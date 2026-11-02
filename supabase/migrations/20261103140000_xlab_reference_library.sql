-- Biblioteca de referência vinda do XLAB7: catálogo de exames, preços e CID-10.
--
-- São tabelas de CONSULTA, iguais para todas as empresas (não têm company_id): quem lê é qualquer
-- usuário logado e ninguém grava pelo sistema (a carga é feita pelo painel do Supabase, por CSV).
--
-- * xlab_legacy_exams: os 1.151 exames do XLAB7. O sistema não despeja tudo na lista de exames da
--   empresa: o usuário busca na biblioteca e importa só o que usa (nome, material, prazo...).
-- * xlab_legacy_price_tables / xlab_legacy_prices: tabelas de preço do XLAB7 (AMB, CIEFAS, TUSS,
--   SUS, particular). Ficam como biblioteca; o preço é copiado quando o exame é importado.
-- * cid10: classificação de doenças, com busca no pedido.
-- * orders.cid10_code: CID-10 opcional do pedido.
-- * price_tables.legacy_code: liga uma tabela de preço da empresa a uma da biblioteca.
--
-- Mudança aditiva.

CREATE TABLE public.xlab_legacy_exams (
  code text PRIMARY KEY,
  name text NOT NULL,
  amb_code text,
  sector text,          -- no XLAB7: setor/laboratório que realiza (BIOQ, RHESUS, FLEURY...)
  material text,
  days integer,         -- prazo de entrega em dias
  fasting_hours integer,
  price_sector text,
  label_group text
);

CREATE TABLE public.xlab_legacy_price_tables (
  code text PRIMARY KEY,
  name text NOT NULL,
  unit text NOT NULL CHECK (unit IN ('R$', 'CH')) -- CH = coeficiente de honorários (precisa de um valor de CH)
);

CREATE TABLE public.xlab_legacy_prices (
  table_code text NOT NULL,
  exam_code text NOT NULL,
  price numeric,
  factor numeric,
  PRIMARY KEY (table_code, exam_code)
);
CREATE INDEX xlab_legacy_prices_exam_idx ON public.xlab_legacy_prices (exam_code);

CREATE TABLE public.cid10 (
  code text PRIMARY KEY,
  name text NOT NULL
);

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['xlab_legacy_exams', 'xlab_legacy_price_tables', 'xlab_legacy_prices', 'cid10'] LOOP
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC, anon, authenticated', t);
    EXECUTE format('GRANT SELECT ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY "authenticated read %s" ON public.%I FOR SELECT TO authenticated USING (true)', t, t);
  END LOOP;
END $$;

INSERT INTO public.xlab_legacy_price_tables (code, name, unit) VALUES
  ('92', 'TABELA COMPLEMENTAR 1992 - EM CHS', 'CH'),
  ('96', 'TABELA COMPLEMENTAR 1996 - EM R$', 'R$'),
  ('99', 'TABELA COMPLEMENTAR 1999 - EM R$', 'R$'),
  ('AMB', 'TABELA AMB ASSOCIAÇÃO MÉDICA BRASILEIRA', 'CH'),
  ('AMB90', 'TABELA COMPLETA AMB 1990 - EM CHS', 'CH'),
  ('AMB92', 'TABELA COMPLETA AMB 1992 - EM CHS', 'CH'),
  ('AMB96', 'TABELA COMPLETA AMB 1996 - EM R$', 'R$'),
  ('AMB99', 'TABELA COMPLETA AMB 1999 - EM R$', 'R$'),
  ('CIEFAS', 'TABELA CIEFAS 1993 - EM CHS', 'CH'),
  ('CIEFAS2', 'TABELA CIEFAS 2000 - VALOR EM R$', 'R$'),
  ('CIEFAS96', 'TABELA CIEFAS 1996 - VALOR EM R$', 'R$'),
  ('PART', 'TABELA PARTICULAR - VALOR EM R$', 'R$'),
  ('SUS', 'TABELA SUS - SISTEMA ÚNICO DE SAÚDE- R$', 'R$'),
  ('TUSS90', 'TUSS 90', 'CH'),
  ('TUSS92', 'TUSS 92', 'CH');

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS cid10_code text;
ALTER TABLE public.price_tables ADD COLUMN IF NOT EXISTS legacy_code text;
