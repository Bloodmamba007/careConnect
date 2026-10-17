# Supabase Setup Guide

This guide explains how to replace Firebase with Supabase for real-time notifications in CareConnect.

## Why Supabase?

- **Built-in PostgreSQL**: Already using PostgreSQL for audit trails
- **Real-time subscriptions**: Native WebSocket support without external services
- **Simple authentication**: JWT-based auth that works with existing auth system
- **Open source**: Self-hostable if needed
- **Cost-effective**: Generous free tier

## Step 1: Create Supabase Project

1. Go to [https://supabase.com](https://supabase.com)
2. Sign up / Sign in
3. Click "New Project"
4. Choose a name (e.g., "careconnect")
5. Set database password (save it!)
6. Choose a region (choose closest to your users)
7. Wait for project to be created (~2 minutes)

## Step 2: Get Credentials

1. Go to Project Settings > API
2. Copy these values:
   - **Project URL** (e.g., `https://xyz.supabase.co`)
   - **anon/public key** (starts with `eyJ...`)
   - **service_role key** (starts with `eyJ...` - for server-side)

## Step 3: Configure Environment Variables

### Backend (.env)

```bash
# Supabase (Real-time notifications & database)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### Frontend (.env or .env.local)

```bash
# Supabase Configuration
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

## Step 4: Run Migrations

The migration file is already included: `backend/migrations/003_supabase_notifications.sql`

Run migrations from the backend directory:

```bash
cd backend
npm run migrate
```

This will create the `notifications` table with:
- Primary key (UUID)
- Patient ID, title, body, data fields
- Read status tracking
- Row Level Security (RLS) policies
- Indexes for performance

## Step 5: Enable Realtime

### Option A: Via Supabase Dashboard (Recommended)

1. Go to your Supabase project
2. Navigate to **Database** > **Replication**
3. Click **Realtime** on the left
4. Find the `notifications` table
5. Toggle it to **Enabled**
6. Click **Save**

### Option B: Via SQL

Run this in the Supabase SQL Editor:

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
```

## Step 6: Update Frontend Code

In your React components, you can now use the Supabase utilities:

```tsx
import { subscribeToPatientNotifications } from "./utils/supabase";

function PatientDashboard({ patientId }) {
  useEffect(() => {
    const unsubscribe = subscribeToPatientNotifications(
      patientId,
      (notification) => {
        console.log("New alert:", notification);
        // Show notification in UI
      }
    );

    return () => unsubscribe();
  }, [patientId]);

  return <div>...</div>;
}
```

## Step 7: Test Real-time Notifications

1. Start the backend: `cd backend && npm run dev`
2. Start the frontend: `cd frontend && npm run dev`
3. Trigger a RED alert via the demo panel
4. Check browser console for Supabase connection logs
5. You should see: `[Supabase] Subscribed to patient_pt_001`
6. When an alert fires, you'll see: `[Supabase] Received notification: ...`

## Migration Notes

### What Changed

**Removed:**
- `firebase-admin` dependency
- Firebase credentials from `.env.example`
- `backend/src/notifications/fcm.ts` (kept for reference, can delete)

**Added:**
- `@supabase/supabase-js` dependency
- Supabase credentials in `.env.example`
- `backend/src/notifications/supabase.ts`
- `frontend/src/utils/supabase.ts`
- Migration: `003_supabase_notifications.sql`

**Updated:**
- `backend/src/escalation.ts` - now uses `sendSupabasePush` instead of `sendFcmPush`
- `docs/safety.md` - updated service list

### Fallback Behavior

If Supabase credentials are not configured:
- Notifications are stubbed (logged to console)
- System continues to work with in-memory fallbacks
- No runtime errors

### Mock Mode

Set `MOCK_NOTIFICATIONS=true` in `.env` to test without actual Supabase:
- All notifications are logged as mock
- No external API calls
- Useful for development and testing

## Troubleshooting

### "Supabase credentials not configured"

Make sure you added the environment variables to your `.env` file (not `.env.example`).

### Realtime not working

1. Check that Realtime is enabled for the `notifications` table
2. Verify the channel name matches: `patient_${patientId}`
3. Check browser console for WebSocket errors
4. Ensure your Supabase project is active (not paused)

### Migration fails

1. Verify PostgreSQL is running
2. Check DATABASE_URL in `.env`
3. Run `npm run migrate` from backend directory
4. Check logs for specific error

## Alternative: Push Notifications with OneSignal

If you need native mobile push notifications (not just in-app), you can combine Supabase with OneSignal:

1. Use Supabase Realtime for web/dashboard
2. Use OneSignal for mobile app push
3. Both can be triggered from the same `sendSupabasePush` function

This is optional and not required for the current use case.
