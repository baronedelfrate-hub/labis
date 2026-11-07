-- Endereço próprio do portal do paciente de cada laboratório: /portal?lab=<portal_slug>.
-- A tela de login do portal usa o slug para mostrar o nome e a logo do laboratório antes do login.
--
-- * companies.portal_slug: minúsculas, números e hífen, 3 a 40 caracteres, único.
-- * Gerado a partir do nome para os laboratórios existentes e para os novos (trigger).
-- * A empresa modelo não tem slug (não é um laboratório real).
--
-- Mudança aditiva.

CREATE OR REPLACE FUNCTION public._slugify(t text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT trim(both '-' FROM regexp_replace(
    translate(lower(coalesce(t, '')), 'áàâãäéèêëíìîïóòôõöúùûüçñ', 'aaaaaeeeeiiiiooooouuuucn'),
    '[^a-z0-9]+', '-', 'g'))
$$;

ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS portal_slug text;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'companies_portal_slug_format' AND conrelid = 'public.companies'::regclass) THEN
    ALTER TABLE public.companies ADD CONSTRAINT companies_portal_slug_format
      CHECK (portal_slug IS NULL OR (portal_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND char_length(portal_slug) BETWEEN 3 AND 40));
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS companies_portal_slug_key ON public.companies (portal_slug) WHERE portal_slug IS NOT NULL;

-- Gera um slug único a partir do nome (acrescenta -2, -3... se já existir)
CREATE OR REPLACE FUNCTION public._unique_portal_slug(_name text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE base text; cand text; i int := 1;
BEGIN
  base := left(public._slugify(_name), 36);
  base := trim(both '-' FROM base);
  IF char_length(base) < 3 THEN base := 'laboratorio'; END IF;
  cand := base;
  WHILE EXISTS (SELECT 1 FROM public.companies WHERE portal_slug = cand) LOOP
    i := i + 1;
    cand := base || '-' || i;
  END LOOP;
  RETURN cand;
END;
$$;
REVOKE EXECUTE ON FUNCTION public._unique_portal_slug(text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.tg_companies_portal_slug()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.portal_slug IS NULL AND NOT NEW.is_template THEN
    NEW.portal_slug := public._unique_portal_slug(NEW.name);
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.tg_companies_portal_slug() FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_companies_portal_slug' AND tgrelid = 'public.companies'::regclass) THEN
    CREATE TRIGGER trg_companies_portal_slug BEFORE INSERT ON public.companies
      FOR EACH ROW EXECUTE FUNCTION public.tg_companies_portal_slug();
  END IF;
END $$;

-- Laboratórios que já existem
DO $$
DECLARE c record;
BEGIN
  FOR c IN SELECT id, name FROM public.companies WHERE portal_slug IS NULL AND NOT is_template ORDER BY created_at LOOP
    UPDATE public.companies SET portal_slug = public._unique_portal_slug(c.name) WHERE id = c.id;
  END LOOP;
END $$;
