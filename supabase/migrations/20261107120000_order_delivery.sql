-- Entrega do laudo ao paciente: o pedido finalizado deixa a lista de "prontos para entrega"
-- quando é marcado como entregue. Aditiva: não altera dados existentes nem o status do pedido.
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS delivered_at timestamptz,
  ADD COLUMN IF NOT EXISTS delivered_by uuid,
  ADD COLUMN IF NOT EXISTS delivered_to text;

COMMENT ON COLUMN public.orders.delivered_at IS 'Quando o laudo foi entregue ao paciente (null = ainda não entregue).';
COMMENT ON COLUMN public.orders.delivered_by IS 'Usuário que registrou a entrega.';
COMMENT ON COLUMN public.orders.delivered_to IS 'Quem retirou o laudo (nome, quando informado).';

CREATE INDEX IF NOT EXISTS orders_company_delivered_idx ON public.orders (company_id, delivered_at);
