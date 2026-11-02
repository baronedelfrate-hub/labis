-- Código de cada setor de realização para o código de barras da amostra (formato do XLAB7:
-- ASSNNNNNNN = nº da amostra + código do setor (00 a 99) + nº do pedido). Setor sem código usa 00.
--
-- O nome do setor é guardado em minúsculas e sem espaços nas pontas, para casar com o
-- setor dos exames sem diferenciar maiúsculas.

CREATE TABLE public.barcode_sectors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  sector text NOT NULL CHECK (length(btrim(sector)) > 0),
  code smallint NOT NULL CHECK (code BETWEEN 1 AND 99),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, sector),
  UNIQUE (company_id, code)
);

REVOKE ALL ON public.barcode_sectors FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.barcode_sectors TO authenticated;
GRANT ALL ON public.barcode_sectors TO service_role;

ALTER TABLE public.barcode_sectors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "company members read barcode sectors"
  ON public.barcode_sectors FOR SELECT TO authenticated
  USING (company_id = public.get_user_company_id());

CREATE POLICY "admins insert barcode sectors"
  ON public.barcode_sectors FOR INSERT TO authenticated
  WITH CHECK (company_id = public.get_user_company_id() AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admins update barcode sectors"
  ON public.barcode_sectors FOR UPDATE TO authenticated
  USING (company_id = public.get_user_company_id() AND public.has_role(auth.uid(), 'admin'))
  WITH CHECK (company_id = public.get_user_company_id() AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admins delete barcode sectors"
  ON public.barcode_sectors FOR DELETE TO authenticated
  USING (company_id = public.get_user_company_id() AND public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_barcode_sectors_updated_at
  BEFORE UPDATE ON public.barcode_sectors
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
