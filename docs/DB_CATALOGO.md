# Catálogo do banco — ProspectAI (`lead-king`)

> **Fonte:** exportado do Supabase `wsqbwljeuwzderdrjeve` em 2026-08-31,
> pelo SQL Editor. Os CSVs crus estão em `docs/origem/`.
>
> Este documento é **o estado do banco de origem**, para consulta e para
> comparação futura. O que vai rodar na VPS é o `DB_SCHEMA.sql`, que
> **não é igual a isto**: as policies e os papéis do Supabase ficaram de
> fora — e por bom motivo. Ver `04_Acesso_e_Seguranca.md`.

---

## Contagens no momento da exportação

| pergunta | resposta |
|---|---|
| usuarios cadastrados (auth.users) | **0** |
| profiles | **0** |
|   destes, aprovados (is_approved) | **0** |
|   destes, ativos (is_active) | **0** |
| papeis atribuidos (user_roles) | **0** |
|   admins | **0** |
|   supervisors | **0** |
|   agents | **0** |
| chaves de API no registry | **0** |
|   quais servicos (so o nome) | **(nenhum)** |
| contatos | **0** |
|   com telefone | **0** |
|   com email | **0** |
| listas de contato | **0** |
| buscas executadas | **0** |
| mensagens de abordagem | **0** |
| jobs de scraping | **0** |
| linhas em settings | **0** |
| linhas em project_config | **0** |
|   chaves de project_config (so os nomes) | **(nenhuma)** |
| onboarding concluido | **0** |
| Evolution configurada? | **sem linha em settings** |
| Evolution conectada? | **	-** |

🚨 **Tudo zero.** Nunca houve cadastro, chave configurada ou contato
importado. É o que dá tempo de corrigir o achado de RLS antes do primeiro
uso real — ver seção seguinte e `04_Acesso_e_Seguranca.md`.

---

## 🔴 O achado mais grave dos dois projetos migrados

6 das 11 tabelas tinham policy `USING (true) WITH CHECK (true)` para o
papel **`public`** — que em Postgres significa *todo mundo*, `anon`
incluído. Combinado com `GRANT` de `DELETE, INSERT, SELECT, UPDATE` para
`anon` nas 11 tabelas (seção 7 abaixo), isso significa:

> **qualquer pessoa com a chave pública do bundle do navegador lia,
> escrevia e apagava contatos, listas, buscas, mensagens e
> configurações — sem login, sem token, sem nada.**

As tabelas abertas: `contact_lists`, `contacts`, `lead_searches`,
`outreach_messages`, `scraping_jobs`, `settings`.

Isso confirma o achado **S4** do `AUDIT.md` do projeto original — a
auditoria já sabia disso, e o remix herdou o defeito sem corrigir.

Só não vazou nada porque o banco estava vazio o tempo todo. **Não recriar
esse desenho na VPS** — é o TODO 5.2 do `DB_SCHEMA.sql`.

---
# ESQUEMA postgres
Gerado em 2026-08-31 15:05:41
Postgres 17.6
## 1. Colunas
| tabela | coluna | tipo | nulo | default |
|---|---|---|---|---|
| api_keys_registry | id | uuid | NO | gen_random_uuid() |
| api_keys_registry | user_id | uuid | NO | - |
| api_keys_registry | service_name | text | NO | - |
| api_keys_registry | vault_secret_id | uuid | NO | - |
| api_keys_registry | label | text | YES | - |
| api_keys_registry | is_active | boolean | YES | true |
| api_keys_registry | validation_status | text | YES | 'unknown'::text |
| api_keys_registry | last_validated_at | timestamp with time zone | YES | - |
| api_keys_registry | created_at | timestamp with time zone | YES | now() |
| api_keys_registry | updated_at | timestamp with time zone | YES | now() |
| contact_lists | id | uuid | NO | gen_random_uuid() |
| contact_lists | name | text | NO | - |
| contact_lists | description | text | YES | ''::text |
| contact_lists | contacts_count | integer | YES | 0 |
| contact_lists | created_at | timestamp with time zone | NO | now() |
| contact_lists | updated_at | timestamp with time zone | NO | now() |
| contacts | id | uuid | NO | gen_random_uuid() |
| contacts | name | text | NO | ''::text |
| contacts | phone | text | YES | ''::text |
| contacts | email | text | YES | ''::text |
| contacts | company | text | YES | ''::text |
| contacts | title | text | YES | ''::text |
| contacts | city | text | YES | ''::text |
| contacts | linkedin_url | text | YES | ''::text |
| contacts | instagram | text | YES | ''::text |
| contacts | platform | text | YES | 'linkedin'::text |
| contacts | source | text | YES | 'apollo'::text |
| contacts | status | text | YES | 'novo'::text |
| contacts | score | integer | YES | 0 |
| contacts | tags | ARRAY | YES | '{}'::text[] |
| contacts | list_id | uuid | YES | - |
| contacts | custom_fields | jsonb | YES | '{}'::jsonb |
| contacts | created_at | timestamp with time zone | NO | now() |
| contacts | updated_at | timestamp with time zone | NO | now() |
| lead_searches | id | uuid | NO | gen_random_uuid() |
| lead_searches | name | text | NO | - |
| lead_searches | source | text | YES | 'apollo'::text |
| lead_searches | status | text | YES | 'pending'::text |
| lead_searches | config | jsonb | YES | '{}'::jsonb |
| lead_searches | contacts_found | integer | YES | 0 |
| lead_searches | contacts_new | integer | YES | 0 |
| lead_searches | result_data | jsonb | YES | '[]'::jsonb |
| lead_searches | target_list_id | uuid | YES | - |
| lead_searches | started_at | timestamp with time zone | YES | - |
| lead_searches | completed_at | timestamp with time zone | YES | - |
| lead_searches | duration_ms | integer | YES | - |
| lead_searches | created_at | timestamp with time zone | NO | now() |
| lead_searches | source_reports | jsonb | NO | '[]'::jsonb |
| outreach_messages | id | uuid | NO | gen_random_uuid() |
| outreach_messages | contact_id | uuid | YES | - |
| outreach_messages | channel | text | NO | - |
| outreach_messages | message_text | text | NO | - |
| outreach_messages | status | text | YES | 'sent'::text |
| outreach_messages | provider | text | YES | - |
| outreach_messages | provider_message_id | text | YES | - |
| outreach_messages | metadata | jsonb | YES | '{}'::jsonb |
| outreach_messages | sent_at | timestamp with time zone | YES | now() |
| outreach_messages | created_at | timestamp with time zone | YES | now() |
| outreach_messages | direction | text | NO | 'outbound'::text |
| profiles | id | uuid | NO | - |
| profiles | full_name | text | NO | 'Usuário'::text |
| profiles | email | text | NO | ''::text |
| profiles | avatar_url | text | YES | - |
| profiles | status | text | YES | 'offline'::text |
| profiles | is_active | boolean | NO | true |
| profiles | is_approved | boolean | NO | false |
| profiles | created_at | timestamp with time zone | YES | now() |
| profiles | updated_at | timestamp with time zone | YES | now() |
| project_config | key | text | NO | - |
| project_config | value | text | NO | - |
| project_config | updated_at | timestamp with time zone | YES | now() |
| scraping_jobs | id | uuid | NO | gen_random_uuid() |
| scraping_jobs | url | text | NO | - |
| scraping_jobs | fields | ARRAY | YES | '{name,phone}'::text[] |
| scraping_jobs | status | text | YES | 'pending'::text |
| scraping_jobs | contacts_found | integer | YES | 0 |
| scraping_jobs | contacts_valid | integer | YES | 0 |
| scraping_jobs | result_data | jsonb | YES | '[]'::jsonb |
| scraping_jobs | error_message | text | YES | - |
| scraping_jobs | target_list_id | uuid | YES | - |
| scraping_jobs | started_at | timestamp with time zone | YES | - |
| scraping_jobs | completed_at | timestamp with time zone | YES | - |
| scraping_jobs | duration_ms | integer | YES | - |
| scraping_jobs | created_at | timestamp with time zone | NO | now() |
| settings | id | uuid | NO | gen_random_uuid() |
| settings | workspace_name | text | YES | 'ProspectAI'::text |
| settings | default_country | text | YES | 'Brasil'::text |
| settings | default_language | text | YES | 'pt'::text |
| settings | auto_enrich | boolean | YES | true |
| settings | default_volume | integer | YES | 25 |
| settings | onboarding_completed | boolean | YES | false |
| settings | created_at | timestamp with time zone | YES | now() |
| settings | updated_at | timestamp with time zone | YES | now() |
| settings | evolution_api_url | text | YES | - |
| settings | evolution_instance_name | text | YES | - |
| settings | evolution_connected | boolean | YES | false |
| settings | resend_from_email | text | YES | - |
| settings | resend_from_name | text | YES | - |
| user_onboarding | user_id | uuid | NO | - |
| user_onboarding | completed_at | timestamp with time zone | NO | now() |
| user_roles | id | uuid | NO | gen_random_uuid() |
| user_roles | user_id | uuid | NO | - |
| user_roles | role | USER-DEFINED | NO | 'agent'::app_role |
| user_roles | created_at | timestamp with time zone | YES | now() |
## 2. Constraints (PK, FK com ON DELETE, UNIQUE, CHECK)
| tabela | nome | tipo | definicao |
|---|---|---|---|
| api_keys_registry | api_keys_registry_pkey | PK | PRIMARY KEY (id) |
| api_keys_registry | api_keys_registry_validation_status_check | CHECK | CHECK ((validation_status = ANY (ARRAY['valid'::text, 'invalid'::text, 'unknown'::text]))) |
| contact_lists | contact_lists_pkey | PK | PRIMARY KEY (id) |
| contacts | contacts_list_id_fkey | FK | FOREIGN KEY (list_id) REFERENCES contact_lists(id) ON DELETE SET NULL |
| contacts | contacts_phone_key | UNIQUE | UNIQUE (phone) |
| contacts | contacts_pkey | PK | PRIMARY KEY (id) |
| contacts | contacts_platform_check | CHECK | CHECK ((platform = ANY (ARRAY['linkedin'::text, 'instagram'::text, 'both'::text]))) |
| contacts | contacts_source_check | CHECK | CHECK (((source IS NULL) OR (source = ANY (ARRAY['apollo_search'::text, 'google_maps'::text, 'crustdata_search'::text, 'pdl_search'::text, 'tavily_search'::text, 'apify_instagram'::text, 'apify_twitter'::text, 'apify_tiktok'::text, 'apify_linkedin_search'::text, 'apify_instagram_profiles'::text, 'apify_instagram_comments'::text, 'apify_instagram_followers'::text, 'apify_instagram_hashtags'::text, 'apify_google_reviews'::text, 'apify_google_search'::text, 'apify_google_places'::text, 'apify_linkedin'::text, 'apify_facebook_groups'::text, 'apify_facebook_comments'::text, 'apify_facebook'::text, 'apify_youtube_comments'::text, 'apify_tripadvisor_reviews'::text, 'apify_contact_scraper'::text, 'apollo'::text, 'firecrawl'::text, 'apollo_firecrawl'::text])))) |
| contacts | contacts_status_check | CHECK | CHECK ((status = ANY (ARRAY['novo'::text, 'contatado'::text, 'qualificado'::text, 'descartado'::text]))) |
| lead_searches | lead_searches_pkey | PK | PRIMARY KEY (id) |
| lead_searches | lead_searches_source_check | CHECK | CHECK (((source IS NULL) OR (source = ANY (ARRAY['apollo_search'::text, 'google_maps'::text, 'crustdata_search'::text, 'pdl_search'::text, 'tavily_search'::text, 'apify_instagram'::text, 'apify_twitter'::text, 'apify_tiktok'::text, 'apify_linkedin_search'::text, 'apify_instagram_profiles'::text, 'apify_instagram_comments'::text, 'apify_instagram_followers'::text, 'apify_instagram_hashtags'::text, 'apify_google_reviews'::text, 'apify_google_search'::text, 'apify_google_places'::text, 'apify_linkedin'::text, 'apify_facebook_groups'::text, 'apify_facebook_comments'::text, 'apify_facebook'::text, 'apify_youtube_comments'::text, 'apify_tripadvisor_reviews'::text, 'apify_contact_scraper'::text, 'all'::text])))) |
| lead_searches | lead_searches_status_check | CHECK | CHECK ((status = ANY (ARRAY['pending'::text, 'running'::text, 'completed'::text, 'failed'::text]))) |
| lead_searches | lead_searches_target_list_id_fkey | FK | FOREIGN KEY (target_list_id) REFERENCES contact_lists(id) ON DELETE SET NULL |
| outreach_messages | outreach_messages_channel_check | CHECK | CHECK ((channel = ANY (ARRAY['whatsapp'::text, 'email'::text, 'instagram_dm'::text]))) |
| outreach_messages | outreach_messages_contact_id_fkey | FK | FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE SET NULL |
| outreach_messages | outreach_messages_pkey | PK | PRIMARY KEY (id) |
| outreach_messages | outreach_messages_status_check | CHECK | CHECK ((status = ANY (ARRAY['sent'::text, 'delivered'::text, 'read'::text, 'failed'::text, 'pending'::text]))) |
| profiles | profiles_id_fkey | FK | FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE |
| profiles | profiles_pkey | PK | PRIMARY KEY (id) |
| profiles | profiles_status_check | CHECK | CHECK ((status = ANY (ARRAY['online'::text, 'offline'::text, 'away'::text, 'busy'::text]))) |
| project_config | project_config_pkey | PK | PRIMARY KEY (key) |
| scraping_jobs | scraping_jobs_pkey | PK | PRIMARY KEY (id) |
| scraping_jobs | scraping_jobs_status_check | CHECK | CHECK ((status = ANY (ARRAY['pending'::text, 'running'::text, 'completed'::text, 'failed'::text]))) |
| scraping_jobs | scraping_jobs_target_list_id_fkey | FK | FOREIGN KEY (target_list_id) REFERENCES contact_lists(id) ON DELETE SET NULL |
| settings | settings_pkey | PK | PRIMARY KEY (id) |
| user_onboarding | user_onboarding_pkey | PK | PRIMARY KEY (user_id) |
| user_onboarding | user_onboarding_user_id_fkey | FK | FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE |
| user_roles | user_roles_pkey | PK | PRIMARY KEY (id) |
| user_roles | user_roles_user_id_fkey | FK | FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE |
| user_roles | user_roles_user_id_role_key | UNIQUE | UNIQUE (user_id, role) |
## 3. Indices
| tabela | indice | definicao |
|---|---|---|
| api_keys_registry | api_keys_registry_pkey | CREATE UNIQUE INDEX api_keys_registry_pkey ON public.api_keys_registry USING btree (id) |
| api_keys_registry | api_keys_registry_service_name_unique | CREATE UNIQUE INDEX api_keys_registry_service_name_unique ON public.api_keys_registry USING btree (service_name) |
| contact_lists | contact_lists_pkey | CREATE UNIQUE INDEX contact_lists_pkey ON public.contact_lists USING btree (id) |
| contacts | contacts_phone_key | CREATE UNIQUE INDEX contacts_phone_key ON public.contacts USING btree (phone) |
| contacts | contacts_pkey | CREATE UNIQUE INDEX contacts_pkey ON public.contacts USING btree (id) |
| contacts | idx_contacts_list_id | CREATE INDEX idx_contacts_list_id ON public.contacts USING btree (list_id) |
| contacts | idx_contacts_platform | CREATE INDEX idx_contacts_platform ON public.contacts USING btree (platform) |
| contacts | idx_contacts_source | CREATE INDEX idx_contacts_source ON public.contacts USING btree (source) |
| contacts | idx_contacts_status | CREATE INDEX idx_contacts_status ON public.contacts USING btree (status) |
| lead_searches | lead_searches_pkey | CREATE UNIQUE INDEX lead_searches_pkey ON public.lead_searches USING btree (id) |
| outreach_messages | idx_outreach_messages_channel | CREATE INDEX idx_outreach_messages_channel ON public.outreach_messages USING btree (channel, sent_at DESC) |
| outreach_messages | idx_outreach_messages_contact | CREATE INDEX idx_outreach_messages_contact ON public.outreach_messages USING btree (contact_id, created_at DESC) |
| outreach_messages | idx_outreach_messages_dir | CREATE INDEX idx_outreach_messages_dir ON public.outreach_messages USING btree (direction, channel, created_at DESC) |
| outreach_messages | outreach_messages_pkey | CREATE UNIQUE INDEX outreach_messages_pkey ON public.outreach_messages USING btree (id) |
| profiles | profiles_pkey | CREATE UNIQUE INDEX profiles_pkey ON public.profiles USING btree (id) |
| project_config | project_config_pkey | CREATE UNIQUE INDEX project_config_pkey ON public.project_config USING btree (key) |
| scraping_jobs | scraping_jobs_pkey | CREATE UNIQUE INDEX scraping_jobs_pkey ON public.scraping_jobs USING btree (id) |
| settings | settings_pkey | CREATE UNIQUE INDEX settings_pkey ON public.settings USING btree (id) |
| user_onboarding | user_onboarding_pkey | CREATE UNIQUE INDEX user_onboarding_pkey ON public.user_onboarding USING btree (user_id) |
| user_roles | user_roles_pkey | CREATE UNIQUE INDEX user_roles_pkey ON public.user_roles USING btree (id) |
| user_roles | user_roles_user_id_role_key | CREATE UNIQUE INDEX user_roles_user_id_role_key ON public.user_roles USING btree (user_id, role) |
## 4. Triggers
| tabela | gatilho | definicao |
|---|---|---|
| api_keys_registry | update_api_keys_registry_updated_at | CREATE TRIGGER update_api_keys_registry_updated_at BEFORE UPDATE ON public.api_keys_registry FOR EACH ROW EXECUTE FUNCTION update_updated_at_column() |
| contact_lists | update_contact_lists_updated_at | CREATE TRIGGER update_contact_lists_updated_at BEFORE UPDATE ON public.contact_lists FOR EACH ROW EXECUTE FUNCTION update_updated_at_column() |
| contacts | trigger_update_list_count | CREATE TRIGGER trigger_update_list_count AFTER INSERT OR DELETE OR UPDATE OF list_id ON public.contacts FOR EACH ROW EXECUTE FUNCTION update_list_contacts_count() |
| contacts | update_contacts_updated_at | CREATE TRIGGER update_contacts_updated_at BEFORE UPDATE ON public.contacts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column() |
| profiles | update_profiles_updated_at | CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column() |
| settings | update_settings_updated_at | CREATE TRIGGER update_settings_updated_at BEFORE UPDATE ON public.settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column() |
## 5. RLS por tabela
| tabela | rls_ligada |
|---|---|
| api_keys_registry | true |
| contact_lists | true |
| contacts | true |
| lead_searches | true |
| outreach_messages | true |
| profiles | true |
| project_config | true |
| scraping_jobs | true |
| settings | true |
| user_onboarding | true |
| user_roles | true |
## 6. Policies
| tabela | policy | operacao | papeis | USING | WITH CHECK |
|---|---|---|---|---|---|
| api_keys_registry | Admins manage project keys | ALL | public | has_role(auth.uid(), 'admin'::app_role) | has_role(auth.uid(), 'admin'::app_role) |
| contact_lists | Allow all access to contact_lists | ALL | public | true | true |
| contacts | Allow all access to contacts | ALL | public | true | true |
| lead_searches | Allow all access to lead_searches | ALL | public | true | true |
| outreach_messages | outreach_messages_full_access | ALL | public | true | true |
| profiles | Admins read all profiles | SELECT | public | has_role(auth.uid(), 'admin'::app_role) | - |
| profiles | Admins update all profiles | UPDATE | public | has_role(auth.uid(), 'admin'::app_role) | - |
| profiles | Service inserts profiles | INSERT | public | - | (auth.uid() = id) |
| profiles | Users read own profile | SELECT | public | (auth.uid() = id) | - |
| profiles | Users update own profile | UPDATE | public | (auth.uid() = id) | (auth.uid() = id) |
| project_config | Admins read config | SELECT | public | has_role(auth.uid(), 'admin'::app_role) | - |
| project_config | Admins update config | UPDATE | public | has_role(auth.uid(), 'admin'::app_role) | - |
| scraping_jobs | Allow all access to scraping_jobs | ALL | public | true | true |
| settings | settings_full_access | ALL | public | true | true |
| user_onboarding | Users delete own onboarding | DELETE | public | (auth.uid() = user_id) | - |
| user_onboarding | Users insert own onboarding | INSERT | public | - | (auth.uid() = user_id) |
| user_onboarding | Users read own onboarding | SELECT | public | (auth.uid() = user_id) | - |
| user_onboarding | Users update own onboarding | UPDATE | public | (auth.uid() = user_id) | (auth.uid() = user_id) |
| user_roles | Admins manage roles | ALL | public | has_role(auth.uid(), 'admin'::app_role) | - |
| user_roles | Users read own role | SELECT | public | (auth.uid() = user_id) | - |
## 7. GRANTs por papel
| tabela | papel | permissoes |
|---|---|---|
| api_keys_registry | anon | DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE |
| api_keys_registry | authenticated | DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE |
| api_keys_registry | service_role | DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE |
| contact_lists | anon | DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE |
| contact_lists | authenticated | DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE |
| contact_lists | service_role | DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE |
| contacts | anon | DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE |
| contacts | authenticated | DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE |
| contacts | service_role | DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE |
| lead_searches | anon | DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE |
| lead_searches | authenticated | DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE |
| lead_searches | service_role | DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE |
| outreach_messages | anon | DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE |
| outreach_messages | authenticated | DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE |
| outreach_messages | service_role | DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE |
| profiles | anon | DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE |
| profiles | authenticated | DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE |
| profiles | service_role | DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE |
| project_config | anon | DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE |
| project_config | authenticated | DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE |
| project_config | service_role | DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE |
| scraping_jobs | anon | DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE |
| scraping_jobs | authenticated | DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE |
| scraping_jobs | service_role | DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE |
| settings | anon | DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE |
| settings | authenticated | DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE |
| settings | service_role | DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE |
| user_onboarding | anon | DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE |
| user_onboarding | authenticated | DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE |
| user_onboarding | service_role | DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE |
| user_roles | anon | DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE |
| user_roles | authenticated | DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE |
| user_roles | service_role | DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE |
## 8. Funcoes
| funcao | argumentos | retorno | seguranca | search_path | EXECUTE para |
|---|---|---|---|---|---|
| _remix_introspect |  | jsonb | DEFINER | search_path=public, pg_catalog | anon, authenticated, service_role |
| check_email_domain |  | trigger | DEFINER | search_path=public | anon, authenticated, service_role |
| delete_project_secret | p_service_name text | void | DEFINER | search_path=public | anon, authenticated, service_role |
| get_user_api_key | p_user_id uuid, p_service_name text | text | DEFINER | search_path=public | anon, authenticated, service_role |
| get_vault_key | p_service_name text | text | DEFINER | search_path=public | anon, authenticated, service_role |
| handle_new_user |  | trigger | DEFINER | search_path=public | anon, authenticated, service_role |
| has_role | _user_id uuid, _role app_role | boolean | DEFINER | search_path=public | anon, authenticated, service_role |
| is_workspace_ready |  | boolean | DEFINER | search_path=public | anon, authenticated, service_role |
| list_project_secrets |  | TABLE(service_name text, label text, is_active boolean, validation_status text, last_validated_at timestamp with time zone, configured boolean, masked_value text, updated_at timestamp with time zone) | DEFINER | search_path=public | anon, authenticated, service_role |
| set_project_secret | p_service_name text, p_secret text, p_label text, p_validation_status text | jsonb | DEFINER | search_path=public | anon, authenticated, service_role |
| update_list_contacts_count |  | trigger | INVOKER | - | anon, authenticated, service_role |
| update_updated_at_column |  | trigger | INVOKER | search_path=public | anon, authenticated, service_role |
| upsert_lead_contact | p_name text, p_phone text, p_company text, p_city text, p_tags text[], p_list_id uuid, p_custom_fields jsonb, p_score integer, p_source text | jsonb | DEFINER | search_path=public | anon, authenticated, service_role |
| vault_delete_secret | p_secret_id uuid | void | DEFINER | search_path=public | anon, authenticated, service_role |
| vault_read_secret | p_secret_id uuid | text | DEFINER | search_path=public | anon, authenticated, service_role |
| vault_store_secret | p_secret text, p_name text, p_description text | uuid | DEFINER | search_path=public | anon, authenticated, service_role |
| vault_update_secret | p_secret_id uuid, p_new_secret text | void | DEFINER | search_path=public | anon, authenticated, service_role |
## 9. Linhas por tabela
| tabela | linhas |
|---|---|
| api_keys_registry | 0 |
| contact_lists | 0 |
| contacts | 0 |
| lead_searches | 0 |
| outreach_messages | 0 |
| profiles | 0 |
| project_config | 0 |
| scraping_jobs | 0 |
| settings | 0 |
| user_onboarding | 0 |
| user_roles | 0 |
## 10. Extensoes
	- pg_stat_statements 1.11
	- pgcrypto 1.3
	- plpgsql 1.0
	- supabase_vault 0.3.1
	- uuid-ossp 1.1
