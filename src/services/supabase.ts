import { createClient } from '@supabase/supabase-js';
import { config } from '../config.js';

// Database types based on luhive-mvp schema
export interface TelegramUser {
  id: string;
  telegram_id: number;
  user_id: string;
  chat_id: number;
  username?: string | null;
  created_at: string;
}

export interface Community {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  tagline: string | null;
  logo_url: string | null;
  cover_url: string | null;
  verified: boolean | null;
  created_by: string;
  created_at: string | null;
}

export interface CommunityMember {
  id: string;
  community_id: string | null;
  user_id: string | null;
  role: string | null;
  joined_at: string | null;
}

export interface Event {
  id: string;
  title: string;
  description: string | null;
  community_id: string;
  start_time: string;
  end_time: string | null;
  timezone: string;
  location_address: string | null;
  online_meeting_link: string | null;
  event_type: 'in-person' | 'online' | 'hybrid';
  status: 'draft' | 'published' | 'cancelled';
  capacity: number | null;
  cover_url: string | null;
  registration_type: string | null;
  registration_deadline: string | null;
  external_registration_url: string | null;
  is_approve_required: boolean;
  created_at: string | null;
  slug: string | null;
}

export interface EventRegistration {
  id: string;
  event_id: string;
  user_id: string | null;
  anonymous_email: string | null;
  anonymous_name: string | null;
  rsvp_status: 'going' | 'not_going' | 'maybe';
  approval_status: 'pending' | 'approved' | 'rejected' | null;
  is_verified: boolean;
  registered_at: string | null;
}

export interface Profile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  bio: string | null;
}

// Create Supabase client with service role key (bypasses RLS)
export const supabase = createClient(
  config.supabaseUrl,
  config.supabaseServiceRoleKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

// Helper to get or create telegram user link
export async function getTelegramUser(telegramId: number): Promise<TelegramUser | null> {
  const { data, error } = await supabase
    .from('telegram_users')
    .select('*')
    .eq('telegram_id', telegramId)
    .single();

  if (error && error.code !== 'PGRST116') {
    console.error('Error fetching telegram user:', error);
    return null;
  }

  return data;
}

// Link telegram account to luhive user
export async function linkTelegramUser(
  telegramId: number,
  chatId: number,
  userId: string,
  username?: string
): Promise<TelegramUser | null> {
  const { data, error } = await supabase
    .from('telegram_users')
    .upsert({
      telegram_id: telegramId,
      chat_id: chatId,
      user_id: userId,
      username: username || null,
    }, {
      onConflict: 'telegram_id',
    })
    .select()
    .single();

  if (error) {
    console.error('Error linking telegram user:', error);
    return null;
  }

  return data;
}

// Unlink telegram account
export async function unlinkTelegramUser(telegramId: number): Promise<boolean> {
  const { error } = await supabase
    .from('telegram_users')
    .delete()
    .eq('telegram_id', telegramId);

  if (error) {
    console.error('Error unlinking telegram user:', error);
    return false;
  }

  return true;
}

// Authenticate user with email/password
export async function authenticateUser(
  email: string,
  password: string
): Promise<{ user: { id: string; email: string } } | { error: string }> {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { error: error.message };
  }

  if (!data.user) {
    return { error: 'Authentication failed' };
  }

  return {
    user: {
      id: data.user.id,
      email: data.user.email || email,
    },
  };
}

// Get user profile
export async function getUserProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) {
    console.error('Error fetching profile:', error);
    return null;
  }

  return data;
}

