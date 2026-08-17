import {
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Fallback del cuerpo del sidebar mientras se resuelve la sesión. Replica la
 * geometría del `AppSidebarBody` real (8 entradas de menú y chip de usuario)
 * para que el relevo no mueva nada de sitio.
 *
 * No incluye el marco (`Sidebar`, cabecera, rail): ese lo pinta `AppSidebar`
 * fuera del <Suspense>, porque decide entre móvil y escritorio con un valor que
 * solo existe en cliente y tiene que hidratar junto al `SidebarProvider`.
 *
 * Los anchos son fijos a propósito: `SidebarMenuSkeleton` de shadcn los sortea
 * con `Math.random()`, lo que provoca desajustes de hidratación al venir de SSR.
 */
export function AppSidebarBodySkeleton() {
  return (
    <>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>
            <Skeleton className="h-3 w-20" />
          </SidebarGroupLabel>
          <SidebarMenu>
            {NAV_WIDTHS.map((width, index) => (
              <SidebarMenuItem key={index}>
                <div className="flex h-8 items-center gap-2 rounded-md px-2">
                  <Skeleton className="size-4 shrink-0 rounded-md" />
                  <Skeleton className="h-4" style={{ width }} />
                </div>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <div className="flex h-12 items-center gap-2 px-2">
              <Skeleton className="size-8 shrink-0 rounded-lg" />
              <div className="flex flex-1 flex-col gap-1.5">
                <Skeleton className="h-3.5 w-32" />
                <Skeleton className="h-3 w-16" />
              </div>
            </div>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </>
  );
}

/** Un ancho por entrada del menú, imitando etiquetas de largo desigual. */
const NAV_WIDTHS = ["62%", "54%", "70%", "48%", "66%", "78%", "44%", "58%"];
