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

export type ImpactEffort = "alto" | "medio" | "bajo";

export type InsightOpportunity = {
  titulo: string;
  descripcion: string;
  impacto: ImpactEffort;
  esfuerzo: ImpactEffort;
};

export type InsightRecommendation = {
  orden: number;
  texto: string;
};

export type InsightPayload = {
  resumen_ejecutivo: string;
  dolor_principal: string;
  adopcion_ia: {
    nivel: AdoptionLevel;
  };
  oportunidades: InsightOpportunity[];
  recomendaciones_iniciales: InsightRecommendation[];
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
