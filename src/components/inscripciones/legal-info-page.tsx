import { LocaleSwitcher } from "@/components/locale-switcher";

/**
 * Página pública de texto legal (SEPA, imagen, privacidad, condiciones...),
 * enlazada desde el formulario de inscripción con un "leer texto completo".
 * Se abre siempre en pestaña nueva (`target="_blank"`), así que no lleva
 * botón de "volver": esa pestaña no tiene historial al que volver, y un link
 * a "/inscripcion/jugador" cargaría un formulario vacío, no el que se estaba
 * rellenando en la pestaña de origen. Cerrar la pestaña es lo correcto.
 */
export function LegalInfoPage({ title, body }: { title: string; body: string }) {
  const paragraphs = body.split("\n\n");

  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b">
        <div className="mx-auto flex h-16 w-full max-w-2xl items-center justify-end px-6">
          <LocaleSwitcher />
        </div>
      </header>

      <div className="mx-auto w-full max-w-2xl px-6 py-10">
        <h1 className="mb-6 text-2xl font-semibold tracking-tight">{title}</h1>
        <div className="flex flex-col gap-4">
          {paragraphs.map((paragraph, i) => (
            <p key={i} className="text-sm text-muted-foreground">
              {paragraph}
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}
