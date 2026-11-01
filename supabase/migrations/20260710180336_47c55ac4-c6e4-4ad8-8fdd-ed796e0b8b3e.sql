
CREATE TABLE public.tiss_conselhos_profissionais (
  codigo varchar PRIMARY KEY,
  descricao text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.tiss_conselhos_profissionais TO authenticated;
GRANT ALL ON public.tiss_conselhos_profissionais TO service_role;
ALTER TABLE public.tiss_conselhos_profissionais ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read tiss_conselhos_profissionais"
  ON public.tiss_conselhos_profissionais FOR SELECT TO authenticated USING (true);

INSERT INTO public.tiss_conselhos_profissionais (codigo, descricao) VALUES
  ('COREN','Conselho Federal de Enfermagem (COREN)'),
  ('CRAS','Conselho Regional de Assistência Social (CRAS)'),
  ('CREFITO','Conselho Regional de Fisiot. e Terapia Ocupacional (CREFITO)'),
  ('CRF','Conselho Regional de Farmácia (CRF)'),
  ('CRM','Conselho Regional de Medicina (CRM)'),
  ('CRN','Conselho Regional de Nutrição (CRN)'),
  ('CRO','Conselho Regional de Odontologia (CRO)'),
  ('CRP','Conselho Regional de Psicologia (CRP)'),
  ('CRFA','Conselho Regional de Fonoaudiologia (CRFA)'),
  ('OUT','Outros Conselhos')
ON CONFLICT (codigo) DO NOTHING;

-- Migra CBO antigo -> tiss_cbos onde tiss_cbos estiver vazio
UPDATE public.doctors
   SET tiss_cbos = cbos_code
 WHERE cbos_code IS NOT NULL AND cbos_code <> ''
   AND (tiss_cbos IS NULL OR tiss_cbos = '');

ALTER TABLE public.doctors DROP COLUMN IF EXISTS cbos_code;

-- FK opcional para conselho (mantém coluna existente tiss_conselho como código)
ALTER TABLE public.doctors
  ADD CONSTRAINT doctors_tiss_conselho_fkey
  FOREIGN KEY (tiss_conselho) REFERENCES public.tiss_conselhos_profissionais(codigo)
  ON UPDATE CASCADE ON DELETE SET NULL;
