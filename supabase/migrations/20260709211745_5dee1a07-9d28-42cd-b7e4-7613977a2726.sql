
-- 1. Enum sample_status
CREATE TYPE public.sample_status AS ENUM ('pendente', 'coletada', 'recebida', 'rejeitada');

-- 2. Tabela samples
CREATE TABLE public.samples (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  sample_number int NOT NULL,
  material text NOT NULL,
  sector text,
  status public.sample_status NOT NULL DEFAULT 'pendente',
  collected_at timestamptz,
  collected_by uuid REFERENCES public.profiles(id),
  received_at timestamptz,
  received_by uuid REFERENCES public.profiles(id),
  rejection_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (order_id, sample_number)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.samples TO authenticated;
GRANT ALL ON public.samples TO service_role;

ALTER TABLE public.samples ENABLE ROW LEVEL SECURITY;

CREATE POLICY "samples_select_company" ON public.samples
  FOR SELECT TO authenticated
  USING (company_id = public.get_user_company_id());

CREATE POLICY "samples_insert_company_active" ON public.samples
  FOR INSERT TO authenticated
  WITH CHECK (
    company_id = public.get_user_company_id()
    AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.active = true)
  );

CREATE POLICY "samples_update_company_active" ON public.samples
  FOR UPDATE TO authenticated
  USING (company_id = public.get_user_company_id())
  WITH CHECK (
    company_id = public.get_user_company_id()
    AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.active = true)
  );

CREATE POLICY "samples_delete_admin" ON public.samples
  FOR DELETE TO authenticated
  USING (company_id = public.get_user_company_id() AND public.has_role(auth.uid(), 'admin'));

-- Trigger sample_number sequencial por pedido
CREATE OR REPLACE FUNCTION public.tg_sample_number()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE next_num int;
BEGIN
  IF NEW.sample_number IS NULL THEN
    PERFORM 1 FROM public.orders WHERE id = NEW.order_id FOR UPDATE;
    SELECT COALESCE(MAX(sample_number), 0) + 1 INTO next_num
      FROM public.samples WHERE order_id = NEW.order_id;
    NEW.sample_number := next_num;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER tg_samples_number BEFORE INSERT ON public.samples
  FOR EACH ROW EXECUTE FUNCTION public.tg_sample_number();

CREATE TRIGGER tg_samples_updated_at BEFORE UPDATE ON public.samples
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- 3. Tabela results
CREATE TABLE public.results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  order_item_id uuid NOT NULL UNIQUE REFERENCES public.order_items(id) ON DELETE CASCADE,
  value text NOT NULL,
  reference_min numeric,
  reference_max numeric,
  unit text,
  observation text,
  entered_by uuid REFERENCES public.profiles(id),
  entered_at timestamptz NOT NULL DEFAULT now(),
  released boolean NOT NULL DEFAULT false,
  released_by uuid REFERENCES public.profiles(id),
  released_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.results TO authenticated;
GRANT ALL ON public.results TO service_role;

ALTER TABLE public.results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "results_select_company" ON public.results
  FOR SELECT TO authenticated
  USING (company_id = public.get_user_company_id());

CREATE POLICY "results_insert_writer" ON public.results
  FOR INSERT TO authenticated
  WITH CHECK (
    company_id = public.get_user_company_id()
    AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.active = true)
    AND (
      public.has_role(auth.uid(), 'tecnico')
      OR public.has_role(auth.uid(), 'bioquimico')
      OR public.has_role(auth.uid(), 'admin')
    )
  );

CREATE POLICY "results_update_writer" ON public.results
  FOR UPDATE TO authenticated
  USING (company_id = public.get_user_company_id())
  WITH CHECK (
    company_id = public.get_user_company_id()
    AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.active = true)
    AND (
      public.has_role(auth.uid(), 'tecnico')
      OR public.has_role(auth.uid(), 'bioquimico')
      OR public.has_role(auth.uid(), 'admin')
    )
  );

CREATE POLICY "results_delete_admin" ON public.results
  FOR DELETE TO authenticated
  USING (company_id = public.get_user_company_id() AND public.has_role(auth.uid(), 'admin'));

-- Trigger BEFORE UPDATE: trava liberação por role e preenche released_by/at
CREATE OR REPLACE FUNCTION public.check_result_release()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.released = true AND OLD.released = false THEN
    IF NOT (public.has_role(auth.uid(), 'bioquimico') OR public.has_role(auth.uid(), 'admin')) THEN
      RAISE EXCEPTION 'Sem permissão para liberar resultado';
    END IF;
    NEW.released_by := auth.uid();
    NEW.released_at := now();
  ELSIF NEW.released = false AND OLD.released = true THEN
    -- reverter liberação também restrito a bioquimico/admin
    IF NOT (public.has_role(auth.uid(), 'bioquimico') OR public.has_role(auth.uid(), 'admin')) THEN
      RAISE EXCEPTION 'Sem permissão para reverter liberação';
    END IF;
    NEW.released_by := NULL;
    NEW.released_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER tg_results_check_release BEFORE UPDATE ON public.results
  FOR EACH ROW EXECUTE FUNCTION public.check_result_release();

CREATE TRIGGER tg_results_updated_at BEFORE UPDATE ON public.results
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- 4. order_items: adicionar sample_id, migrar sample_number texto
ALTER TABLE public.order_items ADD COLUMN sample_id uuid REFERENCES public.samples(id);

-- Backfill: para cada order_item com sample_number preenchido, criar/reaproveitar sample por (order_id, material)
DO $$
DECLARE
  r record;
  v_sample_id uuid;
  v_material text;
BEGIN
  FOR r IN SELECT oi.id, oi.order_id, oi.exam_id, oi.company_id, oi.sample_number, e.material
             FROM public.order_items oi
             JOIN public.exams e ON e.id = oi.exam_id
            WHERE oi.sample_number IS NOT NULL AND oi.sample_number <> ''
  LOOP
    v_material := COALESCE(r.material, 'não especificado');
    SELECT id INTO v_sample_id FROM public.samples
     WHERE order_id = r.order_id AND material = v_material AND status <> 'rejeitada'
     LIMIT 1;
    IF v_sample_id IS NULL THEN
      INSERT INTO public.samples (company_id, order_id, material, status)
      VALUES (r.company_id, r.order_id, v_material, 'coletada')
      RETURNING id INTO v_sample_id;
    END IF;
    UPDATE public.order_items SET sample_id = v_sample_id WHERE id = r.id;
  END LOOP;
END$$;

ALTER TABLE public.order_items DROP COLUMN sample_number;

-- 5. Sync order_items.status a partir de samples + results
CREATE OR REPLACE FUNCTION public.recompute_order_item_status(_order_item_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_sample_status public.sample_status;
  v_has_result boolean;
  v_released boolean;
  v_new_status public.order_item_status;
BEGIN
  SELECT s.status INTO v_sample_status
    FROM public.order_items oi
    LEFT JOIN public.samples s ON s.id = oi.sample_id
   WHERE oi.id = _order_item_id;

  SELECT r.id IS NOT NULL, COALESCE(r.released, false)
    INTO v_has_result, v_released
    FROM public.order_items oi
    LEFT JOIN public.results r ON r.order_item_id = oi.id
   WHERE oi.id = _order_item_id;

  IF v_released THEN
    v_new_status := 'liberado';
  ELSIF v_has_result THEN
    v_new_status := 'com_resultado';
  ELSIF v_sample_status IS NULL OR v_sample_status = 'rejeitada' THEN
    v_new_status := 'pendente';
  ELSIF v_sample_status IN ('coletada', 'recebida') THEN
    v_new_status := 'coletado';
  ELSE
    v_new_status := 'pendente';
  END IF;

  UPDATE public.order_items SET status = v_new_status WHERE id = _order_item_id AND status IS DISTINCT FROM v_new_status;
END;
$$;

-- Trigger em samples: recomputa status dos order_items vinculados
CREATE OR REPLACE FUNCTION public.tg_samples_sync_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id FROM public.order_items WHERE sample_id = COALESCE(NEW.id, OLD.id) LOOP
    PERFORM public.recompute_order_item_status(r.id);
  END LOOP;
  RETURN NULL;
END;
$$;

CREATE TRIGGER tg_samples_sync_status_aiud AFTER INSERT OR UPDATE OR DELETE ON public.samples
  FOR EACH ROW EXECUTE FUNCTION public.tg_samples_sync_status();

-- Trigger em results
CREATE OR REPLACE FUNCTION public.tg_results_sync_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.recompute_order_item_status(COALESCE(NEW.order_item_id, OLD.order_item_id));
  RETURN NULL;
END;
$$;

CREATE TRIGGER tg_results_sync_status_aiud AFTER INSERT OR UPDATE OR DELETE ON public.results
  FOR EACH ROW EXECUTE FUNCTION public.tg_results_sync_status();

-- Trigger em order_items: quando sample_id muda, recomputa
CREATE OR REPLACE FUNCTION public.tg_order_items_sync_on_sample_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.sample_id IS DISTINCT FROM OLD.sample_id THEN
    PERFORM public.recompute_order_item_status(NEW.id);
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER tg_order_items_sync_on_sample_change_au AFTER UPDATE ON public.order_items
  FOR EACH ROW EXECUTE FUNCTION public.tg_order_items_sync_on_sample_change();

-- 6. Auto-criar/reaproveitar sample no INSERT de order_items
CREATE OR REPLACE FUNCTION public.tg_order_items_auto_sample()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_material text;
  v_sector text;
  v_sample_id uuid;
BEGIN
  IF NEW.sample_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(material, 'não especificado'), sector
    INTO v_material, v_sector
    FROM public.exams WHERE id = NEW.exam_id;

  SELECT id INTO v_sample_id
    FROM public.samples
   WHERE order_id = NEW.order_id
     AND material = v_material
     AND status <> 'rejeitada'
   ORDER BY created_at DESC
   LIMIT 1;

  IF v_sample_id IS NULL THEN
    INSERT INTO public.samples (company_id, order_id, material, sector, status)
    VALUES (NEW.company_id, NEW.order_id, v_material, v_sector, 'pendente')
    RETURNING id INTO v_sample_id;
  END IF;

  NEW.sample_id := v_sample_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER tg_order_items_auto_sample_bi BEFORE INSERT ON public.order_items
  FOR EACH ROW EXECUTE FUNCTION public.tg_order_items_auto_sample();

-- 7. Índices
CREATE INDEX idx_samples_order_id ON public.samples(order_id);
CREATE INDEX idx_samples_company_status ON public.samples(company_id, status);
CREATE INDEX idx_order_items_sample_id ON public.order_items(sample_id);
CREATE INDEX idx_results_company ON public.results(company_id);
