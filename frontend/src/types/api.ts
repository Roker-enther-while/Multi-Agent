export type ServiceMap = Record<string, string>;

export type HealthResponse = {
  status: string;
  services: ServiceMap;
};

export type QueryPlan = {
  intent: string;
  query_language: string;
  target_modalities: string[];
  visual_query: string;
  text_query: string;
  ocr_query: string;
  audio_query: string;
  object_filters: string[];
  temporal_constraints: Record<string, unknown>[];
  metadata_filters: Record<string, unknown>;
  search_strategy: string;
  confidence: number;
};

export type MatchedEvidence = {
  caption: string;
  ocr: string;
  transcript: string;
  objects: unknown[];
  audio_events: unknown[];
  text: string;
};

export type ValidationChecks = {
  visual_condition_met: boolean;
  ocr_condition_met: boolean;
  audio_condition_met: boolean;
  text_condition_met: boolean;
  temporal_condition_met: boolean;
};

export type ValidationResult = {
  checks: ValidationChecks;
  missing: string[];
  validation_score: number;
};

export type SearchResult = {
  asset_id: string;
  segment_id: string;
  source_type: string;
  timestamp_start: number | null;
  timestamp_end: number | null;
  preview_image: string | null;
  score: number;
  component_scores: Record<string, number>;
  matched_evidence: MatchedEvidence;
  validation: ValidationResult;
  explanation: string;
};

export type SearchRequest = {
  query: string;
  mode: "interactive";
  top_k: number;
  filters?: {
    asset_type?: string[];
  };
};

export type SearchResponse = {
  search_id: string;
  parsed_query: QueryPlan;
  results: SearchResult[];
  latency_ms: number;
};

export type AutoSearchRequest = {
  query_id: string;
  query: string;
  top_k: number;
  return_format: "challenge_json";
  speed_mode: "fast" | "balanced" | "accurate";
};

export type AutoAnswer = {
  rank: number;
  asset_id: string;
  segment_id: string;
  timestamp_start: number | null;
  timestamp_end: number | null;
  score: number;
  evidence: {
    frame?: string;
    caption?: string;
    transcript?: string;
    ocr?: string;
    text?: string;
  };
};

export type AutoSearchResponse = {
  query_id: string;
  answers: AutoAnswer[];
  latency_ms: number;
};

export type Asset = {
  asset_id: string;
  asset_type: string;
  original_path: string;
  media_path: string | null;
  duration_seconds: number | null;
  width: number | null;
  height: number | null;
  fps: number | null;
  language_hint: string | null;
  source: string | null;
  created_at: string;
};

export type AssetListResponse = {
  items: Asset[];
  limit: number;
  offset: number;
};
