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
