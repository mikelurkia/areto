"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { SearchIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useDialogParam } from "@/hooks/use-dialog-param";
import type { Permission } from "@/lib/permissions";
import { cn } from "@/lib/utils";

/**
 * El cuerpo de la paleta, con `cmdk` dentro, fuera del bundle inicial.
 *
 * `cmdk` son ~15-20 KB gz que hasta ahora viajaban en toda ruta de la
 * aplicación por una importación estática desde `(app)/layout.tsx`, para un
 * diálogo que la mayoría de las cargas no llega a abrir. `ssr: false` porque
 * la paleta no pinta nada hasta que alguien pulsa ⌘K.
 */
const CommandPaletteDialog = dynamic(
  () => import("@/components/command-palette-dialog"),
  { ssr: false },
);

/** Clave de `?dialogo=`: la comparten la paleta y su botón de la cabecera. */
const DIALOG_KEY = "buscar";

/** El teclado no cambia mientras la página vive: no hay a qué suscribirse. */
const subscribeToNothing = () => () => {};

/**
 * Botón de la cabecera que abre la paleta.
 *
 * No comparte estado con `CommandPalette` por props ni por contexto: los dos
 * leen y escriben el mismo `?dialogo=buscar`, así que pueden vivir en ramas
 * distintas del árbol —la cabecera es síncrona; la paleta cuelga del
 * <Suspense> de la sesión, que es quien conoce los permisos—.
 */
export function CommandPaletteTrigger() {
  const t = useTranslations("Command");
  const [, setOpen] = useDialogParam(DIALOG_KEY);

  return (
    <Button
      variant="outline"
      size="sm"
      className="gap-2 font-normal text-muted-foreground"
      onClick={() => setOpen(true)}
    >
      <SearchIcon className="size-4" />
      <span className="hidden sm:inline">{t("trigger")}</span>
      <ShortcutHint className="hidden sm:inline-block" />
    </Button>
  );
}

/**
 * `⌘K` en Mac y `Ctrl K` en el resto.
 *
 * En el servidor no se sabe qué teclado hay al otro lado, así que se pinta la
 * versión de PC y el cliente la corrige: `useSyncExternalStore` con dos
 * instantáneas distintas es la forma de hacerlo sin romper la hidratación.
 */
function ShortcutHint({ className }: { className?: string }) {
  const isMac = useSyncExternalStore(
    subscribeToNothing,
    () => /mac/i.test(navigator.userAgent),
    () => false,
  );

  return (
    <kbd
      className={cn(
        "pointer-events-none rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px] leading-none",
        className,
      )}
    >
      {isMac ? "⌘K" : "Ctrl K"}
    </kbd>
  );
}

/**
 * Paleta de comandos global (⌘/Ctrl+K).
 *
 * Este componente es solo el envoltorio ligero: mantiene el atajo y el estado
 * de apertura, y no arrastra `cmdk`. Lo que se busca y lo encontrado vive en
 * `CommandPaletteDialog`, que se descarga la primera vez que se abre.
 *
 * `everOpened` es lo que evita que se descargue de nuevo —y que se pierda la
 * animación de cierre— al cerrar: una vez traído, el diálogo se queda montado
 * y solo cambia su `open`.
 */
export function CommandPalette({ permissions }: { permissions: Permission[] }) {
  const [open, setOpen] = useDialogParam(DIALOG_KEY);
  const [everOpened, setEverOpened] = useState(open);

  // Atajo global, con el mismo montaje que el `Ctrl+B` del sidebar
  // (`components/ui/sidebar.tsx`).
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key?.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setOpen(!open);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, setOpen]);

  // Ajuste durante el render, no en un efecto: `open` puede volverse cierto
  // desde el botón de la cabecera, que vive en otra rama del árbol y solo
  // comparte el `?dialogo=`.
  if (open && !everOpened) setEverOpened(true);
  if (!everOpened) return null;

  return (
    <CommandPaletteDialog
      permissions={permissions}
      open={open}
      onOpenChange={setOpen}
    />
  );
}
