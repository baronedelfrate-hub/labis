-- Três itens inspirados no XLAB7:
--   1) exames tipo texto (resultado em texto livre, ex.: diagnóstico por imagem)
--   2) textos-modelo para inserir no resultado
--   3) histórico da amostra (quem fez cada passo, quando e em que setor)
-- Mudanças aditivas: o padrão mantém o comportamento atual.

-- 1) Exame tipo texto ---------------------------------------------------------
ALTER TABLE public.exams
  ADD COLUMN IF NOT EXISTS is_text boolean NOT NULL DEFAULT false;

-- 2) Textos-modelo ------------------------------------------------------------
CREATE TABLE public.result_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  exam_id uuid REFERENCES public.exams(id) ON DELETE SET NULL, -- vazio = vale para qualquer exame tipo texto
  title text NOT NULL CHECK (length(btrim(title)) > 0),
  body text NOT NULL CHECK (length(btrim(body)) > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX result_templates_company_exam_idx ON public.result_templates (company_id, exam_id);

REVOKE ALL ON public.result_templates FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.result_templates TO authenticated;
GRANT ALL ON public.result_templates TO service_role;

ALTER TABLE public.result_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "company members read result templates"
  ON public.result_templates FOR SELECT TO authenticated
  USING (company_id = public.get_user_company_id());

CREATE POLICY "admins and biochemists insert result templates"
  ON public.result_templates FOR INSERT TO authenticated
  WITH CHECK (company_id = public.get_user_company_id()
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'bioquimico')));

CREATE POLICY "admins and biochemists update result templates"
  ON public.result_templates FOR UPDATE TO authenticated
  USING (company_id = public.get_user_company_id()
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'bioquimico')))
  WITH CHECK (company_id = public.get_user_company_id()
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'bioquimico')));

CREATE POLICY "admins and biochemists delete result templates"
  ON public.result_templates FOR DELETE TO authenticated
  USING (company_id = public.get_user_company_id()
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'bioquimico')));

CREATE TRIGGER trg_result_templates_updated_at
  BEFORE UPDATE ON public.result_templates
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- 3) Histórico da amostra -----------------------------------------------------
-- Somente leitura para os usuários: quem grava é o gatilho abaixo, a cada mudança de status.
CREATE TABLE public.sample_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  sample_id uuid NOT NULL REFERENCES public.samples(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  event text NOT NULL,                 -- pendente | coletada | recebida | rejeitada
  sector text,
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sample_events_sample_idx ON public.sample_events (sample_id, created_at);

REVOKE ALL ON public.sample_events FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.sample_events TO authenticated;
GRANT ALL ON public.sample_events TO service_role;

ALTER TABLE public.sample_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "company members read sample events"
  ON public.sample_events FOR SELECT TO authenticated
  USING (company_id = public.get_user_company_id());

CREATE OR REPLACE FUNCTION public.tg_samples_log_event()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user uuid;
BEGIN
  IF TG_OP = 'INSERT' OR NEW.status IS DISTINCT FROM OLD.status THEN
    -- só registra o usuário se ele tiver perfil (evita erro de chave estrangeira)
    SELECT id INTO v_user FROM public.profiles WHERE id = auth.uid();
    INSERT INTO public.sample_events (company_id, sample_id, order_id, event, sector, user_id)
    VALUES (NEW.company_id, NEW.id, NEW.order_id, NEW.status::text, NEW.sector, v_user);
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.tg_samples_log_event() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.tg_samples_log_event() TO service_role;

CREATE TRIGGER trg_samples_log_event
  AFTER INSERT OR UPDATE ON public.samples
  FOR EACH ROW EXECUTE FUNCTION public.tg_samples_log_event();

-- Histórico das amostras que já existem (com o que o sistema já guardava)
INSERT INTO public.sample_events (company_id, sample_id, order_id, event, sector, user_id, created_at)
SELECT s.company_id, s.id, s.order_id, 'pendente', s.sector, NULL, s.created_at FROM public.samples s;

INSERT INTO public.sample_events (company_id, sample_id, order_id, event, sector, user_id, created_at)
SELECT s.company_id, s.id, s.order_id, 'coletada', s.sector,
       (SELECT p.id FROM public.profiles p WHERE p.id = s.collected_by), s.collected_at
  FROM public.samples s WHERE s.collected_at IS NOT NULL;

INSERT INTO public.sample_events (company_id, sample_id, order_id, event, sector, user_id, created_at)
SELECT s.company_id, s.id, s.order_id, 'recebida', s.sector,
       (SELECT p.id FROM public.profiles p WHERE p.id = s.received_by), s.received_at
  FROM public.samples s WHERE s.received_at IS NOT NULL;

INSERT INTO public.sample_events (company_id, sample_id, order_id, event, sector, user_id, created_at)
SELECT s.company_id, s.id, s.order_id, 'rejeitada', s.sector, NULL, s.updated_at
  FROM public.samples s WHERE s.status = 'rejeitada';
