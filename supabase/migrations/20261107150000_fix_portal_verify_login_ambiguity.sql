-- Corrige "column reference "locked_until" is ambiguous" (42702) em portal_verify_login.
-- A função declara RETURNS TABLE(status, order_id, locked_until): essas colunas de saída viram variáveis
-- com o mesmo nome das colunas de portal_access e o PL/pgSQL não sabia qual usar. O ramo de senha
-- incorreta falhava com erro (500 no portal) e, por falhar, o contador de tentativas nunca subia
-- (o bloqueio de 5 tentativas não funcionava). A diretiva abaixo resolve a ambiguidade a favor da coluna.
CREATE OR REPLACE FUNCTION public.portal_verify_login(_code text, _pin text)
RETURNS TABLE(status text, order_id uuid, locked_until timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
#variable_conflict use_column
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
    UPDATE public.portal_access SET failed_attempts = 0, locked_until = NULL WHERE portal_access.id = r.id;
    RETURN QUERY SELECT 'ok'::text, r.order_id, NULL::timestamptz;
    RETURN;
  END IF;

  -- PIN inválido: incrementa contador e bloqueia por 15 minutos na 5ª tentativa
  UPDATE public.portal_access
    SET failed_attempts = portal_access.failed_attempts + 1,
        locked_until = CASE WHEN portal_access.failed_attempts + 1 >= 5 THEN now() + interval '15 minutes' ELSE portal_access.locked_until END
    WHERE portal_access.id = r.id;

  RETURN QUERY SELECT 'invalid'::text, NULL::uuid, NULL::timestamptz;
END;
$$;

REVOKE ALL ON FUNCTION public.portal_verify_login(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.portal_verify_login(text, text) TO service_role;
