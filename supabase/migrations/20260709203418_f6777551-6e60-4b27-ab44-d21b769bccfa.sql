
-- ============ ENUMS ============
CREATE TYPE public.app_role AS ENUM ('admin', 'recepcao', 'tecnico', 'bioquimico');
CREATE TYPE public.order_status AS ENUM ('aberto', 'coletado', 'em_analise', 'finalizado', 'cancelado');
CREATE TYPE public.order_item_status AS ENUM ('pendente', 'coletado', 'com_resultado', 'liberado');
CREATE TYPE public.patient_sex AS ENUM ('M', 'F', 'O');

-- ============ updated_at helper ============
CREATE OR REPLACE FUNCTION public.tg_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- ============ PROFILES ============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select_auth" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email, ''));
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ USER_ROLES ============
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE POLICY "user_roles_select_own" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "user_roles_admin_all" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_user_roles_updated BEFORE UPDATE ON public.user_roles FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Helper: any authenticated user is a lab staff member (single-tenant)
CREATE OR REPLACE FUNCTION public.is_staff(_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _user_id IS NOT NULL;
$$;

-- ============ UNITS ============
CREATE TABLE public.units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  address TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.units TO authenticated;
GRANT ALL ON public.units TO service_role;
ALTER TABLE public.units ENABLE ROW LEVEL SECURITY;
CREATE POLICY "units_all_staff" ON public.units FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE TRIGGER trg_units_updated BEFORE UPDATE ON public.units FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ============ DOCTORS ============
CREATE TABLE public.doctors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  crm TEXT NOT NULL,
  crm_uf TEXT NOT NULL,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  cbos_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (crm, crm_uf)
);
CREATE INDEX doctors_name_idx ON public.doctors USING gin (to_tsvector('simple', name));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.doctors TO authenticated;
GRANT ALL ON public.doctors TO service_role;
ALTER TABLE public.doctors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "doctors_all_staff" ON public.doctors FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE TRIGGER trg_doctors_updated BEFORE UPDATE ON public.doctors FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ============ PRICE_TABLES ============
CREATE TABLE public.price_tables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.price_tables TO authenticated;
GRANT ALL ON public.price_tables TO service_role;
ALTER TABLE public.price_tables ENABLE ROW LEVEL SECURITY;
CREATE POLICY "price_tables_read" ON public.price_tables FOR SELECT TO authenticated USING (true);
CREATE POLICY "price_tables_write" ON public.price_tables FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "price_tables_update" ON public.price_tables FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "price_tables_delete_admin" ON public.price_tables FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_price_tables_updated BEFORE UPDATE ON public.price_tables FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ============ INSURANCE_PLANS ============
CREATE TABLE public.insurance_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  price_table_id UUID NOT NULL REFERENCES public.price_tables(id) ON DELETE RESTRICT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.insurance_plans TO authenticated;
GRANT ALL ON public.insurance_plans TO service_role;
ALTER TABLE public.insurance_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "insurance_read" ON public.insurance_plans FOR SELECT TO authenticated USING (true);
CREATE POLICY "insurance_write" ON public.insurance_plans FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "insurance_update" ON public.insurance_plans FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "insurance_delete_admin" ON public.insurance_plans FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_insurance_updated BEFORE UPDATE ON public.insurance_plans FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ============ EXAMS ============
CREATE TABLE public.exams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  sector TEXT,
  material TEXT,
  deadline_days INTEGER NOT NULL DEFAULT 1,
  fasting_hours INTEGER NOT NULL DEFAULT 0,
  preparation_instructions TEXT,
  is_urgent_allowed BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX exams_name_idx ON public.exams USING gin (to_tsvector('simple', name));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.exams TO authenticated;
GRANT ALL ON public.exams TO service_role;
ALTER TABLE public.exams ENABLE ROW LEVEL SECURITY;
CREATE POLICY "exams_all_staff" ON public.exams FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE TRIGGER trg_exams_updated BEFORE UPDATE ON public.exams FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ============ EXAM_GROUPS ============
CREATE TABLE public.exam_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.exam_groups TO authenticated;
GRANT ALL ON public.exam_groups TO service_role;
ALTER TABLE public.exam_groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "exam_groups_all_staff" ON public.exam_groups FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE TRIGGER trg_exam_groups_updated BEFORE UPDATE ON public.exam_groups FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE public.exam_group_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_group_id UUID NOT NULL REFERENCES public.exam_groups(id) ON DELETE CASCADE,
  exam_id UUID NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (exam_group_id, exam_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.exam_group_items TO authenticated;
GRANT ALL ON public.exam_group_items TO service_role;
ALTER TABLE public.exam_group_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "exam_group_items_all_staff" ON public.exam_group_items FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE TRIGGER trg_exam_group_items_updated BEFORE UPDATE ON public.exam_group_items FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ============ PRICE_TABLE_ITEMS ============
CREATE TABLE public.price_table_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  price_table_id UUID NOT NULL REFERENCES public.price_tables(id) ON DELETE CASCADE,
  exam_id UUID NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
  price NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (price_table_id, exam_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.price_table_items TO authenticated;
GRANT ALL ON public.price_table_items TO service_role;
ALTER TABLE public.price_table_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pti_all_staff" ON public.price_table_items FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE TRIGGER trg_pti_updated BEFORE UPDATE ON public.price_table_items FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ============ PATIENTS ============
CREATE TABLE public.patients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  birth_date DATE,
  sex public.patient_sex,
  cpf TEXT,
  rg TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  zip_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX patients_name_idx ON public.patients USING gin (to_tsvector('simple', name));
CREATE INDEX patients_cpf_idx ON public.patients (cpf);
CREATE INDEX patients_code_idx ON public.patients (code);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.patients TO authenticated;
GRANT ALL ON public.patients TO service_role;
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "patients_all_staff" ON public.patients FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE TRIGGER trg_patients_updated BEFORE UPDATE ON public.patients FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Patient code auto-generation
CREATE SEQUENCE public.patients_code_seq START 1;
CREATE OR REPLACE FUNCTION public.tg_patient_code()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.code IS NULL OR NEW.code = '' THEN
    NEW.code := 'P' || LPAD(nextval('public.patients_code_seq')::text, 6, '0');
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_patients_code BEFORE INSERT ON public.patients FOR EACH ROW EXECUTE FUNCTION public.tg_patient_code();

-- ============ ORDERS ============
CREATE SEQUENCE public.orders_number_seq START 1;

CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number BIGINT NOT NULL UNIQUE,
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE RESTRICT,
  doctor_id UUID REFERENCES public.doctors(id) ON DELETE SET NULL,
  insurance_plan_id UUID REFERENCES public.insurance_plans(id) ON DELETE SET NULL,
  unit_id UUID REFERENCES public.units(id) ON DELETE SET NULL,
  status public.order_status NOT NULL DEFAULT 'aberto',
  is_urgent BOOLEAN NOT NULL DEFAULT false,
  order_date DATE NOT NULL DEFAULT CURRENT_DATE,
  collection_date DATE,
  delivery_date DATE,
  total_value NUMERIC(12,2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX orders_order_number_idx ON public.orders (order_number);
CREATE INDEX orders_patient_id_idx ON public.orders (patient_id);
CREATE INDEX orders_order_date_idx ON public.orders (order_date);
CREATE INDEX orders_status_idx ON public.orders (status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.orders TO authenticated;
GRANT ALL ON public.orders TO service_role;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "orders_all_staff" ON public.orders FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE TRIGGER trg_orders_updated BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE OR REPLACE FUNCTION public.tg_order_number()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.order_number IS NULL THEN
    NEW.order_number := nextval('public.orders_number_seq');
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_orders_number BEFORE INSERT ON public.orders FOR EACH ROW EXECUTE FUNCTION public.tg_order_number();

-- ============ ORDER_ITEMS ============
CREATE TABLE public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  exam_id UUID NOT NULL REFERENCES public.exams(id) ON DELETE RESTRICT,
  status public.order_item_status NOT NULL DEFAULT 'pendente',
  sample_number VARCHAR,
  price NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (order_id, exam_id)
);
CREATE INDEX order_items_order_id_idx ON public.order_items (order_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_items TO authenticated;
GRANT ALL ON public.order_items TO service_role;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "order_items_all_staff" ON public.order_items FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE TRIGGER trg_order_items_updated BEFORE UPDATE ON public.order_items FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ============ SEED ============
INSERT INTO public.price_tables (name) VALUES ('Particular') ON CONFLICT DO NOTHING;
