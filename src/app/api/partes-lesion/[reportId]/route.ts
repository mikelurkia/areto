import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/db";
import { memberships, personInjuryReports } from "@/db/schema";
import { getCurrentUser, hasPermission } from "@/lib/auth";
import { getClubSettings } from "@/lib/club";
import {
  DOCUMENT_TEMPLATES_BUCKET,
  INJURY_REPORT_TEMPLATE_PATH,
  fillInjuryReportPdf,
} from "@/lib/injury-report-pdf";
import { fileExists } from "@/lib/supabase/storage";

/**
 * Descarga del parte de lesión federativo de un parte concreto, ya rellenado
 * sobre la plantilla oficial de la Mutualidad.
 *
 * Es un route handler y no una Server Action porque la respuesta es un binario
 * que el navegador tiene que descargar. Ojo: `/api/*` NO pasa por
 * `src/proxy.ts` (su `matcher` lo excluye), así que la sesión y el permiso se
 * comprueban aquí, igual que hace `/api/storage/[bucket]/[...path]`.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ reportId: string }> },
) {
  const { reportId } = await params;

  const user = await getCurrentUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });
  if (!hasPermission(user, "personas.medical.view")) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const report = await db.query.personInjuryReports.findFirst({
    where: eq(personInjuryReports.id, reportId),
    with: { person: true, team: true },
  });
  if (!report) return new NextResponse("Not found", { status: 404 });

  // Los puestos viven en la ficha del jugador en ese equipo, no en el parte.
  // Sin equipo fijado no hay a qué ficha mirar y la casilla "Puesto" se queda
  // vacía, que es lo honesto: el puesto de hoy no dice el de entonces.
  const membership = report.teamId
    ? await db.query.memberships.findFirst({
        where: and(
          eq(memberships.personId, report.personId),
          eq(memberships.teamId, report.teamId),
        ),
        columns: { positions: true },
      })
    : null;

  const club = await getClubSettings();

  // El fallo esperable es que el club no haya subido todavía la plantilla. Se
  // comprueba antes de generar, en vez de envolver la generación en un `catch`
  // que haría pasar cualquier error real por "falta la plantilla". No hay
  // pantalla de error para una descarga, así que el motivo va en texto plano;
  // quien pulsa el botón llega del formulario, que ya lo avisa antes.
  if (!(await fileExists(DOCUMENT_TEMPLATES_BUCKET, INJURY_REPORT_TEMPLATE_PATH))) {
    return new NextResponse("Falta la plantilla del parte de lesión", { status: 409 });
  }

  const pdf = await fillInjuryReportPdf({
    report,
    person: report.person,
    team: report.team,
    positions: membership?.positions ?? [],
    club,
  });

  const filename = `parte-lesion-${slug(report.person.lastName)}-${report.occurredOn}.pdf`;

  return new NextResponse(pdf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "sandbox",
      // Se genera en cada petición a partir de datos que se están editando:
      // cachearlo mostraría el parte de antes de la última corrección.
      "Cache-Control": "private, no-store",
    },
  });
}

/** Nombre de fichero sin acentos ni espacios, para no depender del cliente. */
function slug(value: string): string {
  return (
    value
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .toLowerCase() || "jugador"
  );
}
