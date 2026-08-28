"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { useLocale, useTranslations } from "next-intl";
import {
  GlobeIcon,
  LogOutIcon,
  MoonIcon,
  SearchIcon,
  SettingsIcon,
  ShirtIcon,
  SunIcon,
  UsersIcon,
} from "lucide-react";

import { updateLocale } from "@/app/[locale]/(app)/actions";
import {
  searchEntities,
  type SearchResult,
} from "@/app/[locale]/(app)/search-actions";
import { logout } from "@/app/[locale]/(auth)/actions";
import { useNavItems } from "@/components/nav-items";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { useDialogParam } from "@/hooks/use-dialog-param";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";
import type { Permission } from "@/lib/permissions";
import { cn } from "@/lib/utils";

/** Clave de `?dialogo=`: la comparten la paleta y su botón de la cabecera. */
const DIALOG_KEY = "buscar";

/** Igual que en el servidor: por debajo de esto no se consulta nada. */
const MIN_QUERY_LENGTH = 2;

/** Freno antes de consultar, para no lanzar una consulta por tecla. */
const DEBOUNCE_MS = 200;

const localeNames: Record<Locale, string> = { eu: "Euskara", es: "Castellano" };

/** El teclado no cambia mientras la página vive: no hay a qué suscribirse. */
const subscribeToNothing = () => () => {};

/** Últimas fichas abiertas desde la paleta. Por navegador, no por usuario. */
const RECENTS_KEY = "areto:paleta-recientes";
const RECENTS_LIMIT = 5;

/**
 * Se guarda en `localStorage` y no en la base de datos a propósito: es una
 * comodidad de este navegador, no un dato del club. Todo va entre `try`: el
 * usuario puede tener el almacenamiento bloqueado, y perder los recientes no
 * puede tumbar el buscador.
 */
function readRecents(): SearchResult[] {
  try {
    const raw = window.localStorage.getItem(RECENTS_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is SearchResult =>
        typeof item?.id === "string" &&
        typeof item?.label === "string" &&
        typeof item?.href === "string",
    );
  } catch {
    return [];
  }
}

function rememberRecent(result: SearchResult) {
  try {
    const next = [
      result,
      ...readRecents().filter((item) => item.href !== result.href),
    ].slice(0, RECENTS_LIMIT);
    window.localStorage.setItem(RECENTS_KEY, JSON.stringify(next));
  } catch {
    // Sin almacenamiento no hay recientes, y no pasa nada más.
  }
}

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
 * Este componente es solo el envoltorio: mantiene el atajo y el estado de
 * apertura. Lo que se busca y lo encontrado vive en `PaletteBody`, que solo
 * existe mientras el diálogo está abierto y así vuelve a empezar en blanco cada
 * vez, sin tener que limpiarlo a mano.
 */
export function CommandPalette({ permissions }: { permissions: Permission[] }) {
  const t = useTranslations("Command");
  const [open, setOpen] = useDialogParam(DIALOG_KEY);

  // Atajo global, con el mismo montaje que el `Ctrl+B` del sidebar
  // (`components/ui/sidebar.tsx`).
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setOpen(!open);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, setOpen]);

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      title={t("title")}
      description={t("description")}
    >
      {open ? (
        <PaletteBody
          permissions={permissions}
          close={() => setOpen(false)}
        />
      ) : null}
    </CommandDialog>
  );
}

function PaletteBody({
  permissions,
  close,
}: {
  permissions: Permission[];
  close: () => void;
}) {
  const t = useTranslations("Command");
  const tLayout = useTranslations("AppLayout");
  const tSidebar = useTranslations("Sidebar");
  const router = useRouter();
  const pathname = usePathname();
  const locale = useLocale();
  const { setTheme } = useTheme();

  const [query, setQuery] = useState("");
  // Los resultados se guardan junto al texto que los produjo. Así "lo que se ve"
  // y "si se está esperando" se deducen del estado en vez de mantenerse en
  // paralelo: al borrar letras, los resultados de la búsqueda anterior dejan de
  // corresponder y desaparecen solos.
  const [found, setFound] = useState<{ term: string; items: SearchResult[] }>({
    term: "",
    items: [],
  });
  const requestRef = useRef(0);

  // Se leen una sola vez, al abrir: el cuerpo de la paleta se monta de cero
  // cada vez, así que aquí no hace falta ni efecto ni sincronización.
  const [recents] = useState(readRecents);

  const nav = useNavItems(permissions);
  const term = query.trim();
  const searchable = term.length >= MIN_QUERY_LENGTH;
  const results = found.term === term ? found.items : [];
  const loading = searchable && found.term !== term;

  // El contador descarta las respuestas que llegan tarde: sin él, una consulta
  // lenta de hace tres letras podría pisar los resultados de la actual.
  useEffect(() => {
    if (!searchable) return;

    const id = ++requestRef.current;
    const timer = setTimeout(async () => {
      try {
        const items = await searchEntities(term);
        if (id === requestRef.current) setFound({ term, items });
      } catch {
        if (id === requestRef.current) setFound({ term, items: [] });
      }
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [term, searchable]);

  function run(action: () => void) {
    close();
    action();
  }

  /** Abrir una ficha, y dejarla apuntada para la próxima vez. */
  function openResult(result: SearchResult) {
    rememberRecent(result);
    run(() => router.push(result.href));
  }

  const people = results.filter((result) => result.type === "person");
  const teams = results.filter((result) => result.type === "team");

  return (
    <Command>
      <CommandInput
        placeholder={t("placeholder")}
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>{loading ? t("searching") : t("empty")}</CommandEmpty>

        {/* Mientras no se busca nada, lo último abierto: es lo que más se
            repite —volver a la ficha en la que se estaba— y ahorra teclear. */}
        {!searchable && recents.length > 0 ? (
          <CommandGroup heading={t("groupRecent")}>
            {recents.map((recent) => (
              <ResultItem
                key={recent.href}
                result={recent}
                query={query}
                icon={recent.type === "team" ? <ShirtIcon /> : <UsersIcon />}
                onSelect={() => openResult(recent)}
              />
            ))}
          </CommandGroup>
        ) : null}

        {people.length > 0 ? (
          <CommandGroup heading={t("groupPeople")}>
            {people.map((person) => (
              <ResultItem
                key={person.id}
                result={person}
                query={query}
                icon={<UsersIcon />}
                onSelect={() => openResult(person)}
              />
            ))}
          </CommandGroup>
        ) : null}

        {teams.length > 0 ? (
          <CommandGroup heading={t("groupTeams")}>
            {teams.map((team) => (
              <ResultItem
                key={team.id}
                result={team}
                query={query}
                icon={<ShirtIcon />}
                onSelect={() => openResult(team)}
              />
            ))}
          </CommandGroup>
        ) : null}

        <CommandGroup heading={t("groupNavigation")}>
          {nav
            .filter((item) => !item.disabled)
            .map((item) => (
              <CommandItem
                key={item.href}
                value={item.title}
                onSelect={() => run(() => router.push(item.href))}
              >
                <item.icon />
                {item.title}
              </CommandItem>
            ))}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading={t("groupActions")}>
          <CommandItem
            value={tSidebar("settings")}
            onSelect={() => run(() => router.push("/ajustes"))}
          >
            <SettingsIcon />
            {tSidebar("settings")}
          </CommandItem>
          <CommandItem
            value={tLayout("themeLight")}
            onSelect={() => run(() => setTheme("light"))}
          >
            <SunIcon />
            {tLayout("themeLight")}
          </CommandItem>
          <CommandItem
            value={tLayout("themeDark")}
            onSelect={() => run(() => setTheme("dark"))}
          >
            <MoonIcon />
            {tLayout("themeDark")}
          </CommandItem>
          {routing.locales
            .filter((other) => other !== locale)
            .map((other) => (
              <CommandItem
                key={other}
                value={localeNames[other]}
                onSelect={() =>
                  run(() => {
                    // Igual que el selector de la cabecera: se guarda como
                    // preferencia del usuario y se reescribe la misma ruta.
                    void updateLocale(other).then(() =>
                      router.replace(pathname, { locale: other }),
                    );
                  })
                }
              >
                <GlobeIcon />
                {localeNames[other]}
              </CommandItem>
            ))}
          <CommandItem
            value={tSidebar("logout")}
            onSelect={() =>
              run(() => {
                // Salida con recarga completa, como en el sidebar: así no queda
                // montado en memoria el estado del usuario anterior.
                void logout().then(({ redirectTo }) => {
                  window.location.href = redirectTo;
                });
              })
            }
          >
            <LogOutIcon />
            {tSidebar("logout")}
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </Command>
  );
}

/** Una persona o un equipo de los que ha devuelto el servidor. */
function ResultItem({
  result,
  query,
  icon,
  onSelect,
}: {
  result: SearchResult;
  query: string;
  icon: React.ReactNode;
  onSelect: () => void;
}) {
  return (
    <CommandItem
      // `cmdk` vuelve a filtrar en cliente lo que ya filtró el servidor: sin
      // pasarle lo tecleado como palabra clave, un resultado que casó por el
      // DNI y no por el nombre desaparecería de la lista.
      value={`${result.label} ${result.sublabel ?? ""}`}
      keywords={[query]}
      onSelect={onSelect}
    >
      {icon}
      <span className="truncate">{result.label}</span>
      {result.sublabel ? (
        <span className="ml-auto truncate text-xs text-muted-foreground">
          {result.sublabel}
        </span>
      ) : null}
    </CommandItem>
  );
}
