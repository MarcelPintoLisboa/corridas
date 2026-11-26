/** athlete = corredor | admin = organiza as corridas e gerencia tudo */
export type UserRole = 'athlete' | 'admin';
export type RunnerLevel = 'beginner' | 'intermediate' | 'advanced';
export type SessionType = 'easy' | 'long' | 'tempo' | 'interval' | 'fartlek' | 'recovery' | 'strength' | 'rest' | 'race';
export type TipCategory = 'training' | 'nutrition' | 'hydration' | 'recovery' | 'mindset' | 'race_day';
export type SponsorTier = 'master' | 'gold' | 'silver' | 'support';
export type PostType = 'news' | 'alert' | 'promo' | 'schedule';
export type LeadStatus = 'new' | 'contacted' | 'qualified' | 'converted' | 'lost';
export type LeadSource = 'app' | 'instagram' | 'sponsor' | 'landing' | 'referral' | 'event' | 'import';

/** Linha de st_usuarios (controle de acesso) */
export interface Profile {
  id: string;
  user_id: string | null;
  ativo: boolean;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  avatar_url: string | null;
  birth_date: string | null;
  gender: string | null;
  city: string | null;
  instagram: string | null;
  role: UserRole;
  /** cadastrado com senha provisória: precisa criar a própria senha no 1º acesso */
  trocar_senha?: boolean;
}

export interface RaceEvent {
  id: string;
  organizer_id: string | null;
  name: string;
  slug: string | null;
  tagline: string | null;
  description: string | null;
  cover_image_url: string | null;
  logo_url: string | null;
  primary_color: string;
  secondary_color: string;
  event_date: string;
  location_name: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  latitude: number | null;
  longitude: number | null;
  hashtag: string | null;
  instagram_handle: string | null;
  website_url: string | null;
  registration_url: string | null;
  regulation_url: string | null;
  route_map_url: string | null;
  require_order_code: boolean;
  status: 'draft' | 'published' | 'finished' | 'canceled';
}

export interface EventDistance {
  id: string;
  event_id: string;
  label: string;
  distance_km: number;
  start_time: string | null;
  sort_order: number;
}

export interface KitPickup {
  id: string;
  event_id: string;
  location_name: string;
  address: string | null;
  maps_url: string | null;
  starts_at: string;
  ends_at: string;
  required_docs: string | null;
  notes: string | null;
}

export interface Registration {
  id: string;
  event_id: string;
  user_id: string;
  distance_id: string | null;
  bib_number: string | null;
  shirt_size: string | null;
  level: RunnerLevel;
  goal_time_seconds: number | null;
  weekly_runs: number | null;
  kit_picked_up: boolean;
  created_at: string;
  event?: RaceEvent;
  distance?: EventDistance | null;
}

export interface TrainingPlan {
  id: string;
  event_id: string;
  distance_id: string | null;
  level: RunnerLevel;
  name: string;
  description: string | null;
  coach_name: string | null;
  coach_avatar_url: string | null;
  weeks: number;
  /** preenchido = plano pessoal (anamnese) deste corredor */
  user_id?: string | null;
}

export interface TrainingSession {
  id: string;
  plan_id: string;
  week: number;
  day_of_week: number;
  title: string;
  type: SessionType;
  distance_km: number | null;
  duration_min: number | null;
  target_pace: string | null;
  description: string | null;
  /** faixa de duração: duration_min – duration_max_min */
  duration_max_min?: number | null;
  warmup?: string | null;
  steps?: SessionStep[] | null;
  treadmill_notes?: string | null;
}

export type StepKind = 'warmup' | 'run' | 'interval' | 'recovery' | 'walk' | 'cooldown' | 'strength';

/** Etapa de uma sessão (configurada pelo gestor) */
export interface SessionStep {
  kind: StepKind;
  title: string;
  distance_km?: number | null;
  duration_min?: number | null;
  /** "5:30" ou "5:30-6:00" (min/km) */
  pace?: string | null;
  repeat?: number | null;
  note?: string | null;
}

export interface Workout {
  id: string;
  user_id: string;
  event_id: string | null;
  session_id: string | null;
  performed_at: string;
  title: string | null;
  distance_km: number;
  duration_seconds: number;
  avg_pace_seconds: number | null;
  elevation_m: number | null;
  avg_hr: number | null;
  feeling: number | null;
  photo_url: string | null;
  notes: string | null;
  is_race: boolean;
  shared_instagram: boolean;
  /** manual | apple_health | health_connect */
  source?: 'manual' | 'apple_health' | 'health_connect';
  external_id?: string | null;
  max_hr?: number | null;
  calories?: number | null;
}

export interface Tip {
  id: string;
  event_id: string;
  category: TipCategory;
  title: string;
  body: string;
  author_name: string | null;
  author_role: string | null;
  image_url: string | null;
  days_before_race: number | null;
}

export interface Sponsor {
  id: string;
  event_id: string;
  name: string;
  tier: SponsorTier;
  logo_url: string | null;
  banner_url: string | null;
  description: string | null;
  offer_title: string | null;
  coupon_code: string | null;
  website_url: string | null;
  instagram: string | null;
  sort_order: number;
  active: boolean;
  material_url: string | null;
  material_label: string | null;
}

export interface CommunityPost {
  id: string;
  event_id: string;
  user_id: string;
  author_name: string | null;
  author_avatar: string | null;
  body: string | null;
  image_url: string | null;
  workout_id: string | null;
  workout_km: number | null;
  workout_seconds: number | null;
  workout_pace: number | null;
  created_at: string;
}

export interface Post {
  id: string;
  event_id: string;
  type: PostType;
  title: string;
  body: string | null;
  image_url: string | null;
  cta_label: string | null;
  cta_url: string | null;
  pinned: boolean;
  published: boolean;
  published_at: string;
}

export interface Lead {
  id: string;
  event_id: string | null;
  user_id: string | null;
  name: string;
  email: string | null;
  phone: string | null;
  city: string | null;
  source: LeadSource;
  status: LeadStatus;
  interest: string | null;
  score: number;
  consent_marketing: boolean;
  tags: string[];
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface LeadInteraction {
  id: string;
  lead_id: string;
  type: 'note' | 'email' | 'whatsapp' | 'call' | 'status_change';
  content: string | null;
  created_at: string;
}

export interface EventMetrics {
  registrations: number;
  kits_picked_up: number;
  leads_total: number;
  leads_new: number;
  leads_converted: number;
  workouts: number;
  km_total: number;
  instagram_shares: number;
  sponsor_impressions: number;
  sponsor_clicks: number;
  by_distance: { label: string; total: number }[];
}

export interface CommunityComment {
  id: string;
  post_id: string;
  event_id: string;
  user_id: string;
  author_name: string | null;
  author_avatar: string | null;
  body: string;
  created_at: string;
}
