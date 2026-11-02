-- SaaS: empresa modelo (cópia automática para cada laboratório novo) e unicidade POR EMPRESA.
--
-- 1) Corrige regras de unicidade que eram GLOBAIS: o código de um exame, convênio ou unidade, o nome
--    de uma tabela de preço ou grupo e o CRM de um médico só podiam existir em UMA empresa do
--    sistema inteiro. Agora cada empresa tem o seu espaço. (Só afrouxa: nenhum dado existente conflita.)
-- 2) Empresa modelo: uma empresa marcada com is_template guarda a configuração padrão. Ao cadastrar um
--    laboratório novo, a configuração dela é COPIADA (cópia independente) para a empresa nova.
-- 3) A cópia nunca impede o cadastro: se falhar, a empresa nasce vazia e o erro vai para o log.

-- 1) Unicidade por empresa ---------------------------------------------------
ALTER TABLE public.exams DROP CONSTRAINT IF EXISTS exams_code_key;
ALTER TABLE public.exams ADD CONSTRAINT exams_company_code_key UNIQUE (company_id, code);

ALTER TABLE public.insurance_plans DROP CONSTRAINT IF EXISTS insurance_plans_code_key;
ALTER TABLE public.insurance_plans ADD CONSTRAINT insurance_plans_company_code_key UNIQUE (company_id, code);

ALTER TABLE public.units DROP CONSTRAINT IF EXISTS units_code_key;
ALTER TABLE public.units ADD CONSTRAINT units_company_code_key UNIQUE (company_id, code);

ALTER TABLE public.price_tables DROP CONSTRAINT IF EXISTS price_tables_name_key;
ALTER TABLE public.price_tables ADD CONSTRAINT price_tables_company_name_key UNIQUE (company_id, name);

ALTER TABLE public.exam_groups DROP CONSTRAINT IF EXISTS exam_groups_name_key;
ALTER TABLE public.exam_groups ADD CONSTRAINT exam_groups_company_name_key UNIQUE (company_id, name);

ALTER TABLE public.doctors DROP CONSTRAINT IF EXISTS doctors_crm_crm_uf_key;
DROP INDEX IF EXISTS public.doctors_crm_crm_uf_key;
ALTER TABLE public.doctors ADD CONSTRAINT doctors_company_crm_key UNIQUE (company_id, crm, crm_uf);

-- 2) Empresa modelo ----------------------------------------------------------
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS is_template boolean NOT NULL DEFAULT false;
CREATE UNIQUE INDEX IF NOT EXISTS companies_single_template_idx ON public.companies ((true)) WHERE is_template;

-- Só o painel/serviço (sem usuário logado) pode criar ou mudar a marca de modelo.
CREATE OR REPLACE FUNCTION public.tg_companies_protect_template()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND (
       (TG_OP = 'INSERT' AND NEW.is_template)
    OR (TG_OP = 'UPDATE' AND NEW.is_template IS DISTINCT FROM OLD.is_template)
  ) THEN
    RAISE EXCEPTION 'A marca de empresa modelo só pode ser alterada pelo administrador da plataforma';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_companies_protect_template
  BEFORE INSERT OR UPDATE ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.tg_companies_protect_template();

-- Id novo e estável para a cópia: o mesmo (empresa nova, id antigo) sempre dá o mesmo id, então as
-- tabelas se ligam entre si sem precisar de tabela temporária.
CREATE OR REPLACE FUNCTION public._clone_id(_target uuid, _old uuid)
RETURNS uuid LANGUAGE sql IMMUTABLE AS $$ SELECT md5(_target::text || ':' || _old::text)::uuid $$;

-- Lista as colunas de uma tabela (com prefixo opcional), menos as que a cópia reescreve, já com a
-- vírgula na frente (", a, b") ou vazio se não sobrar nenhuma. Lida em tempo de execução: coluna nova
-- adicionada depois no sistema também passa a ser copiada.
CREATE OR REPLACE FUNCTION public._clone_cols(_table text, _skip text[], _alias text DEFAULT '')
RETURNS text LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT COALESCE(', ' || string_agg(CASE WHEN _alias = '' THEN quote_ident(attname) ELSE _alias || '.' || quote_ident(attname) END, ', ' ORDER BY attnum), '')
    FROM pg_attribute
   WHERE attrelid = ('public.' || quote_ident(_table))::regclass
     AND attnum > 0 AND NOT attisdropped AND attgenerated = ''
     AND NOT (attname = ANY(_skip))
$$;

-- Copia a configuração de uma empresa para outra (exames com parâmetros e referências, grupos,
-- convênios, tabelas de preço, unidades, setores do código de barras e textos-modelo).
-- NÃO copia: dados da empresa, pacientes, médicos, pedidos, resultados, usuários.
CREATE OR REPLACE FUNCTION public.clone_company_defaults(_source uuid, _target uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  base text[] := ARRAY['id', 'company_id', 'created_at', 'updated_at'];
BEGIN
  IF _source IS NULL OR _target IS NULL OR _source = _target THEN RETURN; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.companies WHERE id = _source)
     OR NOT EXISTS (SELECT 1 FROM public.companies WHERE id = _target) THEN RETURN; END IF;

  EXECUTE format('INSERT INTO public.price_tables (id, company_id%1$s) SELECT public._clone_id($1, t.id), $1%2$s FROM public.price_tables t WHERE t.company_id = $2',
    public._clone_cols('price_tables', base), public._clone_cols('price_tables', base, 't')) USING _target, _source;

  EXECUTE format('INSERT INTO public.units (id, company_id%1$s) SELECT public._clone_id($1, t.id), $1%2$s FROM public.units t WHERE t.company_id = $2',
    public._clone_cols('units', base), public._clone_cols('units', base, 't')) USING _target, _source;

  EXECUTE format('INSERT INTO public.exams (id, company_id%1$s) SELECT public._clone_id($1, t.id), $1%2$s FROM public.exams t WHERE t.company_id = $2',
    public._clone_cols('exams', base), public._clone_cols('exams', base, 't')) USING _target, _source;

  EXECUTE format('INSERT INTO public.exam_parameters (id, exam_id%1$s) SELECT public._clone_id($1, p.id), public._clone_id($1, p.exam_id)%2$s FROM public.exam_parameters p JOIN public.exams e ON e.id = p.exam_id WHERE e.company_id = $2',
    public._clone_cols('exam_parameters', ARRAY['id', 'exam_id', 'created_at', 'updated_at']),
    public._clone_cols('exam_parameters', ARRAY['id', 'exam_id', 'created_at', 'updated_at'], 'p')) USING _target, _source;

  EXECUTE format('INSERT INTO public.reference_ranges (id, company_id, exam_id, exam_parameter_id%1$s) SELECT public._clone_id($1, r.id), $1, public._clone_id($1, r.exam_id), public._clone_id($1, r.exam_parameter_id)%2$s FROM public.reference_ranges r WHERE r.company_id = $2',
    public._clone_cols('reference_ranges', base || ARRAY['exam_id', 'exam_parameter_id']),
    public._clone_cols('reference_ranges', base || ARRAY['exam_id', 'exam_parameter_id'], 'r')) USING _target, _source;

  EXECUTE format('INSERT INTO public.exam_groups (id, company_id%1$s) SELECT public._clone_id($1, t.id), $1%2$s FROM public.exam_groups t WHERE t.company_id = $2',
    public._clone_cols('exam_groups', base), public._clone_cols('exam_groups', base, 't')) USING _target, _source;

  EXECUTE format('INSERT INTO public.exam_group_items (id, company_id, exam_group_id, exam_id%1$s) SELECT public._clone_id($1, t.id), $1, public._clone_id($1, t.exam_group_id), public._clone_id($1, t.exam_id)%2$s FROM public.exam_group_items t WHERE t.company_id = $2',
    public._clone_cols('exam_group_items', base || ARRAY['exam_group_id', 'exam_id']),
    public._clone_cols('exam_group_items', base || ARRAY['exam_group_id', 'exam_id'], 't')) USING _target, _source;

  EXECUTE format('INSERT INTO public.price_table_items (id, company_id, price_table_id, exam_id%1$s) SELECT public._clone_id($1, t.id), $1, public._clone_id($1, t.price_table_id), public._clone_id($1, t.exam_id)%2$s FROM public.price_table_items t WHERE t.company_id = $2',
    public._clone_cols('price_table_items', base || ARRAY['price_table_id', 'exam_id']),
    public._clone_cols('price_table_items', base || ARRAY['price_table_id', 'exam_id'], 't')) USING _target, _source;

  EXECUTE format('INSERT INTO public.insurance_plans (id, company_id, price_table_id%1$s) SELECT public._clone_id($1, t.id), $1, public._clone_id($1, t.price_table_id)%2$s FROM public.insurance_plans t WHERE t.company_id = $2',
    public._clone_cols('insurance_plans', base || ARRAY['price_table_id']),
    public._clone_cols('insurance_plans', base || ARRAY['price_table_id'], 't')) USING _target, _source;

  EXECUTE format('INSERT INTO public.barcode_sectors (id, company_id%1$s) SELECT public._clone_id($1, t.id), $1%2$s FROM public.barcode_sectors t WHERE t.company_id = $2',
    public._clone_cols('barcode_sectors', base), public._clone_cols('barcode_sectors', base, 't')) USING _target, _source;

  EXECUTE format('INSERT INTO public.result_templates (id, company_id, exam_id%1$s) SELECT public._clone_id($1, t.id), $1, public._clone_id($1, t.exam_id)%2$s FROM public.result_templates t WHERE t.company_id = $2',
    public._clone_cols('result_templates', base || ARRAY['exam_id']),
    public._clone_cols('result_templates', base || ARRAY['exam_id'], 't')) USING _target, _source;
END;
$$;

REVOKE ALL ON FUNCTION public.clone_company_defaults(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.clone_company_defaults(uuid, uuid) TO service_role;
REVOKE ALL ON FUNCTION public._clone_id(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._clone_id(uuid, uuid) TO service_role;
REVOKE ALL ON FUNCTION public._clone_cols(text, text[], text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._clone_cols(text, text[], text) TO service_role;

-- Cadastro de usuário: igual ao anterior, e laboratório novo (sem convite) recebe a cópia do modelo.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  new_company_id uuid;
  display_name text;
  company_name text;
  inv record;
BEGIN
  display_name := COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email, '');

  SELECT * INTO inv
  FROM public.invitations
  WHERE lower(email) = lower(NEW.email)
    AND status = 'pending'
    AND expires_at > now()
  ORDER BY created_at DESC
  LIMIT 1;

  IF inv.id IS NOT NULL THEN
    INSERT INTO public.profiles (id, full_name, company_id)
    VALUES (NEW.id, display_name, inv.company_id);

    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, inv.role);

    UPDATE public.invitations
       SET status = 'accepted', updated_at = now()
     WHERE id = inv.id;
  ELSE
    company_name := COALESCE(NEW.raw_user_meta_data->>'company_name',
                             'Laboratório de ' || display_name);

    INSERT INTO public.companies (name)
    VALUES (company_name)
    RETURNING id INTO new_company_id;

    INSERT INTO public.profiles (id, full_name, company_id)
    VALUES (NEW.id, display_name, new_company_id);

    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin');

    -- Configuração padrão (empresa modelo). Nunca pode impedir o cadastro: se falhar, desfaz só a cópia.
    BEGIN
      PERFORM public.clone_company_defaults((SELECT id FROM public.companies WHERE is_template LIMIT 1), new_company_id);
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'clone_company_defaults falhou para a empresa %: %', new_company_id, SQLERRM;
    END;
  END IF;

  RETURN NEW;
END;
$$;

-- A empresa modelo e o kit inicial (convênio e tabela Particular, unidade Matriz). Os exames, grupos e
-- textos do modelo são montados depois, pelo próprio sistema, com um usuário da empresa modelo.
INSERT INTO public.companies (name, is_template)
SELECT 'Laboratório Modelo (padrão do sistema)', true
 WHERE NOT EXISTS (SELECT 1 FROM public.companies WHERE is_template);

DO $$
DECLARE m uuid; pt uuid;
BEGIN
  SELECT id INTO m FROM public.companies WHERE is_template;
  IF NOT EXISTS (SELECT 1 FROM public.units WHERE company_id = m) THEN
    INSERT INTO public.units (company_id, code, name) VALUES (m, 'MATRIZ', 'Matriz');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.price_tables WHERE company_id = m) THEN
    INSERT INTO public.price_tables (company_id, name) VALUES (m, 'Particular') RETURNING id INTO pt;
    INSERT INTO public.insurance_plans (company_id, code, name, price_table_id, is_particular)
    VALUES (m, 'PART', 'Particular', pt, true);
  END IF;
END $$;
