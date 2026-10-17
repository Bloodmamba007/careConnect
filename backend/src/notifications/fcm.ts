import { getApps, initializeApp, cert } from "firebase-admin/app";
import { getMessaging, Message } from "firebase-admin/messaging";

export interface FcmPushResult {
  messageId: string;
  recipient: string;
  status: "SENT" | "MOCKED" | "STUBBED" | "FAILED";
  error?: string;
}

let firebaseInitialized = false;

function initFirebaseIfNeeded(): boolean {
  if (firebaseInitialized) return true;
  if (getApps().length > 0) {
    firebaseInitialized = true;
    return true;
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  let privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (!projectId || !clientEmail || !privateKey) {
    return false;
  }

  // Handle escaped newlines in private key
  if (privateKey.includes("\\n")) {
    privateKey = privateKey.replace(/\\n/g, "\n");
  }

  try {
    initializeApp({
      credential: cert({
        projectId,
        clientEmail,
        privateKey,
      }),
    });
    firebaseInitialized = true;
    return true;
  } catch (err) {
    console.warn("[Firebase] Failed to initialize Firebase Admin SDK:", err);
    return false;
  }
}

export async function sendFcmPush(
  target: { token?: string; topic?: string },
  payload: {
    title: string;
    body: string;
    data?: Record<string, string>;
  },
): Promise<FcmPushResult> {
  const isMock =
    process.env.MOCK_NOTIFICATIONS === "true" ||
    process.env.NODE_ENV === "test";

  const recipient = target.token
    ? `token:${target.token.slice(0, 10)}...`
    : target.topic
    ? `topic:${target.topic}`
    : "broadcast";

  if (isMock) {
    const mockId = `fcm_mock_${Math.random().toString(36).slice(2, 10)}`;
    console.log(`[MOCK NOTIFICATION][FCM PUSH] -> ${recipient}:\nTitle: ${payload.title}\nBody: ${payload.body}`);
    return {
      messageId: mockId,
      recipient,
      status: "MOCKED",
    };
  }

  const hasKeys = initFirebaseIfNeeded();
  if (!hasKeys) {
    console.log(
      `[FCM STUB] Firebase credentials not configured. Stubbing push notification for ${recipient}:\n"${payload.title} - ${payload.body}"`,
    );
    return {
      messageId: `fcm_stub_${Date.now()}`,
      recipient,
      status: "STUBBED",
    };
  }

  try {
    const message: Message = {
      notification: {
        title: payload.title,
        body: payload.body,
      },
      data: payload.data ?? {},
      ...(target.token ? { token: target.token } : { topic: target.topic || "alerts" }),
    };

    const response = await getMessaging().send(message);
    return {
      messageId: response,
      recipient,
      status: "SENT",
    };
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error(`[FCM PUSH] Failed to send push to ${recipient}:`, errMsg);
    return {
      messageId: "",
      recipient,
      status: "FAILED",
      error: errMsg,
    };
  }
}
