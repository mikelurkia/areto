export const TEAM_CATEGORIES = [
  "escuela",
  "infantil",
  "cadete",
  "juvenil",
  "senior",
] as const;

export type TeamCategoryValue = (typeof TEAM_CATEGORIES)[number];
