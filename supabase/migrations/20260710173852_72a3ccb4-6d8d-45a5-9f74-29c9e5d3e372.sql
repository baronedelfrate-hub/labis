CREATE TABLE public.tiss_glosa_codes (
  codigo varchar PRIMARY KEY,
  descricao text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.tiss_glosa_codes TO authenticated;
GRANT ALL ON public.tiss_glosa_codes TO service_role;
ALTER TABLE public.tiss_glosa_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read tiss codes" ON public.tiss_glosa_codes FOR SELECT TO authenticated USING (true);

ALTER TABLE public.billing_batch_items ADD COLUMN glosa_codigo varchar REFERENCES public.tiss_glosa_codes(codigo);
ALTER TABLE public.insurance_plans ADD COLUMN tiss_codigo_ans varchar, ADD COLUMN tiss_tabela varchar;
ALTER TABLE public.doctors ADD COLUMN tiss_cbos varchar, ADD COLUMN tiss_conselho varchar;
ALTER TABLE public.exams ADD COLUMN tiss_codigo_procedimento varchar;