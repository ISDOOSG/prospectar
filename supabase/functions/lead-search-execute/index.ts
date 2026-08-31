import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ─── Utils ───
const BR_STATES: Record<string, string> = {
  AC:"Acre",AL:"Alagoas",AP:"Amapá",AM:"Amazonas",BA:"Bahia",CE:"Ceará",DF:"Distrito Federal",
  ES:"Espírito Santo",GO:"Goiás",MA:"Maranhão",MT:"Mato Grosso",MS:"Mato Grosso do Sul",
  MG:"Minas Gerais",PA:"Pará",PB:"Paraíba",PR:"Paraná",PE:"Pernambuco",PI:"Piauí",
  RJ:"Rio de Janeiro",RN:"Rio Grande do Norte",RS:"Rio Grande do Sul",RO:"Rondônia",
  RR:"Roraima",SC:"Santa Catarina",SP:"São Paulo",SE:"Sergipe",TO:"Tocantins",
};

function normalizeLocations(locs: string[]): string[] {
  const r: string[] = [];
  for (const l of locs) {
    const u = l.trim().toUpperCase();
    if (BR_STATES[u]) { r.push(BR_STATES[u]); r.push(`${BR_STATES[u]}, Brazil`); }
    else { r.push(l.trim()); if (!l.toLowerCase().includes("brazil")) r.push(`${l.trim()}, Brazil`); }
  }
  return [...new Set(r)];
}

function normalizeBRPhone(raw: unknown): string | null {
  if (raw === null || raw === undefined) return null;
  const s = String(raw);
  let d = s.replace(/\D/g, "");
  if (d.startsWith("55") && d.length > 11) d = d.slice(2);
  if (d.length < 10 || d.length > 11) return null;
  if (d.length === 10) { const ddd = d.slice(0,2); const n = d.slice(2); if (parseInt(n[0],10) >= 6) d = ddd+"9"+n; }
  return "55"+d;
}

const BR_SYNONYMS: Record<string, string[]> = {
  dentista:["dentista","cirurgiao dentista","odontologa","odontologista"],
  nutricionista:["nutricionista","nutrologa"],
  "personal trainer":["personal trainer","educador fisico","preparador fisico"],
  advogado:["advogado","advogada","jurista"],
  psicologo:["psicologo","psicologa","terapeuta"],
  medico:["medico","medica","physician"],
  engenheiro:["engenheiro","engineer"],
  "engenheiro de energia":["engenheiro de energia","energy engineer","engenheiro eletrico","electrical engineer"],
};

function expandProf(profs: string[]): string[] {
  const r: string[] = [];
  for (const p of profs) {
    const k = p.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    r.push(p);
    for (const [key, syns] of Object.entries(BR_SYNONYMS)) { if (k.includes(key)||key.includes(k)) { r.push(...syns); break; } }
  }
  return [...new Set(r)];
}

// ─── Main ───
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const { searchId } = await req.json();
    if (!searchId) return new Response(JSON.stringify({ success:false, error:"searchId required" }), { status:400, headers:{...corsHeaders,"Content-Type":"application/json"} });

    const { data: search } = await supabase.from("lead_searches").select("*").eq("id", searchId).single();
    if (!search) return new Response(JSON.stringify({ success:false, error:"Search not found" }), { status:404, headers:{...corsHeaders,"Content-Type":"application/json"} });

    const startTime = Date.now();
    await supabase.from("lead_searches").update({ status:"running", started_at:new Date().toISOString() }).eq("id", searchId);

    // Load API keys EXCLUSIVELY from Vault — no env fallback, no settings table
    const loadVaultKey = async (name: string): Promise<string> => {
      const { data } = await supabase.rpc("get_vault_key", { p_service_name: name });
      return (data as string) || "";
    };
    const [apollo, apify, crustdata, tavily, pdl] = await Promise.all([
      loadVaultKey("apollo"),
      loadVaultKey("apify"),
      loadVaultKey("crustdata"),
      loadVaultKey("tavily"),
      loadVaultKey("pdl"),
    ]);
    const K = { apollo, apify, crustdata, tavily, pdl };

    const config = search.config as any;
    const source = search.source as string;
    const limit = config.volume?.per_page || 25;
    if (config.location?.person_locations) config.location.person_locations = normalizeLocations(config.location.person_locations);

    const profs = [...(config.persona?.professions||[]),...(config.persona?.titles||[])];
    const specs = config.persona?.specialties || [];
    const interests = config.persona?.interests || [];
    const keywords = config.persona?.keywords || [];
    const locs = config.location?.person_locations || [];
    const industries = config.persona?.industries || [];
    const seniorities = config.persona?.seniority || [];

    // Helper: build query string from all search terms
    const buildQ = (...extras: string[][]) => [...profs,...specs,...interests,...keywords,...extras.flat(),...locs].filter(Boolean).join(" ") || "profissional";

    // ══════════════════════════════════════════
    // RUN SELECTED SOURCE(S) INDEPENDENTLY
    // ══════════════════════════════════════════
    let allContacts: any[] = [];
    const isAll = source === "all";
    const shouldRun = (s: string) => source === s || isAll;

    // Relatório por fonte: visibilidade real do que cada fonte produziu / por que falhou.
    // Sem isto, plano free, chave faltando ou actor lento viram "0 resultados" silencioso.
    const reports: Record<string, { found: number; error?: string }> = {};

    // Check: if single source requested but key missing, fail immediately with clear error
    if (!isAll) {
      const keyNeeded: Record<string,string> = {
        apollo_search:"apollo", google_maps:"apify", crustdata_search:"crustdata",
        apify_instagram:"apify", apify_twitter:"apify", apify_tiktok:"apify",
        apify_linkedin_search:"apify", tavily_search:"tavily", pdl_search:"pdl",
      };
      const needed = keyNeeded[source];
      if (needed && !K[needed as keyof typeof K]) {
        await supabase.from("lead_searches").update({
          status: "failed", completed_at: new Date().toISOString(),
          result_data: [{ error: `API key não configurada: ${needed}. Vá em Configurações.` }],
          source_reports: [{ source, found: 0, error: `Chave "${needed}" não configurada no cofre. Configure em Configurações.` }],
        }).eq("id", searchId);
        return new Response(JSON.stringify({ success:false, error:`API key não configurada: ${needed}` }), { headers:{...corsHeaders,"Content-Type":"application/json"} });
      }
    }

    // Pré-registra cada fonte que vai de fato rodar (tem chave). Assim uma fonte que
    // rodou e voltou vazia aparece como "0 resultados" em vez de sumir do relatório.
    const SOURCE_KEY: Record<string,string> = {
      apollo_search:"apollo", google_maps:"apify", crustdata_search:"crustdata",
      apify_instagram:"apify", apify_twitter:"apify", apify_tiktok:"apify",
      apify_linkedin_search:"apify", tavily_search:"tavily", pdl_search:"pdl",
    };
    for (const [src, keyName] of Object.entries(SOURCE_KEY)) {
      if (shouldRun(src) && K[keyName as keyof typeof K]) reports[src] = { found: 0 };
    }

    const tasks: Promise<void>[] = [];

    // ─── APOLLO ───
    if (shouldRun("apollo_search") && K.apollo) {
      tasks.push((async () => {
        try {
          const body: any = { per_page: Math.min(limit,100), page:1, include_similar_titles:true };
          const titles = [...profs,...specs].filter(Boolean);
          if (titles.length) body.person_titles = titles;
          const kw = [...interests,...keywords].filter(Boolean);
          if (kw.length) body.q_keywords = kw.join(" ");
          if (config.persona?.freeform_description) body.q_keywords = (body.q_keywords||"")+" "+config.persona.freeform_description;
          if (locs.length) body.person_locations = locs;
          if (industries.length) body.q_keywords = (body.q_keywords||"")+" "+industries.join(" ");
          const senMap:Record<string,string> = {"Estagiário":"intern","Júnior":"entry","Pleno":"senior","Sênior":"senior","Especialista":"senior","Coordenador":"manager","Gerente":"manager","Diretor":"director","VP":"vp","C-Level":"c_suite","Fundador/Sócio":"founder"};
          if (seniorities.length) body.person_seniorities = [...new Set(seniorities.map((s:string)=>senMap[s]||s.toLowerCase()).filter(Boolean))];
          body.contact_email_status = ["verified","likely to engage"];

          const resp = await fetch("https://api.apollo.io/api/v1/mixed_people/api_search", { method:"POST", headers:{"Content-Type":"application/json","x-api-key":K.apollo}, body:JSON.stringify(body) });
          if (!resp.ok) {
            const errBody = await resp.json().catch(() => ({} as any));
            reports.apollo_search = { found: 0, error: errBody?.error_code === "API_INACCESSIBLE"
              ? "Plano FREE do Apollo: a API de busca está bloqueada. Faça upgrade do plano ou use outras fontes (Apify, PDL, Tavily)."
              : `Apollo retornou HTTP ${resp.status}${errBody?.error ? ` — ${errBody.error}` : ""}` };
            return;
          }
          const data = await resp.json();
          const people = data.people||[];

          // Try enrich for emails
          const ids = people.map((p:any)=>p.id).filter(Boolean);
          let enriched: Record<string,any> = {};
          if (ids.length > 0) {
            try {
              for (let i=0;i<ids.length;i+=10) {
                const batch = ids.slice(i,i+10);
                const er = await fetch("https://api.apollo.io/api/v1/people/bulk_match", { method:"POST", headers:{"Content-Type":"application/json","x-api-key":K.apollo}, body:JSON.stringify({reveal_personal_emails:true,details:batch.map((id:string)=>({id}))}) });
                if (er.ok) { const ed = await er.json(); for (const m of (ed.matches||ed.people||[])) { if(m.id) enriched[m.id]=m; } }
              }
            } catch {}
          }

          for (const p of people) {
            const e = enriched[p.id];
            const org = p.organization||{};
            allContacts.push({
              name: e?.name || p.first_name || "",
              email: e?.email || e?.personal_emails?.[0] || "",
              phone: "", title: p.title||"", company: org.name||"",
              city: [e?.city||p.city, e?.state||p.state].filter(Boolean).join(", ")||locs[0]||"",
              linkedin_url: e?.linkedin_url||p.linkedin_url||"",
              tags:["apollo"], _source:"apollo_search",
              custom_fields:{ apollo_id:p.id, profile_pic:e?.photo_url||"", seniority:p.seniority||"", source_url:e?.linkedin_url||"", has_email:p.has_email }
            });
          }
          console.log(`[apollo] ${people.length} found, ${Object.keys(enriched).length} enriched`);
        } catch(e) { console.error("[apollo]",e); }
      })());
    }

    // ─── GOOGLE MAPS ───
    if (shouldRun("google_maps") && K.apify) {
      tasks.push((async () => {
        try {
          const searchStrings = profs.map(p => `${p} ${specs[0]||""} ${locs[0]||""}`.trim()).slice(0,3);
          if (!searchStrings.length) return;
          const { items, error } = await apifyRun(K.apify, "compass/crawler-google-places", { searchStringsArray:searchStrings, maxCrawledPlacesPerSearch:limit, language:"pt-BR", maxReviews:0 }, limit);
          if (error) { reports.google_maps = { found: 0, error }; return; }
          for (const p of items) {
            const ws = p.website||"";
            const ig = ws.includes("instagram.com") ? ws.replace(/.*instagram\.com\//,"").replace(/\/.*/,"") : "";
            allContacts.push({ name:p.title||"", phone:p.phone||"", email:"", company:p.title||"", city:p.address||locs[0]||"", instagram:ig, linkedin_url:"", tags:["google-maps",p.categoryName||""].filter(Boolean), _source:"google_maps", custom_fields:{ source_url:p.url||"", website:ws, rating:p.totalScore||null, reviews:p.reviewsCount||null, address:p.address||"", category:p.categoryName||"", place_id:p.placeId||"" } });
          }
          console.log(`[google-maps] ${items.length}`);
        } catch(e) { console.error("[google-maps]",e); }
      })());
    }

    // ─── CRUSTDATA ───
    if (shouldRun("crustdata_search") && K.crustdata) {
      tasks.push((async () => {
        try {
          const headline = expandProf(profs).concat(specs,interests,keywords).filter(Boolean).join("|");
          if (!headline) return;
          const conds:any[] = [{ field:"basic_profile.headline", type:"(.)", value:headline }];
          if (locs.length) conds.push({ field:"basic_profile.location.raw", type:"(.)", value:locs.join("|") });
          const resp = await fetch("https://api.crustdata.com/screener/person/search", { method:"POST", headers:{authorization:`Bearer ${K.crustdata}`,"content-type":"application/json","x-api-version":"2025-11-01"}, body:JSON.stringify({filters:conds.length===1?conds[0]:{op:"and",conditions:conds},limit:limit}) });
          if (!resp.ok) { reports.crustdata_search = { found: 0, error: `CrustData retornou HTTP ${resp.status}` }; return; }
          const data = await resp.json();
          for (const p of (data.profiles||[])) {
            const bp=p.basic_profile||{};const sh=p.social_handles||{};
            allContacts.push({ name:bp.name||"", phone:"", email:"", title:bp.headline||bp.current_title||"", company:"", city:bp.location?.raw||locs[0]||"", linkedin_url:sh.professional_network_identifier?.profile_url||"", tags:["crustdata"], _source:"crustdata_search", custom_fields:{ profile_pic:bp.profile_picture_permalink||"", crustdata_id:p.crustdata_person_id||"", source_url:sh.professional_network_identifier?.profile_url||"", twitter:sh.twitter_identifier?.slug?`https://x.com/${sh.twitter_identifier.slug}`:"" } });
          }
          console.log(`[crustdata] ${data.profiles?.length||0}`);
        } catch(e) { console.error("[crustdata]",e); }
      })());
    }

    // ─── INSTAGRAM ───
    if (shouldRun("apify_instagram") && K.apify) {
      tasks.push((async () => {
        try {
          const q = buildQ();
          const { items, error } = await apifyRun(K.apify, "data-slayer/instagram-search-users", { query:q, limit:limit }, limit);
          if (error) { reports.apify_instagram = { found: 0, error }; return; }
          for (const r of items) {
            const h = r.username||""; if(!h) continue;
            allContacts.push({ name:r.full_name||h, phone:"", email:"", company:"", city:locs[0]||"", instagram:h, linkedin_url:"", tags:["instagram",`@${h}`], _source:"apify_instagram", custom_fields:{ source_url:`https://instagram.com/${h}`, profile_url:`https://instagram.com/${h}`, profile_pic:r.profile_pic_url||"", is_private:r.is_private||false, is_verified:r.is_verified||false, followers:r.follower_count||null } });
          }
          console.log(`[instagram] ${items.length}`);
        } catch(e) { console.error("[instagram]",e); }
      })());
    }

    // ─── TWITTER ───
    if (shouldRun("apify_twitter") && K.apify) {
      tasks.push((async () => {
        try {
          const q = buildQ();
          const { items, error } = await apifyRun(K.apify, "apidojo/tweet-scraper", { searchTerms:[q], maxTweets:limit, sort:"Latest" }, limit);
          if (error) { reports.apify_twitter = { found: 0, error }; return; }
          const seen = new Set<string>();
          for (const r of items) {
            const handle = r.author?.userName||r.user?.screen_name||""; if(!handle||seen.has(handle)) continue; seen.add(handle);
            allContacts.push({ name:r.author?.name||r.user?.name||"", phone:"", email:"", company:"", city:r.author?.location||r.user?.location||locs[0]||"", instagram:"", linkedin_url:"", tags:["twitter",`@${handle}`], _source:"apify_twitter", custom_fields:{ source_url:`https://x.com/${handle}`, twitter_handle:handle, bio:(r.author?.description||"").slice(0,500), followers:r.author?.followers||null, tweet:(r.text||"").slice(0,300) } });
          }
          console.log(`[twitter] ${seen.size}`);
        } catch(e) { console.error("[twitter]",e); }
      })());
    }

    // ─── TIKTOK ───
    if (shouldRun("apify_tiktok") && K.apify) {
      tasks.push((async () => {
        try {
          const q = buildQ();
          const { items, error } = await apifyRun(K.apify, "clockworks/tiktok-scraper", { searchQueries:[q], resultsPerPage:limit, searchSection:"users" }, limit);
          if (error) { reports.apify_tiktok = { found: 0, error }; return; }
          for (const r of items) {
            const handle = r.uniqueId||r.author?.uniqueId||""; if(!handle) continue;
            allContacts.push({ name:r.nickname||r.author?.nickname||handle, phone:"", email:"", company:"", city:locs[0]||"", instagram:"", linkedin_url:"", tags:["tiktok",`@${handle}`], _source:"apify_tiktok", custom_fields:{ source_url:`https://tiktok.com/@${handle}`, tiktok_handle:handle, bio:(r.signature||r.author?.signature||"").slice(0,500), followers:r.fans||r.authorMeta?.fans||null, hearts:r.heart||r.authorMeta?.heart||null } });
          }
          console.log(`[tiktok] ${items.length}`);
        } catch(e) { console.error("[tiktok]",e); }
      })());
    }

    // ─── LINKEDIN SEARCH ───
    if (shouldRun("apify_linkedin_search") && K.apify) {
      tasks.push((async () => {
        try {
          const jobTitle = profs.concat(specs).join(" ")||buildQ();
          const location = locs.join(", ")||null;
          const { items, error } = await apifyRun(K.apify, "apimaestro/linkedin-profile-search-scraper", { current_job_title:jobTitle, location, rows:limit }, limit);
          if (error) { reports.apify_linkedin_search = { found: 0, error }; return; }
          for (const r of items) {
            const bi=r.basic_info||r; const loc=bi.location||{};
            allContacts.push({ name:bi.fullname||bi.full_name||r.name||"", phone:bi.phone||"", email:bi.email||"", title:bi.headline||r.title||"", company:bi.current_company||r.company||"", city:loc.city||loc.full||r.location||locs[0]||"", linkedin_url:bi.profile_url||r.profileUrl||"", tags:["linkedin-search"], _source:"apify_linkedin_search", custom_fields:{ source_url:bi.profile_url||r.profileUrl||"", followers:bi.follower_count||null, open_to_work:bi.open_to_work||false } });
          }
          console.log(`[linkedin-search] ${items.length}`);
        } catch(e) { console.error("[linkedin-search]",e); }
      })());
    }

    // ─── TAVILY ───
    if (shouldRun("tavily_search") && K.tavily) {
      tasks.push((async () => {
        try {
          const queries = [`${profs.concat(specs).join(" ")} ${locs[0]||""} contato telefone whatsapp`, `${buildQ()} instagram linkedin site`];
          const seenUrls = new Set<string>();
          for (const q of queries.slice(0,2)) {
            const resp = await fetch("https://api.tavily.com/search", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({api_key:K.tavily,query:q,search_depth:"advanced",max_results:Math.min(Math.ceil(limit/2),20),include_raw_content:true}) });
            if (!resp.ok) { reports.tavily_search = { found: reports.tavily_search?.found || 0, error: `Tavily retornou HTTP ${resp.status}` }; continue; }
            const data = await resp.json();
            for (const r of (data.results||[])) {
              const url=r.url||""; if(seenUrls.has(url)) continue; seenUrls.add(url);
              const txt=`${r.title||""} ${r.content||""} ${r.raw_content||""}`;
              const phones=[...new Set((txt.match(/\(?\d{2}\)?\s?\d{4,5}[-.\s]?\d{4}/g)||[]))];
              const emails=[...new Set((txt.match(/[\w.-]+@[\w.-]+\.\w{2,}/g)||[]))].filter(e=>!e.includes("facebook")&&!e.includes("sentry")&&!e.includes("wixpress"));
              const igs=[...new Set((txt.match(/instagram\.com\/([\w.]{3,30})/g)||[]).map(m=>m.replace("instagram.com/","")))].filter(h=>!["p","reel","explore"].includes(h));
              const wa=txt.match(/wa\.me\/(\d{10,15})/)?.[1]||"";
              const name=(r.title||"").replace(/\s*[-|–—:].*/g,"").replace(/\s*\(.*\)/,"").trim();
              if (/\d+\s*(melhores|dentistas|nutricionistas)/i.test(r.title||"")) continue;
              if (name.length>2) {
                allContacts.push({ name, phone:phones[0]||"", email:emails[0]||"", company:"", city:locs[0]||"", instagram:igs[0]||"", linkedin_url:"", tags:["tavily"], _source:"tavily_search", custom_fields:{ source_url:url, website:url, all_phones:phones.slice(0,5), all_emails:emails.slice(0,5), whatsapp:wa?`+${wa}`:"", tavily_score:r.score||null } });
              }
            }
          }
          console.log(`[tavily] ${allContacts.filter(c=>c._source==="tavily_search").length}`);
        } catch(e) { console.error("[tavily]",e); }
      })());
    }

    // ─── PDL SEARCH ───
    if (shouldRun("pdl_search") && K.pdl) {
      tasks.push((async () => {
        try {
          const profExpanded = expandProf(profs);
          const sql = `SELECT * FROM person WHERE location_country='brazil'${profExpanded.length?` AND (${profExpanded.map((p:string)=>`job_title='${p}'`).join(" OR ")})`:""}${locs.length?` AND (${locs.map((l:string)=>`location_name LIKE '%${l}%'`).join(" OR ")})`:""}`;
          const resp = await fetch("https://api.peopledatalabs.com/v5/person/search", { method:"POST", headers:{"Content-Type":"application/json","X-Api-Key":K.pdl}, body:JSON.stringify({sql,size:Math.min(limit,100)}) });
          if (!resp.ok) { const eb = await resp.json().catch(() => ({} as any)); reports.pdl_search = { found: 0, error: `PDL retornou HTTP ${resp.status}${eb?.error?.message ? ` — ${eb.error.message}` : ""}` }; return; }
          const data = await resp.json();
          for (const p of (data.data||[])) {
            allContacts.push({ name:p.full_name||"", phone:p.mobile_phone||p.phone_numbers?.[0]||"", email:p.recommended_personal_email||p.personal_emails?.[0]||p.work_email||"", title:p.job_title||"", company:p.job_company_name||"", city:p.location_name||locs[0]||"", linkedin_url:p.linkedin_url||"", instagram:"", tags:["pdl"], _source:"pdl_search", custom_fields:{ source_url:p.linkedin_url||"", profile_pic:p.profile_pic_url||"", facebook:p.facebook_url||"", twitter:p.twitter_url||"", github:p.github_url||"", gender:p.sex||"", skills:(p.skills||[]).slice(0,10).join(", "), interests:(p.interests||[]).slice(0,10).join(", ") } });
          }
          console.log(`[pdl] ${data.data?.length||0}`);
        } catch(e) { console.error("[pdl]",e); }
      })());
    }

    // ══════════════════════════════════════════
    // WAIT FOR ALL SOURCES
    // ══════════════════════════════════════════
    await Promise.all(tasks);
    console.log(`[search] All sources done. Raw contacts: ${allContacts.length}`);

    // Conta resultados brutos por fonte (não sobrescreve fontes que registraram erro).
    for (const c of allContacts) {
      const r = reports[c._source];
      if (r && !r.error) r.found++;
    }

    // ══════════════════════════════════════════
    // MERGE BY NAME (fuzzy)
    // ══════════════════════════════════════════
    const merged = new Map<string, any>();
    for (const c of allContacts) {
      if (!c.name || c.name.length < 3) continue;
      const key = c.name.toLowerCase().trim().replace(/\s+/g," ");
      if (merged.has(key)) {
        const existing = merged.get(key);
        // Merge: fill empty fields, concat sources
        for (const f of ["email","phone","title","company","city","linkedin_url","instagram"]) {
          if (!existing[f] && c[f]) existing[f] = c[f];
        }
        if (c.custom_fields) {
          for (const [k,v] of Object.entries(c.custom_fields)) {
            if (v && !existing.custom_fields[k]) existing.custom_fields[k] = v;
          }
        }
        // Track all sources
        if (!existing.custom_fields.sources) existing.custom_fields.sources = [existing._source];
        if (!existing.custom_fields.sources.includes(c._source)) existing.custom_fields.sources.push(c._source);
        // Merge tags
        existing.tags = [...new Set([...(existing.tags||[]),...(c.tags||[])])];
      } else {
        c.custom_fields = c.custom_fields || {};
        c.custom_fields.sources = [c._source];
        merged.set(key, c);
      }
    }
    let contacts = Array.from(merged.values());
    console.log(`[search] After merge: ${contacts.length}`);

    // ══════════════════════════════════════════
    // FILTERS
    // ══════════════════════════════════════════
    const excludeTerms = (config.persona?.exclude_keywords||[]).map((s:string)=>s.toLowerCase());
    contacts = contacts.filter(c => {
      const txt = [c.name,c.title,c.company,c.city,c.custom_fields?.bio,c.custom_fields?.headline].filter(Boolean).join(" ").toLowerCase();
      // Exclude keywords
      if (excludeTerms.some((t:string)=>txt.includes(t))) return false;
      return true;
    });

    // Contact/social requirements
    if (config.contact_requirements?.require_phone) contacts = contacts.filter(c=>c.phone);
    if (config.contact_requirements?.require_email) contacts = contacts.filter(c=>c.email||c.custom_fields?.email);
    if (config.social?.require_instagram) contacts = contacts.filter(c=>c.instagram);
    if (config.social?.require_linkedin) contacts = contacts.filter(c=>c.linkedin_url);
    if (config.social?.min_followers > 0) contacts = contacts.filter(c=>(c.custom_fields?.followers||0)>=config.social.min_followers);
    if (config.demographics?.gender) contacts = contacts.filter(c=>!c.custom_fields?.gender||c.custom_fields.gender.toLowerCase()===config.demographics.gender.toLowerCase());

    // Sort: Apollo first, then by source priority
    const ORDER:Record<string,number> = { apollo_search:0, google_maps:1, crustdata_search:2, pdl_search:3, apify_linkedin_search:4, tavily_search:5, apify_instagram:6, apify_twitter:7, apify_tiktok:8 };
    contacts.sort((a,b) => (ORDER[a._source]??9) - (ORDER[b._source]??9));

    console.log(`[search] Final: ${contacts.length}`);

    // ══════════════════════════════════════════
    // SAVE
    // ══════════════════════════════════════════
    let newCount = 0;
    for (const c of contacts) {
      const phone = c.phone ? normalizeBRPhone(c.phone) : null;
      const { data: result } = await supabase.rpc("upsert_lead_contact", {
        p_name:c.name||"", p_phone:phone||"", p_company:c.company||"", p_city:c.city||"",
        p_tags:c.tags||["lead-search"], p_list_id:search.target_list_id||null,
        p_custom_fields:{ email:c.email||"", linkedin:c.linkedin_url||"", instagram:c.instagram||"", title:c.title||"", source_search_id:searchId, ...(c.custom_fields||{}) },
        p_score:0, p_source:c._source||source,
      });
      if (result?.is_new) newCount++;
    }

    const dur = Date.now()-startTime;
    const sourceReports = Object.entries(reports).map(([src, r]) => ({ source: src, found: r.found, error: r.error || null }));
    const sourcesWithError = sourceReports.filter(r => r.error);
    await supabase.from("lead_searches").update({ status:"completed", contacts_found:contacts.length, contacts_new:newCount, result_data:contacts, source_reports:sourceReports, completed_at:new Date().toISOString(), duration_ms:dur }).eq("id",searchId);
    console.log(`[search] DONE: ${contacts.length} found, ${newCount} new, ${dur}ms. Sources com erro: ${sourcesWithError.length}`);
    return new Response(JSON.stringify({ success:true, contacts_found:contacts.length, contacts_new:newCount, source_reports:sourceReports }), { headers:{...corsHeaders,"Content-Type":"application/json"} });
  } catch(error) {
    console.error("[search] Error:",error);
    return new Response(JSON.stringify({ success:false, error:error instanceof Error?error.message:"Unknown" }), { status:500, headers:{...corsHeaders,"Content-Type":"application/json"} });
  }
});

// ─── Apify Actor Runner ───
// Retorna { items, error }. `error` preenchido quando o actor falha/expira — assim
// a fonte aparece no relatório em vez de virar "0 resultados" silencioso.
async function apifyRun(key:string, actorId:string, input:any, limit=30): Promise<{ items:any[]; error?:string }> {
  const h = {"Content-Type":"application/json",Authorization:`Bearer ${key}`};
  const maxItems = String(Math.max(30, limit));
  // waitForFinish máx. 60s no POST; depois até 3 polls de 25s. As fontes rodam em
  // paralelo (Promise.all), então o tempo de parede é o do actor mais lento, não a soma.
  const p = new URLSearchParams({waitForFinish:"55",maxItems,timeout:"120",maxTotalChargeUsd:"1.0"});
  try {
    const r = await fetch(`https://api.apify.com/v2/acts/${actorId.replace("/","~")}/runs?${p}`,{method:"POST",headers:h,body:JSON.stringify(input)});
    if (!r.ok) return { items:[], error:`Apify HTTP ${r.status} ao iniciar ${actorId}` };
    let run = (await r.json()).data;
    let polls=0;
    while ((run.status==="RUNNING"||run.status==="READY")&&polls<3) { polls++; const pr=await fetch(`https://api.apify.com/v2/actor-runs/${run.id}?waitForFinish=25`,{headers:h}); run=(await pr.json()).data; }
    if (run.status==="RUNNING"||run.status==="READY") return { items:[], error:`Apify ainda processando (timeout) em ${actorId}` };
    if (run.status!=="SUCCEEDED") return { items:[], error:`Apify status ${run.status} em ${actorId}` };
    if (!run.defaultDatasetId) return { items:[], error:`Apify sem dataset em ${actorId}` };
    const items = await (await fetch(`https://api.apify.com/v2/datasets/${run.defaultDatasetId}/items?format=json&clean=true&limit=${maxItems}`,{headers:h})).json();
    return { items: Array.isArray(items)?items:[] };
  } catch(e) { return { items:[], error: e instanceof Error?e.message:"erro Apify" }; }
}
