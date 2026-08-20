export type PersonForMatching = {
  id: string;
  firstName: string;
  lastName: string;
  nationalId: string | null;
  email: string | null;
};

export function normalizeName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Distancia de edición (inserciones/borrados/sustituciones) entre dos
 * cadenas. Se usa para detectar variantes ortográficas de un mismo nombre
 * (p. ej. "Urkia Kortabarria" / "Urquia Cortabarria") que `normalizeName` no
 * unifica porque no son solo diferencias de acentos o mayúsculas.
 */
export function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  let previousRow = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const currentRow = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      currentRow.push(
        Math.min(
          previousRow[j] + 1, // borrado
          currentRow[j - 1] + 1, // inserción
          previousRow[j - 1] + cost, // sustitución
        ),
      );
    }
    previousRow = currentRow;
  }
  return previousRow[b.length];
}

/** Umbral de distancia tolerado para considerar dos nombres (o apellidos)
 * "parecidos", proporcional a su longitud: cuanto más largos, más erratas
 * de tecleo puede acumular una transcripción sin dejar de ser el mismo texto. */
function fuzzyNameThreshold(length: number): number {
  return Math.min(4, Math.max(1, Math.ceil(length / 6)));
}

/**
 * ¿Son estos dos nombres completos (nombre + apellidos) variantes
 * ortográficas del mismo nombre? Compara nombre y apellidos por separado
 * (en vez de la cadena completa) para poder exigir similitud en cada parte
 * de forma independiente: así "Mikel Urkia Kortabarria" / "Mikel Urquia
 * Cortabarria" (apellidos con erratas, nombre idéntico) puntúa igual de bien
 * que un nombre con la errata y el apellido exacto.
 */
export function isFuzzyNameMatch(
  a: { firstName: string; lastName: string },
  b: { firstName: string; lastName: string },
): boolean {
  const firstA = normalizeName(a.firstName);
  const firstB = normalizeName(b.firstName);
  const lastA = normalizeName(a.lastName);
  const lastB = normalizeName(b.lastName);
  if (firstA === firstB && lastA === lastB) return false; // ya es coincidencia exacta, no "fuzzy"

  const firstDistance = levenshteinDistance(firstA, firstB);
  const lastDistance = levenshteinDistance(lastA, lastB);
  const firstClose = firstDistance <= fuzzyNameThreshold(Math.min(firstA.length, firstB.length));
  const lastClose = lastDistance <= fuzzyNameThreshold(Math.min(lastA.length, lastB.length));

  // Exigimos que AMBAS partes sean iguales o parecidas: si una de las dos es
  // radicalmente distinta (apodos como "Eli"/"Elisabeth", o apellidos que no
  // tienen nada que ver), no basta con esto — hace falta un dato de contacto
  // compartido (ver `isFuzzyLastNameMatch` y `sharedContact` en la página de
  // duplicados).
  return firstClose && lastClose;
}

/**
 * ¿Tienen estas dos personas el apellido parecido, sin mirar el nombre?
 * Por sí sola es una señal débil (dos primos pueden compartir apellido sin
 * ser la misma persona), pero combinada con un teléfono o IBAN compartido
 * detecta el caso de un apodo o nombre corto ("Eli" vs "Elisabeth") que
 * `isFuzzyNameMatch` descarta al exigir también similitud en el nombre.
 */
export function isFuzzyLastNameMatch(
  a: { lastName: string },
  b: { lastName: string },
): boolean {
  const lastA = normalizeName(a.lastName);
  const lastB = normalizeName(b.lastName);
  if (lastA === lastB) return false;
  const distance = levenshteinDistance(lastA, lastB);
  return distance <= fuzzyNameThreshold(Math.min(lastA.length, lastB.length));
}

const MIN_NICKNAME_LENGTH = 3;

/**
 * ¿Es uno de estos nombres un posible diminutivo o forma corta del otro
 * ("Eli" de "Elisabeth", "Fran" de "Francisco")? Solo cubre el caso más
 * simple (uno es prefijo literal del otro) — no detecta diminutivos que no
 * lo son ("Pepe"/"José") — pero basta como corroboración cuando el apellido
 * ya es igual o parecido y el nombre completo es demasiado distinto en
 * longitud para que `isFuzzyNameMatch` lo trate como una simple errata.
 */
export function isNicknameFirstNameMatch(
  a: { firstName: string },
  b: { firstName: string },
): boolean {
  const firstA = normalizeName(a.firstName);
  const firstB = normalizeName(b.firstName);
  if (firstA === firstB) return false;
  if (firstA.length < MIN_NICKNAME_LENGTH || firstB.length < MIN_NICKNAME_LENGTH) return false;
  return firstA.startsWith(firstB) || firstB.startsWith(firstA);
}

/**
 * Busca en `pool` quién podría ser la misma persona que `target`. DNI y email
 * identifican de forma fuerte a un individuo: si alguno coincide, no hace
 * falta (ni conviene) caer también en el emparejamiento débil por nombre.
 */
export function findCandidates<T extends PersonForMatching>(
  target: { firstName: string; lastName: string; nationalId: string | null; email: string | null },
  pool: T[],
): T[] {
  const strongMatches = new Map<string, T>();
  if (target.nationalId) {
    for (const p of pool) {
      if (p.nationalId && p.nationalId.trim().toUpperCase() === target.nationalId.trim().toUpperCase()) {
        strongMatches.set(p.id, p);
      }
    }
  }
  if (target.email) {
    for (const p of pool) {
      if (p.email && p.email.trim().toLowerCase() === target.email.trim().toLowerCase()) {
        strongMatches.set(p.id, p);
      }
    }
  }
  if (strongMatches.size > 0) return [...strongMatches.values()];

  const nameKey = normalizeName(`${target.firstName} ${target.lastName}`);
  return pool.filter((p) => normalizeName(`${p.firstName} ${p.lastName}`) === nameKey);
}
