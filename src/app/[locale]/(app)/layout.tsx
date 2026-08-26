import { Suspense } from "react";

import { AppHeader } from "@/components/app-header";
import { AppSidebar, AppSidebarBody } from "@/components/app-sidebar";
import { AppSidebarBodySkeleton } from "@/components/app-sidebar-skeleton";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { hasPermission, requireUser } from "@/lib/auth";
import { getFederationAccounts } from "@/lib/club";

/**
 * Sesión y accesos federativos del sidebar, aislados en su propio <Suspense>.
 *
 * Antes el layout los esperaba con `await` en su cuerpo, y eso bloqueaba la
 * navegación completa: según la documentación de `layout.js` ("Interaction with
 * loading.js"), sin Cache Components el acceso a datos de runtime en el layout
 * impide que se muestre cualquier `loading.tsx` de las rutas hijas. Con el
 * `await` aquí dentro, el marco de la app pinta al instante y el contenido de la
 * página se renderiza en paralelo con la comprobación de sesión.
 *
 * Esto no relaja la autorización: cada página protegida llama a
 * `requirePermission`/`requireUser` por su cuenta antes de consultar datos, y
 * `src/proxy.ts` corta las rutas privadas antes de llegar al layout.
 */
async function AppSidebarBodyWithSession() {
  const user = await requireUser();
  const federations = hasPermission(user, "club.view")
    ? (await getFederationAccounts()).map((f) => ({
        id: f.id,
        name: f.name,
        url: f.url,
      }))
    : [];

  return (
    <AppSidebarBody
      user={{
        email: user.email,
        fullName: user.fullName,
        roles: user.assignedRoles.map((r) => ({ key: r.key, name: r.name })),
        permissions: [...user.permissions],
      }}
      federations={federations}
    />
  );
}

/**
 * Layout sincrónico a propósito: no debe hacer ningún `await`. Todo lo que
 * necesite datos de runtime va dentro de un <Suspense>.
 */
export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider>
      {/*
        El marco del sidebar queda fuera del <Suspense> a propósito: elige entre
        móvil y escritorio con un valor que solo existe en cliente, así que tiene
        que hidratar en la misma pasada que `SidebarProvider`, que es quien lo
        publica. Dentro del boundary va solo lo que depende de la sesión.
      */}
      <AppSidebar>
        <Suspense fallback={<AppSidebarBodySkeleton />}>
          <AppSidebarBodyWithSession />
        </Suspense>
      </AppSidebar>
      <SidebarInset>
        <AppHeader />
        <main className="flex flex-1 flex-col gap-4 p-4 md:p-6">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
