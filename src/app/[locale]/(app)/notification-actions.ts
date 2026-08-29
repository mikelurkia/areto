"use server";

import { getCurrentUser } from "@/lib/auth";
import { loadNotificationAlerts, type NotificationItem } from "@/lib/notifications";

export async function fetchNotifications(): Promise<NotificationItem[]> {
  const user = await getCurrentUser();
  // No usa `requireUser()`: esta Server Action solo devuelve datos (no debe
  // redirigir), pero necesita la misma barrera contra una cuenta desactivada
  // cuyo JWT todavía no ha caducado — ver el comentario de `requireUser`.
  if (!user || user.status !== "active") return [];
  return loadNotificationAlerts(user);
}
