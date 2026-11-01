
CREATE TABLE public.xlab_legacy_reference_staging (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_code text NOT NULL,
  source text NOT NULL CHECK (source IN ('param','reference')),
  param_code text,
  param_order int,
  unit text,
  label text,
  range_min numeric,
  range_max numeric,
  reference_text text,
  sex text,
  effective_from date,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_xlab_legacy_exam_code ON public.xlab_legacy_reference_staging (exam_code);

GRANT SELECT ON public.xlab_legacy_reference_staging TO authenticated;
GRANT ALL ON public.xlab_legacy_reference_staging TO service_role;

ALTER TABLE public.xlab_legacy_reference_staging ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Legacy staging readable by authenticated"
  ON public.xlab_legacy_reference_staging
  FOR SELECT TO authenticated
  USING (true);
