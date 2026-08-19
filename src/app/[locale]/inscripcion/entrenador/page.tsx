import { redirect } from "next/navigation";

/** El alta de entrenador/staff se fusionó con la de jugador: un único
 * formulario de equipo decide el rol al aprobar, no al inscribirse. Se
 * mantiene esta ruta como redirección por si quedó algún enlace compartido. */
export default async function InscripcionEntrenadorPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  redirect(`/${locale}/inscripcion/jugador`);
}
