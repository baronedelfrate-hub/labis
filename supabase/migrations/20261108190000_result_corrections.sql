-- Devolver um resultado para correção, antes da liberação.
--
-- Hoje um valor digitado errado não tinha como ser corrigido pelo sistema: o resultado sai da fila de lançamento
-- e não há edição na Liberação. Esta função apaga o resultado ainda NÃO liberado (os valores vão junto) e o exame
-- volta sozinho para a fila de Resultados, guardando um registro do que foi devolvido e do motivo.
--
-- Regras: só administrador ou bioquímico; só resultado do próprio laboratório; só se ainda não foi liberado;
-- motivo obrigatório. Resultado liberado NÃO pode ser devolvido (retificação de laudo é outro assunto).
--
-- Mudança aditiva.

CREATE TABLE IF NOT EXISTS public.result_corrections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  order_item_id uuid NOT NULL REFERENCES public.order_items(id) ON DELETE CASCADE,
  reason text NOT NULL CHECK (char_length(btrim(reason)) >= 3),
  returned_by uuid,
  returned_at timestamptz NOT NULL DEFAULT now(),
  snapshot jsonb NOT NULL
);
CREATE INDEX IF NOT EXISTS result_corrections_item_idx ON public.result_corrections (order_item_id, returned_at DESC);

REVOKE ALL ON public.result_corrections FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.result_corrections TO authenticated;
GRANT ALL ON public.result_corrections TO service_role;
ALTER TABLE public.result_corrections ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'result_corrections' AND policyname = 'result_corrections_select_company') THEN
    CREATE POLICY result_corrections_select_company ON public.result_corrections FOR SELECT TO authenticated
      USING (company_id = public.get_user_company_id());
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.return_result_for_correction(_result_id uuid, _reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_res public.results%ROWTYPE;
  v_snap jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  IF _reason IS NULL OR char_length(btrim(_reason)) < 3 THEN
    RAISE EXCEPTION 'Informe o motivo da devolução (mínimo 3 letras)';
  END IF;

  SELECT * INTO v_res FROM public.results WHERE id = _result_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Resultado não encontrado'; END IF;
  IF v_res.company_id IS DISTINCT FROM public.get_user_company_id() THEN
    RAISE EXCEPTION 'Sem permissão para este resultado';
  END IF;
  IF NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'bioquimico')) THEN
    RAISE EXCEPTION 'Só administrador ou bioquímico pode devolver um resultado para correção';
  END IF;
  IF v_res.released THEN
    RAISE EXCEPTION 'Este resultado já foi liberado e não pode ser devolvido';
  END IF;

  v_snap := to_jsonb(v_res) || jsonb_build_object(
    'values', COALESCE((SELECT jsonb_agg(to_jsonb(v)) FROM public.result_values v WHERE v.result_id = v_res.id), '[]'::jsonb));

  INSERT INTO public.result_corrections (company_id, order_item_id, reason, returned_by, snapshot)
  VALUES (v_res.company_id, v_res.order_item_id, btrim(_reason), auth.uid(), v_snap);

  DELETE FROM public.results WHERE id = _result_id; -- os valores vão junto e o exame volta para a fila de Resultados
END;
$$;

REVOKE ALL ON FUNCTION public.return_result_for_correction(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.return_result_for_correction(uuid, text) TO authenticated;
