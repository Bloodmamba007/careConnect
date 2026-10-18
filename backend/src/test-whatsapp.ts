/**
 * Test script for Twilio WhatsApp integration
 * Run with: npx tsx src/test-whatsapp.ts
 */

import path from "node:path";
import { config as loadEnv } from "dotenv";

loadEnv({ path: path.resolve(process.cwd(), "../.env") });
loadEnv();

import twilio from "twilio";
import { sendTwilioWhatsApp } from "./notifications/twilio.js";

async function testTwilioWhatsApp() {
  console.log("=========================================");
  console.log("CareConnect Twilio WhatsApp Diagnostic");
  console.log("=========================================");

  const accountSid = process.env.TWILIO_ACCOUNT_SID || "ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx";
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_WHATSAPP_FROM || "whatsapp:+14155238886";
  const to = "whatsapp:+918076860402";
  const contentSid = process.env.TWILIO_CONTENT_SID;
  const contentVariables = contentSid ? JSON.stringify({ "1": "12/1", "2": "3pm" }) : undefined;

  console.log(`Account SID: ${accountSid}`);
  console.log(`Auth Token: ${authToken ? "********" + authToken.slice(-4) : "MISSING"}`);
  console.log(`From: ${from}`);
  console.log(`To: ${to}`);
  console.log(`Content SID: ${contentSid}`);
  console.log(`Variables: ${contentVariables}`);
  console.log(`Mock Mode: ${process.env.MOCK_NOTIFICATIONS}`);
  console.log("-----------------------------------------");

  if (!authToken || authToken === "[AuthToken]") {
    console.error("❌ Error: TWILIO_AUTH_TOKEN is not set or still set to placeholder [AuthToken].");
    console.log("Please update TWILIO_AUTH_TOKEN in .env with your real token from Twilio console.");
    return;
  }

  const client = twilio(accountSid, authToken);

  console.log("Attempting direct Twilio WhatsApp API call...");
  try {
    const createParams: any = { from, to };
    if (contentSid) {
      createParams.contentSid = contentSid;
      createParams.contentVariables = contentVariables;
    } else {
      createParams.body = "CareConnect Alert: Clinical status update for patient pt_001. System online and monitoring.";
    }
    const message = await client.messages.create(createParams);
    console.log("✅ SUCCESS! Twilio WhatsApp Message Queued.");
    console.log(`   Message SID: ${message.sid}`);
    console.log(`   Status: ${message.status}`);
  } catch (err: any) {
    console.warn("⚠️ Direct WhatsApp Call Error:", err.message);
    if (err.code === 21608 || err.code === 63015 || err.message?.includes("sandbox")) {
      console.log("\n💡 WhatsApp Sandbox Note: Make sure the recipient (+918076860402) has joined your Twilio WhatsApp Sandbox by sending your sandbox join keyword (e.g., 'join <keyword>') to +14155238886 on WhatsApp.");
    }
  }

  console.log("\nTesting via CareConnect notification service (sendTwilioWhatsApp)...");
  try {
    const res = await sendTwilioWhatsApp({
      to,
      from,
      contentSid,
      contentVariables,
    });
    console.log("Service Result:", res);
  } catch (err: any) {
    console.error("Service Call Failed:", err);
  }
}

testTwilioWhatsApp();
