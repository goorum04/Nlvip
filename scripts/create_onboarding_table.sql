-- Script to add diet_onboarding_requests table
CREATE TABLE IF NOT EXISTS public.diet_onboarding_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  requested_by UUID REFERENCES public.profiles(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'submitted', 'completed', 'skipped')),
  responses JSONB,
  generated_diet_id UUID REFERENCES public.diet_templates(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Enable RLS
ALTER TABLE public.diet_onboarding_requests ENABLE ROW LEVEL SECURITY;

-- Policies: members can read/write their own, admins/trainers can read all
CREATE POLICY "members_own_onboarding" ON public.diet_onboarding_requests
  FOR ALL USING (member_id = auth.uid());

CREATE POLICY "staff_read_all_onboarding" ON public.diet_onboarding_requests
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'trainer')
    )
  );

CREATE POLICY "staff_insert_onboarding" ON public.diet_onboarding_requests
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'trainer')
    )
  );
