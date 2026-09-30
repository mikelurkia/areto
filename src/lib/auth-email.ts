import "server-only";

import nodemailer from "nodemailer";

import { getSiteUrl } from "@/lib/site-url";

/**
 * Correo de autenticación (invitaciones, recuperación de contraseña y cambio de
 * correo), por SMTP y solo si está configurado. Sin SMTP la aplicación funciona
 * igual: los enlaces los copia un administrador desde /administracion/usuarios.
 */
const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM } = process.env;

export const isSmtpConfigured = Boolean(
  SMTP_HOST && SMTP_PORT && SMTP_USER && SMTP_PASS && SMTP_FROM,
);

export type AuthEmailKind = "invite" | "recovery" | "changeEmail";

/**
 * Textos de cada correo, en euskera y castellano a la vez: se envía antes de
 * saber en qué idioma usa la aplicación quien lo recibe. Portados de las
 * plantillas que tenía Supabase Auth (`supabase/email-templates/`).
 */
const COPY: Record<
  AuthEmailKind,
  {
    subject: string;
    euTitle: string;
    euBody: string;
    esTitle: string;
    esBody: string;
    button: string;
    footer: string;
  }
> = {
  invite: {
    subject: "Aretora sartzeko gonbidapena · Invitación para entrar en Areto",
    euTitle: "Ongi etorri Aretora",
    euBody:
      "Klubak <strong>{email}</strong> helbidea gonbidatu du kluba kudeatzeko aplikaziora. Sakatu botoia zure pasahitza jarri eta sartzeko.",
    esTitle: "Te damos la bienvenida a Areto",
    esBody:
      "El club ha invitado a <strong>{email}</strong> a la aplicación de gestión. Pulsa el botón de arriba para poner tu contraseña y entrar.",
    button: "Pasahitza jarri · Poner mi contraseña",
    footer:
      "Esteka honek iraungitze-data du. Ez baduzu zuk eskatu, ez egin ezer.<br>Este enlace caduca. Si no esperabas esta invitación, ignora el mensaje.",
  },
  recovery: {
    subject: "Pasahitza berrezarri · Restablecer tu contraseña de Areto",
    euTitle: "Pasahitza berrezarri",
    euBody:
      "<strong>{email}</strong> kontuaren pasahitza berrezartzeko eskaera jaso dugu. Sakatu botoia pasahitz berri bat jartzeko.",
    esTitle: "Restablecer tu contraseña",
    esBody:
      "Hemos recibido una petición para restablecer la contraseña de <strong>{email}</strong>. Pulsa el botón de arriba para poner una nueva.",
    button: "Pasahitz berria jarri · Poner una contraseña nueva",
    footer:
      "Ez baduzu zuk eskatu, ez egin ezer: zure pasahitzak berdin jarraituko du.<br>Si no lo has pedido tú, ignora este mensaje: tu contraseña seguirá igual.",
  },
  changeEmail: {
    subject: "Helbide berria egiaztatu · Confirma tu nuevo correo en Areto",
    euTitle: "Helbide berria egiaztatu",
    euBody:
      "Sakatu botoia <strong>{email}</strong> zure Aretoko helbide berria dela egiaztatzeko.",
    esTitle: "Confirma tu nuevo correo",
    esBody:
      "Pulsa el botón de arriba para confirmar <strong>{email}</strong> como tu nuevo correo en Areto.",
    button: "Egiaztatu · Confirmar",
    footer:
      "Esteka honek iraungitze-data du. Ez baduzu zuk eskatu, ez egin ezer.<br>Este enlace caduca. Si no lo has pedido tú, ignora el mensaje.",
  },
};

const FONT =
  "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;";

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function renderEmail(kind: AuthEmailKind, email: string, url: string) {
  const c = COPY[kind];
  const fill = (text: string) => text.replaceAll("{email}", escapeHtml(email));
  const href = escapeHtml(url);

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#eff2f6;margin:0;padding:24px 12px;">
  <tr><td align="center">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background-color:#ffffff;border:1px solid #dadee3;border-radius:12px;">
      <tr><td style="padding:28px 32px 0 32px;" align="center">
        <img src="${getSiteUrl()}/logo.png" width="44" height="44" alt="" style="display:block;border:0;outline:none;">
        <div style="${FONT}font-size:19px;font-weight:600;color:#12161c;padding-top:10px;">Areto</div>
        <div style="${FONT}font-size:12px;color:#585e66;padding-top:3px;">Aloña Mendi · Areto Futbol Saila</div>
      </td></tr>
      <tr><td style="padding:28px 32px 0 32px;${FONT}">
        <h1 style="margin:0 0 10px 0;font-size:20px;line-height:1.3;font-weight:600;color:#12161c;">${c.euTitle}</h1>
        <p style="margin:0;font-size:15px;line-height:1.6;color:#12161c;">${fill(c.euBody)}</p>
      </td></tr>
      <tr><td style="padding:24px 32px;" align="center">
        <a href="${href}" style="display:inline-block;padding:13px 30px;${FONT}font-size:15px;font-weight:600;line-height:1;color:#ffffff;background-color:#026fd7;text-decoration:none;border-radius:8px;">${c.button}</a>
      </td></tr>
      <tr><td style="padding:0 32px;"><div style="height:1px;background-color:#dadee3;line-height:1px;font-size:0;">&nbsp;</div></td></tr>
      <tr><td style="padding:20px 32px 0 32px;${FONT}">
        <h2 style="margin:0 0 8px 0;font-size:15px;line-height:1.3;font-weight:600;color:#12161c;">${c.esTitle}</h2>
        <p style="margin:0;font-size:14px;line-height:1.6;color:#585e66;">${fill(c.esBody)}</p>
      </td></tr>
      <tr><td style="padding:24px 32px 28px 32px;${FONT}">
        <div style="background-color:#eff2f6;border-radius:8px;padding:14px 16px;">
          <p style="margin:0 0 6px 0;font-size:12px;line-height:1.5;color:#585e66;">Botoiak funtzionatzen ez badu, kopiatu esteka hau nabigatzailera · Si el botón no funciona, copia este enlace en el navegador:</p>
          <a href="${href}" style="font-size:12px;line-height:1.5;color:#026fd7;word-break:break-all;">${href}</a>
        </div>
        <p style="margin:16px 0 0 0;font-size:12px;line-height:1.5;color:#585e66;text-align:center;">${c.footer}</p>
      </td></tr>
    </table>
  </td></tr>
</table>`;
}

/**
 * Envía el correo si hay SMTP. Devuelve si se ha enviado; un fallo del servidor
 * de correo se registra y cuenta como no enviado, para que quien invita pueda
 * seguir copiando el enlace a mano.
 */
export async function sendAuthEmail(
  kind: AuthEmailKind,
  to: string,
  url: string,
): Promise<boolean> {
  if (!isSmtpConfigured) return false;

  const port = Number(SMTP_PORT);
  const transport = nodemailer.createTransport({
    host: SMTP_HOST,
    port,
    secure: port === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });

  try {
    await transport.sendMail({
      from: SMTP_FROM,
      to,
      subject: COPY[kind].subject,
      html: renderEmail(kind, to, url),
      text: `${COPY[kind].subject}\n\n${url}`,
    });
    return true;
  } catch (error) {
    console.error("[auth-email] SMTP:", error);
    return false;
  }
}
