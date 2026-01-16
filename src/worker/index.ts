import { Hono, type Context } from "hono";
import type { EnvBindings } from "./env";

type AppEnv = { Bindings: EnvBindings };
type AppContext = Context<AppEnv>;

const app = new Hono<AppEnv>();

// --- API Routes ---

app.get("/api/", (c: AppContext) => c.json({ name: "LTV Monitor", status: "running" }));

// Manual trigger endpoint for testing
app.get("/api/test", async (c: AppContext) => {
  console.log("[Manual] 🔧 Manual test triggered via API");
  await checkHealthFactors(c.env);
  return c.json({ message: "Manual check completed. Check logs with `npm run tail`" });
});

// Health check endpoint
app.get("/api/health", (c: AppContext) => {
  return c.json({ 
    status: "healthy",
    timestamp: new Date().toISOString(),
    telegram: !!c.env.TELEGRAM_BOT_TOKEN && !!c.env.TELEGRAM_CHAT_ID,
    twilio: !!c.env.TWILIO_ACCOUNT_SID && !!c.env.TWILIO_AUTH_TOKEN && !!c.env.TWILIO_MESSAGING_SERVICE_SID
  });
});

// --- CORE LTV MONITORING LOGIC ---

async function checkHealthFactors(env: EnvBindings) {
  // 🧪 MOCK DATA - Simulates a high LTV position for testing
  const mockUsers: AaveUser[] = [
    {
      id: "0x1234567890abcdef1234567890abcdef12345678",
      totalCollateralBase: "1000000",  // $1M collateral
      totalDebtBase: "900000"          // $900K debt = 90% LTV (triggers alert)
    },
    {
      id: "0xabcdef1234567890abcdef1234567890abcdef12",
      totalCollateralBase: "500000",   // $500K collateral
      totalDebtBase: "450000"          // $450K debt = 90% LTV (triggers alert)
    }
  ];

  try {
    const users = mockUsers;

    console.log(`[Monitor] 🔍 Using MOCK data - ${users.length} test borrowers.`);

    const alertPromises: Promise<void>[] = [];

    for (const user of users) {
      const collateral = parseFloat(user.totalCollateralBase);
      const debt = parseFloat(user.totalDebtBase);

      if (collateral === 0) continue;

      // Calculate LTV (Loan-to-Value)
      const ltv = (debt / collateral) * 100;

      // 🚨 THRESHOLD: Alert if LTV is above 85%
      if (ltv > 85) {
        console.log(`[Alert] ⚠️ High LTV found: ${user.id} at ${ltv.toFixed(2)}%`);

        const shortAddr = `${user.id.substring(0, 6)}...${user.id.substring(38)}`;
        const msg = `High LTV Alert! Wallet ${shortAddr} is at ${ltv.toFixed(2)}% LTV.`;

        // Add alerts to the queue
        alertPromises.push(sendTelegramAlert(env, msg));
        alertPromises.push(sendTwilioSMS(env, msg));
      }
    }

    // Wait for all alerts to be sent
    await Promise.all(alertPromises);

    if (alertPromises.length === 0) {
      console.log("[Monitor] ✅ No high LTV positions detected.");
    }

  } catch (error) {
    console.error("[Error] Failed to fetch or process data:", error);
  }
}

// --- TELEGRAM NOTIFICATION ---

async function sendTelegramAlert(env: EnvBindings, text: string): Promise<void> {
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) {
    console.warn("[Telegram] ⚠️ Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID");
    return;
  }

  const url = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`;
  
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: env.TELEGRAM_CHAT_ID,
        text: `🚨 ${text}`,
        parse_mode: "HTML"
      })
    });

    if (response.ok) {
      console.log("[Telegram] ✅ Alert sent successfully");
    } else {
      const errorData = await response.text();
      console.error("[Telegram] ❌ Failed to send:", errorData);
    }
  } catch (e) {
    console.error("[Telegram] Error:", e);
  }
}

// --- TWILIO SMS MESSAGE ---

async function sendTwilioSMS(env: EnvBindings, messageText: string): Promise<void> {
  if (!env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN || !env.TWILIO_TO_NUMBER) {
    console.warn("[Twilio] ⚠️ Missing Twilio credentials or phone number");
    return;
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Messages.json`;

  const formData = new URLSearchParams();
  formData.append("To", env.TWILIO_TO_NUMBER);
  formData.append("MessagingServiceSid", env.TWILIO_MESSAGING_SERVICE_SID);
  formData.append("Body", `🚨 ${messageText}`);

  const auth = btoa(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: formData
    });

    if (response.ok) {
      console.log("[Twilio] ✅ SMS sent successfully");
    } else {
      const errorData = await response.text();
      console.error("[Twilio] ❌ Failed to send SMS:", errorData);
    }
  } catch (e) {
    console.error("[Twilio] Error:", e);
  }
}

// --- TYPE DEFINITIONS ---

interface AaveUser {
  id: string;
  totalCollateralBase: string;
  totalDebtBase: string;
}

// --- EXPORT WITH SCHEDULED HANDLER ---

export default {
  // HTTP Request Handler (Hono)
  fetch: app.fetch,

  // Scheduled Event Handler (Cron Job - runs every 10 minutes)
  async scheduled(_event: ScheduledEvent, env: EnvBindings, ctx: ExecutionContext) {
    console.log("[Cron] ⏰ Scheduled event triggered. Checking health factors...");
    ctx.waitUntil(checkHealthFactors(env));
  }
};
