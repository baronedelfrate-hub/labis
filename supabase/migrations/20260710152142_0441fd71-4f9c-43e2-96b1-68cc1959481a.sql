CREATE TABLE public.company_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL UNIQUE REFERENCES public.companies(id) ON DELETE CASCADE,
  logo_url text,
  legal_name text,
  address text,
  city text,
  state text,
  zip_code text,
  phone text,
  email text,
  cnpj text,
  cnes text,
  responsible_tech_name text,
  responsible_tech_council text,
  footer_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_settings TO authenticated;
GRANT ALL ON public.company_settings TO service_role;

ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "company members read own settings"
  ON public.company_settings FOR SELECT TO authenticated
  USING (company_id = public.get_user_company_id());

CREATE POLICY "admins insert own settings"
  ON public.company_settings FOR INSERT TO authenticated
  WITH CHECK (company_id = public.get_user_company_id() AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admins update own settings"
  ON public.company_settings FOR UPDATE TO authenticated
  USING (company_id = public.get_user_company_id() AND public.has_role(auth.uid(), 'admin'))
  WITH CHECK (company_id = public.get_user_company_id() AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admins delete own settings"
  ON public.company_settings FOR DELETE TO authenticated
  USING (company_id = public.get_user_company_id() AND public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_company_settings_updated_at
  BEFORE UPDATE ON public.company_settings
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Storage policies for company-logos bucket (bucket criado via tool)
CREATE POLICY "public read company logos"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'company-logos');

CREATE POLICY "company members upload own logo"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'company-logos'
    AND public.has_role(auth.uid(), 'admin')
    AND (storage.foldername(name))[1] = public.get_user_company_id()::text
  );

CREATE POLICY "company members update own logo"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'company-logos'
    AND public.has_role(auth.uid(), 'admin')
    AND (storage.foldername(name))[1] = public.get_user_company_id()::text
  );

CREATE POLICY "company members delete own logo"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'company-logos'
    AND public.has_role(auth.uid(), 'admin')
    AND (storage.foldername(name))[1] = public.get_user_company_id()::text
  );