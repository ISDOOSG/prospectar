import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Search, X, Loader2, MapPin, Globe, Sparkles, Target, Users, Briefcase, Heart, Brain, Ban, Plus, Bot, SlidersHorizontal, GraduationCap, Award, Share2, Building2, ChevronDown, MessageSquare, Filter, Linkedin, Instagram, Facebook, Twitter } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useContactLists } from "@/hooks/useContactLists";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { SearchChat } from "@/components/SearchChat";

// ─── Data ───

const PROFESSIONS = [
  "Dentista", "Nutricionista", "Psicólogo", "Fisioterapeuta", "Médico", "Dermatologista", "Veterinário", "Enfermeiro", "Fonoaudiólogo", "Farmacêutico", "Biomédico",
  "Personal Trainer", "Educador Físico", "Coach", "Esteticista", "Massoterapeuta",
  "Advogado", "Contador", "Economista", "Consultor Financeiro", "Corretor de Imóveis", "Corretor de Seguros",
  "Desenvolvedor", "Designer", "Fotógrafo", "Videomaker", "Social Media", "Marketing Digital", "Copywriter", "UX Designer", "Product Manager",
  "Professor", "Pedagogo", "Tutor", "Instrutor",
  "Cabeleireiro", "Barbeiro", "Maquiador", "Manicure", "Design de Sobrancelhas",
  "Chef", "Confeiteiro", "Sommelier", "Bartender", "Pizzaiolo",
  "Arquiteto", "Engenheiro Civil", "Designer de Interiores", "Paisagista",
  "CEO", "Fundador", "Diretor", "Gerente", "Coordenador", "Analista", "Especialista", "Consultor",
  "Atleta", "Treinador", "Preparador Físico", "Influenciador",
];

const SPECIALTIES_MAP: Record<string, string[]> = {
  Dentista: ["Ortodontia", "Implantes", "Estética dental", "Endodontia", "Periodontia", "Prótese", "Odontopediatria", "Cirurgia bucomaxilofacial", "Harmonização orofacial"],
  Nutricionista: ["Emagrecimento", "Nutrição esportiva", "Nutrição funcional", "Nutrição clínica", "Vegetariano/Vegano", "Nutrição materno-infantil", "Nutrição oncológica"],
  Advogado: ["Trabalhista", "Civil", "Criminal", "Empresarial", "Família", "Tributário", "Digital", "Imobiliário", "Previdenciário", "Consumidor"],
  Psicólogo: ["TCC", "Psicanálise", "Terapia de casal", "Infantil", "Neuropsicologia", "Terapia online", "EMDR", "Comportamental"],
  "Personal Trainer": ["Musculação", "Funcional", "Crossfit", "Emagrecimento", "Hipertrofia", "Idosos", "Gestantes", "Reabilitação", "HIIT"],
  Médico: ["Dermatologia", "Cardiologia", "Ortopedia", "Pediatria", "Ginecologia", "Oftalmologia", "Urologia", "Psiquiatria", "Endocrinologia", "Cirurgia plástica"],
  Fisioterapeuta: ["Ortopédica", "Neurológica", "Respiratória", "Esportiva", "Pilates clínico", "RPG", "Pélvica"],
  Fotógrafo: ["Casamento", "Newborn", "Corporativo", "Produto", "Moda", "Imobiliário", "Gastronomia", "Eventos"],
  Arquiteto: ["Residencial", "Comercial", "Interiores", "Paisagismo", "Sustentável", "Corporativo"],
  Coach: ["Executivo", "Vida", "Carreira", "Financeiro", "Esportivo", "Relacionamento", "Liderança"],
  "Marketing Digital": ["Tráfego pago", "SEO", "Social media", "Copywriting", "Email marketing", "Inbound", "Growth hacking"],
};

const INTEREST_CATEGORIES = [
  { cat: "Esportes", items: ["Beach Tennis", "Futebol", "Corrida", "Musculação", "Crossfit", "Yoga", "Pilates", "Natação", "Ciclismo", "Surf", "Tênis", "Artes Marciais", "Vôlei", "Golf", "Escalada", "Triathlon", "Jiu-Jitsu", "Boxe", "Skate"] },
  { cat: "Saúde", items: ["Emagrecimento", "Nutrição saudável", "Meditação", "Estética", "Skin care", "Vegano", "Low carb", "Jejum intermitente", "Saúde mental", "Ayurveda", "Fitoterapia"] },
  { cat: "Negócios", items: ["Startup", "Marketing Digital", "E-commerce", "Investimentos", "Day trade", "Criptomoedas", "Imobiliário", "Franquias", "Consultoria", "Vendas", "Liderança", "SaaS", "Dropshipping"] },
  { cat: "Tecnologia", items: ["Programação", "IA", "UX Design", "No-code", "Blockchain", "Cybersecurity", "Data Science", "Cloud", "Apps mobile", "DevOps", "IoT"] },
  { cat: "Lifestyle", items: ["Viagem", "Gastronomia", "Vinhos", "Cerveja artesanal", "Fotografia", "Moda", "Decoração", "Pets", "Maternidade", "Luxo", "Sustentabilidade", "Minimalismo", "Van life"] },
  { cat: "Educação", items: ["Concursos", "MBA", "Pós-graduação", "Idiomas", "Intercâmbio", "Cursos online", "Vestibular", "Homeschooling"] },
  { cat: "Entretenimento", items: ["Games", "Música", "Cinema", "Podcasts", "Livros", "Anime", "K-pop", "Stand-up", "Cosplay", "Board games"] },
];

const SENIORITY_LEVELS = ["Estagiário", "Júnior", "Pleno", "Sênior", "Especialista", "Coordenador", "Gerente", "Diretor", "VP", "C-Level", "Fundador/Sócio"];
const COMPANY_SIZES = ["Autônomo/Freelancer", "1-10 funcionários", "11-50", "51-200", "201-500", "500+", "Startup", "Multinacional"];
const EDUCATION_LEVELS = ["Ensino Médio", "Técnico", "Graduação", "Pós-graduação", "MBA", "Mestrado", "Doutorado", "Pós-doutorado"];
const INDUSTRIES = ["Saúde", "Educação", "Tecnologia", "Financeiro", "Jurídico", "Imobiliário", "Alimentação", "Beleza", "Fitness", "Moda", "Construção", "Automotivo", "Agronegócio", "Entretenimento", "Turismo", "Varejo", "Indústria", "Logística", "Marketing", "Consultoria", "E-commerce"];

const LOCATIONS = {
  countries: ["Brasil", "Estados Unidos", "Portugal", "Espanha", "Reino Unido", "Canadá", "Itália", "França", "Alemanha", "Argentina", "México", "Japão", "Austrália", "Emirados Árabes", "Irlanda", "Holanda", "Suíça", "Chile", "Colômbia", "Uruguai"],
  brStates: ["SP", "RJ", "MG", "PR", "SC", "RS", "BA", "PE", "CE", "DF", "GO", "PA", "AM", "MT", "MS", "ES", "MA", "PB", "RN", "AL", "PI", "SE", "TO", "RO", "AC", "AP", "RR"],
  cities: ["São Paulo", "Rio de Janeiro", "Belo Horizonte", "Curitiba", "Porto Alegre", "Florianópolis", "Salvador", "Recife", "Fortaleza", "Brasília", "Goiânia", "Campinas", "Santos", "Ribeirão Preto", "Niterói", "Uberlândia", "Londrina", "Joinville", "Natal", "Manaus", "Belém", "Vitória", "Campo Grande", "Cuiabá", "Aracaju", "Maceió", "Teresina", "São Luís", "New York", "Miami", "Los Angeles", "London", "Lisboa", "Paris", "Dubai", "Toronto", "Madrid", "Berlin", "Buenos Aires", "Santiago"],
};

const SOURCES = [
  { id: "apollo_search", label: "Apollo.io", icon: "🚀", desc: "275M+ contatos com email e telefone verificados", default: true },
  { id: "google_maps", label: "Google Maps", icon: "📍", desc: "Profissionais com telefone, endereço e website", default: true },
  { id: "crustdata_search", label: "CrustData", icon: "🔮", desc: "LinkedIn profiles com foto e cargo", default: true },
  { id: "tavily_search", label: "Web (Tavily)", icon: "🌐", desc: "Sites, diretórios, contatos em páginas", default: true },
  { id: "apify_instagram", label: "Instagram", icon: "📸", desc: "Perfis de profissionais", default: false },
  { id: "pdl_search", label: "People Data Labs", icon: "📊", desc: "Perfis verificados globais", default: false },
  { id: "apify_linkedin_search", label: "LinkedIn Search", icon: "💼", desc: "Busca por cargo", default: false },
  { id: "apify_twitter", label: "Twitter/X", icon: "🐦", desc: "Autores de tweets", default: false },
  { id: "apify_tiktok", label: "TikTok", icon: "🎵", desc: "Criadores de conteúdo", default: false },
];

// ─── Components ───

function SmartInput({ value, onChange, suggestions, placeholder, className }: {
  value: string; onChange: (v: string) => void; suggestions: string[]; placeholder: string; className?: string;
}) {
  const [focused, setFocused] = useState(false);
  const filtered = useMemo(() => {
    if (!value.trim()) return suggestions.slice(0, 6);
    return suggestions.filter(s => s.toLowerCase().includes(value.toLowerCase())).slice(0, 8);
  }, [value, suggestions]);
  return (
    <div className="relative">
      <Input value={value} onChange={e => onChange(e.target.value)}
        onFocus={() => setFocused(true)} onBlur={() => setTimeout(() => setFocused(false), 200)}
        placeholder={placeholder} className={className || "h-10"} />
      {focused && filtered.length > 0 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border rounded-lg shadow-lg max-h-48 overflow-auto">
          {filtered.map(s => (
            <div key={s} className="px-3 py-2 text-sm hover:bg-muted cursor-pointer"
              onMouseDown={e => { e.preventDefault(); onChange(s); setFocused(false); }}>{s}</div>
          ))}
        </div>
      )}
    </div>
  );
}

function TagInput({ value, onChange, placeholder, suggestions }: { value: string[]; onChange: (v: string[]) => void; placeholder: string; suggestions?: string[] }) {
  const [input, setInput] = useState("");
  const [focused, setFocused] = useState(false);
  const add = (v?: string) => { const val = (v || input).trim(); if (val && !value.includes(val)) { onChange([...value, val]); setInput(""); } };
  const filtered = useMemo(() => {
    if (!suggestions || !input.trim()) return [];
    return suggestions.filter(s => s.toLowerCase().includes(input.toLowerCase()) && !value.includes(s)).slice(0, 6);
  }, [input, suggestions, value]);

  return (
    <div>
      <div className="relative">
        <div className="flex gap-1.5">
          <Input value={input} onChange={e => setInput(e.target.value)}
            onFocus={() => setFocused(true)} onBlur={() => setTimeout(() => setFocused(false), 200)}
            onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
            placeholder={placeholder} className="h-8 text-xs" />
          <Button type="button" variant="outline" size="sm" className="h-8 px-2 shrink-0" onClick={() => add()} disabled={!input.trim()}><Plus className="h-3 w-3" /></Button>
        </div>
        {focused && filtered.length > 0 && (
          <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border rounded-lg shadow-lg max-h-36 overflow-auto">
            {filtered.map(s => (
              <div key={s} className="px-3 py-1.5 text-xs hover:bg-muted cursor-pointer"
                onMouseDown={e => { e.preventDefault(); add(s); setFocused(false); }}>{s}</div>
            ))}
          </div>
        )}
      </div>
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1.5">
          {value.map(t => <Badge key={t} variant="secondary" className="gap-1 cursor-pointer text-[10px] hover:bg-destructive/10" onClick={() => onChange(value.filter(v => v !== t))}>{t}<X className="h-2 w-2" /></Badge>)}
        </div>
      )}
    </div>
  );
}

function Chip({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) {
  return (
    <Badge variant={selected ? "default" : "outline"}
      className={`cursor-pointer text-[11px] px-2.5 py-1 transition-all ${selected ? "bg-primary text-primary-foreground hover:bg-primary/90" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"}`}
      onClick={onClick}>{label}</Badge>
  );
}

function Section({ title, icon: Icon, desc, children, defaultOpen = true }: { title: string; icon: any; desc?: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/20 transition-colors pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Icon className="h-4 w-4 text-primary" />
                <CardTitle className="text-sm">{title}</CardTitle>
                {desc && <span className="text-[10px] text-muted-foreground hidden sm:inline">— {desc}</span>}
              </div>
              <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent><CardContent className="pt-0 pb-4">{children}</CardContent></CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

// ─── Audience Builder ───

function AudienceBuilder() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { data: lists = [] } = useContactLists();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Persona
  const [professions, setProfessions] = useState<string[]>([]);
  const [specialties, setSpecialties] = useState<string[]>([]);
  const [seniority, setSeniority] = useState<Set<string>>(new Set());
  const [yearsExp, setYearsExp] = useState("any");
  const [companySize, setCompanySize] = useState<Set<string>>(new Set());
  const [education, setEducation] = useState<Set<string>>(new Set());
  const [certifications, setCertifications] = useState<string[]>([]);

  // Location
  const [country, setCountry] = useState("Brasil");
  const [state, setState] = useState("");
  const [cities, setCities] = useState<string[]>([]);

  // Interests
  const [selectedInterests, setSelectedInterests] = useState<Set<string>>(new Set());
  const [customInterests, setCustomInterests] = useState<string[]>([]);
  const [selectedIndustries, setSelectedIndustries] = useState<Set<string>>(new Set());

  // Demographics
  const [gender, setGender] = useState("");
  const [ageRange, setAgeRange] = useState("");
  const [language, setLanguage] = useState("");

  // Refinement
  const [keywords, setKeywords] = useState<string[]>([]);
  const [excludeKeywords, setExcludeKeywords] = useState<string[]>([]);
  const [freeformDesc, setFreeformDesc] = useState("");

  // Social presence
  const [requireInstagram, setRequireInstagram] = useState(false);
  const [requireLinkedin, setRequireLinkedin] = useState(false);
  const [minFollowers, setMinFollowers] = useState("");
  const [contentCreator, setContentCreator] = useState(false);

  // Contact preferences
  const [requirePhone, setRequirePhone] = useState(false);
  const [requireEmail, setRequireEmail] = useState(false);

  // Sources & Output
  const [selectedSources, setSelectedSources] = useState<Set<string>>(new Set(SOURCES.filter(s => s.default).map(s => s.id)));
  const [volume, setVolume] = useState("25");
  const [autoEnrich, setAutoEnrich] = useState(true);
  const [targetListId, setTargetListId] = useState("");

  const allInterests = [...selectedInterests, ...customInterests];
  const availableSpecialties = [...new Set(professions.flatMap(p => SPECIALTIES_MAP[p] || []))];

  const toggleSet = (set: Set<string>, val: string, setter: (s: Set<string>) => void) => {
    const next = new Set(set); next.has(val) ? next.delete(val) : next.add(val); setter(next);
  };

  const filterCount = professions.length + specialties.length + seniority.size + (yearsExp ? 1 : 0) + companySize.size + education.size + certifications.length + cities.length + (state ? 1 : 0) + allInterests.length + selectedIndustries.size + (gender && gender !== "any" ? 1 : 0) + (ageRange && ageRange !== "any" ? 1 : 0) + keywords.length + (requirePhone ? 1 : 0) + (requireEmail ? 1 : 0) + (requireInstagram ? 1 : 0) + (requireLinkedin ? 1 : 0) + (contentCreator ? 1 : 0) + (freeformDesc ? 1 : 0);

  const handleSearch = async () => {
    if (professions.length === 0 && allInterests.length === 0 && keywords.length === 0 && !freeformDesc) {
      toast({ title: "Defina ao menos um critério de busca", variant: "destructive" }); return;
    }
    setIsSubmitting(true);

    const nameParts = [professions.join(", "), cities.join(", ") || state || (country !== "Brasil" ? country : "")].filter(Boolean);
    if (allInterests.length > 0) nameParts.push(allInterests.slice(0, 2).join(", "));
    const name = nameParts.join(" — ") || "Busca Personalizada";

    const locations = [...cities, state, country].filter(Boolean);

    const config: any = {
      persona: {
        professions,
        titles: professions,
        specialties,
        interests: allInterests,
        keywords: [...keywords, ...certifications],
        exclude_keywords: excludeKeywords,
        industries: [...selectedIndustries],
        seniority: [...seniority],
        company_size: [...companySize],
        education: [...education],
        certifications,
        freeform_description: freeformDesc,
      },
      location: { person_locations: locations },
      demographics: {
        gender: gender && gender !== "any" ? gender : undefined,
        age_range: ageRange && ageRange !== "any" ? ageRange : undefined,
        language: language && language !== "any" ? language : undefined,
      },
      social: {
        require_instagram: requireInstagram,
        require_linkedin: requireLinkedin,
        min_followers: minFollowers ? parseInt(minFollowers) : undefined,
        content_creator: contentCreator,
      },
      contact_requirements: {
        require_phone: requirePhone,
        require_email: requireEmail,
      },
      volume: { per_page: parseInt(volume) || 25 },
      enrichment: { auto_enrich: autoEnrich },
    };
    if (yearsExp) config.persona.years_experience = yearsExp;

    try {
      let listId = targetListId && targetListId !== "none" ? targetListId : null;
      if (!listId) {
        const desc = [professions.join(", "), specialties.join(", "), locations.join(", "), allInterests.join(", ")].filter(Boolean).join(" · ");
        const { data: newList, error } = await supabase.from("contact_lists").insert({ name, description: desc || "Prospecção" }).select().single();
        if (error) throw error;
        listId = newList.id;
        queryClient.invalidateQueries({ queryKey: ["contact_lists"] });
      }

      for (const source of Array.from(selectedSources)) {
        const { data: search, error } = await supabase.from("lead_searches").insert({
          name: `${name} [${SOURCES.find(s => s.id === source)?.label || source}]`,
          source, config, status: "pending", target_list_id: listId,
        }).select().single();
        if (error) throw error;
        supabase.functions.invoke("lead-search-execute", { body: { searchId: search.id } }).then(() => {
          queryClient.invalidateQueries({ queryKey: ["lead_searches", "contacts", "contact_lists"] });
        });
      }

      toast({ title: "Buscando!", description: `${selectedSources.size} fontes em paralelo` });
      navigate(`/lists/${listId}`);
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* 1. PROFISSÃO */}
      <Section title="Profissão & Cargo" icon={Briefcase} desc="Quem você procura?">
        <div className="space-y-4">
          <TagInput value={professions} onChange={setProfessions} suggestions={PROFESSIONS} placeholder="Digite ou selecione profissões..." />
          {professions.length === 0 && (
            <div className="flex flex-wrap gap-1.5">
              {["Dentista", "Personal Trainer", "Advogado", "Nutricionista", "Coach", "Fotógrafo", "CEO", "Designer", "Médico", "Psicólogo"].map(j => (
                <Chip key={j} label={j} selected={false} onClick={() => setProfessions(prev => [...prev, j])} />
              ))}
            </div>
          )}

          {availableSpecialties.length > 0 && (
            <>
              <Separator />
              <div>
                <Label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5 block">Especialidade / Sub-área</Label>
                <div className="flex flex-wrap gap-1.5">
                  {availableSpecialties.map(s => (
                    <Chip key={s} label={s} selected={specialties.includes(s)} onClick={() => setSpecialties(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s])} />
                  ))}
                </div>
              </div>
            </>
          )}

          <Separator />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5 block">Nível de Senioridade</Label>
              <div className="flex flex-wrap gap-1.5">
                {SENIORITY_LEVELS.map(s => <Chip key={s} label={s} selected={seniority.has(s)} onClick={() => toggleSet(seniority, s, setSeniority)} />)}
              </div>
            </div>
            <div>
              <Label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5 block">Anos de Experiência</Label>
              <Select value={yearsExp} onValueChange={setYearsExp}>
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Qualquer" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Qualquer</SelectItem>
                  <SelectItem value="0-2">0-2 anos</SelectItem>
                  <SelectItem value="3-5">3-5 anos</SelectItem>
                  <SelectItem value="5-10">5-10 anos</SelectItem>
                  <SelectItem value="10+">10+ anos</SelectItem>
                  <SelectItem value="20+">20+ anos</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </Section>

      {/* 2. EMPRESA */}
      <Section title="Empresa & Setor" icon={Building2} desc="Onde trabalham?" defaultOpen={false}>
        <div className="space-y-4">
          <div>
            <Label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5 block">Setor de Atuação</Label>
            <div className="flex flex-wrap gap-1.5">
              {INDUSTRIES.map(i => <Chip key={i} label={i} selected={selectedIndustries.has(i)} onClick={() => toggleSet(selectedIndustries, i, setSelectedIndustries)} />)}
            </div>
          </div>
          <div>
            <Label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5 block">Tamanho da Empresa</Label>
            <div className="flex flex-wrap gap-1.5">
              {COMPANY_SIZES.map(s => <Chip key={s} label={s} selected={companySize.has(s)} onClick={() => toggleSet(companySize, s, setCompanySize)} />)}
            </div>
          </div>
        </div>
      </Section>

      {/* 3. LOCALIZAÇÃO */}
      <Section title="Localização" icon={MapPin} desc="Onde estão?">
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">País</Label>
              <SmartInput value={country} onChange={setCountry} suggestions={LOCATIONS.countries} placeholder="Brasil" className="h-9 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">Estado</Label>
              <SmartInput value={state} onChange={setState} suggestions={LOCATIONS.brStates} placeholder="SP, RJ..." className="h-9 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">Cidades</Label>
              <TagInput value={cities} onChange={setCities} suggestions={LOCATIONS.cities} placeholder="Adicionar cidade..." />
            </div>
          </div>
        </div>
      </Section>

      {/* 4. INTERESSES */}
      <Section title="Interesses & Hobbies" icon={Heart} desc="O que curtem?" defaultOpen={false}>
        <div className="space-y-3">
          {INTEREST_CATEGORIES.map(cat => (
            <div key={cat.cat}>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">{cat.cat}</p>
              <div className="flex flex-wrap gap-1.5">
                {cat.items.map(item => <Chip key={item} label={item} selected={selectedInterests.has(item)} onClick={() => toggleSet(selectedInterests, item, setSelectedInterests)} />)}
              </div>
            </div>
          ))}
          <Separator />
          <TagInput value={customInterests} onChange={setCustomInterests} placeholder="Interesse personalizado..." />
        </div>
      </Section>

      {/* 5. FORMAÇÃO */}
      <Section title="Formação & Certificações" icon={GraduationCap} desc="Escolaridade e qualificações" defaultOpen={false}>
        <div className="space-y-4">
          <div>
            <Label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5 block">Nível de Formação</Label>
            <div className="flex flex-wrap gap-1.5">
              {EDUCATION_LEVELS.map(e => <Chip key={e} label={e} selected={education.has(e)} onClick={() => toggleSet(education, e, setEducation)} />)}
            </div>
          </div>
          <div>
            <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">Certificações / Cursos específicos</Label>
            <TagInput value={certifications} onChange={setCertifications} placeholder="Ex: CRO, OAB, CREF, PMP, AWS..." />
          </div>
        </div>
      </Section>

      {/* 6. DEMOGRAFIA */}
      <Section title="Demografia" icon={Users} desc="Perfil demográfico" defaultOpen={false}>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">Gênero</Label>
            <Select value={gender} onValueChange={setGender}>
              <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Qualquer" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Qualquer</SelectItem>
                <SelectItem value="male">Masculino</SelectItem>
                <SelectItem value="female">Feminino</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">Faixa Etária</Label>
            <Select value={ageRange} onValueChange={setAgeRange}>
              <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Qualquer" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Qualquer</SelectItem>
                <SelectItem value="18-24">18-24</SelectItem>
                <SelectItem value="25-34">25-34</SelectItem>
                <SelectItem value="35-44">35-44</SelectItem>
                <SelectItem value="45-54">45-54</SelectItem>
                <SelectItem value="55+">55+</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">Idioma</Label>
            <Select value={language} onValueChange={setLanguage}>
              <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Qualquer" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Qualquer</SelectItem>
                <SelectItem value="pt">Português</SelectItem>
                <SelectItem value="en">Inglês</SelectItem>
                <SelectItem value="es">Espanhol</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </Section>

      {/* 7. PRESENÇA DIGITAL */}
      <Section title="Presença Digital" icon={Share2} desc="Redes sociais e comportamento online" defaultOpen={false}>
        <div className="space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <label className="flex items-center gap-2 cursor-pointer p-2 rounded-lg border hover:bg-muted/30 transition-colors">
              <Checkbox checked={requireInstagram} onCheckedChange={(v) => setRequireInstagram(!!v)} />
              <span className="text-xs">Tem Instagram</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer p-2 rounded-lg border hover:bg-muted/30 transition-colors">
              <Checkbox checked={requireLinkedin} onCheckedChange={(v) => setRequireLinkedin(!!v)} />
              <span className="text-xs">Tem LinkedIn</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer p-2 rounded-lg border hover:bg-muted/30 transition-colors">
              <Checkbox checked={contentCreator} onCheckedChange={(v) => setContentCreator(!!v)} />
              <span className="text-xs">Criador de conteúdo</span>
            </label>
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">Seguidores mín.</Label>
              <Input value={minFollowers} onChange={e => setMinFollowers(e.target.value)} placeholder="0" className="h-8 text-xs" type="number" />
            </div>
          </div>
        </div>
      </Section>

      {/* 8. CONTATO DESEJADO */}
      <Section title="Tipo de Contato Desejado" icon={MessageSquare} desc="O que você precisa ter para abordar" defaultOpen={false}>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <label className="flex items-center gap-2 cursor-pointer p-2.5 rounded-lg border hover:bg-muted/30 transition-colors">
            <Checkbox checked={requirePhone} onCheckedChange={(v) => setRequirePhone(!!v)} />
            <span className="text-xs">Precisa ter Telefone</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer p-2.5 rounded-lg border hover:bg-muted/30 transition-colors">
            <Checkbox checked={requireEmail} onCheckedChange={(v) => setRequireEmail(!!v)} />
            <span className="text-xs">Precisa ter Email</span>
          </label>
        </div>
      </Section>

      {/* 9. REFINAMENTO */}
      <Section title="Refinamento & Exclusões" icon={Filter} desc="Palavras-chave e descrição livre" defaultOpen={false}>
        <div className="space-y-4">
          <div>
            <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">Incluir palavras-chave no perfil</Label>
            <TagInput value={keywords} onChange={setKeywords} placeholder="Ex: vegano, atleta, premium, verificado..." />
          </div>
          <div>
            <Label className="text-[10px] text-muted-foreground uppercase tracking-wider flex items-center gap-1"><Ban className="h-3 w-3" /> Excluir</Label>
            <TagInput value={excludeKeywords} onChange={setExcludeKeywords} placeholder="Ex: loja, empresa, bot, spam..." />
          </div>
          <Separator />
          <div>
            <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">Descrição livre do público (para busca IA)</Label>
            <Textarea value={freeformDesc} onChange={e => setFreeformDesc(e.target.value)} rows={3}
              placeholder="Descreva em palavras o perfil ideal. Ex: 'Homens de 25-35 anos que praticam beach tennis em Florianópolis e são donos de academia ou personal trainers com presença ativa no Instagram'" className="text-sm mt-1" />
            <p className="text-[10px] text-muted-foreground mt-1">Essa descrição será usada para refinar a busca via IA (Tavily e CrustData)</p>
          </div>
        </div>
      </Section>

      {/* 10. FONTES & OPÇÕES */}
      <Section title="Fontes & Opções de Busca" icon={Globe}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {SOURCES.map(s => (
              <div key={s.id} onClick={() => toggleSet(selectedSources, s.id, setSelectedSources)}
                className={`flex flex-col items-center gap-1 p-2.5 rounded-lg border cursor-pointer transition-all text-center ${selectedSources.has(s.id) ? "border-primary/50 bg-primary/5" : "border-border hover:bg-muted/30"}`}>
                <span className="text-lg">{s.icon}</span>
                <p className="text-[10px] font-medium leading-tight">{s.label}</p>
                <p className="text-[8px] text-muted-foreground leading-tight">{s.desc}</p>
              </div>
            ))}
          </div>
          <Separator />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">Volume / fonte</Label>
              <Select value={volume} onValueChange={setVolume}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10 resultados</SelectItem>
                  <SelectItem value="25">25 resultados</SelectItem>
                  <SelectItem value="50">50 resultados</SelectItem>
                  <SelectItem value="100">100 resultados</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">Lista destino</Label>
              <Select value={targetListId} onValueChange={setTargetListId}>
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Nova lista" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Criar nova</SelectItem>
                  {lists.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end pb-0.5">
              <label className="flex items-center gap-2 cursor-pointer">
                <Switch checked={autoEnrich} onCheckedChange={setAutoEnrich} />
                <span className="text-xs">Auto-enriquecer com LinkedIn</span>
                <Sparkles className="h-3.5 w-3.5 text-primary" />
              </label>
            </div>
          </div>
        </div>
      </Section>

      {/* SUBMIT */}
      <div className="sticky bottom-4 bg-card rounded-xl p-4 border shadow-lg">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1">
              {professions.map(p => <Badge key={p} className="text-[10px]">{p}</Badge>)}
              {specialties.slice(0, 2).map(s => <Badge key={s} variant="secondary" className="text-[10px]">{s}</Badge>)}
              {allInterests.slice(0, 2).map(i => <Badge key={i} variant="outline" className="text-[10px]">{i}</Badge>)}
              {cities.slice(0, 2).map(c => <Badge key={c} variant="outline" className="text-[10px]">📍{c}</Badge>)}
              {!cities.length && state && <Badge variant="outline" className="text-[10px]">📍{state}</Badge>}
              {country !== "Brasil" && <Badge variant="outline" className="text-[10px]">🌍{country}</Badge>}
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">
              {filterCount} filtro{filterCount !== 1 ? "s" : ""} · {selectedSources.size} fonte{selectedSources.size !== 1 ? "s" : ""} · {volume}/fonte
              {autoEnrich ? " · auto-enrich LinkedIn" : ""}
            </p>
          </div>
          <Button onClick={handleSearch} size="lg" disabled={isSubmitting || (professions.length === 0 && allInterests.length === 0 && keywords.length === 0 && !freeformDesc)} className="gap-2 shrink-0">
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            Buscar Público
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Page ───

export default function SearchPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Nova Busca</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Busca rápida por IA ou configure cada detalhe do seu público</p>
      </div>
      <Tabs defaultValue="audience" className="space-y-4">
        <TabsList>
          <TabsTrigger value="ai" className="gap-1.5"><Bot className="h-4 w-4" /> Busca Rápida (IA)</TabsTrigger>
          <TabsTrigger value="audience" className="gap-1.5"><SlidersHorizontal className="h-4 w-4" /> Público-Alvo Detalhado</TabsTrigger>
        </TabsList>
        <TabsContent value="ai"><SearchChat /></TabsContent>
        <TabsContent value="audience"><AudienceBuilder /></TabsContent>
      </Tabs>
    </div>
  );
}
