import { Context, Telegraf } from 'telegraf';
import { isLoggedIn, getCurrentUser } from '../../services/auth.js';
import { mainMenuKeyboard, loginPromptKeyboard } from '../menus.js';

export function registerStartCommand(bot: Telegraf<any>): void {
  bot.command('start', handleStart);
  bot.hears('👤 Profile', handleProfile);
}

async function handleStart(ctx: Context): Promise<void> {
  const telegramId = ctx.from?.id;
  if (!telegramId) return;

  const telegramUser = await isLoggedIn(telegramId);

  const welcomeMessage = `
🐝 *Welcome to Luhive Bot!*

Discover and engage with communities, browse events, and never miss an update\\.

*Available Commands:*
📋 /communities \\- Browse all communities
📅 /events \\- View upcoming events from your communities
🔐 /login \\- Connect your Luhive account
🚪 /logout \\- Disconnect your account
❓ /help \\- Get help

${telegramUser
      ? '✅ *You are logged in\\!* Use the menu below to explore\\.'
      : '🔐 *Login to unlock all features* and receive event notifications\\!'}
`;

  await ctx.reply(welcomeMessage, {
    parse_mode: 'MarkdownV2',
    ...mainMenuKeyboard,
  });

  if (!telegramUser) {
    await ctx.reply(
      '👋 To get personalized event notifications and manage your communities, please login:',
      loginPromptKeyboard()
    );
  }
}

async function handleProfile(ctx: Context): Promise<void> {
  const telegramId = ctx.from?.id;
  if (!telegramId) return;

  const currentUser = await getCurrentUser(telegramId);

  if (!currentUser) {
    await ctx.reply(
      '🔐 *You are not logged in*\n\nLogin to view your profile and manage your communities\\.',
      {
        parse_mode: 'MarkdownV2',
        ...loginPromptKeyboard(),
      }
    );
    return;
  }

  const { profile } = currentUser;
  const name = profile?.full_name || 'Unknown';

  const profileMessage = `
👤 *Your Profile*

*Name:* ${escapeMarkdown(name)}
*Status:* ✅ Logged in

Use /communities to see your communities or /events to view upcoming events\\.
`;

  await ctx.reply(profileMessage, {
    parse_mode: 'MarkdownV2',
    ...mainMenuKeyboard,
  });
}

function escapeMarkdown(text: string): string {
  return text.replace(/[_*[\]()~`>#+\-=|{}.!]/g, '\\$&');
}

