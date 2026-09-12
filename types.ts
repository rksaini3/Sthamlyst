export type AuditStatus = 'pending' | 'processing' | 'complete' | 'failed';
export type AiSource = 'openai' | 'anthropic' | 'perplexity' | 'gemini';
export type Sentiment = 'positive' | 'neutral' | 'negative';
export type FixType = 'schema_markup' | 'faq_section' | 'meta_tags';
export type OptimizationStatus = 'pending' | 'applied' | 'failed';
export type PaymentStatus = 'unpaid' | 'paid';
export type Plan = 'free' | 'pro';

export interface Profile {
  id: string;
  full_name: string | null;
  brand_name: string | null;
  website_url: string | null;
  plan: Plan;
  created_at: string;
}

export interface Audit {
  id: string;
  user_id: string | null;
  website_url: string | null;
  brand_name: string;
  target_city: string;
  has_website: boolean;
  status: AuditStatus;
  visibility_score: number | null;
  local_visibility_score: number | null;
  created_at: string;
  completed_at: string | null;
}

export interface AiMention {
  id: string;
  audit_id: string;
  source: AiSource;
  mentioned: boolean;
  sentiment: Sentiment | null;
  citation_url: string | null;
  is_local: boolean;
  raw_response: string | null;
  created_at: string;
}

export interface GoogleAiOverviewResult {
  id: string;
  audit_id: string;
  query: string;
  appears_in_overview: boolean;
  ranked_position: number | null;
  competitor_urls: string[] | null;
  created_at: string;
}

export interface WordpressConnection {
  id: string;
  user_id: string;
  site_url: string;
  wp_username: string;
  wp_app_password: string;
  connected_at: string;
  last_used_at: string | null;
}

export interface Optimization {
  id: string;
  audit_id: string;
  wordpress_connection_id: string | null;
  fix_type: FixType;
  status: OptimizationStatus;
  payment_status: PaymentStatus;
  applied_at: string | null;
  created_at: string;
}

export interface AuditReport extends Audit {
  ai_mentions: AiMention[];
  google_results: GoogleAiOverviewResult[];
}