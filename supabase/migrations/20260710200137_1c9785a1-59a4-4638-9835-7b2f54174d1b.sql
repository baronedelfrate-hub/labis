
-- 1. exam_parameters
CREATE TYPE public.exam_value_type AS ENUM ('numeric', 'qualitative', 'text');

CREATE TABLE public.exam_parameters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id UUID NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
  code TEXT,
  name TEXT NOT NULL,
  unit TEXT,
  display_order INT NOT NULL DEFAULT 0,
  value_type public.exam_value_type NOT NULL DEFAULT 'numeric',
  group_label TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_exam_parameters_exam ON public.exam_parameters(exam_id, display_order);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.exam_parameters TO authenticated;
GRANT ALL ON public.exam_parameters TO service_role;
ALTER TABLE public.exam_parameters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "exam_parameters_by_company" ON public.exam_parameters
FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.exams e WHERE e.id = exam_parameters.exam_id AND e.company_id = public.get_user_company_id()))
WITH CHECK (EXISTS (SELECT 1 FROM public.exams e WHERE e.id = exam_parameters.exam_id AND e.company_id = public.get_user_company_id()));

CREATE TRIGGER trg_exam_parameters_updated_at BEFORE UPDATE ON public.exam_parameters
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- 2. reference_ranges
CREATE TYPE public.sex_type AS ENUM ('M', 'F');

CREATE TABLE public.reference_ranges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  exam_id UUID REFERENCES public.exams(id) ON DELETE CASCADE,
  exam_parameter_id UUID REFERENCES public.exam_parameters(id) ON DELETE CASCADE,
  sex public.sex_type,
  age_min_months INT,
  age_max_months INT,
  range_min NUMERIC,
  range_max NUMERIC,
  category_label TEXT,
  display_text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT reference_ranges_target_check CHECK (
    (exam_id IS NOT NULL AND exam_parameter_id IS NULL) OR
    (exam_id IS NULL AND exam_parameter_id IS NOT NULL)
  )
);
CREATE INDEX idx_reference_ranges_exam ON public.reference_ranges(exam_id);
CREATE INDEX idx_reference_ranges_param ON public.reference_ranges(exam_parameter_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.reference_ranges TO authenticated;
GRANT ALL ON public.reference_ranges TO service_role;
ALTER TABLE public.reference_ranges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reference_ranges_by_company" ON public.reference_ranges
FOR ALL TO authenticated
USING (company_id = public.get_user_company_id())
WITH CHECK (company_id = public.get_user_company_id());

CREATE TRIGGER trg_reference_ranges_updated_at BEFORE UPDATE ON public.reference_ranges
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- 3. result_values
CREATE TABLE public.result_values (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  result_id UUID NOT NULL REFERENCES public.results(id) ON DELETE CASCADE,
  exam_parameter_id UUID REFERENCES public.exam_parameters(id) ON DELETE SET NULL,
  value TEXT NOT NULL,
  unit TEXT,
  reference_display_text TEXT,
  reference_min NUMERIC,
  reference_max NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_result_values_result ON public.result_values(result_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.result_values TO authenticated;
GRANT ALL ON public.result_values TO service_role;
ALTER TABLE public.result_values ENABLE ROW LEVEL SECURITY;

CREATE POLICY "result_values_by_company" ON public.result_values
FOR ALL TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.results r
  JOIN public.order_items oi ON oi.id = r.order_item_id
  JOIN public.orders o ON o.id = oi.order_id
  WHERE r.id = result_values.result_id AND o.company_id = public.get_user_company_id()
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.results r
  JOIN public.order_items oi ON oi.id = r.order_item_id
  JOIN public.orders o ON o.id = oi.order_id
  WHERE r.id = result_values.result_id AND o.company_id = public.get_user_company_id()
));

-- 4. results: method, reviewed_by
ALTER TABLE public.results
  ADD COLUMN method TEXT,
  ADD COLUMN reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

-- 5. exams: default_method, standard_notes
ALTER TABLE public.exams
  ADD COLUMN default_method TEXT,
  ADD COLUMN standard_notes TEXT;

-- 6. profiles: professional_council, professional_registration
ALTER TABLE public.profiles
  ADD COLUMN professional_council VARCHAR REFERENCES public.tiss_conselhos_profissionais(codigo),
  ADD COLUMN professional_registration TEXT;
