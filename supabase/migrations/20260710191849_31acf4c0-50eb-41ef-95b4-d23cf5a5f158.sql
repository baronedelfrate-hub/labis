CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE TABLE public.portal_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  order_id uuid NOT NULL UNIQUE REFERENCES public.orders(id) ON DELETE CASCADE,
  public_code varchar NOT NULL UNIQUE,
  pin_hash text NOT NULL,
  failed_attempts int NOT NULL DEFAULT 0,
  locked_until timestamptz,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '90 days'),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

GRANT ALL ON public.portal_access TO service_role;

ALTER TABLE public.portal_access ENABLE ROW LEVEL SECURITY;
-- Sem policies: apenas service_role (que bypassa RLS) pode acessar.

CREATE INDEX idx_portal_access_public_code ON public.portal_access(public_code);
CREATE INDEX idx_portal_access_order_id ON public.portal_access(order_id);

-- Gera código público alfanumérico maiúsculo sem caracteres ambíguos (O/0, I/1, L)
CREATE OR REPLACE FUNCTION public.portal_generate_code()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  chars text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  result text := '';
  i int;
BEGIN
  FOR i IN 1..4 LOOP
    result := result || substr(chars, 1 + floor(random() * length(chars))::int, 1);
  END LOOP;
  result := result || '-';
  FOR i IN 1..4 LOOP
    result := result || substr(chars, 1 + floor(random() * length(chars))::int, 1);
  END LOOP;
  RETURN result;
END;
$$;

-- Gera acesso ao portal para um pedido finalizado (invalida acesso anterior)
-- Executado com privilégios elevados; verifica que o pedido pertence à mesma empresa do usuário chamador.
CREATE OR REPLACE FUNCTION public.portal_create_access(_order_id uuid)
RETURNS TABLE(public_code varchar, pin text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_company_id uuid;
  v_status public.order_status;
  v_user_company uuid;
  v_code varchar;
  v_pin text;
  v_hash text;
BEGIN
  SELECT company_id, status INTO v_company_id, v_status
    FROM public.orders WHERE id = _order_id;
  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'Pedido não encontrado';
  END IF;
  IF v_status <> 'finalizado' THEN
    RAISE EXCEPTION 'Só é possível gerar acesso ao portal para pedidos finalizados';
  END IF;

  v_user_company := public.get_user_company_id();
  IF v_user_company IS NULL OR v_user_company <> v_company_id THEN
    RAISE EXCEPTION 'Sem permissão para gerar acesso ao portal deste pedido';
  END IF;

  -- Gera código único
  LOOP
    v_code := public.portal_generate_code();
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.portal_access WHERE portal_access.public_code = v_code);
  END LOOP;

  -- Gera PIN numérico de 6 dígitos
  v_pin := lpad(floor(random() * 1000000)::int::text, 6, '0');
  v_hash := crypt(v_pin, gen_salt('bf'));

  -- Invalida acesso anterior (unique em order_id) e cria novo
  DELETE FROM public.portal_access WHERE order_id = _order_id;
  INSERT INTO public.portal_access (company_id, order_id, public_code, pin_hash, created_by)
  VALUES (v_company_id, _order_id, v_code, v_hash, auth.uid());

  RETURN QUERY SELECT v_code, v_pin;
END;
$$;

REVOKE ALL ON FUNCTION public.portal_create_access(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.portal_create_access(uuid) TO authenticated;

-- Verifica login do portal. Chamada apenas pelo backend do sistema com service_role.
-- Retorna order_id em caso de sucesso; nulo em caso de falha.
-- Faz o rate limiting/bloqueio server-side.
CREATE OR REPLACE FUNCTION public.portal_verify_login(_code text, _pin text)
RETURNS TABLE(status text, order_id uuid, locked_until timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  r public.portal_access%ROWTYPE;
BEGIN
  SELECT * INTO r FROM public.portal_access WHERE portal_access.public_code = _code;
  IF NOT FOUND THEN
    RETURN QUERY SELECT 'invalid'::text, NULL::uuid, NULL::timestamptz;
    RETURN;
  END IF;

  IF r.locked_until IS NOT NULL AND r.locked_until > now() THEN
    RETURN QUERY SELECT 'locked'::text, NULL::uuid, r.locked_until;
    RETURN;
  END IF;

  IF r.expires_at < now() THEN
    RETURN QUERY SELECT 'expired'::text, NULL::uuid, NULL::timestamptz;
    RETURN;
  END IF;

  IF crypt(_pin, r.pin_hash) = r.pin_hash THEN
    UPDATE public.portal_access SET failed_attempts = 0, locked_until = NULL WHERE id = r.id;
    RETURN QUERY SELECT 'ok'::text, r.order_id, NULL::timestamptz;
    RETURN;
  END IF;

  -- PIN inválido: incrementa contador
  UPDATE public.portal_access
    SET failed_attempts = failed_attempts + 1,
        locked_until = CASE WHEN failed_attempts + 1 >= 5 THEN now() + interval '15 minutes' ELSE locked_until END
    WHERE id = r.id;

  RETURN QUERY SELECT 'invalid'::text, NULL::uuid, NULL::timestamptz;
END;
$$;

REVOKE ALL ON FUNCTION public.portal_verify_login(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.portal_verify_login(text, text) TO service_role;

-- Trigger updated_at N/A (não existe updated_at)