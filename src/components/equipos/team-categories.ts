export const TEAM_CATEGORIES = [
  "escuela",
  "infantil",
  "cadete",
  "juvenil",
  "senior",
] as const;

export type TeamCategoryValue = (typeof TEAM_CATEGORIES)[number];

const MEDICAL_CHECKUP_MIN_CATEGORY_INDEX = TEAM_CATEGORIES.indexOf("cadete");

/**
 * Cadete y superior (cadete, juvenil, senior) compiten en federado y
 * necesitan reconocimiento médico vigente; escuela e infantil no. Sin
 * categoría asignada se exige por defecto: es preferible un aviso de más que
 * perder de vista a alguien que sí lo necesita.
 */
export function categoryRequiresMedicalCheckup(category: TeamCategoryValue | null): boolean {
  if (category === null) return true;
  return TEAM_CATEGORIES.indexOf(category) >= MEDICAL_CHECKUP_MIN_CATEGORY_INDEX;
}
