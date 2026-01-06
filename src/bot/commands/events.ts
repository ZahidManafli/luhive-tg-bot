import { Context, Telegraf } from 'telegraf';
import { isLoggedIn } from '../../services/auth.js';
import {
  getUserCommunityEvents,
  getEventById,
  formatEventMessage,
  isUserRegisteredForEvent,
  registerForEvent,
  cancelRegistration,
} from '../../services/event.js';
import { getCommunityById } from '../../services/community.js';
import {
  mainMenuKeyboard,
  eventsKeyboard,
  eventDetailKeyboard,
  loginPromptKeyboard,
} from '../menus.js';
import { config } from '../../config.js';
import { supabase } from '../../services/supabase.js';

// Store pagination state per user
const userEventsPaginationState = new Map<number, { page: number }>();

export function registerEventsCommand(bot: Telegraf<any>): void {
  bot.command('events', handleEvents);
  bot.hears('📅 Events', handleEvents);

  // Pagination callbacks
  bot.action(/^events:page:(\d+)$/, handleEventsPage);
  bot.action('events:back', handleEvents);

  // Event action callbacks
  bot.action(/^event:view:(.+)$/, handleEventView);
  bot.action(/^event:register:(.+)$/, handleEventRegister);
  bot.action(/^event:cancel:(.+)$/, handleEventCancel);
}

async function handleEvents(ctx: Context): Promise<void> {
  const telegramId = ctx.from?.id;
  if (!telegramId) return;

  // Reset pagination
  userEventsPaginationState.set(telegramId, { page: 0 });

  const telegramUser = await isLoggedIn(telegramId);

  if (!telegramUser) {
    const message = `
📅 *Events*

Login to view events from your communities and register for them\\.

_Join communities first to see their events here\\._
`;

    const replyOptions = {
      parse_mode: 'MarkdownV2' as const,
      ...loginPromptKeyboard(),
    };

    try {
      if (ctx.callbackQuery) {
        await (ctx as any).editMessageText(message, replyOptions);
      } else {
        await ctx.reply(message, replyOptions);
      }
    } catch {
      await ctx.reply(message, replyOptions);
    }
    return;
  }

  const events = await getUserCommunityEvents(telegramUser.user_id);

  if (events.length === 0) {
    const message = `
📅 *Events*

No upcoming events from your communities\\.

• Use /communities to join more communities
• Events from your communities will appear here
`;

    const noEventsReplyOptions = {
      parse_mode: 'MarkdownV2' as const,
      reply_markup: {
        inline_keyboard: [
          [{ text: '📋 Browse Communities', callback_data: 'communities:back' }],
        ],
      },
    };

    try {
      if (ctx.callbackQuery) {
        await (ctx as any).editMessageText(message, noEventsReplyOptions);
      } else {
        await ctx.reply(message, noEventsReplyOptions);
      }
    } catch {
      await ctx.reply(message, noEventsReplyOptions);
    }
    return;
  }

  // Get user's registered events
  const { data: registrations } = await supabase
    .from('event_registrations')
    .select('event_id')
    .eq('user_id', telegramUser.user_id);

  const userRegisteredEventIds = new Set<string>(
    (registrations || []).map((r: any) => r.event_id)
  );

  const header = '📅 *Upcoming Events*\n\n✅ \\= You are registered\nTap an event to view details\\.';

  const eventsReplyOptions = {
    parse_mode: 'MarkdownV2' as const,
    ...eventsKeyboard(events, userRegisteredEventIds, 0),
  };

  try {
    if (ctx.callbackQuery) {
      await (ctx as any).editMessageText(header, eventsReplyOptions);
    } else {
      await ctx.reply(header, eventsReplyOptions);
    }
  } catch {
    await ctx.reply(header, eventsReplyOptions);
  }
}

async function handleEventsPage(ctx: Context): Promise<void> {
  if (!ctx.callbackQuery || !('data' in ctx.callbackQuery)) return;

  const telegramId = ctx.from?.id;
  if (!telegramId) return;

  await ctx.answerCbQuery();

  const match = ctx.callbackQuery.data.match(/^events:page:(\d+)$/);
  if (!match) return;

  const page = parseInt(match[1], 10);
  userEventsPaginationState.set(telegramId, { page });

  const telegramUser = await isLoggedIn(telegramId);
  if (!telegramUser) return;

  const events = await getUserCommunityEvents(telegramUser.user_id);

  const { data: registrations } = await supabase
    .from('event_registrations')
    .select('event_id')
    .eq('user_id', telegramUser.user_id);

  const userRegisteredEventIds = new Set<string>(
    (registrations || []).map((r: any) => r.event_id)
  );

  const header = '📅 *Upcoming Events*\n\n✅ \\= You are registered\nTap an event to view details\\.';

  await ctx.editMessageText(header, {
    parse_mode: 'MarkdownV2',
    ...eventsKeyboard(events, userRegisteredEventIds, page),
  });
}

async function handleEventView(ctx: Context): Promise<void> {
  if (!ctx.callbackQuery || !('data' in ctx.callbackQuery)) return;

  const telegramId = ctx.from?.id;
  if (!telegramId) return;

  await ctx.answerCbQuery();

  const match = ctx.callbackQuery.data.match(/^event:view:(.+)$/);
  if (!match) return;

  const eventId = match[1];
  const event = await getEventById(eventId);

  if (!event) {
    await ctx.answerCbQuery('Event not found');
    return;
  }

  const community = await getCommunityById(event.community_id);
  if (!community) return;

  const telegramUser = await isLoggedIn(telegramId);
  let isRegistered = false;
  let registrationStatus = '';

  if (telegramUser) {
    const regStatus = await isUserRegisteredForEvent(telegramUser.user_id, eventId);
    isRegistered = regStatus.registered;
    registrationStatus = regStatus.status || '';
  }

  const isExternal = event.registration_type === 'external';

  let statusLine = '';
  if (isRegistered) {
    if (registrationStatus === 'pending') {
      statusLine = '\n\n⏳ *Status:* Registration pending approval';
    } else if (registrationStatus === 'approved') {
      statusLine = '\n\n✅ *Status:* You are registered\\!';
    } else if (registrationStatus === 'rejected') {
      statusLine = '\n\n❌ *Status:* Registration was rejected';
    }
  }

  const message = formatEventMessage(event, community.name) + statusLine;

  await ctx.editMessageText(message, {
    parse_mode: 'MarkdownV2',
    ...eventDetailKeyboard(event, community.slug, isRegistered, isExternal, config.appBaseUrl),
  });
}

async function handleEventRegister(ctx: Context): Promise<void> {
  if (!ctx.callbackQuery || !('data' in ctx.callbackQuery)) return;

  const telegramId = ctx.from?.id;
  if (!telegramId) return;

  const telegramUser = await isLoggedIn(telegramId);

  if (!telegramUser) {
    await ctx.answerCbQuery('Please login first');
    await ctx.editMessageText(
      '🔐 *Login Required*\n\nYou need to login to register for events\\.',
      {
        parse_mode: 'MarkdownV2',
        ...loginPromptKeyboard(),
      }
    );
    return;
  }

  const match = ctx.callbackQuery.data.match(/^event:register:(.+)$/);
  if (!match) return;

  const eventId = match[1];
  const result = await registerForEvent(telegramUser.user_id, eventId);

  if (!result.success) {
    await ctx.answerCbQuery(result.error || 'Registration failed', { show_alert: true });
    return;
  }

  if (result.status === 'pending') {
    await ctx.answerCbQuery('⏳ Registration request submitted!');
  } else {
    await ctx.answerCbQuery('✅ Successfully registered!');
  }

  // Refresh the event view
  const event = await getEventById(eventId);
  if (!event) return;

  const community = await getCommunityById(event.community_id);
  if (!community) return;

  const statusLine = result.status === 'pending'
    ? '\n\n⏳ *Status:* Registration pending approval'
    : '\n\n✅ *Status:* You are registered\\!';

  const message = formatEventMessage(event, community.name) + statusLine;

  await ctx.editMessageText(message, {
    parse_mode: 'MarkdownV2',
    ...eventDetailKeyboard(event, community.slug, true, false, config.appBaseUrl),
  });
}

async function handleEventCancel(ctx: Context): Promise<void> {
  if (!ctx.callbackQuery || !('data' in ctx.callbackQuery)) return;

  const telegramId = ctx.from?.id;
  if (!telegramId) return;

  const telegramUser = await isLoggedIn(telegramId);

  if (!telegramUser) {
    await ctx.answerCbQuery('Please login first');
    return;
  }

  const match = ctx.callbackQuery.data.match(/^event:cancel:(.+)$/);
  if (!match) return;

  const eventId = match[1];
  const result = await cancelRegistration(telegramUser.user_id, eventId);

  if (!result.success) {
    await ctx.answerCbQuery(result.error || 'Cancellation failed', { show_alert: true });
    return;
  }

  await ctx.answerCbQuery('👋 Registration cancelled');

  // Refresh the event view
  const event = await getEventById(eventId);
  if (!event) return;

  const community = await getCommunityById(event.community_id);
  if (!community) return;

  const message = formatEventMessage(event, community.name);

  await ctx.editMessageText(message, {
    parse_mode: 'MarkdownV2',
    ...eventDetailKeyboard(event, community.slug, false, event.registration_type === 'external', config.appBaseUrl),
  });
}

