import { Context, Telegraf } from 'telegraf';
import { mainMenuKeyboard } from '../menus.js';

export function registerHelpCommand(bot: Telegraf<any>): void {
  bot.command('help', handleHelp);
  bot.hears('❓ Help', handleHelp);
}

async function handleHelp(ctx: Context): Promise<void> {
  const helpMessage = `
❓ *Luhive Bot Help*

*Commands:*

🏠 *Communities*
/communities \\- Browse all communities
• View community details
• Join or leave communities
• See events from specific communities

📅 *Events*
/events \\- View upcoming events
• See events from your communities
• Register for events
• Get event details

🔐 *Account*
/login \\- Connect your Luhive account
/logout \\- Disconnect your account

📱 *Menu Buttons*
You can also use the menu buttons at the bottom of the screen for quick access\\.

🔔 *Notifications*
When logged in, you'll receive notifications for:
• New events from your communities
• Event updates and cancellations

💡 *Tips:*
• Login to unlock all features
• Join communities to see their events
• Register for events to get reminders

Need more help? Visit our website at luhive\\.com
`;

  await ctx.reply(helpMessage, {
    parse_mode: 'MarkdownV2',
    ...mainMenuKeyboard,
  });
}

