import "server-only";

import {
  fillInjuryReportTemplate,
  type InjuryReportPdfInput,
} from "@/lib/injury-report-fields";
import { DOCUMENT_TEMPLATES_BUCKET } from "@/lib/club";
import { downloadFile } from "@/lib/supabase/storage";

export { DOCUMENT_TEMPLATES_BUCKET };

/**
 * Dónde vive la plantilla del parte de lesión y cómo llegar a ella.
 *
 * Es un único fichero global, en una ruta fija de un bucket privado: la plantilla
 * no depende de la temporada ni del equipo, y el club la reemplaza desde Ajustes
 * cuando la federación cambia el impreso. La lógica de qué dato va a qué casilla
 * está en `injury-report-fields.ts`.
 */
export const INJURY_REPORT_TEMPLATE_PATH = "parte-lesion/plantilla.pdf";

/** Descarga la plantilla del club y devuelve el parte relleno. */
export async function fillInjuryReportPdf(
  input: InjuryReportPdfInput,
): Promise<Uint8Array<ArrayBuffer>> {
  const template = await downloadFile(DOCUMENT_TEMPLATES_BUCKET, INJURY_REPORT_TEMPLATE_PATH);
  return fillInjuryReportTemplate(await template.arrayBuffer(), input);
}
