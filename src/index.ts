import { Telegraf, Scenes, session } from 'telegraf';
import { config, validateConfig } from './config.js';

// Import command handlers
import { registerStartCommand } from './bot/commands/start.js';
import { createLoginScene, registerLoginCommand, registerLogoutCommand } from './bot/commands/login.js';
import { registerHelpCommand } from './bot/commands/help.js';
import { registerCommunitiesCommand } from './bot/commands/communities.js';
import { registerEventsCommand } from './bot/commands/events.js';

// Import webhook server
import { startWebhookServer } from './webhook/server.js';

// Session data type
interface SessionData extends Scenes.WizardSessionData {
  email?: string;
}

async function main(): Promise<void> {
  console.log('🐝 Starting Luhive Telegram Bot...\n');

  // Validate configuration
  try {
    validateConfig();
    console.log('✅ Configuration validated');
  } catch (error) {
    console.error('❌ Configuration error:', error);
    process.exit(1);
  }

  // Create bot instance with scenes support
  const bot = new Telegraf<Scenes.WizardContext<SessionData>>(config.telegramBotToken);

  // Create scenes
  const loginScene = createLoginScene();
  const stage = new Scenes.Stage<Scenes.WizardContext<SessionData>>([loginScene]);

  // Register middleware
  bot.use(session());
  bot.use(stage.middleware());

  // Register bot commands in Telegram menu
  await bot.telegram.setMyCommands([
    { command: 'start', description: '🏠 Start the bot and see menu' },
    { command: 'communities', description: '📋 Browse all communities' },
    { command: 'events', description: '📅 View upcoming events' },
    { command: 'login', description: '🔐 Login to your Luhive account' },
    { command: 'logout', description: '🚪 Logout from your account' },
    { command: 'help', description: '❓ Get help and see all commands' },
  ]);
  console.log('✅ Bot commands registered');

  // Register command handlers
  registerStartCommand(bot);
  registerLoginCommand(bot);
  registerLogoutCommand(bot);
  registerHelpCommand(bot);
  registerCommunitiesCommand(bot);
  registerEventsCommand(bot);
  console.log('✅ Command handlers registered');

  // Handle errors
  bot.catch((err, ctx) => {
    console.error(`Error for ${ctx.updateType}:`, err);
  });

  // Start webhook server for event notifications
  startWebhookServer(bot);

  // Start bot
  await bot.launch();
  console.log('\n🤖 Bot is running!');
  console.log('   Press Ctrl+C to stop\n');

  // Enable graceful stop
  process.once('SIGINT', () => {
    console.log('\n👋 Stopping bot...');
    bot.stop('SIGINT');
  });
  process.once('SIGTERM', () => {
    console.log('\n👋 Stopping bot...');
    bot.stop('SIGTERM');
  });
}

// Run the bot
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

