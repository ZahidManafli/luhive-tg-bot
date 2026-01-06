-- Create telegram_users table for linking Telegram accounts to Luhive users
-- Run this in your Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.telegram_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    telegram_id BIGINT UNIQUE NOT NULL,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    chat_id BIGINT NOT NULL,
    username TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_telegram_users_telegram_id ON public.telegram_users(telegram_id);
CREATE INDEX IF NOT EXISTS idx_telegram_users_user_id ON public.telegram_users(user_id);

-- Enable Row Level Security
ALTER TABLE public.telegram_users ENABLE ROW LEVEL SECURITY;

-- Policy: Service role can do everything (our bot uses service role key)
CREATE POLICY "Service role full access" ON public.telegram_users
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- Comment for documentation
COMMENT ON TABLE public.telegram_users IS 'Links Telegram user accounts to Luhive user profiles for bot authentication and notifications';
COMMENT ON COLUMN public.telegram_users.telegram_id IS 'Telegram user ID (unique per Telegram account)';
COMMENT ON COLUMN public.telegram_users.user_id IS 'Reference to Luhive user profile';
COMMENT ON COLUMN public.telegram_users.chat_id IS 'Telegram chat ID for sending messages';
COMMENT ON COLUMN public.telegram_users.username IS 'Telegram username (optional)';

