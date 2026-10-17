/**
 * Supabase Realtime Client Setup
 * Connects to Supabase for real-time notifications and data sync
 *
 * Setup instructions:
 * 1. Create a Supabase project at https://supabase.com
 * 2. Go to Project Settings > API to get URL and keys
 * 3. Add to your .env file:
 *    VITE_SUPABASE_URL=your-project-url
 *    VITE_SUPABASE_ANON_KEY=your-anon-key
 * 4. Enable Realtime for the notifications table in Supabase dashboard
 */

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn("[Supabase] Missing environment variables. Real-time features will be disabled.");
}

export const supabase = createClient(supabaseUrl || "", supabaseAnonKey || "");

/**
 * Subscribe to real-time notifications for a patient
 * @param patientId - Patient ID to subscribe to
 * @param callback - Function to call when notification is received
 * @returns Unsubscribe function
 */
export function subscribeToPatientNotifications(
  patientId: string,
  callback: (notification: {
    id: string;
    title: string;
    body: string;
    data: Record<string, string>;
    timestamp: string;
  }) => void,
) {
  const channelName = `patient_${patientId}`;

  const channel = supabase.channel(channelName);

  channel
    .on("broadcast", { event: "alert" }, (payload) => {
      console.log("[Supabase] Received notification:", payload);
      callback({
        id: payload.payload.id,
        title: payload.payload.title,
        body: payload.payload.body,
        data: payload.payload.data,
        timestamp: payload.payload.timestamp,
      });
    })
    .subscribe((status) => {
      if (status === "SUBSCRIBED") {
        console.log(`[Supabase] Subscribed to ${channelName}`);
      } else if (status === "CHANNEL_ERROR") {
        console.error(`[Supabase] Error subscribing to ${channelName}`);
      }
    });

  // Return unsubscribe function
  return () => {
    supabase.removeChannel(channel);
    console.log(`[Supabase] Unsubscribed from ${channelName}`);
  };
}

/**
 * Alternative: Subscribe to table changes (for offline/polling support)
 * This requires Realtime to be enabled for the notifications table
 */
export function subscribeToNotificationsTable(
  patientId: string,
  callback: (notification: any) => void,
) {
  const subscription = supabase
    .channel("notifications-changes")
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "notifications",
        filter: `patient_id=eq.${patientId}`,
      },
      (payload) => {
        console.log("[Supabase] New notification in table:", payload);
        callback(payload.new);
      },
    )
    .subscribe();

  return () => {
    supabase.removeChannel(subscription);
  };
}

/**
 * Fetch notification history for a patient
 */
export async function getNotificationHistory(patientId: string, limit = 50) {
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("patient_id", patientId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[Supabase] Error fetching notifications:", error);
    return [];
  }

  return data;
}

/**
 * Mark notification as read
 */
export async function markNotificationAsRead(notificationId: string) {
  const { error } = await supabase
    .from("notifications")
    .update({ read: true, read_at: new Date().toISOString() })
    .eq("id", notificationId);

  if (error) {
    console.error("[Supabase] Error marking notification as read:", error);
    return false;
  }

  return true;
}
