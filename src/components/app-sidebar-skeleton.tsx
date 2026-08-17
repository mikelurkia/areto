import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Fallback del sidebar mientras se resuelve la sesión. Replica la geometría del
 * `AppSidebar` real (cabecera, 8 entradas de menú, chip de usuario) para que el
 * relevo no mueva nada de sitio.
 *
 * Los anchos son fijos a propósito: `SidebarMenuSkeleton` de shadcn los sortea
 * con `Math.random()`, lo que provoca desajustes de hidratación al venir de SSR.
 */
export function AppSidebarSkeleton() {
  return (
    <Sidebar>
      <SidebarHeader>
        {/* La marca es estática: se pinta ya, sin esperar a nada. */}
        <div className="flex items-center gap-2 px-2 py-1.5">
          <div className="flex size-8 items-center justify-center rounded-md bg-primary font-bold text-primary-foreground">
            A
          </div>
          <span className="font-semibold">Areto</span>
        </div>
      </SidebarHeader>
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
      <SidebarRail />
    </Sidebar>
  );
}

/** Un ancho por entrada del menú, imitando etiquetas de largo desigual. */
const NAV_WIDTHS = ["62%", "54%", "70%", "48%", "66%", "78%", "44%", "58%"];
