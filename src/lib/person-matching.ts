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
