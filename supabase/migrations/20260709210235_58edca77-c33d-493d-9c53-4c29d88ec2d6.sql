
-- 1. profiles.active
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;

-- 2. invitation_status enum
DO $$ BEGIN
  CREATE TYPE public.invitation_status AS ENUM ('pending','accepted','expired','revoked');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3. invitations table
CREATE TABLE public.invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  email text NOT NULL,
  role public.app_role NOT NULL,
  invited_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  status public.invitation_status NOT NULL DEFAULT 'pending',
  token uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.invitations (company_id);
CREATE INDEX ON public.invitations (email);
CREATE UNIQUE INDEX invitations_one_pending_per_email
  ON public.invitations (company_id, lower(email)) WHERE status = 'pending';

GRANT SELECT, INSERT, UPDATE, DELETE ON public.invitations TO authenticated;
GRANT ALL ON public.invitations TO service_role;
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_invitations_updated BEFORE UPDATE ON public.invitations
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE POLICY invitations_admin_select ON public.invitations FOR SELECT TO authenticated
  USING (company_id = public.get_user_company_id() AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY invitations_admin_insert ON public.invitations FOR INSERT TO authenticated
  WITH CHECK (company_id = public.get_user_company_id() AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY invitations_admin_update ON public.invitations FOR UPDATE TO authenticated
  USING (company_id = public.get_user_company_id() AND public.has_role(auth.uid(), 'admin'))
  WITH CHECK (company_id = public.get_user_company_id() AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY invitations_admin_delete ON public.invitations FOR DELETE TO authenticated
  USING (company_id = public.get_user_company_id() AND public.has_role(auth.uid(), 'admin'));

-- 4. get_user_company_id: only for active users
CREATE OR REPLACE FUNCTION public.get_user_company_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT company_id FROM public.profiles WHERE id = auth.uid() AND active = true
$$;

-- 5. has_role: only for active users
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.profiles p ON p.id = ur.user_id
    WHERE ur.user_id = _user_id AND ur.role = _role AND p.active = true
  )
$$;

-- 6. handle_new_user: consume invitation if present
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_company_id uuid;
  display_name text;
  company_name text;
  inv record;
BEGIN
  display_name := COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email, '');

  SELECT * INTO inv
  FROM public.invitations
  WHERE lower(email) = lower(NEW.email)
    AND status = 'pending'
    AND expires_at > now()
  ORDER BY created_at DESC
  LIMIT 1;

  IF inv.id IS NOT NULL THEN
    INSERT INTO public.profiles (id, full_name, company_id)
    VALUES (NEW.id, display_name, inv.company_id);

    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, inv.role);

    UPDATE public.invitations
       SET status = 'accepted', updated_at = now()
     WHERE id = inv.id;
  ELSE
    company_name := COALESCE(NEW.raw_user_meta_data->>'company_name',
                             'Laboratório de ' || display_name);

    INSERT INTO public.companies (name)
    VALUES (company_name)
    RETURNING id INTO new_company_id;

    INSERT INTO public.profiles (id, full_name, company_id)
    VALUES (NEW.id, display_name, new_company_id);

    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin');
  END IF;

  RETURN NEW;
END;
$$;

-- 7. Allow admins to see user_roles from their own company (for user management UI)
DROP POLICY IF EXISTS user_roles_admin_select ON public.user_roles;
CREATE POLICY user_roles_admin_select ON public.user_roles FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = user_roles.user_id
        AND p.company_id = public.get_user_company_id()
        AND public.has_role(auth.uid(), 'admin')
    )
  );
