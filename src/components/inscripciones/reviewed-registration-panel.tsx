import { MailIcon, MessageCircleIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { mailtoLink, whatsappLink } from "@/lib/contact-links";
import { formatDateTime } from "@/lib/format-date";
import { Link } from "@/i18n/navigation";
import { DeleteRegistrationDialog } from "@/components/inscripciones/delete-registration-dialog";
import { ReopenRegistrationButton } from "@/components/inscripciones/reopen-registration-button";
import { Button } from "@/components/ui/button";

type Props = {
  registrationId: string;
  kind: "player" | "member";
  status: "approved" | "rejected";
  reviewer: { fullName: string | null; email: string } | null;
  reviewedAt: Date | null;
  rejectionReason: string | null;
  phone: string | null;
  email: string | null;
  fullName: string;
  locale: string;
  matchedPerson: { id: string; firstName: string; lastName: string } | null;
  /** Ruta del propio detalle (`/inscripciones/{id}` o `/socios/{id}`), para el
   * `from`/`fromLabel` del enlace a la persona resultante. */
  backHref: string;
  canManage: boolean;
};

/**
 * Bloque de solo lectura de una solicitud ya revisada (aprobada o
 * rechazada), compartido entre `/inscripciones/[id]` y `/socios/[id]` — antes
 * duplicado byte a byte salvo por las claves de mensaje según `kind`. Incluye
 * los botones para reabrir o borrar una rechazada.
 */
export async function ReviewedRegistrationPanel({
  registrationId,
  kind,
  status,
  reviewer,
  reviewedAt,
  rejectionReason,
  phone,
  email,
  fullName,
  locale,
  matchedPerson,
  backHref,
  canManage,
}: Props) {
  const t = await getTranslations("Inscripciones");
  const messageKey =
    `notify${status === "approved" ? "Approved" : "Rejected"}${kind === "player" ? "Player" : "Member"}Message` as "notifyApprovedPlayerMessage";
  const notifyMessage = t(messageKey, { name: fullName, reason: rejectionReason ?? "" });

  return (
    <div className="flex flex-col gap-2 rounded-lg border p-4 text-sm">
      {reviewer ? (
        <p>
          {t("reviewedBy", {
            name: reviewer.fullName ?? reviewer.email,
            date: reviewedAt ? formatDateTime(reviewedAt, locale) : "",
          })}
        </p>
      ) : null}
      {matchedPerson ? (
        <p>
          {t("matchedPersonLabel")}{" "}
          <Link
            href={`/personas/${matchedPerson.id}?from=${encodeURIComponent(backHref)}&fromLabel=${encodeURIComponent(fullName)}`}
            className="text-primary hover:underline"
          >
            {matchedPerson.firstName} {matchedPerson.lastName}
          </Link>
        </p>
      ) : null}
      {status === "rejected" && rejectionReason ? (
        <p className="text-muted-foreground">
          {t("rejectionReasonLabel")}: {rejectionReason}
        </p>
      ) : null}
      <div className="flex items-center gap-1 pt-1">
        <span className="text-muted-foreground">{t("notifyLabel")}</span>
        {phone ? (
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-muted-foreground"
            render={<a href={whatsappLink(phone, notifyMessage)} target="_blank" rel="noreferrer" />}
            nativeButton={false}
            title={t("notifyWhatsappAction")}
            aria-label={t("notifyWhatsappAction")}
          >
            <MessageCircleIcon />
          </Button>
        ) : null}
        {email ? (
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-muted-foreground"
            render={<a href={mailtoLink(email, t("notifyEmailSubject"), notifyMessage)} />}
            nativeButton={false}
            title={t("notifyEmailAction")}
            aria-label={t("notifyEmailAction")}
          >
            <MailIcon />
          </Button>
        ) : null}
      </div>
      {status === "rejected" && canManage ? (
        <div className="flex items-center gap-2 pt-2">
          <ReopenRegistrationButton registrationId={registrationId} />
          <DeleteRegistrationDialog
            registrationId={registrationId}
            fullName={fullName}
            redirectTo={kind === "member" ? "/socios" : "/inscripciones"}
          />
        </div>
      ) : null}
    </div>
  );
}
