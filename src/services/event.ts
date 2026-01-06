import { supabase, Event, EventRegistration } from './supabase.js';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';

dayjs.extend(utc);
dayjs.extend(timezone);

// Get published events for a community
export async function getCommunityEvents(communityId: string): Promise<Event[]> {
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('community_id', communityId)
    .eq('status', 'published')
    .gte('start_time', new Date().toISOString())
    .order('start_time', { ascending: true });

  if (error) {
    console.error('Error fetching events:', error);
    return [];
  }

  return data || [];
}

// Get event by ID
export async function getEventById(eventId: string): Promise<Event | null> {
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('id', eventId)
    .single();

  if (error) {
    console.error('Error fetching event:', error);
    return null;
  }

  return data;
}

// Get all upcoming events from user's communities
export async function getUserCommunityEvents(userId: string): Promise<(Event & { community_name: string; community_slug: string })[]> {
  // First get user's communities
  const { data: memberships, error: memberError } = await supabase
    .from('community_members')
    .select('community_id')
    .eq('user_id', userId);

  if (memberError || !memberships || memberships.length === 0) {
    return [];
  }

  const communityIds = memberships.map((m) => m.community_id).filter(Boolean) as string[];

  // Get events from those communities
  const { data: events, error: eventsError } = await supabase
    .from('events')
    .select(`
      *,
      communities!inner (
        name,
        slug
      )
    `)
    .in('community_id', communityIds)
    .eq('status', 'published')
    .gte('start_time', new Date().toISOString())
    .order('start_time', { ascending: true })
    .limit(10);

  if (eventsError) {
    console.error('Error fetching events:', eventsError);
    return [];
  }

  return (events || []).map((event: any) => ({
    ...event,
    community_name: event.communities.name,
    community_slug: event.communities.slug,
  }));
}

// Check if user is registered for an event
export async function isUserRegisteredForEvent(
  userId: string,
  eventId: string
): Promise<{ registered: boolean; status?: string }> {
  const { data, error } = await supabase
    .from('event_registrations')
    .select('id, approval_status')
    .eq('event_id', eventId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    console.error('Error checking registration:', error);
    return { registered: false };
  }

  if (!data) {
    return { registered: false };
  }

  return {
    registered: true,
    status: data.approval_status || 'approved',
  };
}

// Register user for an event
export async function registerForEvent(
  userId: string,
  eventId: string
): Promise<{ success: boolean; error?: string; status?: string }> {
  // Get event details first
  const event = await getEventById(eventId);
  if (!event) {
    return { success: false, error: 'Event not found' };
  }

  // Check if already registered
  const { registered } = await isUserRegisteredForEvent(userId, eventId);
  if (registered) {
    return { success: false, error: 'You are already registered for this event' };
  }

  // Check if event is external
  if (event.registration_type === 'external') {
    return {
      success: false,
      error: `This event uses external registration. Please register at: ${event.external_registration_url || 'the event page'}`,
    };
  }

  // Check capacity
  if (event.capacity) {
    const { count } = await supabase
      .from('event_registrations')
      .select('*', { count: 'exact', head: true })
      .eq('event_id', eventId)
      .eq('approval_status', 'approved');

    if (count && count >= event.capacity) {
      return { success: false, error: 'Event is at full capacity' };
    }
  }

  // Check registration deadline
  const deadline = event.registration_deadline
    ? new Date(event.registration_deadline)
    : new Date(event.start_time);

  if (new Date() > deadline) {
    return { success: false, error: 'Registration deadline has passed' };
  }

  // Determine approval status
  const approvalStatus = event.is_approve_required ? 'pending' : 'approved';

  // Create registration
  const { error } = await supabase
    .from('event_registrations')
    .insert({
      event_id: eventId,
      user_id: userId,
      rsvp_status: 'going',
      is_verified: true,
      approval_status: approvalStatus,
    });

  if (error) {
    console.error('Error registering for event:', error);
    return { success: false, error: 'Failed to register for event' };
  }

  return {
    success: true,
    status: approvalStatus,
  };
}

// Cancel registration
export async function cancelRegistration(
  userId: string,
  eventId: string
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from('event_registrations')
    .delete()
    .eq('event_id', eventId)
    .eq('user_id', userId);

  if (error) {
    console.error('Error cancelling registration:', error);
    return { success: false, error: 'Failed to cancel registration' };
  }

  return { success: true };
}

// Get registration count for an event
export async function getEventRegistrationCount(eventId: string): Promise<number> {
  const { count, error } = await supabase
    .from('event_registrations')
    .select('*', { count: 'exact', head: true })
    .eq('event_id', eventId)
    .eq('approval_status', 'approved');

  if (error) {
    console.error('Error fetching registration count:', error);
    return 0;
  }

  return count || 0;
}

// Format event for display
export function formatEventMessage(event: Event, communityName?: string): string {
  const startDate = dayjs(event.start_time).tz(event.timezone);
  const endDate = event.end_time ? dayjs(event.end_time).tz(event.timezone) : null;

  const eventTypeEmoji = {
    'in-person': '📍',
    'online': '💻',
    'hybrid': '🔄',
  }[event.event_type] || '📅';

  let message = `${eventTypeEmoji} *${escapeMarkdown(event.title)}*\n\n`;

  if (communityName) {
    message += `🏠 ${escapeMarkdown(communityName)}\n`;
  }

  message += `📅 ${startDate.format('dddd, MMMM D, YYYY')}\n`;
  message += `⏰ ${startDate.format('h:mm A')}`;
  if (endDate) {
    message += ` - ${endDate.format('h:mm A')}`;
  }
  message += ` (${event.timezone})\n`;

  if (event.location_address && event.event_type !== 'online') {
    message += `📍 ${escapeMarkdown(event.location_address)}\n`;
  }

  if (event.description) {
    const truncatedDesc = event.description.length > 200
      ? event.description.substring(0, 200) + '...'
      : event.description;
    message += `\n${escapeMarkdown(truncatedDesc)}`;
  }

  return message;
}

// Escape markdown special characters for Telegram
function escapeMarkdown(text: string): string {
  return text.replace(/[_*[\]()~`>#+\-=|{}.!]/g, '\\$&');
}

