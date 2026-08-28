"use server";

import { getCurrentUser } from "@/lib/auth";
import { loadNotificationAlerts, type NotificationItem } from "@/lib/notifications";

export async function fetchNotifications(): Promise<NotificationItem[]> {
  const user = await getCurrentUser();
  if (!user) return [];
  return loadNotificationAlerts(user);
}
