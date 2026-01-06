import { Telegraf } from 'telegraf';
import { getCommunityMembersWithTelegram, getCommunityById } from './community.js';
import { Event, supabase } from './supabase.js';
import { formatEventMessage } from './event.js';
import { config } from '../config.js';

// Send notification to all community members about new event
export async function notifyNewEvent(
  bot: Telegraf,
  event: Event
): Promise<{ sent: number; failed: number }> {
  const community = await getCommunityById(event.community_id);
  if (!community) {
    console.error('Community not found for event notification');
    return { sent: 0, failed: 0 };
  }

  // Get all community members with linked Telegram accounts
  const members = await getCommunityMembersWithTelegram(event.community_id);

  let sent = 0;
  let failed = 0;

  const message = `🎉 *New Event from ${escapeMarkdown(community.name)}\\!*\n\n` +
    formatEventMessage(event) +
    `\n\n🔗 [View Event](${config.appBaseUrl}/c/${community.slug}/events/${event.id})`;

  // Send notification to each member
  for (const member of members) {
    try {
      await bot.telegram.sendMessage(member.chat_id, message, {
        parse_mode: 'MarkdownV2',
        link_preview_options: { is_disabled: true },
      });
      sent++;

      // Small delay to avoid rate limiting
      await sleep(50);
    } catch (error) {
      console.error(`Failed to send notification to chat ${member.chat_id}:`, error);
      failed++;
    }
  }

  console.log(`Event notification sent: ${sent} success, ${failed} failed`);
  return { sent, failed };
}

// Send notification about event update
export async function notifyEventUpdate(
  bot: Telegraf,
  event: Event,
  updateType: 'cancelled' | 'updated' | 'deleted'
): Promise<{ sent: number; failed: number }> {
  const community = await getCommunityById(event.community_id);
  if (!community) {
    return { sent: 0, failed: 0 };
  }

  // Step 1: Get registered user_ids for this event
  const { data: registrations, error: regError } = await supabase
    .from('event_registrations')
    .select('user_id')
    .eq('event_id', event.id)
    .eq('approval_status', 'approved');

  if (regError || !registrations || registrations.length === 0) {
    if (regError) {
      console.error('Error fetching event registrations:', regError);
    }
    return { sent: 0, failed: 0 };
  }

  const userIds = registrations.map((r) => r.user_id);

  // Step 2: Get telegram users for those user_ids
  const { data: telegramUsers, error: telegramError } = await supabase
    .from('telegram_users')
    .select('telegram_id, chat_id, user_id')
    .in('user_id', userIds);

  if (telegramError || !telegramUsers || telegramUsers.length === 0) {
    if (telegramError) {
      console.error('Error fetching telegram users:', telegramError);
    }
    return { sent: 0, failed: 0 };
  }

  let sent = 0;
  let failed = 0;

  const emojiMap = { cancelled: '❌', updated: '📝', deleted: '🗑️' };
  const titleMap = { cancelled: 'Event Cancelled', updated: 'Event Updated', deleted: 'Event Deleted' };
  const emoji = emojiMap[updateType];
  const title = titleMap[updateType];

  const messageMap = {
    cancelled: 'This event has been cancelled\\. We apologize for any inconvenience\\.',
    updated: 'This event has been updated\\. Please check the event page for the latest details\\.',
    deleted: 'This event has been deleted and is no longer available\\.',
  };

  const message = `${emoji} *${title}*\n\n` +
    `*${escapeMarkdown(event.title)}*\n` +
    `🏠 ${escapeMarkdown(community.name)}\n\n` +
    messageMap[updateType] +
    (updateType !== 'deleted'
      ? `\n\n🔗 [View Event](${config.appBaseUrl}/c/${community.slug}/events/${event.id})`
      : '');

  for (const telegramInfo of telegramUsers) {
    try {
      await bot.telegram.sendMessage(Number(telegramInfo.chat_id), message, {
        parse_mode: 'MarkdownV2',
        link_preview_options: { is_disabled: true },
      });
      sent++;
      await sleep(50);
    } catch (error) {
      console.error(`Failed to send update notification to chat ${telegramInfo.chat_id}:`, error);
      failed++;
    }
  }

  console.log(`Event ${updateType} notification sent: ${sent} success, ${failed} failed`);
  return { sent, failed };
}

// Helper to escape markdown
function escapeMarkdown(text: string): string {
  return text.replace(/[_*[\]()~`>#+\-=|{}.!]/g, '\\$&');
}

// Helper sleep function
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

