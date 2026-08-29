/**
 * Catálogo de permisos de la aplicación.
 *
 * Vive en código y no en la base de datos a propósito: un permiso solo significa
 * algo si existe un `requirePermission()` que lo comprueba. Si el catálogo fuera
 * editable desde la interfaz se podrían inventar permisos que no hacen nada y
 * borrar permisos que el código sigue exigiendo. La base de datos guarda solo
 * las asignaciones rol → permiso (`role_permissions`), como texto libre; lo que
 * no esté en esta lista se descarta al leerlo (ver `getCurrentUser`).
 *
 * AÑADIR un permiso: basta con meterlo aquí y en `PERMISSION_MODULES`, más su
 * traducción en `messages/*.json` (`Administracion.permissions.<clave>`). No
 * hace falta migración.
 *
 * RENOMBRAR un permiso NO es gratis: las filas de `role_permissions` con la
 * clave vieja se ignorarían en silencio y los roles perderían ese acceso sin
 * avisar. Hace falta una migración `update role_permissions set permission = …`.
 *
 * Este fichero NO lleva `server-only`: el sidebar y los diálogos lo importan
 * para decidir qué pintan.
 */

export const PERMISSIONS = [
  // Personas
  "personas.view",
  "personas.manage",
  "personas.medical.view",
  "personas.medical.manage",
  "personas.banking.view",
  "personas.banking.manage",
  // Socios
  "socios.view",
  "socios.manage",
  // Inscripciones
  "inscripciones.view",
  "inscripciones.manage",
  // Equipos
  "equipos.view",
  "equipos.manage",
  "equipos.acta",
  // Temporadas
  "temporadas.view",
  "temporadas.manage",
  // Calendario (peticiones de cancha)
  "calendario.view",
  "calendario.manage",
  "calendario.manage.all",
  // Patrocinadores
  "patrocinadores.view",
  "patrocinadores.manage",
  // Club
  "club.view",
  "club.manage",
  // Administración de la propia aplicación
  "usuarios.manage",
  "roles.manage",
  "administracion.audit.view",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const PERMISSION_SET: ReadonlySet<string> = new Set(PERMISSIONS);

/** ¿Es `value` una clave del catálogo actual? Filtra asignaciones huérfanas. */
export function isPermission(value: string): value is Permission {
  return PERMISSION_SET.has(value);
}

/**
 * Clave de traducción de un permiso.
 *
 * next-intl usa el punto como separador de anidamiento, así que no admite
 * claves que lo lleven dentro: `Administracion.permissions.personas.view` se
 * leería como cuatro niveles. Y anidarlas de verdad tampoco vale, porque
 * `calendario.manage` y `calendario.manage.all` obligarían a que `manage` fuese
 * a la vez texto y objeto. Se aplanan con guion bajo: `personas_view`.
 */
export function permissionKey(permission: Permission): string {
  return permission.split(".").join("_");
}

/** Clave de módulo, usada para agrupar la matriz y para las traducciones. */
export type PermissionModuleKey =
  | "personas"
  | "socios"
  | "inscripciones"
  | "equipos"
  | "temporadas"
  | "calendario"
  | "patrocinadores"
  | "club"
  | "administracion";

/**
 * Agrupación de los permisos por módulo, en el orden en que se muestran en la
 * matriz de un rol. Cada permiso aparece exactamente una vez (lo comprueba
 * `permissions.test`… bueno, no hay tests: lo comprueba `ALL_MODULE_PERMISSIONS`
 * más abajo, que se usa desde la propia matriz).
 */
export const PERMISSION_MODULES: readonly {
  key: PermissionModuleKey;
  permissions: readonly Permission[];
}[] = [
  {
    key: "personas",
    permissions: [
      "personas.view",
      "personas.manage",
      "personas.medical.view",
      "personas.medical.manage",
      "personas.banking.view",
      "personas.banking.manage",
    ],
  },
  { key: "socios", permissions: ["socios.view", "socios.manage"] },
  {
    key: "inscripciones",
    permissions: ["inscripciones.view", "inscripciones.manage"],
  },
  {
    key: "equipos",
    permissions: ["equipos.view", "equipos.manage", "equipos.acta"],
  },
  { key: "temporadas", permissions: ["temporadas.view", "temporadas.manage"] },
  {
    key: "calendario",
    permissions: ["calendario.view", "calendario.manage", "calendario.manage.all"],
  },
  {
    key: "patrocinadores",
    permissions: ["patrocinadores.view", "patrocinadores.manage"],
  },
  { key: "club", permissions: ["club.view", "club.manage"] },
  {
    key: "administracion",
    permissions: ["usuarios.manage", "roles.manage", "administracion.audit.view"],
  },
];

/** Claves de los seis roles sembrados de fábrica. */
export const SYSTEM_ROLE_KEYS = [
  "admin",
  "staff",
  "coach",
  "player",
  "member",
  "basic",
] as const;
export type SystemRoleKey = (typeof SYSTEM_ROLE_KEYS)[number];

export function isSystemRoleKey(value: string): value is SystemRoleKey {
  return (SYSTEM_ROLE_KEYS as readonly string[]).includes(value);
}

/**
 * Permisos que el rol `admin` no puede perder nunca: quien administra la
 * aplicación tiene que poder seguir administrándola. La matriz los pinta
 * marcados y deshabilitados, y la Server Action los vuelve a comprobar.
 */
export const ADMIN_LOCKED_PERMISSIONS: readonly Permission[] = [
  "usuarios.manage",
  "roles.manage",
];

/**
 * Matriz de fábrica de los seis roles de sistema. La usa `db:seed` para que
 * una base de datos de desarrollo nueva arranque usable.
 *
 * OJO: la migración que siembra estos roles en `drizzle/` lleva una COPIA
 * literal de esta tabla. Es duplicación deliberada — una migración que dependa
 * del código de hoy deja de ser reproducible mañana. No intentes unificarlas.
 *
 * `basic` conserva `equipos.view` y `temporadas.view` porque antes de existir
 * los permisos esas dos páginas solo llamaban a `requireUser()` y las veía todo
 * el mundo: es el suelo, y ninguna cuenta debe perder acceso al pasar a él.
 * `member` (Socio) añade el calendario, que es lo que distingue a un socio del
 * club de una cuenta recién creada. `staff` no administra usuarios ni roles.
 */
export const SYSTEM_ROLE_PERMISSIONS: Record<SystemRoleKey, readonly Permission[]> = {
  admin: [...PERMISSIONS],
  staff: PERMISSIONS.filter(
    (p) => p !== "usuarios.manage" && p !== "roles.manage",
  ),
  coach: [
    "equipos.view",
    "equipos.acta",
    "temporadas.view",
    "calendario.view",
    "calendario.manage",
  ],
  player: ["equipos.view", "temporadas.view", "calendario.view"],
  member: ["equipos.view", "temporadas.view", "calendario.view"],
  basic: ["equipos.view", "temporadas.view"],
};

/** Nombre y orden de fábrica de los roles de sistema (el nombre visible se traduce por `key`). */
export const SYSTEM_ROLES: readonly {
  key: SystemRoleKey;
  name: string;
  description: string;
  sortOrder: number;
  isDefault: boolean;
}[] = [
  {
    key: "admin",
    name: "Administratzailea",
    description: "Klubaren kudeaketa osoa, erabiltzaileak eta rolak barne.",
    sortOrder: 10,
    isDefault: false,
  },
  {
    key: "staff",
    name: "Idazkaritza",
    description: "Idazkaritza eta diruzaintza: pertsonak, bazkideak, izen-emateak eta ekonomia.",
    sortOrder: 20,
    isDefault: false,
  },
  {
    key: "coach",
    name: "Entrenatzailea",
    description: "Bere taldeak: plantilla ikusi, akta eta kantxa-eskaerak.",
    sortOrder: 30,
    isDefault: false,
  },
  {
    key: "player",
    name: "Jokalaria",
    description: "Bere taldea, denboraldiak eta egutegia ikusi.",
    sortOrder: 35,
    isDefault: false,
  },
  {
    key: "member",
    name: "Bazkidea",
    description: "Klubeko bazkidea: taldeak, denboraldiak eta egutegia ikusi.",
    sortOrder: 40,
    isDefault: false,
  },
  {
    key: "basic",
    name: "Oinarrizko sarbidea",
    description: "Kontu berri baten abiapuntua: taldeak eta denboraldiak ikusi.",
    sortOrder: 50,
    isDefault: true,
  },
];
