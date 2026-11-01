ALTER TABLE public.reference_ranges
  ADD COLUMN IF NOT EXISTS effective_from date,
  ADD COLUMN IF NOT EXISTS needs_review boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_reference_ranges_needs_review
  ON public.reference_ranges (company_id) WHERE needs_review = true;