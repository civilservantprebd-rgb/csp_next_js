-- Migration: 2026_study_groups.sql
-- স্টাডি গ্রুপ এবং সদস্য ট্র্যাকিং টেবিল

CREATE TABLE IF NOT EXISTS public.study_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course TEXT NOT NULL,
  name TEXT NOT NULL,
  invite_code TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- দ্রুত অনুসন্ধানের জন্য Index
CREATE INDEX IF NOT EXISTS idx_study_groups_course ON public.study_groups(course);
CREATE INDEX IF NOT EXISTS idx_study_groups_invite_code ON public.study_groups(invite_code);

-- স্টাডি গ্রুপের মেম্বার তালিকা
CREATE TABLE IF NOT EXISTS public.study_group_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.study_groups(id) ON DELETE CASCADE,
  student_id TEXT NOT NULL,
  student_name TEXT,
  student_email TEXT,
  joined_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(group_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_study_group_members_group_id ON public.study_group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_study_group_members_student_id ON public.study_group_members(student_id);

-- RLS চালু
ALTER TABLE public.study_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_group_members ENABLE ROW LEVEL SECURITY;

-- যেকোনো ইউজার যাতে ইনভাইট লিংকের মাধ্যমে গ্রুপ তথ্য দেখতে ও জয়েন করতে পারে
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'study_groups' AND policyname = 'Allow public read of study_groups'
  ) THEN
    CREATE POLICY "Allow public read of study_groups" ON public.study_groups FOR SELECT USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'study_group_members' AND policyname = 'Allow authenticated insert to study_group_members'
  ) THEN
    CREATE POLICY "Allow authenticated insert to study_group_members" ON public.study_group_members FOR INSERT WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'study_group_members' AND policyname = 'Allow public read of study_group_members'
  ) THEN
    CREATE POLICY "Allow public read of study_group_members" ON public.study_group_members FOR SELECT USING (true);
  END IF;
END $$;
