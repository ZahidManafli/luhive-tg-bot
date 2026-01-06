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

  const message = `🎉 *New Event from ${escapeMarkdown(community.name)}!*\n\n` +
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
  updateType: 'cancelled' | 'updated'
): Promise<{ sent: number; failed: number }> {
  const community = await getCommunityById(event.community_id);
  if (!community) {
    return { sent: 0, failed: 0 };
  }

  // Get members who are registered for this event AND have telegram linked
  const { data: registrations } = await supabase
    .from('event_registrations')
    .select(`
      user_id,
      telegram_users!inner (
        telegram_id,
        chat_id
      )
    `)
    .eq('event_id', event.id)
    .eq('approval_status', 'approved');

  if (!registrations || registrations.length === 0) {
    return { sent: 0, failed: 0 };
  }

  let sent = 0;
  let failed = 0;

  const emoji = updateType === 'cancelled' ? '❌' : '📝';
  const title = updateType === 'cancelled' ? 'Event Cancelled' : 'Event Updated';

  const message = `${emoji} *${title}*\n\n` +
    `*${escapeMarkdown(event.title)}*\n` +
    `🏠 ${escapeMarkdown(community.name)}\n\n` +
    (updateType === 'cancelled'
      ? 'This event has been cancelled\\. We apologize for any inconvenience\\.'
      : 'This event has been updated\\. Please check the event page for the latest details\\.') +
    `\n\n🔗 [View Event](${config.appBaseUrl}/c/${community.slug}/events/${event.id})`;

  for (const reg of registrations) {
    const telegramInfo = reg.telegram_users as any;
    try {
      await bot.telegram.sendMessage(telegramInfo.chat_id, message, {
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

