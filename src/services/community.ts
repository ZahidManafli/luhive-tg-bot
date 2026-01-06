import { supabase, Community, CommunityMember } from './supabase.js';

// Get all communities
export async function getAllCommunities(): Promise<Community[]> {
  const { data, error } = await supabase
    .from('communities')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching communities:', error);
    return [];
  }

  return data || [];
}

// Get community by slug
export async function getCommunityBySlug(slug: string): Promise<Community | null> {
  const { data, error } = await supabase
    .from('communities')
    .select('*')
    .eq('slug', slug)
    .single();

  if (error) {
    console.error('Error fetching community:', error);
    return null;
  }

  return data;
}

// Get community by ID
export async function getCommunityById(communityId: string): Promise<Community | null> {
  const { data, error } = await supabase
    .from('communities')
    .select('*')
    .eq('id', communityId)
    .single();

  if (error) {
    console.error('Error fetching community:', error);
    return null;
  }

  return data;
}

// Get user's joined communities
export async function getUserCommunities(userId: string): Promise<Community[]> {
  const { data, error } = await supabase
    .from('community_members')
    .select(`
      community_id,
      communities (*)
    `)
    .eq('user_id', userId);

  if (error) {
    console.error('Error fetching user communities:', error);
    return [];
  }

  // Extract communities from the joined data
  return (data || [])
    .map((item: any) => item.communities)
    .filter((c: Community | null): c is Community => c !== null);
}

// Check if user is member of a community
export async function isUserMemberOfCommunity(
  userId: string,
  communityId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from('community_members')
    .select('id')
    .eq('user_id', userId)
    .eq('community_id', communityId)
    .maybeSingle();

  if (error) {
    console.error('Error checking membership:', error);
    return false;
  }

  return !!data;
}

// Join a community
export async function joinCommunity(
  userId: string,
  communityId: string
): Promise<{ success: boolean; error?: string }> {
  // Check if already a member
  const isMember = await isUserMemberOfCommunity(userId, communityId);
  if (isMember) {
    return { success: false, error: 'You are already a member of this community' };
  }

  const { error } = await supabase
    .from('community_members')
    .insert({
      user_id: userId,
      community_id: communityId,
      role: 'member',
    });

  if (error) {
    console.error('Error joining community:', error);
    return { success: false, error: 'Failed to join community' };
  }

  return { success: true };
}

// Leave a community
export async function leaveCommunity(
  userId: string,
  communityId: string
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from('community_members')
    .delete()
    .eq('user_id', userId)
    .eq('community_id', communityId);

  if (error) {
    console.error('Error leaving community:', error);
    return { success: false, error: 'Failed to leave community' };
  }

  return { success: true };
}

// Get member count for a community
export async function getCommunityMemberCount(communityId: string): Promise<number> {
  const { count, error } = await supabase
    .from('community_members')
    .select('*', { count: 'exact', head: true })
    .eq('community_id', communityId);

  if (error) {
    console.error('Error fetching member count:', error);
    return 0;
  }

  return count || 0;
}

// Get community members with telegram accounts linked
export async function getCommunityMembersWithTelegram(
  communityId: string
): Promise<{ telegram_id: number; chat_id: number; user_id: string }[]> {
  const { data, error } = await supabase
    .from('community_members')
    .select(`
      user_id,
      telegram_users!inner (
        telegram_id,
        chat_id
      )
    `)
    .eq('community_id', communityId);

  if (error) {
    console.error('Error fetching community telegram members:', error);
    return [];
  }

  return (data || []).map((item: any) => ({
    telegram_id: item.telegram_users.telegram_id,
    chat_id: item.telegram_users.chat_id,
    user_id: item.user_id,
  }));
}

