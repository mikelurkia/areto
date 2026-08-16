export const TEAM_GENDERS = ["masculino", "femenino"] as const;

export type TeamGenderValue = (typeof TEAM_GENDERS)[number];
