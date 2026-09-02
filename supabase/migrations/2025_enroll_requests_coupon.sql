-- enroll_requests-এ কুপন কোড সংরক্ষণের কলাম (একবারই Run করুন)
alter table public.enroll_requests add column if not exists coupon text;