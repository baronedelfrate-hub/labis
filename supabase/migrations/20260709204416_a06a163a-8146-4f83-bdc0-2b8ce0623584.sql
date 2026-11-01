
-- 1. companies table
CREATE TABLE public.companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  cnpj text,
  plan text NOT NULL DEFAULT 'free',
  active boolean NOT NULL DEFAULT true,
  next_order_number bigint NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.companies TO authenticated;
GRANT ALL ON public.companies TO service_role;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_companies_updated BEFORE UPDATE ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- 2. Seed demo company and capture id
DO $$
DECLARE demo_id uuid;
BEGIN
  INSERT INTO public.companies (name, plan) VALUES ('Empresa Demo', 'free')
  RETURNING id INTO demo_id;

  -- 3+4. Add company_id nullable, backfill
  ALTER TABLE public.profiles          ADD COLUMN company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE;
  ALTER TABLE public.units             ADD COLUMN company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE;
  ALTER TABLE public.doctors           ADD COLUMN company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE;
  ALTER TABLE public.insurance_plans   ADD COLUMN company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE;
  ALTER TABLE public.price_tables      ADD COLUMN company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE;
  ALTER TABLE public.price_table_items ADD COLUMN company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE;
  ALTER TABLE public.exams             ADD COLUMN company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE;
  ALTER TABLE public.exam_groups       ADD COLUMN company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE;
  ALTER TABLE public.exam_group_items  ADD COLUMN company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE;
  ALTER TABLE public.patients          ADD COLUMN company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE;
  ALTER TABLE public.orders            ADD COLUMN company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE;
  ALTER TABLE public.order_items       ADD COLUMN company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE;

  UPDATE public.profiles          SET company_id = demo_id WHERE company_id IS NULL;
  UPDATE public.units             SET company_id = demo_id WHERE company_id IS NULL;
  UPDATE public.doctors           SET company_id = demo_id WHERE company_id IS NULL;
  UPDATE public.insurance_plans   SET company_id = demo_id WHERE company_id IS NULL;
  UPDATE public.price_tables      SET company_id = demo_id WHERE company_id IS NULL;
  UPDATE public.price_table_items SET company_id = demo_id WHERE company_id IS NULL;
  UPDATE public.exams             SET company_id = demo_id WHERE company_id IS NULL;
  UPDATE public.exam_groups       SET company_id = demo_id WHERE company_id IS NULL;
  UPDATE public.exam_group_items  SET company_id = demo_id WHERE company_id IS NULL;
  UPDATE public.patients          SET company_id = demo_id WHERE company_id IS NULL;
  UPDATE public.orders            SET company_id = demo_id WHERE company_id IS NULL;
  UPDATE public.order_items       SET company_id = demo_id WHERE company_id IS NULL;
END $$;

-- 5. NOT NULL
ALTER TABLE public.profiles          ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE public.units             ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE public.doctors           ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE public.insurance_plans   ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE public.price_tables      ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE public.price_table_items ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE public.exams             ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE public.exam_groups       ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE public.exam_group_items  ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE public.patients          ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE public.orders            ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE public.order_items       ALTER COLUMN company_id SET NOT NULL;

-- Indexes on company_id for tenant filtering
CREATE INDEX ON public.units             (company_id);
CREATE INDEX ON public.doctors           (company_id);
CREATE INDEX ON public.insurance_plans   (company_id);
CREATE INDEX ON public.price_tables      (company_id);
CREATE INDEX ON public.price_table_items (company_id);
CREATE INDEX ON public.exams             (company_id);
CREATE INDEX ON public.exam_groups       (company_id);
CREATE INDEX ON public.exam_group_items  (company_id);
CREATE INDEX ON public.patients          (company_id);
CREATE INDEX ON public.orders            (company_id);
CREATE INDEX ON public.order_items       (company_id);

-- 6. get_user_company_id() security definer
CREATE OR REPLACE FUNCTION public.get_user_company_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT company_id FROM public.profiles WHERE id = auth.uid()
$$;
REVOKE EXECUTE ON FUNCTION public.get_user_company_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_user_company_id() TO authenticated;

-- 8. Uniqueness per company
ALTER TABLE public.patients DROP CONSTRAINT patients_code_key;
ALTER TABLE public.patients ADD CONSTRAINT patients_company_code_key UNIQUE (company_id, code);

ALTER TABLE public.orders DROP CONSTRAINT orders_order_number_key;
DROP INDEX IF EXISTS public.orders_order_number_idx;
ALTER TABLE public.orders ADD CONSTRAINT orders_company_number_key UNIQUE (company_id, order_number);

-- 9. Per-company order_number counter
-- Sync starting counter from existing max
UPDATE public.companies c
SET next_order_number = COALESCE((SELECT MAX(order_number) FROM public.orders o WHERE o.company_id = c.id), 0) + 1;

CREATE OR REPLACE FUNCTION public.tg_order_number()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  next_num bigint;
BEGIN
  IF NEW.order_number IS NULL THEN
    UPDATE public.companies
       SET next_order_number = next_order_number + 1
     WHERE id = NEW.company_id
     RETURNING next_order_number - 1 INTO next_num;
    NEW.order_number := next_num;
  END IF;
  RETURN NEW;
END;
$$;

DROP SEQUENCE IF EXISTS public.orders_number_seq;

-- Per-company patient code sequence: switch to per-company counter too
-- Add counter column
ALTER TABLE public.companies ADD COLUMN next_patient_code bigint NOT NULL DEFAULT 1;
UPDATE public.companies c
SET next_patient_code = COALESCE(
  (SELECT MAX(NULLIF(regexp_replace(code, '\D', '', 'g'), '')::bigint)
     FROM public.patients p WHERE p.company_id = c.id), 0) + 1;

CREATE OR REPLACE FUNCTION public.tg_patient_code()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  next_num bigint;
BEGIN
  IF NEW.code IS NULL OR NEW.code = '' THEN
    UPDATE public.companies
       SET next_patient_code = next_patient_code + 1
     WHERE id = NEW.company_id
     RETURNING next_patient_code - 1 INTO next_num;
    NEW.code := 'P' || LPAD(next_num::text, 6, '0');
  END IF;
  RETURN NEW;
END;
$$;

DROP SEQUENCE IF EXISTS public.patients_code_seq;

-- 10. Signup flow: create company, profile, admin role
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_company_id uuid;
  display_name text;
  company_name text;
BEGIN
  display_name := COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email, '');
  company_name := COALESCE(NEW.raw_user_meta_data->>'company_name',
                           'Laboratório de ' || display_name);

  INSERT INTO public.companies (name)
  VALUES (company_name)
  RETURNING id INTO new_company_id;

  INSERT INTO public.profiles (id, full_name, company_id)
  VALUES (NEW.id, display_name, new_company_id);

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'admin');

  RETURN NEW;
END;
$$;

-- 7. Rewrite all RLS policies to filter by company
-- companies
DROP POLICY IF EXISTS companies_select ON public.companies;
DROP POLICY IF EXISTS companies_update ON public.companies;
CREATE POLICY companies_select ON public.companies FOR SELECT TO authenticated
  USING (id = public.get_user_company_id());
CREATE POLICY companies_update ON public.companies FOR UPDATE TO authenticated
  USING (id = public.get_user_company_id() AND public.has_role(auth.uid(), 'admin'))
  WITH CHECK (id = public.get_user_company_id());

-- profiles
DROP POLICY IF EXISTS profiles_select_auth ON public.profiles;
DROP POLICY IF EXISTS profiles_update_own ON public.profiles;
CREATE POLICY profiles_select_same_company ON public.profiles FOR SELECT TO authenticated
  USING (company_id = public.get_user_company_id());
CREATE POLICY profiles_update_own ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid() AND company_id = public.get_user_company_id());

-- Generic helper: rebuild policies per tenant table
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'units','doctors','insurance_plans','price_tables','price_table_items',
    'exams','exam_groups','exam_group_items','patients','orders','order_items'
  ];
  pol record;
BEGIN
  FOREACH t IN ARRAY tables LOOP
    FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename=t LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, t);
    END LOOP;
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (company_id = public.get_user_company_id()) WITH CHECK (company_id = public.get_user_company_id())',
      t || '_tenant_all', t
    );
  END LOOP;
END $$;
