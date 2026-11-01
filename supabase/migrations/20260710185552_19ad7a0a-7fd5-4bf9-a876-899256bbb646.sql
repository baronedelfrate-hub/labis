
ALTER TABLE public.insurance_plans ADD COLUMN IF NOT EXISTS is_particular boolean NOT NULL DEFAULT false;

UPDATE public.insurance_plans SET is_particular = true WHERE upper(code) = 'PART' OR upper(name) = 'PARTICULAR';

CREATE OR REPLACE FUNCTION public.tg_billing_batch_block_particular()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_is_particular boolean;
BEGIN
  IF NEW.insurance_plan_id IS NULL THEN
    RAISE EXCEPTION 'Lote de faturamento requer convênio';
  END IF;
  SELECT is_particular INTO v_is_particular FROM public.insurance_plans WHERE id = NEW.insurance_plan_id;
  IF COALESCE(v_is_particular, false) THEN
    RAISE EXCEPTION 'Não é permitido gerar lote de faturamento para convênio particular';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS billing_batches_block_particular ON public.billing_batches;
CREATE TRIGGER billing_batches_block_particular
BEFORE INSERT OR UPDATE OF insurance_plan_id ON public.billing_batches
FOR EACH ROW EXECUTE FUNCTION public.tg_billing_batch_block_particular();
