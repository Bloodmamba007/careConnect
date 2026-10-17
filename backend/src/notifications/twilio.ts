import twilio from "twilio";

export interface TwilioNotificationResult {
  sid: string;
  channel: "SMS" | "VOICE";
  to: string;
  status: "SENT" | "MOCKED" | "FAILED";
  error?: string;
}

export interface TwilioClientInterface {
  messages: {
    create: (opts: { body: string; to: string; from: string }) => Promise<{ sid: string }>;
  };
  calls: {
    create: (opts: { twiml: string; to: string; from: string }) => Promise<{ sid: string }>;
  };
}

let customTwilioClient: TwilioClientInterface | null = null;

export function setMockTwilioClient(mockClient: TwilioClientInterface | null): void {
  customTwilioClient = mockClient;
}

export function getTwilioClient(): TwilioClientInterface | null {
  if (customTwilioClient) {
    return customTwilioClient;
  }

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;

  if (accountSid && authToken && accountSid.startsWith("AC")) {
    return twilio(accountSid, authToken) as unknown as TwilioClientInterface;
  }
  return null;
}

export async function sendTwilioSms(
  to: string,
  body: string,
): Promise<TwilioNotificationResult> {
  const isMock =
    process.env.MOCK_NOTIFICATIONS === "true" ||
    process.env.NODE_ENV === "test";

  if (customTwilioClient) {
    const from = process.env.TWILIO_PHONE_NUMBER || "+15005550006";
    const res = await customTwilioClient.messages.create({ body, to, from });
    return {
      sid: res.sid,
      channel: "SMS",
      to,
      status: "SENT",
    };
  }

  if (isMock) {
    const mockSid = `SM_mock_${Math.random().toString(36).slice(2, 10)}`;
    console.log(`[MOCK NOTIFICATION][SMS] -> ${to}:\n${body}`);
    return {
      sid: mockSid,
      channel: "SMS",
      to,
      status: "MOCKED",
    };
  }

  const client = getTwilioClient();
  const from = process.env.TWILIO_PHONE_NUMBER;

  if (!client || !from) {
    console.warn("[Twilio SMS] Twilio credentials or TWILIO_PHONE_NUMBER missing. Falling back to mock.");
    return {
      sid: `SM_fallback_${Date.now()}`,
      channel: "SMS",
      to,
      status: "MOCKED",
    };
  }

  try {
    const message = await client.messages.create({ body, to, from });
    return {
      sid: message.sid,
      channel: "SMS",
      to,
      status: "SENT",
    };
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error(`[Twilio SMS] Failed to send SMS to ${to}:`, errMsg);
    return {
      sid: "",
      channel: "SMS",
      to,
      status: "FAILED",
      error: errMsg,
    };
  }
}

export async function sendTwilioVoiceCall(
  to: string,
  spokenMessage: string,
): Promise<TwilioNotificationResult> {
  const isMock =
    process.env.MOCK_NOTIFICATIONS === "true" ||
    process.env.NODE_ENV === "test";

  const twiml = `<Response><Say voice="alice">${escapeXml(spokenMessage)}</Say></Response>`;

  if (customTwilioClient) {
    const from = process.env.TWILIO_PHONE_NUMBER || "+15005550006";
    const res = await customTwilioClient.calls.create({ twiml, to, from });
    return {
      sid: res.sid,
      channel: "VOICE",
      to,
      status: "SENT",
    };
  }

  if (isMock) {
    const mockSid = `CA_mock_${Math.random().toString(36).slice(2, 10)}`;
    console.log(`[MOCK NOTIFICATION][VOICE CALL] -> ${to}:\n"${spokenMessage}"`);
    return {
      sid: mockSid,
      channel: "VOICE",
      to,
      status: "MOCKED",
    };
  }

  const client = getTwilioClient();
  const from = process.env.TWILIO_PHONE_NUMBER;

  if (!client || !from) {
    console.warn("[Twilio Voice] Twilio credentials or TWILIO_PHONE_NUMBER missing. Falling back to mock.");
    return {
      sid: `CA_fallback_${Date.now()}`,
      channel: "VOICE",
      to,
      status: "MOCKED",
    };
  }

  try {
    const call = await client.calls.create({ twiml, to, from });
    return {
      sid: call.sid,
      channel: "VOICE",
      to,
      status: "SENT",
    };
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error(`[Twilio Voice] Failed to place voice call to ${to}:`, errMsg);
    return {
      sid: "",
      channel: "VOICE",
      to,
      status: "FAILED",
      error: errMsg,
    };
  }
}

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
