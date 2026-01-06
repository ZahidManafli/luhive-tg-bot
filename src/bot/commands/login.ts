import { Context, Telegraf, Scenes, session } from 'telegraf';
import { message } from 'telegraf/filters';
import { login, isLoggedIn, logout } from '../../services/auth.js';
import { mainMenuKeyboard } from '../menus.js';

// Session data interface
interface LoginSessionData extends Scenes.WizardSessionData {
  email?: string;
}

// Create login wizard scene
export function createLoginScene(): Scenes.WizardScene<Scenes.WizardContext<LoginSessionData>> {
  return new Scenes.WizardScene<Scenes.WizardContext<LoginSessionData>>(
    'login-wizard',
    // Step 1: Ask for email
    async (ctx) => {
      const telegramId = ctx.from?.id;
      if (!telegramId) {
        await ctx.reply('Something went wrong. Please try again.');
        return ctx.scene.leave();
      }

      // Check if already logged in
      const existingUser = await isLoggedIn(telegramId);
      if (existingUser) {
        await ctx.reply(
          '✅ You are already logged in\\!\n\nUse /logout first if you want to switch accounts\\.',
          { parse_mode: 'MarkdownV2' }
        );
        return ctx.scene.leave();
      }

      await ctx.reply(
        '🔐 *Login to Luhive*\n\nPlease enter your *email address*:',
        {
          parse_mode: 'MarkdownV2',
          reply_markup: {
            inline_keyboard: [
              [{ text: '❌ Cancel', callback_data: 'login:cancel' }],
            ],
          },
        }
      );
      return ctx.wizard.next();
    },
    // Step 2: Receive email, ask for password
    async (ctx) => {
      if (!ctx.message || !('text' in ctx.message)) {
        await ctx.reply('Please enter a valid email address:');
        return;
      }

      const email = ctx.message.text.trim();

      // Basic email validation
      if (!email.includes('@') || !email.includes('.')) {
        await ctx.reply('⚠️ Please enter a valid email address:');
        return;
      }

      // Store email in session
      ctx.scene.session.email = email;

      await ctx.reply(
        '📧 Email received\\!\n\nNow please enter your *password*:\n\n_Your message will be deleted after login for security\\._',
        {
          parse_mode: 'MarkdownV2',
          reply_markup: {
            inline_keyboard: [
              [{ text: '❌ Cancel', callback_data: 'login:cancel' }],
            ],
          },
        }
      );
      return ctx.wizard.next();
    },
    // Step 3: Receive password, authenticate
    async (ctx) => {
      if (!ctx.message || !('text' in ctx.message)) {
        await ctx.reply('Please enter your password:');
        return;
      }

      const password = ctx.message.text;
      const email = ctx.scene.session.email;
      const telegramId = ctx.from?.id;
      const chatId = ctx.chat?.id;
      const username = ctx.from?.username;

      if (!email || !telegramId || !chatId) {
        await ctx.reply('Something went wrong. Please try /login again.');
        return ctx.scene.leave();
      }

      // Delete the password message for security
      try {
        await ctx.deleteMessage(ctx.message.message_id);
      } catch (error) {
        // May fail if bot doesn't have delete permissions
        console.log('Could not delete password message');
      }

      // Show loading message
      const loadingMsg = await ctx.reply('🔄 Authenticating...');

      // Attempt login
      const result = await login(telegramId, chatId, email, password, username);

      // Delete loading message
      try {
        await ctx.deleteMessage(loadingMsg.message_id);
      } catch (error) {
        // Ignore
      }

      if (!result.success) {
        await ctx.reply(
          `❌ *Login Failed*\n\n${escapeMarkdown(result.error || 'Unknown error')}\n\nPlease try /login again\\.`,
          { parse_mode: 'MarkdownV2' }
        );
        return ctx.scene.leave();
      }

      const displayName = result.user?.profile?.full_name || result.user?.email || 'User';

      await ctx.reply(
        `✅ *Login Successful\\!*\n\nWelcome back, *${escapeMarkdown(displayName)}*\\!\n\n🔔 You will now receive notifications for events from your communities\\.\n\nUse /communities to browse or /events to see upcoming events\\.`,
        {
          parse_mode: 'MarkdownV2',
          ...mainMenuKeyboard,
        }
      );

      return ctx.scene.leave();
    }
  );
}

export function registerLoginCommand(bot: Telegraf<any>): void {
  // Handle /login command - enter the wizard
  bot.command('login', (ctx) => ctx.scene.enter('login-wizard'));

  // Handle cancel callback
  bot.action('login:cancel', async (ctx: any) => {
    await ctx.answerCbQuery('Login cancelled');
    await ctx.editMessageText('❌ Login cancelled. Use /login to try again.');
    return ctx.scene.leave();
  });

  // Handle action:login callback from prompts
  bot.action('action:login', (ctx: any) => {
    ctx.answerCbQuery();
    return ctx.scene.enter('login-wizard');
  });
}

export function registerLogoutCommand(bot: Telegraf<any>): void {
  bot.command('logout', handleLogout);
}

async function handleLogout(ctx: Context): Promise<void> {
  const telegramId = ctx.from?.id;
  if (!telegramId) return;

  const result = await logout(telegramId);

  if (!result.success) {
    await ctx.reply(`❌ ${result.error || 'Logout failed'}`);
    return;
  }

  await ctx.reply(
    '👋 *Logged Out Successfully*\n\nYou have been disconnected from your Luhive account\\.\n\n🔕 You will no longer receive event notifications\\.\n\nUse /login to connect again\\.',
    {
      parse_mode: 'MarkdownV2',
      ...mainMenuKeyboard,
    }
  );
}

function escapeMarkdown(text: string): string {
  return text.replace(/[_*[\]()~`>#+\-=|{}.!]/g, '\\$&');
}

