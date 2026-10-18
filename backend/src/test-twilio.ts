/**
 * Quick test script to verify Twilio SMS configuration
 * Run with: npx tsx src/test-twilio.ts
 */

import path from "node:path";
import { config as loadEnv } from "dotenv";

loadEnv({ path: path.resolve(process.cwd(), "../.env") });
loadEnv();

import { sendTwilioSms } from "./notifications/twilio.js";

async function testTwilioSms() {
  console.log("[Twilio Test] Testing SMS configuration...");
  console.log(`Account SID: ${process.env.TWILIO_ACCOUNT_SID}`);
  console.log(`Phone Number: ${process.env.TWILIO_PHONE_NUMBER}`);
  console.log(`Mock Mode: ${process.env.MOCK_NOTIFICATIONS}`);
  console.log("");

  const testTo = process.env.PRIMARY_CAREGIVER_PHONE || "+918076860402";
  const testMessage = "CareConnect Test: This is a test SMS to verify Twilio configuration.";

  console.log(`Sending test SMS to: ${testTo}`);
  console.log(`Message: ${testMessage}`);
  console.log("");

  try {
    const result = await sendTwilioSms(testTo, testMessage);
    console.log("[Twilio Test] Result:", JSON.stringify(result, null, 2));

    if (result.status === "SENT") {
      console.log("\n✅ SUCCESS: SMS sent successfully!");
      console.log(`   SID: ${result.sid}`);
    } else if (result.status === "MOCKED") {
      console.log("\n⚠️  MOCKED: Notifications are in mock mode");
      console.log("   Set MOCK_NOTIFICATIONS=false in .env to send real SMS");
    } else {
      console.log("\n❌ FAILED:", result.error);
    }
  } catch (err) {
    console.error("[Twilio Test] Error:", err);
  }
}

testTwilioSms();
