export type ResearchStatus = "pending" | "researching" | "ready" | "failed";

export type Dossier = {
  summary: string;
};

export type Research = {
  id: string;
  company_name: string;
  website: string | null;
  linkedin: string | null;
  notes: string | null;
  dossier: Dossier | null;
  status: ResearchStatus;
  error_message: string | null;
  has_answers: boolean;
  has_insight: boolean;
  has_roadmap: boolean;
  created_at: string;
  updated_at: string;
};

export type SessionStatus =
  | "draft"
  | "in_progress"
  | "completed"
  | "abandoned";

export type Session = {
  id: string;
  research_id: string;
  status: SessionStatus;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type FormAnswer = {
  question_id: string;
  answer_text: string;
  updated_at: string;
};

export type AdoptionLevel = 1 | 2 | 3 | 4 | 5;

export const ADOPTION_LABELS: Record<AdoptionLevel, string> = {
  1: "SIN ADOPCIÓN",
  2: "INICIAL",
  3: "EN DESARROLLO",
  4: "CONSOLIDADO",
  5: "IA-NATIVO",
};

export type OpportunityCategory = "contenido" | "agentes" | "software";

export const OPPORTUNITY_CATEGORY_LABELS: Record<OpportunityCategory, string> = {
  contenido: "Contenido",
  agentes: "Agentes",
  software: "Software con IA",
};

export type InsightOpportunity = {
  category: OpportunityCategory;
  title: string;
  description: string;
};

export type InsightPayload = {
  executive_summary: string;
  pain_point: string;
  ai_adoption: {
    level: AdoptionLevel;
  };
  opportunities: InsightOpportunity[];
};

export type InsightStatus = "generating" | "ready" | "failed";

export type Insight = {
  id: string;
  session_id: string;
  status: InsightStatus;
  payload: InsightPayload | null;
  model: string | null;
  error_text: string | null;
  generated_at: string | null;
  created_at: string;
  updated_at: string;
};

// ---------- Roadmap ----------

export type RoadmapStatus = "generating" | "ready" | "failed";

// El payload concreto vive en `roadmap-types.ts` (compartido con el playground).
// Lo importamos donde haga falta para evitar ciclos.
export type Roadmap = {
  id: string;
  session_id: string;
  status: RoadmapStatus;
  payload: import("./roadmap-types").RoadmapPayload | null;
  model: string | null;
  error_text: string | null;
  generated_at: string | null;
  created_at: string;
  updated_at: string;
};
