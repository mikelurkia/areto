import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["eu", "es"],
  defaultLocale: "eu",
});

export type Locale = (typeof routing.locales)[number];
