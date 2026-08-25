/**
 * Valida un código postal español: cinco dígitos cuyos dos primeros son el
 * código de provincia (01-52).
 *
 * Mismo criterio permisivo que `isValidNationalId`: si el valor no tiene forma
 * de CP español (una dirección extranjera, p. ej. "SW1A 1AA") no lo rechaza,
 * solo comprueba el rango de provincia cuando ya se ve que se quiso escribir
 * uno de aquí. Así se cazan las erratas de tecleo — "25060" en vez de
 * "20560" pasa, pero "75560" o "2056" no — sin bloquear a nadie.
 */
export function isValidPostalCode(raw: string): boolean {
  const value = raw.trim();
  if (!/^\d+$/.test(value)) return true;
  if (value.length !== 5) return false;
  const province = Number(value.slice(0, 2));
  return province >= 1 && province <= 52;
}

/**
 * Provincias españolas indexadas por los dos primeros dígitos del código
 * postal, que *son* el código de provincia del INE.
 *
 * Existe para no guardar la provincia como un campo aparte: es un dato
 * redundante con el CP que habría que teclear en cada ficha y que se quedaría
 * desincronizado en cuanto alguien corrigiese uno de los dos. El parte de
 * lesión federativo pide provincia y localidad por separado, y así solo hay una
 * fuente de verdad.
 */
const PROVINCES: Record<string, string> = {
  "01": "Álava",
  "02": "Albacete",
  "03": "Alicante",
  "04": "Almería",
  "05": "Ávila",
  "06": "Badajoz",
  "07": "Illes Balears",
  "08": "Barcelona",
  "09": "Burgos",
  "10": "Cáceres",
  "11": "Cádiz",
  "12": "Castellón",
  "13": "Ciudad Real",
  "14": "Córdoba",
  "15": "A Coruña",
  "16": "Cuenca",
  "17": "Girona",
  "18": "Granada",
  "19": "Guadalajara",
  "20": "Gipuzkoa",
  "21": "Huelva",
  "22": "Huesca",
  "23": "Jaén",
  "24": "León",
  "25": "Lleida",
  "26": "La Rioja",
  "27": "Lugo",
  "28": "Madrid",
  "29": "Málaga",
  "30": "Murcia",
  "31": "Navarra",
  "32": "Ourense",
  "33": "Asturias",
  "34": "Palencia",
  "35": "Las Palmas",
  "36": "Pontevedra",
  "37": "Salamanca",
  "38": "Santa Cruz de Tenerife",
  "39": "Cantabria",
  "40": "Segovia",
  "41": "Sevilla",
  "42": "Soria",
  "43": "Tarragona",
  "44": "Teruel",
  "45": "Toledo",
  "46": "Valencia",
  "47": "Valladolid",
  "48": "Bizkaia",
  "49": "Zamora",
  "50": "Zaragoza",
  "51": "Ceuta",
  "52": "Melilla",
};

/**
 * Provincia deducida de un código postal español, o `null` si el valor no lo
 * permite (vacío, extranjero o con un prefijo que no es de ninguna provincia).
 */
export function provinceFromPostalCode(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const value = raw.trim();
  if (!/^\d{5}$/.test(value)) return null;
  return PROVINCES[value.slice(0, 2)] ?? null;
}
