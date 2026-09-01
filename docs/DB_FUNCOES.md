# Corpo das funções do banco — ProspectAI

> **Fonte:** `pg_get_functiondef()` no Supabase `wsqbwljeuwzderdrjeve`,
> 2026-08-31. CSV cru em `docs/origem/02_funcoes.csv`.

🚨 **As 17 funções tinham `EXECUTE` concedido a `anon`.** Das sete que
tocam o Vault, três não verificam quem chama — ver `04_Acesso_e_Seguranca.md`.

⚠️ **Sete funções dependem do schema `vault` do Supabase**
(`vault.decrypted_secrets`), que **não existe** num Postgres comum.
Confirmado em teste na VPS: `get_vault_key` falha com
`relation "vault.decrypted_secrets" does not exist`. Migrar o Vault
exige trocar por um cofre próprio — ver `05_Pendencias.md`.

---

### _remix_introspect

```sql
CREATE OR REPLACE FUNCTION public._remix_introspect()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
  v_tables text[];
  v_functions text[];
BEGIN
  SELECT array_agg(table_name::text) INTO v_tables
  FROM information_schema.tables
  WHERE table_schema = 'public' AND table_type = 'BASE TABLE';

  SELECT array_agg(routine_name::text) INTO v_functions
  FROM information_schema.routines
  WHERE routine_schema = 'public';

  RETURN jsonb_build_object(
    'tables', COALESCE(v_tables, ARRAY[]::text[]),
    'functions', COALESCE(v_functions, ARRAY[]::text[])
  );
END;
$function$

```

### check_email_domain

```sql
CREATE OR REPLACE FUNCTION public.check_email_domain()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _restrict BOOLEAN;
  _domains TEXT;
  _email_domain TEXT;
  _allowed_domain TEXT;
  _is_allowed BOOLEAN := false;
  _user_count INTEGER;
BEGIN
  SELECT count(*) INTO _user_count FROM public.profiles;
  IF _user_count = 0 THEN
    RETURN NEW;
  END IF;

  SELECT (value = 'true') INTO _restrict
    FROM public.project_config WHERE key = 'restrict_signup_by_domain';

  IF NOT COALESCE(_restrict, false) THEN
    RETURN NEW;
  END IF;

  SELECT value INTO _domains
    FROM public.project_config WHERE key = 'allowed_email_domains';

  IF _domains IS NULL OR trim(_domains) = '' THEN
    RAISE EXCEPTION 'Nenhum domínio permitido configurado. Cadastro bloqueado.';
  END IF;

  _email_domain := split_part(NEW.email, '@', 2);

  FOR _allowed_domain IN SELECT trim(unnest(string_to_array(_domains, ',')))
  LOOP
    IF _email_domain = _allowed_domain
       OR _email_domain LIKE '%.' || _allowed_domain THEN
      _is_allowed := true;
      EXIT;
    END IF;
  END LOOP;

  IF NOT _is_allowed THEN
    RAISE EXCEPTION 'Domínio de email não permitido: %', _email_domain;
  END IF;

  RETURN NEW;
END;
$function$

```

### delete_project_secret

```sql
CREATE OR REPLACE FUNCTION public.delete_project_secret(p_service_name text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_vault_id uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Apenas administradores podem remover chaves do projeto';
  END IF;

  SELECT vault_secret_id INTO v_vault_id
    FROM public.api_keys_registry
    WHERE service_name = p_service_name;

  IF v_vault_id IS NOT NULL THEN
    DELETE FROM public.api_keys_registry WHERE service_name = p_service_name;
    DELETE FROM vault.secrets WHERE id = v_vault_id;
  END IF;
END;
$function$

```

### get_user_api_key

🚨 **Sem verificação de dono, EXECUTE aberto para `anon`.** Devolve a
chave de API de **qualquer usuário**, não só de quem chama.

```sql
CREATE OR REPLACE FUNCTION public.get_user_api_key(p_user_id uuid, p_service_name text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_vault_id UUID;
  v_secret TEXT;
  v_active BOOLEAN;
BEGIN
  SELECT vault_secret_id, is_active INTO v_vault_id, v_active
  FROM public.api_keys_registry
  WHERE user_id = p_user_id AND service_name = p_service_name;

  IF v_vault_id IS NULL OR NOT v_active THEN
    RETURN NULL;
  END IF;

  SELECT decrypted_secret INTO v_secret
  FROM vault.decrypted_secrets
  WHERE id = v_vault_id;

  RETURN v_secret;
END;
$function$

```

### get_vault_key

🚨 **Sem verificação de dono, EXECUTE aberto para `anon`.** Recebe o nome
de um serviço e devolve a chave **em claro**. Testado na VPS: falha aqui
só porque `vault.decrypted_secrets` é infraestrutura exclusiva do
Supabase — a função em si não tem nenhuma trava.

```sql
CREATE OR REPLACE FUNCTION public.get_vault_key(p_service_name text)
 RETURNS text
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_vault_id UUID;
  v_secret TEXT;
BEGIN
  SELECT vault_secret_id INTO v_vault_id
  FROM public.api_keys_registry
  WHERE service_name = p_service_name
    AND is_active = true
  ORDER BY created_at ASC
  LIMIT 1;

  IF v_vault_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT decrypted_secret INTO v_secret
  FROM vault.decrypted_secrets
  WHERE id = v_vault_id;

  RETURN v_secret;
END;
$function$

```

### handle_new_user

⚠️ Trigger em `auth.users` que promove o primeiro cadastro a admin
(`count(profiles)=0`). Na VPS, sem `auth.users`, precisa de rotina
equivalente amarrada a `public.usuario`.

```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _user_count INTEGER;
  _require_approval BOOLEAN;
  _is_first_user BOOLEAN;
BEGIN
  LOCK TABLE public.profiles IN SHARE ROW EXCLUSIVE MODE;

  SELECT count(*) INTO _user_count FROM public.profiles;
  _is_first_user := (_user_count = 0);

  SELECT (value = 'true') INTO _require_approval
    FROM public.project_config
    WHERE key = 'require_account_approval';

  INSERT INTO public.profiles (id, full_name, email, is_approved)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'Usuário'),
    NEW.email,
    CASE
      WHEN _is_first_user THEN true
      WHEN _require_approval THEN false
      ELSE true
    END
  );

  INSERT INTO public.user_roles (user_id, role)
  VALUES (
    NEW.id,
    CASE WHEN _is_first_user THEN 'admin'::app_role ELSE 'agent'::app_role END
  );

  RETURN NEW;
END;
$function$

```

### has_role

✅ A checagem de papel real do sistema. Testada na VPS: funciona
normalmente contra `public.usuario` + `user_roles`.

```sql
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$function$

```

### is_workspace_ready

```sql
CREATE OR REPLACE FUNCTION public.is_workspace_ready()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.api_keys_registry
    WHERE service_name = 'apollo' AND is_active = true
  );
$function$

```

### list_project_secrets

✅ **A única das sete funções de Vault que faz certo.** Verifica
`has_role(auth.uid(),'admin')` e levanta exceção se não for admin —
e devolve o valor **mascarado** (`****`+4 dígitos), nunca em claro.
É o padrão a copiar nas outras três.

```sql
CREATE OR REPLACE FUNCTION public.list_project_secrets()
 RETURNS TABLE(service_name text, label text, is_active boolean, validation_status text, last_validated_at timestamp with time zone, configured boolean, masked_value text, updated_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Apenas administradores podem listar chaves do projeto';
  END IF;

  RETURN QUERY
  SELECT
    r.service_name,
    r.label,
    r.is_active,
    r.validation_status,
    r.last_validated_at,
    true AS configured,
    '****' || right(COALESCE(v.decrypted_secret, ''), 4) AS masked_value,
    r.updated_at
  FROM public.api_keys_registry r
  LEFT JOIN vault.decrypted_secrets v ON v.id = r.vault_secret_id
  ORDER BY r.service_name;
END;
$function$

```

### set_project_secret

```sql
CREATE OR REPLACE FUNCTION public.set_project_secret(p_service_name text, p_secret text, p_label text DEFAULT NULL::text, p_validation_status text DEFAULT 'unknown'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_existing_vault_id uuid;
  v_new_vault_id uuid;
  v_registry_id uuid;
BEGIN
  -- Only admins can manage project secrets
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Apenas administradores podem gerenciar chaves do projeto';
  END IF;

  IF p_secret IS NULL OR length(trim(p_secret)) = 0 THEN
    RAISE EXCEPTION 'Secret não pode ser vazio';
  END IF;

  -- Look up existing vault id
  SELECT vault_secret_id INTO v_existing_vault_id
    FROM public.api_keys_registry
    WHERE service_name = p_service_name;

  IF v_existing_vault_id IS NOT NULL THEN
    -- Rotate existing vault entry
    PERFORM vault.update_secret(v_existing_vault_id, p_secret);
    UPDATE public.api_keys_registry
      SET label = COALESCE(p_label, label),
          validation_status = p_validation_status,
          last_validated_at = now(),
          is_active = true,
          updated_at = now()
      WHERE service_name = p_service_name
      RETURNING id INTO v_registry_id;
  ELSE
    -- Create new vault entry + registry row
    SELECT vault.create_secret(
      p_secret,
      'project_' || p_service_name || '_' || extract(epoch from now())::text,
      'Project secret for ' || p_service_name
    ) INTO v_new_vault_id;

    INSERT INTO public.api_keys_registry (
      user_id, service_name, vault_secret_id, label,
      is_active, validation_status, last_validated_at
    ) VALUES (
      '00000000-0000-0000-0000-000000000000'::uuid,
      p_service_name, v_new_vault_id, p_label,
      true, p_validation_status, now()
    )
    RETURNING id INTO v_registry_id;
  END IF;

  RETURN jsonb_build_object('id', v_registry_id, 'service_name', p_service_name);
END;
$function$

```

### update_list_contacts_count

```sql
CREATE OR REPLACE FUNCTION public.update_list_contacts_count()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    IF NEW.list_id IS NOT NULL THEN
      UPDATE contact_lists SET contacts_count = (
        SELECT count(*) FROM contacts WHERE list_id = NEW.list_id
      ) WHERE id = NEW.list_id;
    END IF;
  END IF;
  IF TG_OP = 'DELETE' OR TG_OP = 'UPDATE' THEN
    IF OLD.list_id IS NOT NULL THEN
      UPDATE contact_lists SET contacts_count = (
        SELECT count(*) FROM contacts WHERE list_id = OLD.list_id
      ) WHERE id = OLD.list_id;
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$function$

```

### update_updated_at_column

```sql
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$

```

### upsert_lead_contact

```sql
CREATE OR REPLACE FUNCTION public.upsert_lead_contact(p_name text, p_phone text, p_company text, p_city text, p_tags text[], p_list_id uuid, p_custom_fields jsonb, p_score integer, p_source text DEFAULT 'apify_instagram'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_id uuid;
  v_is_new boolean := false;
BEGIN
  SELECT id INTO v_id FROM contacts WHERE phone = p_phone AND p_phone != '' LIMIT 1;
  IF v_id IS NULL THEN
    INSERT INTO contacts (name, phone, company, city, tags, list_id, custom_fields, score, source, status)
    VALUES (p_name, NULLIF(p_phone,''), p_company, p_city, p_tags, p_list_id, p_custom_fields, p_score, p_source, 'novo')
    RETURNING id INTO v_id;
    v_is_new := true;
  ELSE
    UPDATE contacts SET
      name = CASE WHEN contacts.name IS NULL OR contacts.name = '' THEN p_name ELSE contacts.name END,
      company = CASE WHEN contacts.company IS NULL OR contacts.company = '' THEN p_company ELSE contacts.company END,
      city = CASE WHEN contacts.city IS NULL OR contacts.city = '' THEN p_city ELSE contacts.city END,
      tags = (SELECT array_agg(DISTINCT t) FROM unnest(contacts.tags || p_tags) t),
      custom_fields = contacts.custom_fields || p_custom_fields,
      list_id = COALESCE(p_list_id, contacts.list_id),
      source = COALESCE(p_source, contacts.source),
      updated_at = now()
    WHERE contacts.id = v_id;
  END IF;
  RETURN jsonb_build_object('id', v_id, 'is_new', v_is_new);
END;
$function$

```

### vault_delete_secret

```sql
CREATE OR REPLACE FUNCTION public.vault_delete_secret(p_secret_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  DELETE FROM vault.secrets WHERE id = p_secret_id;
END;
$function$

```

### vault_read_secret

🚨 **Sem verificação de dono, EXECUTE aberto para `anon`.** Devolve
qualquer segredo do Vault, bastando o uuid.

```sql
CREATE OR REPLACE FUNCTION public.vault_read_secret(p_secret_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_secret TEXT;
BEGIN
  SELECT decrypted_secret INTO v_secret
  FROM vault.decrypted_secrets
  WHERE id = p_secret_id;
  RETURN v_secret;
END;
$function$

```

### vault_store_secret

```sql
CREATE OR REPLACE FUNCTION public.vault_store_secret(p_secret text, p_name text, p_description text DEFAULT ''::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_id UUID;
BEGIN
  SELECT vault.create_secret(p_secret, p_name, p_description) INTO v_id;
  RETURN v_id;
END;
$function$

```

### vault_update_secret

```sql
CREATE OR REPLACE FUNCTION public.vault_update_secret(p_secret_id uuid, p_new_secret text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM vault.update_secret(p_secret_id, p_new_secret);
END;
$function$

```

