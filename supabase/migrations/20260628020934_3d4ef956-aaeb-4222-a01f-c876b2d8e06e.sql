-- Azure Blob Storage admin config
CREATE TABLE public.azure_storage_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,
  account_name text NOT NULL,
  connection_string_ciphertext text NOT NULL,
  connection_string_iv text NOT NULL,
  connection_last4 text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.azure_storage_accounts TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.azure_storage_accounts TO authenticated;

ALTER TABLE public.azure_storage_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins manage azure accounts"
  ON public.azure_storage_accounts
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE TRIGGER azure_accounts_touch
  BEFORE UPDATE ON public.azure_storage_accounts
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

-- Only one active account at a time
CREATE UNIQUE INDEX azure_accounts_one_active
  ON public.azure_storage_accounts (is_active) WHERE is_active = true;

CREATE TABLE public.azure_storage_containers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.azure_storage_accounts(id) ON DELETE CASCADE,
  purpose text NOT NULL UNIQUE,
  container_name text NOT NULL,
  public_read boolean NOT NULL DEFAULT false,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.azure_storage_containers TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.azure_storage_containers TO authenticated;

ALTER TABLE public.azure_storage_containers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins manage azure containers"
  ON public.azure_storage_containers
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE TRIGGER azure_containers_touch
  BEFORE UPDATE ON public.azure_storage_containers
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

CREATE INDEX azure_containers_purpose_idx ON public.azure_storage_containers (purpose) WHERE enabled = true;