import { Context, Telegraf } from 'telegraf';
import { isLoggedIn } from '../../services/auth.js';
import {
  getAllCommunities,
  getUserCommunities,
  getCommunityById,
  getCommunityMemberCount,
  joinCommunity,
  leaveCommunity,
  isUserMemberOfCommunity,
} from '../../services/community.js';
import { getCommunityEvents } from '../../services/event.js';
import {
  mainMenuKeyboard,
  communitiesKeyboard,
  communityDetailKeyboard,
  loginPromptKeyboard,
} from '../menus.js';
import { config } from '../../config.js';

// Store pagination state per user
const userPaginationState = new Map<number, { page: number }>();

export function registerCommunitiesCommand(bot: Telegraf<any>): void {
  bot.command('communities', handleCommunities);
  bot.hears('📋 Communities', handleCommunities);

  // Pagination callbacks
  bot.action(/^communities:page:(\d+)$/, handleCommunitiesPage);
  bot.action('communities:back', handleCommunities);

  // Community action callbacks
  bot.action(/^community:view:(.+)$/, handleCommunityView);
  bot.action(/^community:join:(.+)$/, handleCommunityJoin);
  bot.action(/^community:leave:(.+)$/, handleCommunityLeave);
  bot.action(/^community:events:(.+)$/, handleCommunityEvents);
}

async function handleCommunities(ctx: Context): Promise<void> {
  const telegramId = ctx.from?.id;
  if (!telegramId) return;

  // Reset pagination
  userPaginationState.set(telegramId, { page: 0 });

  const telegramUser = await isLoggedIn(telegramId);
  const communities = await getAllCommunities();

  if (communities.length === 0) {
    await ctx.reply('📋 No communities found yet. Check back later!', mainMenuKeyboard);
    return;
  }

  // Get user's community memberships
  let userCommunityIds = new Set<string>();
  if (telegramUser) {
    const userCommunities = await getUserCommunities(telegramUser.user_id);
    userCommunityIds = new Set(userCommunities.map((c) => c.id));
  }

  const header = telegramUser
    ? '📋 *Communities*\n\n✅ = You are a member\nTap a community to view details\\.'
    : '📋 *Communities*\n\nLogin to join communities and receive event notifications\\.';

  // Try to edit if possible, otherwise send new message
  const replyOptions = {
    parse_mode: 'MarkdownV2' as const,
    ...communitiesKeyboard(communities, userCommunityIds, 0),
  };

  try {
    if (ctx.callbackQuery) {
      await (ctx as any).editMessageText(header, replyOptions);
    } else {
      await ctx.reply(header, replyOptions);
    }
  } catch {
    await ctx.reply(header, replyOptions);
  }
}

async function handleCommunitiesPage(ctx: Context): Promise<void> {
  if (!ctx.callbackQuery || !('data' in ctx.callbackQuery)) return;

  const telegramId = ctx.from?.id;
  if (!telegramId) return;

  await ctx.answerCbQuery();

  const match = ctx.callbackQuery.data.match(/^communities:page:(\d+)$/);
  if (!match) return;

  const page = parseInt(match[1], 10);
  userPaginationState.set(telegramId, { page });

  const telegramUser = await isLoggedIn(telegramId);
  const communities = await getAllCommunities();

  let userCommunityIds = new Set<string>();
  if (telegramUser) {
    const userCommunities = await getUserCommunities(telegramUser.user_id);
    userCommunityIds = new Set(userCommunities.map((c) => c.id));
  }

  const header = telegramUser
    ? '📋 *Communities*\n\n✅ = You are a member\nTap a community to view details\\.'
    : '📋 *Communities*\n\nLogin to join communities and receive event notifications\\.';

  await ctx.editMessageText(header, {
    parse_mode: 'MarkdownV2',
    ...communitiesKeyboard(communities, userCommunityIds, page),
  });
}

async function handleCommunityView(ctx: Context): Promise<void> {
  if (!ctx.callbackQuery || !('data' in ctx.callbackQuery)) return;

  const telegramId = ctx.from?.id;
  if (!telegramId) return;

  await ctx.answerCbQuery();

  const match = ctx.callbackQuery.data.match(/^community:view:(.+)$/);
  if (!match) return;

  const communityId = match[1];
  const community = await getCommunityById(communityId);

  if (!community) {
    await ctx.answerCbQuery('Community not found');
    return;
  }

  const telegramUser = await isLoggedIn(telegramId);
  let isMember = false;

  if (telegramUser) {
    isMember = await isUserMemberOfCommunity(telegramUser.user_id, communityId);
  }

  const memberCount = await getCommunityMemberCount(communityId);
  const events = await getCommunityEvents(communityId);

  const message = `
🏠 *${escapeMarkdown(community.name)}*
${community.tagline ? `\n_${escapeMarkdown(community.tagline)}_\n` : ''}
${community.description ? `\n${escapeMarkdown(community.description)}\n` : ''}
👥 *Members:* ${memberCount}
📅 *Upcoming Events:* ${events.length}
${community.verified ? '\n✅ Verified Community' : ''}
${isMember ? '\n🎉 You are a member\\!' : ''}
`;

  await ctx.editMessageText(message, {
    parse_mode: 'MarkdownV2',
    ...communityDetailKeyboard(community, isMember, config.appBaseUrl),
  });
}

async function handleCommunityJoin(ctx: Context): Promise<void> {
  if (!ctx.callbackQuery || !('data' in ctx.callbackQuery)) return;

  const telegramId = ctx.from?.id;
  if (!telegramId) return;

  const telegramUser = await isLoggedIn(telegramId);

  if (!telegramUser) {
    await ctx.answerCbQuery('Please login first');
    await ctx.editMessageText(
      '🔐 *Login Required*\n\nYou need to login to join communities\\.',
      {
        parse_mode: 'MarkdownV2',
        ...loginPromptKeyboard(),
      }
    );
    return;
  }

  const match = ctx.callbackQuery.data.match(/^community:join:(.+)$/);
  if (!match) return;

  const communityId = match[1];
  const result = await joinCommunity(telegramUser.user_id, communityId);

  if (!result.success) {
    await ctx.answerCbQuery(result.error || 'Failed to join');
    return;
  }

  await ctx.answerCbQuery('✅ Joined community!');

  // Refresh the view
  const community = await getCommunityById(communityId);
  if (community) {
    const memberCount = await getCommunityMemberCount(communityId);
    const events = await getCommunityEvents(communityId);

    const message = `
🏠 *${escapeMarkdown(community.name)}*
${community.tagline ? `\n_${escapeMarkdown(community.tagline)}_\n` : ''}
${community.description ? `\n${escapeMarkdown(community.description)}\n` : ''}
👥 *Members:* ${memberCount}
📅 *Upcoming Events:* ${events.length}
${community.verified ? '\n✅ Verified Community' : ''}

🎉 You are a member\\!
`;

    await ctx.editMessageText(message, {
      parse_mode: 'MarkdownV2',
      ...communityDetailKeyboard(community, true, config.appBaseUrl),
    });
  }
}

async function handleCommunityLeave(ctx: Context): Promise<void> {
  if (!ctx.callbackQuery || !('data' in ctx.callbackQuery)) return;

  const telegramId = ctx.from?.id;
  if (!telegramId) return;

  const telegramUser = await isLoggedIn(telegramId);

  if (!telegramUser) {
    await ctx.answerCbQuery('Please login first');
    return;
  }

  const match = ctx.callbackQuery.data.match(/^community:leave:(.+)$/);
  if (!match) return;

  const communityId = match[1];
  const result = await leaveCommunity(telegramUser.user_id, communityId);

  if (!result.success) {
    await ctx.answerCbQuery(result.error || 'Failed to leave');
    return;
  }

  await ctx.answerCbQuery('👋 Left community');

  // Refresh the view
  const community = await getCommunityById(communityId);
  if (community) {
    const memberCount = await getCommunityMemberCount(communityId);
    const events = await getCommunityEvents(communityId);

    const message = `
🏠 *${escapeMarkdown(community.name)}*
${community.tagline ? `\n_${escapeMarkdown(community.tagline)}_\n` : ''}
${community.description ? `\n${escapeMarkdown(community.description)}\n` : ''}
👥 *Members:* ${memberCount}
📅 *Upcoming Events:* ${events.length}
${community.verified ? '\n✅ Verified Community' : ''}
`;

    await ctx.editMessageText(message, {
      parse_mode: 'MarkdownV2',
      ...communityDetailKeyboard(community, false, config.appBaseUrl),
    });
  }
}

async function handleCommunityEvents(ctx: Context): Promise<void> {
  if (!ctx.callbackQuery || !('data' in ctx.callbackQuery)) return;

  const telegramId = ctx.from?.id;
  if (!telegramId) return;

  await ctx.answerCbQuery();

  const match = ctx.callbackQuery.data.match(/^community:events:(.+)$/);
  if (!match) return;

  const communityId = match[1];
  const community = await getCommunityById(communityId);

  if (!community) {
    return;
  }

  const events = await getCommunityEvents(communityId);

  if (events.length === 0) {
    await ctx.editMessageText(
      `📅 *Events from ${escapeMarkdown(community.name)}*\n\nNo upcoming events at the moment\\.\n\nCheck back later\\!`,
      {
        parse_mode: 'MarkdownV2',
        reply_markup: {
          inline_keyboard: [
            [{ text: '⬅️ Back', callback_data: `community:view:${communityId}` }],
          ],
        },
      }
    );
    return;
  }

  // Import event-related functions
  const { formatEventMessage } = await import('../../services/event.js');
  const { eventsKeyboard } = await import('../menus.js');

  const telegramUser = await isLoggedIn(telegramId);
  const userRegisteredEventIds = new Set<string>();

  if (telegramUser) {
    const { supabase } = await import('../../services/supabase.js');
    const { data: registrations } = await supabase
      .from('event_registrations')
      .select('event_id')
      .eq('user_id', telegramUser.user_id)
      .in('event_id', events.map((e) => e.id));

    if (registrations) {
      registrations.forEach((r: any) => userRegisteredEventIds.add(r.event_id));
    }
  }

  await ctx.editMessageText(
    `📅 *Events from ${escapeMarkdown(community.name)}*\n\n✅ = You are registered`,
    {
      parse_mode: 'MarkdownV2',
      ...eventsKeyboard(events, userRegisteredEventIds, 0),
    }
  );
}

function escapeMarkdown(text: string): string {
  return text.replace(/[_*[\]()~`>#+\-=|{}.!]/g, '\\$&');
}

