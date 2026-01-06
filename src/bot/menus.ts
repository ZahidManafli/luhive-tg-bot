import { Markup } from 'telegraf';
import { Community, Event } from '../services/supabase.js';

// Main menu keyboard (persistent)
export const mainMenuKeyboard: ReturnType<typeof Markup.keyboard> = Markup.keyboard([
  ['📋 Communities', '📅 Events'],
  ['👤 Profile', '❓ Help'],
]).resize();

// Community list inline keyboard
export function communitiesKeyboard(
  communities: Community[],
  userCommunityIds: Set<string>,
  page: number = 0,
  pageSize: number = 5
): ReturnType<typeof Markup.inlineKeyboard> {
  const start = page * pageSize;
  const end = start + pageSize;
  const pageCommunities = communities.slice(start, end);
  const totalPages = Math.ceil(communities.length / pageSize);

  const buttons = pageCommunities.map((community) => {
    const isMember = userCommunityIds.has(community.id);
    const statusEmoji = isMember ? '✅' : '';
    const actionPrefix = isMember ? 'leave' : 'join';

    return [
      Markup.button.callback(
        `${statusEmoji} ${community.name}`,
        `community:view:${community.id}`
      ),
      Markup.button.callback(
        isMember ? '🚪 Leave' : '➕ Join',
        `community:${actionPrefix}:${community.id}`
      ),
    ];
  });

  // Pagination buttons
  const navButtons = [];
  if (page > 0) {
    navButtons.push(Markup.button.callback('⬅️ Prev', `communities:page:${page - 1}`));
  }
  if (page < totalPages - 1) {
    navButtons.push(Markup.button.callback('Next ➡️', `communities:page:${page + 1}`));
  }
  if (navButtons.length > 0) {
    buttons.push(navButtons);
  }

  return Markup.inlineKeyboard(buttons);
}

// Event list inline keyboard
export function eventsKeyboard(
  events: (Event & { community_name?: string })[],
  userRegisteredEventIds: Set<string>,
  page: number = 0,
  pageSize: number = 5
): ReturnType<typeof Markup.inlineKeyboard> {
  const start = page * pageSize;
  const end = start + pageSize;
  const pageEvents = events.slice(start, end);
  const totalPages = Math.ceil(events.length / pageSize);

  const buttons = pageEvents.map((event) => {
    const isRegistered = userRegisteredEventIds.has(event.id);
    const statusEmoji = isRegistered ? '✅' : '📅';

    return [
      Markup.button.callback(
        `${statusEmoji} ${truncate(event.title, 25)}`,
        `event:view:${event.id}`
      ),
    ];
  });

  // Pagination buttons
  const navButtons = [];
  if (page > 0) {
    navButtons.push(Markup.button.callback('⬅️ Prev', `events:page:${page - 1}`));
  }
  if (page < totalPages - 1) {
    navButtons.push(Markup.button.callback('Next ➡️', `events:page:${page + 1}`));
  }
  if (navButtons.length > 0) {
    buttons.push(navButtons);
  }

  return Markup.inlineKeyboard(buttons);
}

// Event detail inline keyboard
export function eventDetailKeyboard(
  event: Event,
  communitySlug: string,
  isRegistered: boolean,
  isExternal: boolean,
  appBaseUrl: string
): ReturnType<typeof Markup.inlineKeyboard> {
  const buttons: (ReturnType<typeof Markup.button.callback> | ReturnType<typeof Markup.button.url>)[][] = [];

  if (isExternal) {
    // External event - show link to external registration
    if (event.external_registration_url) {
      buttons.push([
        Markup.button.url('🔗 Register (External)', event.external_registration_url),
      ]);
    }
  } else if (isRegistered) {
    // Native event - user is registered
    buttons.push([
      Markup.button.callback('❌ Cancel Registration', `event:cancel:${event.id}`),
    ]);
  } else {
    // Native event - user not registered
    buttons.push([
      Markup.button.callback('✅ Register', `event:register:${event.id}`),
    ]);
  }

  // Always show link to web view
  buttons.push([
    Markup.button.url('🌐 View on Web', `${appBaseUrl}/c/${communitySlug}/events/${event.id}`),
  ]);

  // Back button
  buttons.push([Markup.button.callback('⬅️ Back to Events', 'events:back')]);

  return Markup.inlineKeyboard(buttons as any);
}

// Community detail inline keyboard
export function communityDetailKeyboard(
  community: Community,
  isMember: boolean,
  appBaseUrl: string
): ReturnType<typeof Markup.inlineKeyboard> {
  const buttons = [
    [
      isMember
        ? Markup.button.callback('🚪 Leave Community', `community:leave:${community.id}`)
        : Markup.button.callback('➕ Join Community', `community:join:${community.id}`),
    ],
    [Markup.button.callback('📅 View Events', `community:events:${community.id}`)],
    [Markup.button.url('🌐 View on Web', `${appBaseUrl}/c/${community.slug}`)],
    [Markup.button.callback('⬅️ Back', 'communities:back')],
  ];

  return Markup.inlineKeyboard(buttons);
}

// Login prompt keyboard
export function loginPromptKeyboard(): ReturnType<typeof Markup.inlineKeyboard> {
  return Markup.inlineKeyboard([
    [Markup.button.callback('🔐 Login Now', 'action:login')],
  ]);
}

// Confirmation keyboard
export function confirmationKeyboard(
  confirmAction: string,
  cancelAction: string
): ReturnType<typeof Markup.inlineKeyboard> {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('✅ Confirm', confirmAction),
      Markup.button.callback('❌ Cancel', cancelAction),
    ],
  ]);
}

// Helper function to truncate text
function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

