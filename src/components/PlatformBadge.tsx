import { Badge } from "@/components/ui/badge";
import { Linkedin, Instagram } from "lucide-react";
import type { LeadPlatform, LeadSource } from "@/lib/types";

export function PlatformBadge({ platform, linkedinUrl, instagramHandle }: { platform: LeadPlatform; linkedinUrl?: string; instagramHandle?: string }) {
  const linkedinBadge = (
    <Badge variant="outline" className="gap-1 border-primary/30 text-primary text-[10px]">
      <Linkedin className="h-3 w-3" /> LinkedIn
    </Badge>
  );
  const instagramBadge = (
    <Badge variant="outline" className="gap-1 border-pink-400/30 text-pink-500 text-[10px]">
      <Instagram className="h-3 w-3" /> Instagram
    </Badge>
  );

  const wrapLink = (badge: React.ReactNode, url?: string) =>
    url ? <a href={url} target="_blank" rel="noopener noreferrer" className="hover:opacity-80 transition-opacity">{badge}</a> : badge;

  const instagramUrl = instagramHandle ? `https://instagram.com/${instagramHandle.replace(/^@/, "")}` : undefined;

  if (platform === "linkedin") return <>{wrapLink(linkedinBadge, linkedinUrl)}</>;
  if (platform === "instagram") return <>{wrapLink(instagramBadge, instagramUrl)}</>;
  return (
    <div className="flex gap-1">
      {wrapLink(<Badge variant="outline" className="gap-1 border-primary/30 text-primary text-[10px]"><Linkedin className="h-3 w-3" /></Badge>, linkedinUrl)}
      {wrapLink(<Badge variant="outline" className="gap-1 border-pink-400/30 text-pink-500 text-[10px]"><Instagram className="h-3 w-3" /></Badge>, instagramUrl)}
    </div>
  );
}

export function SourceBadge({ source }: { source: LeadSource }) {
  const styles: Record<LeadSource, string> = {
    all: "bg-gradient-to-r from-primary/10 to-accent/10 text-primary border-primary/20",
    // Brave & PDL
    apollo_search: "bg-purple-600/10 text-purple-600 border-purple-600/20",
    google_maps: "bg-green-600/10 text-green-600 border-green-600/20",
    crustdata_search: "bg-indigo-500/10 text-indigo-500 border-indigo-500/20",
    tavily_search: "bg-orange-500/10 text-orange-500 border-orange-500/20",
    pdl_search: "bg-violet-500/10 text-violet-500 border-violet-500/20",
    // Instagram
    apify_instagram: "bg-pink-500/10 text-pink-500 border-pink-500/20",
    apify_instagram_profiles: "bg-pink-500/10 text-pink-500 border-pink-500/20",
    apify_instagram_comments: "bg-pink-300/10 text-pink-300 border-pink-300/20",
    apify_instagram_followers: "bg-pink-600/10 text-pink-600 border-pink-600/20",
    apify_instagram_hashtags: "bg-pink-400/10 text-pink-400 border-pink-400/20",
    // Google
    apify_google_reviews: "bg-green-500/10 text-green-500 border-green-500/20",
    apify_google_search: "bg-green-400/10 text-green-400 border-green-400/20",
    // LinkedIn
    apify_linkedin: "bg-blue-700/10 text-blue-700 border-blue-700/20",
    apify_linkedin_search: "bg-blue-600/10 text-blue-600 border-blue-600/20",
    // Facebook
    facebook_discovery: "bg-blue-600/10 text-blue-600 border-blue-600/20",
    apify_facebook_groups: "bg-blue-500/10 text-blue-500 border-blue-500/20",
    apify_facebook_comments: "bg-blue-400/10 text-blue-400 border-blue-400/20",
    // Twitter
    apify_twitter: "bg-sky-500/10 text-sky-500 border-sky-500/20",
    // TikTok
    apify_tiktok: "bg-fuchsia-500/10 text-fuchsia-500 border-fuchsia-500/20",
    // YouTube
    apify_youtube_comments: "bg-red-500/10 text-red-500 border-red-500/20",
    // TripAdvisor
    apify_tripadvisor_reviews: "bg-lime-500/10 text-lime-500 border-lime-500/20",
    // Contact
    apify_contact_scraper: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
  };
  const labels: Record<LeadSource, string> = {
    all: "Todas",
    apollo_search: "Apollo",
    google_maps: "Google Maps",
    crustdata_search: "CrustData",
    tavily_search: "Tavily Search",
    pdl_search: "People Data Labs",
    apify_instagram: "Instagram",
    apify_instagram_profiles: "IG Perfis",
    apify_instagram_comments: "IG Comentários",
    apify_instagram_followers: "IG Seguidores",
    apify_instagram_hashtags: "IG Hashtags",
    apify_google_reviews: "Google Reviews",
    apify_google_search: "Google Search",
    apify_linkedin: "LinkedIn",
    apify_linkedin_search: "LinkedIn Busca",
    facebook_discovery: "Facebook Discovery",
    apify_facebook_groups: "FB Grupos",
    apify_facebook_comments: "FB Comentários",
    apify_twitter: "Twitter/X",
    apify_tiktok: "TikTok",
    apify_youtube_comments: "YT Comentários",
    apify_tripadvisor_reviews: "TripAdvisor",
    apify_contact_scraper: "Contact Scraper",
  };
  return <Badge variant="outline" className={`text-[10px] ${styles[source]}`}>{labels[source]}</Badge>;
}

export function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    novo: "bg-primary/10 text-primary border-primary/20",
    contatado: "bg-warning/10 text-warning border-warning/20",
    qualificado: "bg-accent/10 text-accent border-accent/20",
    descartado: "bg-destructive/10 text-destructive border-destructive/20",
    pending: "bg-muted text-muted-foreground",
    running: "bg-primary/10 text-primary border-primary/20 animate-pulse-soft",
    completed: "bg-accent/10 text-accent border-accent/20",
    failed: "bg-destructive/10 text-destructive border-destructive/20",
  };
  return (
    <Badge variant="outline" className={`text-[10px] capitalize ${styles[status] || ""}`}>
      {status}
    </Badge>
  );
}
