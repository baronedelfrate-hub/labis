
CREATE OR REPLACE FUNCTION public.recompute_order_status(_order_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_total int;
  v_pendente int;
  v_coletado int;
  v_com_resultado int;
  v_liberado int;
  v_current public.order_status;
  v_new public.order_status;
BEGIN
  SELECT status INTO v_current FROM public.orders WHERE id = _order_id;
  IF v_current = 'cancelado' THEN RETURN; END IF;

  SELECT
    count(*),
    count(*) FILTER (WHERE status = 'pendente'),
    count(*) FILTER (WHERE status = 'coletado'),
    count(*) FILTER (WHERE status = 'com_resultado'),
    count(*) FILTER (WHERE status = 'liberado')
  INTO v_total, v_pendente, v_coletado, v_com_resultado, v_liberado
  FROM public.order_items WHERE order_id = _order_id;

  IF v_total = 0 THEN
    v_new := 'aberto';
  ELSIF v_liberado = v_total THEN
    v_new := 'finalizado';
  ELSIF v_pendente > 0 THEN
    v_new := 'aberto';
  ELSIF v_com_resultado > 0 OR v_liberado > 0 THEN
    v_new := 'em_analise';
  ELSIF v_coletado > 0 THEN
    v_new := 'coletado';
  ELSE
    v_new := 'aberto';
  END IF;

  UPDATE public.orders SET status = v_new
   WHERE id = _order_id AND status IS DISTINCT FROM v_new;
END;
$$;

CREATE OR REPLACE FUNCTION public.tg_order_items_sync_order_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.recompute_order_status(OLD.order_id);
  ELSIF TG_OP = 'INSERT' THEN
    PERFORM public.recompute_order_status(NEW.order_id);
  ELSE
    PERFORM public.recompute_order_status(NEW.order_id);
    IF NEW.order_id IS DISTINCT FROM OLD.order_id THEN
      PERFORM public.recompute_order_status(OLD.order_id);
    END IF;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_order_items_sync_order_status ON public.order_items;
CREATE TRIGGER trg_order_items_sync_order_status
AFTER INSERT OR UPDATE OR DELETE ON public.order_items
FOR EACH ROW EXECUTE FUNCTION public.tg_order_items_sync_order_status();

-- Backfill de todos os pedidos existentes (exceto cancelados)
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id FROM public.orders WHERE status <> 'cancelado' LOOP
    PERFORM public.recompute_order_status(r.id);
  END LOOP;
END $$;
