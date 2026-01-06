import {
  authenticateUser,
  getTelegramUser,
  linkTelegramUser,
  unlinkTelegramUser,
  getUserProfile,
  TelegramUser,
  Profile,
} from './supabase.js';

export interface AuthResult {
  success: boolean;
  error?: string;
  user?: {
    id: string;
    email: string;
    profile?: Profile | null;
  };
}

// Check if telegram user is logged in
export async function isLoggedIn(telegramId: number): Promise<TelegramUser | null> {
  return getTelegramUser(telegramId);
}

// Login user with email and password
export async function login(
  telegramId: number,
  chatId: number,
  email: string,
  password: string,
  username?: string
): Promise<AuthResult> {
  // Check if already logged in
  const existingLink = await getTelegramUser(telegramId);
  if (existingLink) {
    return {
      success: false,
      error: 'You are already logged in. Use /logout first to switch accounts.',
    };
  }

  // Authenticate with Supabase
  const authResult = await authenticateUser(email, password);

  if ('error' in authResult) {
    return {
      success: false,
      error: authResult.error,
    };
  }

  // Link telegram account to luhive user
  const linked = await linkTelegramUser(
    telegramId,
    chatId,
    authResult.user.id,
    username
  );

  if (!linked) {
    return {
      success: false,
      error: 'Failed to link your Telegram account. Please try again.',
    };
  }

  // Get user profile
  const profile = await getUserProfile(authResult.user.id);

  return {
    success: true,
    user: {
      id: authResult.user.id,
      email: authResult.user.email,
      profile,
    },
  };
}

// Logout user
export async function logout(telegramId: number): Promise<{ success: boolean; error?: string }> {
  const telegramUser = await getTelegramUser(telegramId);
  if (!telegramUser) {
    return {
      success: false,
      error: 'You are not logged in.',
    };
  }

  const unlinked = await unlinkTelegramUser(telegramId);
  if (!unlinked) {
    return {
      success: false,
      error: 'Failed to logout. Please try again.',
    };
  }

  return { success: true };
}

// Get current user info
export async function getCurrentUser(telegramId: number): Promise<{
  telegramUser: TelegramUser;
  profile: Profile | null;
} | null> {
  const telegramUser = await getTelegramUser(telegramId);
  if (!telegramUser) {
    return null;
  }

  const profile = await getUserProfile(telegramUser.user_id);
  return { telegramUser, profile };
}

