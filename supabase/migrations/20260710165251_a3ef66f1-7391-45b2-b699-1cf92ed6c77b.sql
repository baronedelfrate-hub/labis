
-- Enums
CREATE TYPE public.payment_method AS ENUM ('dinheiro','pix','cartao_debito','cartao_credito','boleto');
CREATE TYPE public.billing_batch_status AS ENUM ('aberto','fechado','enviado','pago_parcial','pago');
CREATE TYPE public.payment_status AS ENUM ('pendente','parcial','pago');

-- orders: add payment_status + billing_batch_id (batch FK added after batches table)
ALTER TABLE public.orders ADD COLUMN payment_status public.payment_status NOT NULL DEFAULT 'pendente';
ALTER TABLE public.orders ADD COLUMN billing_batch_id uuid;

-- billing_batches
CREATE TABLE public.billing_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  insurance_plan_id uuid NOT NULL REFERENCES public.insurance_plans(id),
  reference_month date NOT NULL,
  status public.billing_batch_status NOT NULL DEFAULT 'aberto',
  total_value numeric NOT NULL DEFAULT 0,
  opened_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.billing_batches TO authenticated;
GRANT ALL ON public.billing_batches TO service_role;
ALTER TABLE public.billing_batches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "billing_batches select by company" ON public.billing_batches
  FOR SELECT TO authenticated USING (company_id = public.get_user_company_id());
CREATE POLICY "billing_batches insert active" ON public.billing_batches
  FOR INSERT TO authenticated WITH CHECK (
    company_id = public.get_user_company_id() AND
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.active = true)
  );
CREATE POLICY "billing_batches update active" ON public.billing_batches
  FOR UPDATE TO authenticated USING (
    company_id = public.get_user_company_id() AND
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.active = true)
  ) WITH CHECK (company_id = public.get_user_company_id());
CREATE POLICY "billing_batches delete admin" ON public.billing_batches
  FOR DELETE TO authenticated USING (
    company_id = public.get_user_company_id() AND public.has_role(auth.uid(),'admin')
  );

CREATE TRIGGER trg_billing_batches_updated_at
  BEFORE UPDATE ON public.billing_batches FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- orders.billing_batch_id FK now that table exists
ALTER TABLE public.orders
  ADD CONSTRAINT orders_billing_batch_id_fkey
  FOREIGN KEY (billing_batch_id) REFERENCES public.billing_batches(id) ON DELETE SET NULL;

-- billing_batch_items
CREATE TABLE public.billing_batch_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  billing_batch_id uuid NOT NULL REFERENCES public.billing_batches(id) ON DELETE CASCADE,
  order_id uuid NOT NULL UNIQUE REFERENCES public.orders(id) ON DELETE CASCADE,
  value numeric NOT NULL DEFAULT 0,
  glosa_value numeric NOT NULL DEFAULT 0,
  glosa_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.billing_batch_items TO authenticated;
GRANT ALL ON public.billing_batch_items TO service_role;
ALTER TABLE public.billing_batch_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "billing_batch_items select by company" ON public.billing_batch_items
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.billing_batches b WHERE b.id = billing_batch_id AND b.company_id = public.get_user_company_id())
  );
CREATE POLICY "billing_batch_items write active" ON public.billing_batch_items
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.billing_batches b WHERE b.id = billing_batch_id AND b.company_id = public.get_user_company_id())
    AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.active = true)
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.billing_batches b WHERE b.id = billing_batch_id AND b.company_id = public.get_user_company_id())
  );

CREATE TRIGGER trg_billing_batch_items_updated_at
  BEFORE UPDATE ON public.billing_batch_items FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- payments
CREATE TABLE public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  order_id uuid REFERENCES public.orders(id) ON DELETE CASCADE,
  billing_batch_id uuid REFERENCES public.billing_batches(id) ON DELETE CASCADE,
  amount numeric NOT NULL,
  method public.payment_method NOT NULL,
  paid_at timestamptz NOT NULL DEFAULT now(),
  received_by uuid REFERENCES public.profiles(id),
  installment_number int NOT NULL DEFAULT 1,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (order_id IS NOT NULL OR billing_batch_id IS NOT NULL)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payments TO authenticated;
GRANT ALL ON public.payments TO service_role;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "payments select by company" ON public.payments
  FOR SELECT TO authenticated USING (company_id = public.get_user_company_id());
CREATE POLICY "payments insert active" ON public.payments
  FOR INSERT TO authenticated WITH CHECK (
    company_id = public.get_user_company_id() AND
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.active = true)
  );
CREATE POLICY "payments update active" ON public.payments
  FOR UPDATE TO authenticated USING (
    company_id = public.get_user_company_id() AND
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.active = true)
  ) WITH CHECK (company_id = public.get_user_company_id());
CREATE POLICY "payments delete admin" ON public.payments
  FOR DELETE TO authenticated USING (
    company_id = public.get_user_company_id() AND public.has_role(auth.uid(),'admin')
  );

CREATE TRIGGER trg_payments_updated_at
  BEFORE UPDATE ON public.payments FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE INDEX idx_payments_order ON public.payments(order_id);
CREATE INDEX idx_payments_batch ON public.payments(billing_batch_id);
CREATE INDEX idx_billing_batches_company_status ON public.billing_batches(company_id, status);
CREATE INDEX idx_orders_billing_batch ON public.orders(billing_batch_id);

-- Recompute payment_status
CREATE OR REPLACE FUNCTION public.recompute_order_payment_status(_order_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_total numeric;
  v_paid numeric;
  v_new public.payment_status;
BEGIN
  IF _order_id IS NULL THEN RETURN; END IF;
  SELECT total_value INTO v_total FROM public.orders WHERE id = _order_id;
  SELECT COALESCE(SUM(amount),0) INTO v_paid FROM public.payments WHERE order_id = _order_id;
  IF v_paid <= 0 THEN v_new := 'pendente';
  ELSIF v_paid < COALESCE(v_total,0) THEN v_new := 'parcial';
  ELSE v_new := 'pago';
  END IF;
  UPDATE public.orders SET payment_status = v_new WHERE id = _order_id AND payment_status IS DISTINCT FROM v_new;
END;
$$;

CREATE OR REPLACE FUNCTION public.tg_payments_sync_order_payment_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.recompute_order_payment_status(OLD.order_id);
  ELSIF TG_OP = 'INSERT' THEN
    PERFORM public.recompute_order_payment_status(NEW.order_id);
  ELSE
    PERFORM public.recompute_order_payment_status(NEW.order_id);
    IF NEW.order_id IS DISTINCT FROM OLD.order_id THEN
      PERFORM public.recompute_order_payment_status(OLD.order_id);
    END IF;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_payments_sync_order_payment_status
  AFTER INSERT OR UPDATE OR DELETE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.tg_payments_sync_order_payment_status();
