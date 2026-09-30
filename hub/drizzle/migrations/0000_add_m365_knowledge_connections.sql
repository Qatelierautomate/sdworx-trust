-- Per-user Microsoft 365 connection handles, stored encrypted (service-role only).
CREATE TABLE public.app_user_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  connector_id text NOT NULL,
  connection_key_ciphertext text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, connector_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_user_connections TO service_role;
GRANT ALL ON public.app_user_connections TO service_role;
ALTER TABLE public.app_user_connections ENABLE ROW LEVEL SECURITY;

-- Knowledge areas an administrator has approved for searching.
CREATE TABLE public.knowledge_allowlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connector_id text NOT NULL,
  resource_kind text NOT NULL,
  resource_ref text NOT NULL,
  display_name text NOT NULL,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (connector_id, resource_kind, resource_ref)
);

GRANT SELECT ON public.knowledge_allowlist TO authenticated;
GRANT ALL ON public.knowledge_allowlist TO service_role;
ALTER TABLE public.knowledge_allowlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Employees can read approved knowledge areas"
  ON public.knowledge_allowlist FOR SELECT TO authenticated
  USING (true);

-- Roles live in their own table, never on a profile row.
CREATE TYPE public.app_role AS ENUM ('admin', 'knowledge_owner', 'user');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  );
$$;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;

-- Starter allowlist. Placeholder names: replace with the real approved areas.
INSERT INTO public.knowledge_allowlist (connector_id, resource_kind, resource_ref, display_name, notes) VALUES
  ('microsoft_teams', 'channel', 'placeholder-payroll-knowledge', 'Payroll Knowledge', 'Placeholder — replace with the approved channel'),
  ('microsoft_teams', 'channel', 'placeholder-benefits-qa', 'Benefits Q&A', 'Placeholder — replace with the approved channel'),
  ('microsoft_outlook', 'folder', 'placeholder-payroll-experts', 'Payroll experts', 'Placeholder — replace with the approved mailbox folder'),
  ('microsoft_sharepoint', 'site', 'placeholder-payroll-policies', 'Payroll Policies', 'Placeholder — replace with the approved site'),
  ('microsoft_onedrive', 'folder', 'placeholder-adviser-notes', 'Adviser notes', 'Placeholder — replace with the approved folder');