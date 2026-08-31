export type LeadPlatform = "linkedin" | "instagram" | "both";
export type LeadSource =
  // Search engines
  | "apollo_search"
  | "google_maps"
  | "crustdata_search"
  | "tavily_search"
  // People Data Labs
  | "pdl_search"
  // Instagram (pessoas)
  | "apify_instagram" | "apify_instagram_profiles" | "apify_instagram_comments" | "apify_instagram_followers" | "apify_instagram_hashtags"
  // Google (avaliadores = pessoas)
  | "apify_google_reviews" | "apify_google_search"
  // LinkedIn (profissionais)
  | "apify_linkedin" | "apify_linkedin_search"
  // Facebook
  | "facebook_discovery" | "apify_facebook_groups" | "apify_facebook_comments"
  // Twitter/X (autores)
  | "apify_twitter"
  // TikTok (criadores)
  | "apify_tiktok"
  // YouTube (comentaristas)
  | "apify_youtube_comments"
  // TripAdvisor (avaliadores)
  | "apify_tripadvisor_reviews"
  // Contato/Email
  | "apify_contact_scraper"
  // All
  | "all";
export type SearchStatus = "pending" | "running" | "completed" | "failed";
export type ContactStatus = "novo" | "contatado" | "qualificado" | "descartado";

export type MessageDirection = "inbound" | "outbound";
export type MessageChannel = "whatsapp" | "email" | "instagram_dm";
export type MessageStatus = "pending" | "sent" | "delivered" | "read" | "failed";

export interface OutreachMessage {
  id: string;
  contact_id: string | null;
  channel: MessageChannel;
  direction: MessageDirection;
  message_text: string;
  status: MessageStatus;
  provider: string | null;
  provider_message_id: string | null;
  metadata: Record<string, any>;
  sent_at: string;
  created_at: string;
  contact?: Pick<Contact, "name" | "phone" | "email" | "company">;
}

export interface Contact {
  id: string;
  name: string;
  phone: string;
  email: string;
  company: string;
  title: string;
  city: string;
  linkedin_url: string;
  instagram: string;
  platform: LeadPlatform;
  source: LeadSource;
  status: ContactStatus;
  score: number;
  tags: string[];
  list_id: string | null;
  custom_fields: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface LeadSearch {
  id: string;
  name: string;
  source: LeadSource;
  status: SearchStatus;
  config: Record<string, any>;
  contacts_found: number;
  contacts_new: number;
  source_reports?: SourceReport[];
  target_list_id: string | null;
  started_at: string | null;
  completed_at: string | null;
  duration_ms: number | null;
  created_at: string;
}

export interface SourceReport {
  source: string;
  found: number;
  error: string | null;
}

export interface ContactList {
  id: string;
  name: string;
  description: string;
  contacts_count: number;
  created_at: string;
}

export interface SearchFilters {
  industry: string[];
  titles: string[];
  seniority: string[];
  location: string[];
  companySize: string[];
  platform: LeadPlatform | "all";
  source: LeadSource | "all";
}
