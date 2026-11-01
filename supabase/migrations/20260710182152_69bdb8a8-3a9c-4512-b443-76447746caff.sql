CREATE TABLE public.tiss_tabelas_referencia (
  codigo varchar PRIMARY KEY,
  descricao text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.tiss_tabelas_referencia TO authenticated;
GRANT ALL ON public.tiss_tabelas_referencia TO service_role;
ALTER TABLE public.tiss_tabelas_referencia ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read tiss_tabelas_referencia" ON public.tiss_tabelas_referencia FOR SELECT TO authenticated USING (true);

INSERT INTO public.tiss_tabelas_referencia (codigo, descricao) VALUES
('00','Tabela própria das operadoras'),
('01','Lista de Procedimentos Médicos AMB 90 (Inativo)'),
('02','Lista de Procedimentos Médicos AMB 92 (Inativo)'),
('03','Lista de Procedimentos Médicos AMB 96 (Inativo)'),
('04','Lista de Procedimentos Médicos AMB 99 (Inativo)'),
('05','Tabela Brasíndice  (Inativo na versão 3.01)'),
('06','Classificação Bras. Hierarq. de Procedim. Médicos  (Inativo)'),
('07','Tabela CIEFAS-93  (Inativo)'),
('08','Tabela CIEFAS-2000  (Inativo)'),
('09','Rol de Procedimentos ANS  (Inativo)'),
('10','Tabela de Procedimentos Hospitalares SUS  (Inativo)'),
('11','Tabela de Procedimentos Hospitalares SUS  (Inativo)'),
('12','Tabela SIMPRO  (Inativo na versão 3.01)'),
('13','Tabela TUNEP (Inativo)'),
('14','Tabela VRPO (Inativo)'),
('15','Tabela de Intercâmbio Sistema Uniodonto (Inativo)'),
('16','TUSS - Terminologia Unificada da Saúde Suplementar  (Inativo na versão 3.01)'),
('17','Procedimentos Odontológicos  (Inativo)'),
('18','Diárias, taxas e gases medicinais'),
('19','Materiais e Órteses, Próteses e Materiais Especiais (OPME)'),
('20','Medicamentos'),
('21','Outras áreas da saúde'),
('22','Procedimentos e eventos em saúde'),
('23','Caráter do atendimento'),
('24','Classificação Brasileira de Ocupações (CBO)'),
('25','Código da despesa'),
('26','Conselho profissional'),
('27','Débitos e créditos'),
('28','Dentes'),
('29','Diagnóstico por imagem'),
('30','Escala de capacidade funcional (ECOG - Escala de Zubrod)'),
('31','Estadiamento do tumor'),
('32','Faces do dente'),
('33','Finalidade do tratamento'),
('34','Forma de pagamento'),
('35','Grau de participação'),
('36','Indicador de acidente'),
('37','Indicador de débito ou crédito'),
('38','Mensagens (glosas, negativas e outras)'),
('39','Motivo de encerramento'),
('40','Origem do evento de atenção à saúde'),
('41','Regime de internação'),
('42','Regiões da boca'),
('88','Tabela Própria Medicina Ocupacional'),
('89','Tabela Própria Assistência Domiciliar'),
('90','Tabela Própria Pacote Odontológico'),
('91','Tabela Provisória - Outras Áreas da Saúde'),
('92','Tabela Provisória - Procedimentos Odontológicos'),
('93','Tabela Provisória – Procedimentos Médicos'),
('94','Tabela Própria Procedimentos  (Inativo na versão 3.01)'),
('95','Tabela Própria Materiais  (Inativo na versão 3.01)'),
('96','Tabela Própria Medicamentos  (Inativo na versão 3.01)'),
('97','Tabela Própria de Taxas Hospitalares  (Inativo na versão 3.01)'),
('98','Tabela Própria de Pacotes'),
('99','Tabela Própria de Gases Medicinais  (Inativo na versão 3.01)')
ON CONFLICT (codigo) DO NOTHING;

UPDATE public.insurance_plans SET tiss_tabela = NULL WHERE tiss_tabela IS NOT NULL AND tiss_tabela NOT IN (SELECT codigo FROM public.tiss_tabelas_referencia);

ALTER TABLE public.insurance_plans
  ADD CONSTRAINT insurance_plans_tiss_tabela_fkey
  FOREIGN KEY (tiss_tabela) REFERENCES public.tiss_tabelas_referencia(codigo);