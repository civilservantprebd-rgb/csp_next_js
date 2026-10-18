-- Migration: Add bKash Number and Payout Tracking to Referral System
-- Date: 2026-10-18

-- 1. Add bKash and Payment Status columns to referral_records table
ALTER TABLE public.referral_records
ADD COLUMN IF NOT EXISTS referrer_bkash TEXT,
ADD COLUMN IF NOT EXISTS referred_user_bkash TEXT,
ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'unpaid',
ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS payment_note TEXT;

-- 2. Index for fast querying by payment_status
CREATE INDEX IF NOT EXISTS idx_referral_records_payment_status
ON public.referral_records(payment_status);

-- 3. Index for querying by referrer bKash
CREATE INDEX IF NOT EXISTS idx_referral_records_referrer_bkash
ON public.referral_records(referrer_bkash);
