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
