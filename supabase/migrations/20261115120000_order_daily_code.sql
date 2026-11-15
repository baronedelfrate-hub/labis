-- Número do pedido do dia: zera todos os dias e leva a data, como no XLAB7.
--   daily_seq  = 1, 2, 3... dentro do dia (por laboratório)
--   daily_code = 5 dígitos + DDMMYYYY, ex.: 0000115112026 (1º do dia 15/11/2026)
-- order_number (sequencial contínuo) continua existindo: é ele que forma o código de barras das amostras,
-- que não pode repetir entre dias. Pedidos antigos ficam sem daily_code e continuam aparecendo como #order_number.
-- Mudança aditiva.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS daily_seq integer,
  ADD COLUMN IF NOT EXISTS daily_code text;

CREATE TABLE IF NOT EXISTS public.order_daily_counters (
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  day date NOT NULL,
  last_seq integer NOT NULL DEFAULT 0,
  PRIMARY KEY (company_id, day)
);
REVOKE ALL ON public.order_daily_counters FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.order_daily_counters TO service_role;
ALTER TABLE public.order_daily_counters ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX IF NOT EXISTS orders_company_daily_code_key
  ON public.orders (company_id, daily_code) WHERE daily_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS orders_daily_code_idx ON public.orders (daily_code) WHERE daily_code IS NOT NULL;

CREATE OR REPLACE FUNCTION public.tg_order_daily_code()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s integer;
BEGIN
  IF NEW.daily_code IS NULL AND NEW.company_id IS NOT NULL THEN
    -- UPSERT atômico: dois pedidos ao mesmo tempo nunca recebem o mesmo número
    INSERT INTO public.order_daily_counters AS c (company_id, day, last_seq)
    VALUES (NEW.company_id, NEW.order_date, 1)
    ON CONFLICT (company_id, day) DO UPDATE SET last_seq = c.last_seq + 1
    RETURNING c.last_seq INTO s;
    IF s > 99999 THEN
      RAISE EXCEPTION 'Limite de 99.999 pedidos no dia atingido.';
    END IF;
    NEW.daily_seq := s;
    NEW.daily_code := lpad(s::text, 5, '0') || to_char(NEW.order_date, 'DDMMYYYY');
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.tg_order_daily_code() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_orders_daily_code ON public.orders;
CREATE TRIGGER trg_orders_daily_code BEFORE INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.tg_order_daily_code();
