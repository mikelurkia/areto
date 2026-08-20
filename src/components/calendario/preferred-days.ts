export const PREFERRED_DAYS = ["saturday", "sunday", "either"] as const;

export type PreferredDayValue = (typeof PREFERRED_DAYS)[number];
