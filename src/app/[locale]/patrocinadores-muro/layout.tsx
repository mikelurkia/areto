import { NextIntlClientProvider } from "next-intl";

import { loadMessages } from "@/i18n/request";
import { pickMessages } from "@/i18n/pick-messages";

const NAMESPACES = ["AppLayout"];

export default async function PatrocinadoresMuroLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const messages = pickMessages(await loadMessages(locale), NAMESPACES);
  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      {children}
    </NextIntlClientProvider>
  );
}
