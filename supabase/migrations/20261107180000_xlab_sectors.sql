-- Setores do XLAB7 para a tela de exames.
--
-- * xlab_legacy_sectors: dicionário de consulta (igual para todas as empresas), vindo do XLAB7.
--     kind = 'tecnico' -> LSETORTEC: setor técnico que EXECUTA o exame (bioquímica, bacteriologia...
--                         e também laboratórios de apoio, como "APOIO CRIESP").
--     kind = 'preco'   -> LSETORPRE: setor de preço (agrupamento usado para preço/faturamento).
-- * exams.tech_sector / exams.price_sector: o código escolhido para cada exame da empresa
--   (LEXAM.SETOR e LEXAM.SETORPRECO no XLAB7). Os existentes são preenchidos pelo catálogo, pelo código do exame.
--
-- Mudança aditiva. Colunas novas de exams são copiadas sozinhas para empresas novas (clone_company_defaults).

CREATE TABLE IF NOT EXISTS public.xlab_legacy_sectors (
  kind text NOT NULL CHECK (kind IN ('tecnico', 'preco')),
  code text NOT NULL,
  name text NOT NULL,
  PRIMARY KEY (kind, code)
);

REVOKE ALL ON public.xlab_legacy_sectors FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.xlab_legacy_sectors TO authenticated;
GRANT ALL ON public.xlab_legacy_sectors TO service_role;
ALTER TABLE public.xlab_legacy_sectors ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'xlab_legacy_sectors' AND policyname = 'authenticated read xlab_legacy_sectors') THEN
    CREATE POLICY "authenticated read xlab_legacy_sectors" ON public.xlab_legacy_sectors FOR SELECT TO authenticated USING (true);
  END IF;
END $$;

INSERT INTO public.xlab_legacy_sectors (kind, code, name) VALUES
  ('tecnico', 'APAE', 'APAE'),
  ('tecnico', 'BACT', 'BACTERIOLOGIA'),
  ('tecnico', 'BARONE', 'APOIO BARONE'),
  ('tecnico', 'BIOQ', 'BIOQUÍMICA'),
  ('tecnico', 'BLOQUEADO', 'CÓDIGO BLOQUEADO'),
  ('tecnico', 'CENT.HEM.', 'C. HEMATOL.DE SÃO PAULO - 3372 6611'),
  ('tecnico', 'COLETA', 'COLETA'),
  ('tecnico', 'CONSULTAR', 'CONSULTAR'),
  ('tecnico', 'CRIESP', 'APOIO CRIESP - CÓDIGO 4502'),
  ('tecnico', 'CTN', 'APOIO CTN'),
  ('tecnico', 'DIAMED', 'APOIO DIAMED'),
  ('tecnico', 'DLE', 'DLE'),
  ('tecnico', 'ELETRO', 'ELETRO'),
  ('tecnico', 'ENDOMED', 'ENDOMED'),
  ('tecnico', 'ESP', 'ESPERMOGRAMA'),
  ('tecnico', 'EXCLUIR', 'EXCLUIR'),
  ('tecnico', 'FLEURY', 'APOIO FLEURY'),
  ('tecnico', 'HEMATO', 'HEMATOLOGIA'),
  ('tecnico', 'IMT', 'APOIO IMT'),
  ('tecnico', 'IMUNO/HOR', 'IMUNO/HORMONIO'),
  ('tecnico', 'IPOG', 'INST.PESQ.ONCOLOGIA GINECOLÓGICA'),
  ('tecnico', 'LQR', 'LIQUOR'),
  ('tecnico', 'NAO REALIZ', 'NAO REALIZA'),
  ('tecnico', 'NOVOLAB', 'APOIO NOVOLAB'),
  ('tecnico', 'PARASITO', 'PARASITO'),
  ('tecnico', 'RHESUS', 'APOIO RHESUS - CÓDIGO=2679'),
  ('tecnico', 'SIRIO', 'APOIO SIRIO'),
  ('tecnico', 'SORO', 'SOROLOGIA'),
  ('tecnico', 'TAB96', 'EXAME DA TAB. 96'),
  ('tecnico', 'TAB99', 'EXAME DA TAB.99'),
  ('tecnico', 'URINALISE', 'URINALISE'),
  ('preco', 'ANATOMO', 'ANATOMO PATOLÓGICO'),
  ('preco', 'BACT', 'MICROBIOLOGIA'),
  ('preco', 'BIO', 'BIOQUÍMICA'),
  ('preco', 'BIO_R', 'BIOQUIMICA ROSARIO EMERGENCIA'),
  ('preco', 'BMOLECU', 'BIOLOGIA MOLECULAR'),
  ('preco', 'BRADESCO', 'CODIGO BRADESCO'),
  ('preco', 'BSANGUE', 'BANCO DE SANGUE'),
  ('preco', 'CITOGENET', 'CITOGENÉTICA'),
  ('preco', 'COLETA', 'COLETA DOMICILIAR'),
  ('preco', 'DIVER', 'DIVERSOS'),
  ('preco', 'DROGAS', 'DROGAS PSICOATIVAS DE USO ILÍCITO'),
  ('preco', 'ESP', 'ESPERMA'),
  ('preco', 'ESPECIAL', 'EXAMES ESPECIAIS NÃO CONSTAM EM TABELA'),
  ('preco', 'FEZ', 'FEZES'),
  ('preco', 'HEMATO', 'HEMATOLOGIA'),
  ('preco', 'HOR', 'HORMÔNIOS'),
  ('preco', 'IMUNO', 'IMUNOLOGIA'),
  ('preco', 'LCR', 'LÍQUOR'),
  ('preco', 'LQAMN', 'LÍQUIDO AMNIÓTICO'),
  ('preco', 'LQR', 'LÍQUIDO CEFALORRAQUEANO'),
  ('preco', 'LQRPACOTE', 'LIQUOR PACOTE'),
  ('preco', 'LQSIDE', 'LÍQUIDO SINOVIALE DERRAMES'),
  ('preco', 'PAT', 'PATOLOGIA CLÍNICA OCUPACIONAL'),
  ('preco', 'PREPARO', 'PREPARO PARA COLETA DE EXAMES'),
  ('preco', 'URINA', 'URINÁLISE')
ON CONFLICT (kind, code) DO UPDATE SET name = EXCLUDED.name;

ALTER TABLE public.exams
  ADD COLUMN IF NOT EXISTS tech_sector text,
  ADD COLUMN IF NOT EXISTS price_sector text;

-- Exames que já existem: pega os setores do catálogo do XLAB7 pelo código do exame.
UPDATE public.exams e
   SET tech_sector = COALESCE(e.tech_sector, NULLIF(trim(l.sector), '')),
       price_sector = COALESCE(e.price_sector, NULLIF(trim(l.price_sector), ''))
  FROM public.xlab_legacy_exams l
 WHERE upper(l.code) = upper(e.code)
   AND (e.tech_sector IS NULL OR e.price_sector IS NULL);
