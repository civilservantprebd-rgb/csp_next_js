-- ============================================================================
-- Referral System Database Schema & Tables
-- Supabase SQL Editor-এ একবার Run করুন (ইচ্ছামতো বারবার Run করা নিরাপদ)
-- ============================================================================

-- ১. রেফারেল কোড টেবিল
CREATE TABLE IF NOT EXISTS public.student_referral_codes (
  student_id TEXT PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_referral_code_lookup ON public.student_referral_codes (code);

-- ২. রেফারেল রেকর্ডস টেবিল
CREATE TABLE IF NOT EXISTS public.referral_records (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  referrer_id TEXT NOT NULL,
  referrer_name TEXT,
  referrer_email TEXT,
  referred_user_id TEXT NOT NULL,
  referred_user_name TEXT NOT NULL,
  referred_user_email TEXT,
  referral_code TEXT NOT NULL,
  course TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'completed'
  reward_amount NUMERIC NOT NULL DEFAULT 50,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_referral_referrer ON public.referral_records (referrer_id);
CREATE INDEX IF NOT EXISTS idx_referral_referred ON public.referral_records (referred_user_id);
CREATE INDEX IF NOT EXISTS idx_referral_status ON public.referral_records (status);

-- RLS চালু
ALTER TABLE public.student_referral_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_records ENABLE ROW LEVEL SECURITY;
