-- Cadastro de convênios (operadoras) do XLAB7 e marca de exame tipo texto no catálogo.
--
-- * xlab_legacy_insurances: operadoras que o XLAB7 trazia, com o código de registro na ANS e a tabela
--   TISS. Consulta, igual para todas as empresas; ao cadastrar um convênio o usuário escolhe uma e o
--   sistema preenche nome, código, ANS e tabela TISS. Particular e AMB não entram (a empresa já nasce
--   com o convênio Particular) e o item de teste "XX" ficou de fora.
-- * xlab_legacy_exams.is_text: no XLAB7 o tipo "X" é o exame de resultado em texto (anatomopatológico,
--   antibiograma, cultura...). O catálogo passa a informar isso e o cadastro marca "exame tipo texto".
--
-- Mudança aditiva.

CREATE TABLE public.xlab_legacy_insurances (
  code text PRIMARY KEY,
  name text NOT NULL,
  ans_code text,
  tiss_table text,
  price_table_code text,   -- tabela de preço que o XLAB7 usava (ex.: AMB90)
  price_factor numeric     -- fator aplicado sobre a tabela (ex.: 0,27)
);

REVOKE ALL ON public.xlab_legacy_insurances FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.xlab_legacy_insurances TO authenticated;
GRANT ALL ON public.xlab_legacy_insurances TO service_role;
ALTER TABLE public.xlab_legacy_insurances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated read xlab_legacy_insurances" ON public.xlab_legacy_insurances FOR SELECT TO authenticated USING (true);

INSERT INTO public.xlab_legacy_insurances (code, name, ans_code, tiss_table, price_table_code, price_factor) VALUES
  ('AMIL', 'AMIL ASSISTENCIA MÉDICA', '326305', '01', 'AMB90', 1),
  ('BLIFE', 'BLUE LIFE - ASSOC. MED DE SÃO PAULO', '304662', '01', 'AMB90', 1),
  ('BRADESCO', 'BRADESCO SAÚDE SEG. S/A', '005711', '00', 'BRADESCO', 1),
  ('GCROSS', 'GOLDEN CROSS ASSISTÊNCIA MÉDICA', '403911', '00', 'GOLDEN', 1),
  ('ISS', 'ISS-INTERMEDICA SISTEMA DE SAÚDE LTDA', '359017', '00', 'AMB90', 1),
  ('MARITIMA', 'MARITIMA  CIA. SEGUROS GERAIS', '000477', '00', 'MARITIMA', 1),
  ('PSEGURO', 'PORTO SEGURO SAUDE - CIA DE SEG. GERAIS', '000582', '01', 'AMB90', 1),
  ('UNIMEDP', 'UNIMED PAULISTANA', '301337', '01', 'AMB90', 0.27);

ALTER TABLE public.xlab_legacy_exams ADD COLUMN IF NOT EXISTS is_text boolean NOT NULL DEFAULT false;

UPDATE public.xlab_legacy_exams SET is_text = true WHERE code IN ('AGP', 'ANP', 'ANPA', 'ANPP', 'ANPR', 'ANPRG', 'ATB', 'ATB1', 'ATB2', 'ATB3', 'ATB4', 'ATB5', 'ATBA', 'ATBBK1', 'ATBBK2', 'ATBEN', 'ATBGN', 'ATBSTF', 'ATBURO', 'BACSV', 'CLAMI', 'COL', 'COPROC', 'CULT', 'CULT1', 'CULT2', 'CULT3', 'CULT4', 'CULTNEG', 'CULTSV', 'ICLL', 'IMEF', 'MIELO', 'PEROX', 'PKUA', 'PKUC', 'RL', 'URO', 'URO+');
