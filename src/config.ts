import dotenv from 'dotenv';

dotenv.config();

export const config = {
  // Telegram
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN || '',
  
  // Supabase
  supabaseUrl: process.env.SUPABASE_URL || '',
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  
  // Webhook
  webhookSecret: process.env.WEBHOOK_SECRET || '',
  port: parseInt(process.env.PORT || '3001', 10),
  
  // App
  appBaseUrl: process.env.APP_BASE_URL || 'https://luhive.com',
};

// Validate required environment variables
export function validateConfig(): void {
  const required = [
    'telegramBotToken',
    'supabaseUrl',
    'supabaseServiceRoleKey',
  ] as const;

  const missing = required.filter((key) => !config[key]);

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}

