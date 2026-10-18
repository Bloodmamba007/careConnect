# Twilio SMS Setup Guide

## Configuration

The Twilio SMS integration is already implemented in `backend/src/notifications/twilio.ts`. You just need to configure your credentials.

### Step 1: Get Your Twilio Credentials

1. Go to [https://console.twilio.com](https://console.twilio.com)
2. Sign in to your account
3. Navigate to **Settings** → **API Keys & Credentials**
4. Copy:
   - **Account SID** (e.g., `ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`)
   - **Auth Token** (long string, keep it secret!)

### Step 2: Add to .env

In your backend `.env` file:

```bash
# Twilio (SMS / WhatsApp notifications)
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_actual_auth_token_here
TWILIO_PHONE_NUMBER=+17744362519
TWILIO_WHATSAPP_FROM=
TWILIO_MESSAGING_SERVICE_SID=

# Escalation & Notification Settings
MOCK_NOTIFICATIONS=false
PRIMARY_CAREGIVER_NAME="Primary Caregiver"
PRIMARY_CAREGIVER_PHONE=+918076860402
SECONDARY_CAREGIVER_NAME="Secondary Caregiver"
SECONDARY_CAREGIVER_PHONE=
DASHBOARD_URL=http://localhost:5173
```

## Testing

### Option 1: Using the Test Script

Run the built-in test script:

```bash
cd backend
npx tsx src/test-twilio.ts
```

This will send a test SMS to the configured caregiver phone number.

### Option 2: Using cURL

You can also test directly with cURL:

```bash
curl 'https://api.twilio.com/2010-04-01/Accounts/ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx/Messages.json' \
  -X POST \
  --data-urlencode 'To=+918076860402' \
  --data-urlencode 'From=+17744362519' \
  --data-urlencode 'Body=CareConnect Test: This is a test SMS.' \
  -u ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx:YOUR_AUTH_TOKEN
```

Replace `YOUR_AUTH_TOKEN` with your actual Twilio Auth Token.

### Option 3: Trigger via Demo Panel

1. Start the backend: `cd backend && npm run dev`
2. Open the frontend demo panel
3. Click the "Crisis" button to trigger a RED alert
4. The system will automatically send SMS and voice calls to configured caregivers

## Mock Mode

For development/testing without sending real SMS:

```bash
MOCK_NOTIFICATIONS=true
```

With mock mode enabled, SMS and voice calls are logged to the console instead of being sent.

## Troubleshooting

### "Failed to send SMS"
- Verify TWILIO_ACCOUNT_SID starts with "AC"
- Verify TWILIO_AUTH_TOKEN is correct (check Twilio console)
- Verify TWILIO_PHONE_NUMBER is in E.164 format (+CountryCodeNumber)
- Check your Twilio account has sufficient credits

### "Twilio credentials missing"
- Ensure all three required env vars are set:
  - TWILIO_ACCOUNT_SID
  - TWILIO_AUTH_TOKEN
  - TWILIO_PHONE_NUMBER

### "Invalid phone number"
- Phone numbers must be in E.164 format: +91XXXXXXXXXX
- India: +91XXXXXXXXXX
- US: +1XXXXXXXXXX

## Voice Calls

The system also supports automated voice calls using Twilio. The same credentials are used, and the voice call is triggered automatically during escalation alongside SMS.

## WhatsApp Integration

The system supports sending clinical notifications and escalation alerts via **Twilio WhatsApp**:

### Configuration in `.env`
```bash
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=<your_auth_token>
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886
PRIMARY_CAREGIVER_PHONE=+918076860402
MOCK_NOTIFICATIONS=false
```

### Testing WhatsApp
1. **Direct Script**:
   ```bash
   cd backend
   npx tsx src/test-whatsapp.ts
   ```
2. **HTTP API**:
   ```bash
   curl -X POST http://localhost:4000/api/notifications/whatsapp \
     -H "Content-Type: application/json" \
     -d '{"to": "+918076860402", "message": "CareConnect WhatsApp Test"}'
   ```

### WhatsApp Sandbox Activation
When testing with the Twilio WhatsApp Sandbox (`+14155238886`), the recipient (+918076860402) must first opt in:
1. Open WhatsApp on `+918076860402`.
2. Send your sandbox join keyword (found in your Twilio Console under **Messaging -> Try it out -> Send a WhatsApp message**, e.g., `join <keyword>`) to **+1 415 523 8886**.
3. Once Twilio replies with confirmation, all CareConnect alert dispatches will be delivered directly to your WhatsApp!

## Security Notes

⚠️ **Never commit your Auth Token to git!**
- The Auth Token gives full access to your Twilio account
- Keep it in `.env` (which is in .gitignore)
- Rotate it if it's ever exposed
