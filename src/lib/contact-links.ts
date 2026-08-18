/** Enlace wa.me a partir de un teléfono (mejor esfuerzo: solo dígitos). */
export function whatsappLink(phone: string, message?: string): string {
  const base = `https://wa.me/${phone.replace(/\D/g, "")}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}

/** Enlace mailto con asunto y cuerpo ya rellenados. */
export function mailtoLink(email: string, subject: string, body: string): string {
  return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
