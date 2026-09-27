CREATE TABLE IF NOT EXISTS payment_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_uid TEXT NOT NULL,
  student_name TEXT,
  student_email TEXT,
  courses TEXT NOT NULL,
  amount TEXT,
  trx_id TEXT,
  coupon TEXT,
  approved_at TIMESTAMPTZ DEFAULT NOW()
);