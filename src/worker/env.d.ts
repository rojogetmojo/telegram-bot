/**
 * Environment bindings for Cloudflare Worker
 * These secrets should be set using: npx wrangler secret put <SECRET_NAME>
 */
export interface EnvBindings {
  // Telegram Bot Secrets
  TELEGRAM_BOT_TOKEN: string;
  TELEGRAM_CHAT_ID: string;

  // Twilio SMS Secrets
  TWILIO_ACCOUNT_SID: string;
  TWILIO_AUTH_TOKEN: string;
  TWILIO_MESSAGING_SERVICE_SID: string;
  TWILIO_TO_NUMBER: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface Env extends EnvBindings {}
}

