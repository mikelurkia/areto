import { NextIntlClientProvider } from "next-intl";

/** Página íntegramente en servidor: ningún componente cliente traduce nada. */
export default async function AuthCodeErrorLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return (
    <NextIntlClientProvider locale={locale} messages={{}}>
      {children}
    </NextIntlClientProvider>
  );
}
