/** Enlace wa.me a partir de un teléfono (mejor esfuerzo: solo dígitos). */
export function whatsappLink(phone: string, message?: string): string {
  const base = `https://wa.me/${phone.replace(/\D/g, "")}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}

/** Enlace mailto con asunto y cuerpo ya rellenados. */
export function mailtoLink(email: string, subject: string, body: string): string {
  return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

/** Enlace mailto en bloque: destinatarios en copia oculta (BCC), mismo asunto
 * y cuerpo para todos — no hay forma de personalizar por destinatario en un
 * único `mailto:`. */
export function mailtoBccLink(emails: string[], subject: string, body: string): string {
  return `mailto:?bcc=${encodeURIComponent(emails.join(","))}&subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
