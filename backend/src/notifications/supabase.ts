import { createClient } from "@supabase/supabase-js";

export interface SupabasePushResult {
  messageId: string;
  recipient: string;
  status: "SENT" | "MOCKED" | "STUBBED" | "FAILED";
  error?: string;
}

let supabaseClient: ReturnType<typeof createClient> | null = null;

function initSupabaseIfNeeded(): boolean {
  if (supabaseClient) return true;

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    return false;
  }

  try {
    // Use service role key for server-side operations
    supabaseClient = createClient(supabaseUrl, supabaseServiceKey);
    return true;
  } catch (err) {
    console.warn("[Supabase] Failed to initialize Supabase client:", err);
    return false;
  }
}

/**
 * Send real-time notification via Supabase Realtime
 * This uses Supabase's broadcast channel for real-time updates
 */
export async function sendSupabasePush(
  target: { channel?: string; patientId?: string },
  payload: {
    title: string;
    body: string;
    data?: Record<string, string>;
  },
): Promise<SupabasePushResult> {
  const isMock =
    process.env.MOCK_NOTIFICATIONS === "true" ||
    process.env.NODE_ENV === "test";

  const channelName = target.channel || (target.patientId ? `patient_${target.patientId}` : "alerts");
  const recipient = `channel:${channelName}`;

  if (isMock) {
    const mockId = `supabase_mock_${Math.random().toString(36).slice(2, 10)}`;
    console.log(`[MOCK NOTIFICATION][SUPABASE] -> ${recipient}:\nTitle: ${payload.title}\nBody: ${payload.body}`);
    return {
      messageId: mockId,
      recipient,
      status: "MOCKED",
    };
  }

  const hasKeys = initSupabaseIfNeeded();
  if (!hasKeys) {
    console.log(
      `[SUPABASE STUB] Supabase credentials not configured. Stubbing notification for ${recipient}:\n"${payload.title} - ${payload.body}"`,
    );
    return {
      messageId: `supabase_stub_${Date.now()}`,
      recipient,
      status: "STUBBED",
    };
  }

  try {
    if (!supabaseClient) {
      throw new Error("Supabase client not initialized");
    }

    // Broadcast to Supabase Realtime channel
    const channel = supabaseClient.channel(channelName);
    const messageId = `supabase_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

    await channel.send({
      type: "broadcast",
      event: "alert",
      payload: {
        id: messageId,
        title: payload.title,
        body: payload.body,
        data: payload.data ?? {},
        timestamp: new Date().toISOString(),
      },
    });

    console.log(`[SUPABASE] Broadcast to ${recipient}: ${payload.title}`);
    return {
      messageId,
      recipient,
      status: "SENT",
    };
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error(`[SUPABASE] Failed to send notification to ${recipient}:`, errMsg);
    return {
      messageId: "",
      recipient,
      status: "FAILED",
      error: errMsg,
    };
  }
}

/**
 * Alternative: Store notification in Supabase database for polling
 * Use this if Realtime is not enabled or for offline support
 */
export async function storeSupabaseNotification(
  patientId: string,
  payload: {
    title: string;
    body: string;
    data?: Record<string, string>;
  },
): Promise<SupabasePushResult> {
  const hasKeys = initSupabaseIfNeeded();
  if (!hasKeys) {
    return {
      messageId: "",
      recipient: `patient_${patientId}`,
      status: "STUBBED",
    };
  }

  try {
    if (!supabaseClient) {
      throw new Error("Supabase client not initialized");
    }

    const { data, error } = await supabaseClient
      .from("notifications")
      .insert({
        patient_id: patientId,
        title: payload.title,
        body: payload.body,
        data: payload.data ?? {},
        read: false,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;

    return {
      messageId: data.id,
      recipient: `patient_${patientId}`,
      status: "SENT",
    };
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error(`[SUPABASE] Failed to store notification:`, errMsg);
    return {
      messageId: "",
      recipient: `patient_${patientId}`,
      status: "FAILED",
      error: errMsg,
    };
  }
}
