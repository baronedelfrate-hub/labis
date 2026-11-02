-- Exames com mais de uma amostra ("+" no XLAB7), mais de uma etiqueta por amostra ("^")
-- e nova coleta automática quando uma amostra é rejeitada.
--
-- * exams.samples_count: quantas amostras (tubos) o exame precisa (1 a 9).
-- * exams.labels_per_sample: quantas etiquetas cada amostra do exame precisa (1 a 5).
-- * samples.material_seq: número do tubo do mesmo material dentro do pedido (1, 2, ...).
-- * order_item_samples: todas as amostras de cada exame do pedido (order_items.sample_id continua
--   guardando a primeira, para não quebrar nada que já use esse campo).
-- * Rejeição: até hoje nada criava uma amostra nova, e os exames ficavam pendentes sem ter o que
--   coletar. Agora a rejeição cria a amostra de reposição e religa os exames a ela.
--
-- Mudança aditiva: o padrão (1 amostra, 1 etiqueta) mantém o comportamento atual.

ALTER TABLE public.exams
  ADD COLUMN IF NOT EXISTS samples_count smallint NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS labels_per_sample smallint NOT NULL DEFAULT 1;

ALTER TABLE public.exams DROP CONSTRAINT IF EXISTS exams_samples_count_range;
ALTER TABLE public.exams ADD CONSTRAINT exams_samples_count_range CHECK (samples_count BETWEEN 1 AND 9);
ALTER TABLE public.exams DROP CONSTRAINT IF EXISTS exams_labels_per_sample_range;
ALTER TABLE public.exams ADD CONSTRAINT exams_labels_per_sample_range CHECK (labels_per_sample BETWEEN 1 AND 5);

ALTER TABLE public.samples
  ADD COLUMN IF NOT EXISTS material_seq smallint NOT NULL DEFAULT 1;

CREATE TABLE public.order_item_samples (
  order_item_id uuid NOT NULL REFERENCES public.order_items(id) ON DELETE CASCADE,
  sample_id uuid NOT NULL REFERENCES public.samples(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  PRIMARY KEY (order_item_id, sample_id)
);
CREATE INDEX order_item_samples_sample_idx ON public.order_item_samples (sample_id);

-- Somente leitura para os usuários: quem grava são os gatilhos abaixo.
REVOKE ALL ON public.order_item_samples FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.order_item_samples TO authenticated;
GRANT ALL ON public.order_item_samples TO service_role;
ALTER TABLE public.order_item_samples ENABLE ROW LEVEL SECURITY;
CREATE POLICY "company members read order item samples"
  ON public.order_item_samples FOR SELECT TO authenticated
  USING (company_id = public.get_user_company_id());

-- Os exames que já existem passam a ter a sua amostra registrada na tabela nova.
INSERT INTO public.order_item_samples (order_item_id, sample_id, company_id)
SELECT oi.id, oi.sample_id, s.company_id
  FROM public.order_items oi JOIN public.samples s ON s.id = oi.sample_id
ON CONFLICT DO NOTHING;

-- 1) Primeira amostra do exame: igual a antes, só que sempre o tubo 1 do material.
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
     AND material_seq = 1
     AND status <> 'rejeitada'
   ORDER BY created_at DESC
   LIMIT 1;

  IF v_sample_id IS NULL THEN
    INSERT INTO public.samples (company_id, order_id, material, sector, status, material_seq)
    VALUES (NEW.company_id, NEW.order_id, v_material, v_sector, 'pendente', 1)
    RETURNING id INTO v_sample_id;
  END IF;

  NEW.sample_id := v_sample_id;
  RETURN NEW;
END;
$$;

-- 2) Depois de gravar o exame: registra todas as amostras dele (cria os tubos 2, 3... se precisar).
CREATE OR REPLACE FUNCTION public.tg_order_items_link_samples()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_material text;
  v_sector text;
  v_count smallint;
  v_sample uuid;
  k int;
BEGIN
  SELECT COALESCE(material, 'não especificado'), sector, samples_count
    INTO v_material, v_sector, v_count
    FROM public.exams WHERE id = NEW.exam_id;

  FOR k IN 1..GREATEST(COALESCE(v_count, 1), 1) LOOP
    IF k = 1 THEN
      v_sample := NEW.sample_id;
    ELSE
      SELECT id INTO v_sample
        FROM public.samples
       WHERE order_id = NEW.order_id AND material = v_material AND material_seq = k AND status <> 'rejeitada'
       ORDER BY created_at DESC LIMIT 1;
      IF v_sample IS NULL THEN
        INSERT INTO public.samples (company_id, order_id, material, sector, status, material_seq)
        VALUES (NEW.company_id, NEW.order_id, v_material, v_sector, 'pendente', k)
        RETURNING id INTO v_sample;
      END IF;
    END IF;
    IF v_sample IS NOT NULL THEN
      INSERT INTO public.order_item_samples (order_item_id, sample_id, company_id)
      VALUES (NEW.id, v_sample, NEW.company_id) ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;

  PERFORM public.recompute_order_item_status(NEW.id);
  RETURN NULL;
END;
$$;

CREATE TRIGGER tg_order_items_link_samples_ai
  AFTER INSERT ON public.order_items
  FOR EACH ROW EXECUTE FUNCTION public.tg_order_items_link_samples();

-- 3) Situação do exame: só fica "coletado" quando TODAS as amostras dele foram coletadas.
CREATE OR REPLACE FUNCTION public.recompute_order_item_status(_order_item_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_total int;
  v_ok int;
  v_has_result boolean;
  v_released boolean;
  v_new_status public.order_item_status;
BEGIN
  SELECT count(*), count(*) FILTER (WHERE q.status IN ('coletada', 'recebida'))
    INTO v_total, v_ok
    FROM (
      SELECT s.status FROM public.order_item_samples ois
        JOIN public.samples s ON s.id = ois.sample_id
       WHERE ois.order_item_id = _order_item_id
      UNION ALL
      SELECT s.status FROM public.order_items oi
        JOIN public.samples s ON s.id = oi.sample_id
       WHERE oi.id = _order_item_id
         AND NOT EXISTS (SELECT 1 FROM public.order_item_samples x WHERE x.order_item_id = oi.id)
    ) q;

  SELECT r.id IS NOT NULL, COALESCE(r.released, false)
    INTO v_has_result, v_released
    FROM public.order_items oi
    LEFT JOIN public.results r ON r.order_item_id = oi.id
   WHERE oi.id = _order_item_id;

  IF v_released THEN
    v_new_status := 'liberado';
  ELSIF v_has_result THEN
    v_new_status := 'com_resultado';
  ELSIF v_total > 0 AND v_ok = v_total THEN
    v_new_status := 'coletado';
  ELSE
    v_new_status := 'pendente';
  END IF;

  UPDATE public.order_items SET status = v_new_status WHERE id = _order_item_id AND status IS DISTINCT FROM v_new_status;
END;
$$;

-- 4) Quando uma amostra muda, recalcula todos os exames que dependem dela.
CREATE OR REPLACE FUNCTION public.tg_samples_sync_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT order_item_id AS id FROM public.order_item_samples WHERE sample_id = COALESCE(NEW.id, OLD.id)
    UNION
    SELECT id FROM public.order_items WHERE sample_id = COALESCE(NEW.id, OLD.id)
  LOOP
    PERFORM public.recompute_order_item_status(r.id);
  END LOOP;
  RETURN NULL;
END;
$$;

-- 5) Amostra rejeitada: cria a amostra de reposição (novo número e nova etiqueta) e religa os exames.
CREATE OR REPLACE FUNCTION public.tg_samples_replace_on_reject()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_new uuid;
  r record;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.order_item_samples WHERE sample_id = NEW.id)
     AND NOT EXISTS (SELECT 1 FROM public.order_items WHERE sample_id = NEW.id) THEN
    RETURN NULL; -- nenhum exame depende dela: não há o que recoletar
  END IF;

  INSERT INTO public.samples (company_id, order_id, material, sector, status, material_seq)
  VALUES (NEW.company_id, NEW.order_id, NEW.material, NEW.sector, 'pendente', NEW.material_seq)
  RETURNING id INTO v_new;

  UPDATE public.order_item_samples SET sample_id = v_new WHERE sample_id = NEW.id;
  UPDATE public.order_items SET sample_id = v_new WHERE sample_id = NEW.id;

  FOR r IN SELECT order_item_id AS id FROM public.order_item_samples WHERE sample_id = v_new LOOP
    PERFORM public.recompute_order_item_status(r.id);
  END LOOP;
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.tg_order_items_link_samples() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.tg_order_items_link_samples() TO service_role;
REVOKE ALL ON FUNCTION public.tg_samples_replace_on_reject() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.tg_samples_replace_on_reject() TO service_role;

CREATE TRIGGER tg_samples_replace_on_reject_au
  AFTER UPDATE OF status ON public.samples
  FOR EACH ROW
  WHEN (NEW.status = 'rejeitada' AND OLD.status IS DISTINCT FROM 'rejeitada')
  EXECUTE FUNCTION public.tg_samples_replace_on_reject();
