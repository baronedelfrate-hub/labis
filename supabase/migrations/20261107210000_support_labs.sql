-- Transporte para laboratórios de apoio (exames terceirizados).
--
-- * support_labs: laboratórios de apoio da empresa (contato e prazo padrão).
-- * exams.support_lab_id: exame executado por um apoio. NÃO é copiado para empresas novas
--   (os apoios são de cada laboratório): _clone_cols passa a ignorar esta coluna.
-- * support_shipments / support_shipment_items: remessas (romaneios) enviadas a um apoio, com os
--   exames do pedido que seguem nela. Um exame do pedido só entra em uma remessa.
--
-- Fluxo: coleta -> fila "a enviar" do apoio -> remessa marcada como enviada -> o exame passa a
-- aparecer em Resultados para lançar o retorno -> liberação, laudo e portal como os demais.
--
-- Mudança aditiva.

CREATE TABLE IF NOT EXISTS public.support_labs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  legacy_code text,
  contact text,
  phone text,
  email text,
  turnaround_days integer,
  notes text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, name)
);

ALTER TABLE public.exams
  ADD COLUMN IF NOT EXISTS support_lab_id uuid REFERENCES public.support_labs(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS exams_support_lab_idx ON public.exams (support_lab_id);

CREATE TABLE IF NOT EXISTS public.support_shipments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  support_lab_id uuid NOT NULL REFERENCES public.support_labs(id) ON DELETE RESTRICT,
  number integer NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  sent_by uuid,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, number)
);
CREATE INDEX IF NOT EXISTS support_shipments_lab_idx ON public.support_shipments (support_lab_id);

CREATE TABLE IF NOT EXISTS public.support_shipment_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id uuid NOT NULL REFERENCES public.support_shipments(id) ON DELETE CASCADE,
  order_item_id uuid NOT NULL UNIQUE REFERENCES public.order_items(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS support_shipment_items_shipment_idx ON public.support_shipment_items (shipment_id);

-- Número sequencial da remessa por empresa
CREATE OR REPLACE FUNCTION public.tg_support_shipment_number()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('support_shipments:' || NEW.company_id::text));
  NEW.number := COALESCE((SELECT max(number) FROM public.support_shipments WHERE company_id = NEW.company_id), 0) + 1;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.tg_support_shipment_number() FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_support_shipment_number' AND tgrelid = 'public.support_shipments'::regclass) THEN
    CREATE TRIGGER trg_support_shipment_number BEFORE INSERT ON public.support_shipments
      FOR EACH ROW EXECUTE FUNCTION public.tg_support_shipment_number();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_support_labs_updated' AND tgrelid = 'public.support_labs'::regclass) THEN
    CREATE TRIGGER trg_support_labs_updated BEFORE UPDATE ON public.support_labs
      FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
  END IF;
END $$;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['support_labs', 'support_shipments', 'support_shipment_items'] LOOP
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC, anon, authenticated', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'support_labs' AND policyname = 'support_labs_tenant_all') THEN
    CREATE POLICY support_labs_tenant_all ON public.support_labs FOR ALL TO authenticated
      USING (company_id = public.get_user_company_id()) WITH CHECK (company_id = public.get_user_company_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'support_shipments' AND policyname = 'support_shipments_tenant_all') THEN
    CREATE POLICY support_shipments_tenant_all ON public.support_shipments FOR ALL TO authenticated
      USING (company_id = public.get_user_company_id()) WITH CHECK (company_id = public.get_user_company_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'support_shipment_items' AND policyname = 'support_shipment_items_tenant_all') THEN
    CREATE POLICY support_shipment_items_tenant_all ON public.support_shipment_items FOR ALL TO authenticated
      USING (EXISTS (SELECT 1 FROM public.support_shipments s WHERE s.id = shipment_id AND s.company_id = public.get_user_company_id()))
      WITH CHECK (EXISTS (SELECT 1 FROM public.support_shipments s WHERE s.id = shipment_id AND s.company_id = public.get_user_company_id()));
  END IF;
END $$;

-- A clonagem da empresa modelo não deve levar o vínculo com o apoio de outra empresa.
CREATE OR REPLACE FUNCTION public._clone_cols(_table text, _skip text[], _alias text DEFAULT '')
RETURNS text LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT COALESCE(', ' || string_agg(CASE WHEN _alias = '' THEN quote_ident(attname) ELSE _alias || '.' || quote_ident(attname) END, ', ' ORDER BY attnum), '')
    FROM pg_attribute
   WHERE attrelid = ('public.' || quote_ident(_table))::regclass
     AND attnum > 0 AND NOT attisdropped AND attgenerated = ''
     AND NOT (attname = ANY(_skip))
     AND NOT (_table = 'exams' AND attname = 'support_lab_id')
$$;
