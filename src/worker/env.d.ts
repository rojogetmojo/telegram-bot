/**
 * Environment bindings for Cloudflare Worker
 * These secrets should be set using: npx wrangler secret put <SECRET_NAME>
 */
export interface EnvBindings {
  // Telegram Bot Secrets
  TELEGRAM_BOT_TOKEN: string;
  TELEGRAM_CHAT_ID: string;

  // Twilio Secrets
  TWILIO_ACCOUNT_SID: string;
  TWILIO_AUTH_TOKEN: string;
  TWILIO_FROM_NUMBER: string;
  EMERGENCY_PHONE_NUMBER: string;
}

declare global {
  interface Env extends EnvBindings {}
}

