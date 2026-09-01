-- ============================================================
-- ProspectAI / lead-king -- esquema para o Postgres da VPS
--
-- Gerado a partir de docs/origem/*.csv, exportados do Supabase
-- (projeto wsqbwljeuwzderdrjeve) em 2026-08-31.
--
-- O QUE FOI RETIRADO, E POR QUE
--   * as 19 policies de RLS  -> usam auth.uid(), que e do Supabase
--   * os GRANT para anon/authenticated/service_role -> papeis inexistentes aqui
--   * a referencia a auth.users -> trocada por public.usuario
--
-- 🚨 NAO REPETIR O DESENHO DE ORIGEM. 6 das 11 tabelas (contact_lists,
--    contacts, lead_searches, outreach_messages, scraping_jobs, settings)
--    tinham policy USING(true) WITH CHECK(true) para o papel 'public' --
--    ou seja, ABERTA TAMBEM PARA anon -- combinada com GRANT de
--    DELETE/INSERT/SELECT/UPDATE para anon nas 11 tabelas. Isso batia com
--    o achado S4 do AUDIT.md do projeto original. So nao vazou nada porque
--    o banco estava vazio (0 linhas em todas as tabelas, medido em 31/08).
--
-- 🚨 A AUTORIZACAO PASSA A SER DA APLICACAO. Sem PostgREST publicando
--    tabela, quem decide quem ve o que e o servico da VPS.
-- ============================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;   -- gen_random_uuid() e cifra

-- ------------------------------------------------------------
-- 0. IDENTIDADE -- substitui auth.users do Supabase
-- ------------------------------------------------------------
-- TODO(decisao): definir se o login sera proprio ou reaproveitado de
--   outro painel da VPS (ex.: o login do MoviZap/painel).
CREATE TABLE IF NOT EXISTS public.usuario (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email       text NOT NULL UNIQUE,
    nome        text NOT NULL,
    senha_hash  text,
    ativo       boolean NOT NULL DEFAULT true,
    criado_em   timestamptz NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- 0.1 ENUM app_role -- user_roles.role depende dele
-- ------------------------------------------------------------
DO $$ BEGIN
    CREATE TYPE public.app_role AS ENUM ('admin', 'supervisor', 'agent');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ------------------------------------------------------------
-- 1. TABELAS
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.contact_lists (
    id                         uuid NOT NULL DEFAULT gen_random_uuid(),
    name                       text NOT NULL,
    description                text DEFAULT ''::text,
    contacts_count             integer DEFAULT 0,
    created_at                 timestamptz NOT NULL DEFAULT now(),
    updated_at                 timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT contact_lists_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.settings (
    id                         uuid NOT NULL DEFAULT gen_random_uuid(),
    workspace_name             text DEFAULT 'ProspectAI'::text,
    default_country            text DEFAULT 'Brasil'::text,
    default_language           text DEFAULT 'pt'::text,
    auto_enrich                boolean DEFAULT true,
    default_volume             integer DEFAULT 25,
    onboarding_completed       boolean DEFAULT false,
    created_at                 timestamptz DEFAULT now(),
    updated_at                 timestamptz DEFAULT now(),
    evolution_api_url          text,
    evolution_instance_name    text,
    evolution_connected        boolean DEFAULT false,
    resend_from_email          text,
    resend_from_name           text,
    CONSTRAINT settings_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.project_config (
    key                        text NOT NULL,
    value                      text NOT NULL,
    updated_at                 timestamptz DEFAULT now(),
    CONSTRAINT project_config_pkey PRIMARY KEY (key)
);

CREATE TABLE IF NOT EXISTS public.contacts (
    id                         uuid NOT NULL DEFAULT gen_random_uuid(),
    name                       text NOT NULL DEFAULT ''::text,
    phone                      text DEFAULT ''::text,
    email                      text DEFAULT ''::text,
    company                    text DEFAULT ''::text,
    title                      text DEFAULT ''::text,
    city                       text DEFAULT ''::text,
    linkedin_url               text DEFAULT ''::text,
    instagram                  text DEFAULT ''::text,
    platform                   text DEFAULT 'linkedin'::text,
    source                     text DEFAULT 'apollo'::text,
    status                     text DEFAULT 'novo'::text,
    score                      integer DEFAULT 0,
    tags                       text[] DEFAULT '{}'::text[],
    list_id                    uuid,
    custom_fields              jsonb DEFAULT '{}'::jsonb,
    created_at                 timestamptz NOT NULL DEFAULT now(),
    updated_at                 timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT contacts_list_id_fkey FOREIGN KEY (list_id) REFERENCES contact_lists(id) ON DELETE SET NULL,
    CONSTRAINT contacts_phone_key UNIQUE (phone),
    CONSTRAINT contacts_pkey PRIMARY KEY (id),
    CONSTRAINT contacts_platform_check CHECK ((platform = ANY (ARRAY['linkedin'::text, 'instagram'::text, 'both'::text]))),
    CONSTRAINT contacts_source_check CHECK (((source IS NULL) OR (source = ANY (ARRAY['apollo_search'::text, 'google_maps'::text, 'crustdata_search'::text, 'pdl_search'::text, 'tavily_search'::text, 'apify_instagram'::text, 'apify_twitter'::text, 'apify_tiktok'::text, 'apify_linkedin_search'::text, 'apify_instagram_profiles'::text, 'apify_instagram_comments'::text, 'apify_instagram_followers'::text, 'apify_instagram_hashtags'::text, 'apify_google_reviews'::text, 'apify_google_search'::text, 'apify_google_places'::text, 'apify_linkedin'::text, 'apify_facebook_groups'::text, 'apify_facebook_comments'::text, 'apify_facebook'::text, 'apify_youtube_comments'::text, 'apify_tripadvisor_reviews'::text, 'apify_contact_scraper'::text, 'apollo'::text, 'firecrawl'::text, 'apollo_firecrawl'::text])))),
    CONSTRAINT contacts_status_check CHECK ((status = ANY (ARRAY['novo'::text, 'contatado'::text, 'qualificado'::text, 'descartado'::text])))
);

CREATE TABLE IF NOT EXISTS public.lead_searches (
    id                         uuid NOT NULL DEFAULT gen_random_uuid(),
    name                       text NOT NULL,
    source                     text DEFAULT 'apollo'::text,
    status                     text DEFAULT 'pending'::text,
    config                     jsonb DEFAULT '{}'::jsonb,
    contacts_found             integer DEFAULT 0,
    contacts_new               integer DEFAULT 0,
    result_data                jsonb DEFAULT '[]'::jsonb,
    target_list_id             uuid,
    started_at                 timestamptz,
    completed_at               timestamptz,
    duration_ms                integer,
    created_at                 timestamptz NOT NULL DEFAULT now(),
    source_reports             jsonb NOT NULL DEFAULT '[]'::jsonb,
    CONSTRAINT lead_searches_pkey PRIMARY KEY (id),
    CONSTRAINT lead_searches_source_check CHECK (((source IS NULL) OR (source = ANY (ARRAY['apollo_search'::text, 'google_maps'::text, 'crustdata_search'::text, 'pdl_search'::text, 'tavily_search'::text, 'apify_instagram'::text, 'apify_twitter'::text, 'apify_tiktok'::text, 'apify_linkedin_search'::text, 'apify_instagram_profiles'::text, 'apify_instagram_comments'::text, 'apify_instagram_followers'::text, 'apify_instagram_hashtags'::text, 'apify_google_reviews'::text, 'apify_google_search'::text, 'apify_google_places'::text, 'apify_linkedin'::text, 'apify_facebook_groups'::text, 'apify_facebook_comments'::text, 'apify_facebook'::text, 'apify_youtube_comments'::text, 'apify_tripadvisor_reviews'::text, 'apify_contact_scraper'::text, 'all'::text])))),
    CONSTRAINT lead_searches_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'running'::text, 'completed'::text, 'failed'::text]))),
    CONSTRAINT lead_searches_target_list_id_fkey FOREIGN KEY (target_list_id) REFERENCES contact_lists(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS public.scraping_jobs (
    id                         uuid NOT NULL DEFAULT gen_random_uuid(),
    url                        text NOT NULL,
    fields                     text[] DEFAULT '{name,phone}'::text[],
    status                     text DEFAULT 'pending'::text,
    contacts_found             integer DEFAULT 0,
    contacts_valid             integer DEFAULT 0,
    result_data                jsonb DEFAULT '[]'::jsonb,
    error_message              text,
    target_list_id             uuid,
    started_at                 timestamptz,
    completed_at               timestamptz,
    duration_ms                integer,
    created_at                 timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT scraping_jobs_pkey PRIMARY KEY (id),
    CONSTRAINT scraping_jobs_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'running'::text, 'completed'::text, 'failed'::text]))),
    CONSTRAINT scraping_jobs_target_list_id_fkey FOREIGN KEY (target_list_id) REFERENCES contact_lists(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS public.outreach_messages (
    id                         uuid NOT NULL DEFAULT gen_random_uuid(),
    contact_id                 uuid,
    channel                    text NOT NULL,
    message_text               text NOT NULL,
    status                     text DEFAULT 'sent'::text,
    provider                   text,
    provider_message_id        text,
    metadata                   jsonb DEFAULT '{}'::jsonb,
    sent_at                    timestamptz DEFAULT now(),
    created_at                 timestamptz DEFAULT now(),
    direction                  text NOT NULL DEFAULT 'outbound'::text,
    CONSTRAINT outreach_messages_channel_check CHECK ((channel = ANY (ARRAY['whatsapp'::text, 'email'::text, 'instagram_dm'::text]))),
    CONSTRAINT outreach_messages_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE SET NULL,
    CONSTRAINT outreach_messages_pkey PRIMARY KEY (id),
    CONSTRAINT outreach_messages_status_check CHECK ((status = ANY (ARRAY['sent'::text, 'delivered'::text, 'read'::text, 'failed'::text, 'pending'::text])))
);

-- 🚨 TODO(revisao): user_id NAO tinha FOREIGN KEY declarada no Supabase
--    (referencia solta, sem integridade). Aqui ela FOI adicionada --
--    decisao de quem migra: manter a integridade ou soltar de novo.
CREATE TABLE IF NOT EXISTS public.api_keys_registry (
    id                         uuid NOT NULL DEFAULT gen_random_uuid(),
    user_id                    uuid NOT NULL,
    service_name               text NOT NULL,
    vault_secret_id            uuid NOT NULL,
    label                      text,
    is_active                  boolean DEFAULT true,
    validation_status          text DEFAULT 'unknown'::text,
    last_validated_at          timestamptz,
    created_at                 timestamptz DEFAULT now(),
    updated_at                 timestamptz DEFAULT now(),
    CONSTRAINT api_keys_registry_pkey PRIMARY KEY (id),
    CONSTRAINT api_keys_registry_validation_status_check CHECK ((validation_status = ANY (ARRAY['valid'::text, 'invalid'::text, 'unknown'::text]))),
    CONSTRAINT api_keys_registry_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.usuario(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.profiles (
    id                         uuid NOT NULL,
    full_name                  text NOT NULL DEFAULT 'Usuário'::text,
    email                      text NOT NULL DEFAULT ''::text,
    avatar_url                 text,
    status                     text DEFAULT 'offline'::text,
    is_active                  boolean NOT NULL DEFAULT true,
    is_approved                boolean NOT NULL DEFAULT false,
    created_at                 timestamptz DEFAULT now(),
    updated_at                 timestamptz DEFAULT now(),
    -- reapontada de auth.users para public.usuario,
    CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES public.usuario(id) ON DELETE CASCADE,
    CONSTRAINT profiles_pkey PRIMARY KEY (id),
    CONSTRAINT profiles_status_check CHECK ((status = ANY (ARRAY['online'::text, 'offline'::text, 'away'::text, 'busy'::text])))
);

CREATE TABLE IF NOT EXISTS public.user_onboarding (
    user_id                    uuid NOT NULL,
    completed_at               timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT user_onboarding_pkey PRIMARY KEY (user_id),
    -- reapontada de auth.users para public.usuario,
    CONSTRAINT user_onboarding_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.usuario(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.user_roles (
    id                         uuid NOT NULL DEFAULT gen_random_uuid(),
    user_id                    uuid NOT NULL,
    role                       public.app_role NOT NULL DEFAULT 'agent'::app_role,
    created_at                 timestamptz DEFAULT now(),
    CONSTRAINT user_roles_pkey PRIMARY KEY (id),
    -- reapontada de auth.users para public.usuario,
    CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.usuario(id) ON DELETE CASCADE,
    CONSTRAINT user_roles_user_id_role_key UNIQUE (user_id, role)
);

-- ------------------------------------------------------------
-- 2. INDICES
-- ------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS api_keys_registry_service_name_unique ON public.api_keys_registry USING btree (service_name);
CREATE INDEX IF NOT EXISTS idx_contacts_list_id ON public.contacts USING btree (list_id);
CREATE INDEX IF NOT EXISTS idx_contacts_platform ON public.contacts USING btree (platform);
CREATE INDEX IF NOT EXISTS idx_contacts_source ON public.contacts USING btree (source);
CREATE INDEX IF NOT EXISTS idx_contacts_status ON public.contacts USING btree (status);
CREATE INDEX IF NOT EXISTS idx_outreach_messages_channel ON public.outreach_messages USING btree (channel, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_outreach_messages_contact ON public.outreach_messages USING btree (contact_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_outreach_messages_dir ON public.outreach_messages USING btree (direction, channel, created_at DESC);

-- ------------------------------------------------------------
-- 3. FUNCOES
-- ------------------------------------------------------------
-- 🚨 Vieram como estao no Supabase. TRES exigem revisao ANTES de usar --
--    no Supabase as tres estavam com EXECUTE liberado para 'anon', SEM
--    nenhuma verificacao interna de quem chama:
--       get_vault_key      -- devolve o segredo em claro
--       vault_read_secret  -- devolve qualquer segredo por uuid
--       get_user_api_key   -- devolve a chave de qualquer usuario
--    Comparar com list_project_secrets, que faz certo: verifica has_role
--    admin e devolve so o valor MASCARADO. E o padrao a copiar.

-- ---------- _remix_introspect
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
$function$;

-- ---------- check_email_domain
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
$function$;

-- ---------- delete_project_secret
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
$function$;

-- ---------- get_user_api_key
-- 🚨 TODO(seguranca): get_user_api_key nao verificava quem chama no Supabase.
--    Na VPS ela so e alcancavel pelo servico -- mas o servico PRECISA
--    aplicar a mesma checagem que list_project_secrets faz (has_role).
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
$function$;

-- ---------- get_vault_key
-- 🚨 TODO(seguranca): get_vault_key nao verificava quem chama no Supabase.
--    Na VPS ela so e alcancavel pelo servico -- mas o servico PRECISA
--    aplicar a mesma checagem que list_project_secrets faz (has_role).
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
$function$;

-- ---------- handle_new_user
-- 🚨 TODO(revisao): e o trigger que promove o 1o usuario a admin
--    (count(profiles)=0). Precisa de equivalente na tabela public.usuario
--    ou de rotina propria de cadastro do primeiro admin.
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
$function$;

-- ---------- has_role
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
$function$;

-- ---------- is_workspace_ready
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
$function$;

-- ---------- list_project_secrets
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
$function$;

-- ---------- set_project_secret
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
$function$;

-- ---------- update_list_contacts_count
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
$function$;

-- ---------- update_updated_at_column
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

-- ---------- upsert_lead_contact
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
$function$;

-- ---------- vault_delete_secret
CREATE OR REPLACE FUNCTION public.vault_delete_secret(p_secret_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  DELETE FROM vault.secrets WHERE id = p_secret_id;
END;
$function$;

-- ---------- vault_read_secret
-- 🚨 TODO(seguranca): vault_read_secret nao verificava quem chama no Supabase.
--    Na VPS ela so e alcancavel pelo servico -- mas o servico PRECISA
--    aplicar a mesma checagem que list_project_secrets faz (has_role).
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
$function$;

-- ---------- vault_store_secret
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
$function$;

-- ---------- vault_update_secret
CREATE OR REPLACE FUNCTION public.vault_update_secret(p_secret_id uuid, p_new_secret text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM vault.update_secret(p_secret_id, p_new_secret);
END;
$function$;

-- ------------------------------------------------------------
-- 4. TRIGGERS
-- ------------------------------------------------------------
DROP TRIGGER IF EXISTS update_api_keys_registry_updated_at ON public.api_keys_registry;
CREATE TRIGGER update_api_keys_registry_updated_at BEFORE UPDATE ON public.api_keys_registry FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS update_contact_lists_updated_at ON public.contact_lists;
CREATE TRIGGER update_contact_lists_updated_at BEFORE UPDATE ON public.contact_lists FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS trigger_update_list_count ON public.contacts;
CREATE TRIGGER trigger_update_list_count AFTER INSERT OR DELETE OR UPDATE OF list_id ON public.contacts FOR EACH ROW EXECUTE FUNCTION update_list_contacts_count();
DROP TRIGGER IF EXISTS update_contacts_updated_at ON public.contacts;
CREATE TRIGGER update_contacts_updated_at BEFORE UPDATE ON public.contacts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS update_settings_updated_at ON public.settings;
CREATE TRIGGER update_settings_updated_at BEFORE UPDATE ON public.settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ------------------------------------------------------------
-- 5. O QUE NAO FOI TRAZIDO -- decisoes em aberto
-- ------------------------------------------------------------
-- 5.1 As 19 policies de RLS do Supabase. TODO(decisao): filtro na
--     aplicacao (padrao dos outros projetos da VPS) ou RLS proprio.
--
-- 5.2 6 das 11 tabelas eram USING(true) WITH CHECK(true) para 'public' --
--     NAO RECRIAR ASSIM. E o achado mais grave dos dois projetos.
--
-- 5.3 handle_new_user (1o usuario vira admin) precisa de equivalente.
--
-- 5.4 has_role(uuid, app_role) e usada pelas policies e por
--     list_project_secrets -- ela continua util como funcao auxiliar,
--     so nao like RLS.

COMMIT;

