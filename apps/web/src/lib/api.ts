import useSWR, { mutate as globalMutate } from "swr";

import type {
  FormAnswer,
  Insight,
  Research,
  ResearchStatus,
  Roadmap,
  Session,
} from "./types";
import type { RoadmapPayload } from "./roadmap-types";

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

class ApiError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, body: unknown, message: string) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

async function fetcher<T>(path: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, { cache: "no-store" });
  if (!res.ok) {
    let body: unknown = null;
    try {
      body = await res.json();
    } catch {
      // ignore
    }
    throw new ApiError(res.status, body, `${path} → ${res.status}`);
  }
  return res.json() as Promise<T>;
}

// ---------- Hooks ----------

export type ResearchListFilters = {
  status?: ResearchStatus;
  search?: string;
};

function buildResearchKey(filters: ResearchListFilters = {}): string {
  const params = new URLSearchParams();
  if (filters.status) params.set("status", filters.status);
  if (filters.search) params.set("search", filters.search);
  const qs = params.toString();
  return `/research${qs ? `?${qs}` : ""}`;
}

export function useResearchList(filters: ResearchListFilters = {}) {
  const key = buildResearchKey(filters);
  return useSWR<Research[]>(key, fetcher, {
    refreshInterval: (latest) =>
      latest?.some((r) => r.status === "researching") ? 5000 : 0,
    revalidateOnFocus: true,
  });
}

export function useResearch(id: string | null | undefined) {
  return useSWR<Research>(id ? `/research/${id}` : null, fetcher, {
    refreshInterval: (latest) =>
      latest?.status === "researching" ? 5000 : 0,
    revalidateOnFocus: true,
  });
}

// ---------- Mutations ----------

export type CreateResearchInput = {
  company_name: string;
  website?: string | null;
  linkedin?: string | null;
  notes?: string | null;
};

export async function createResearch(
  input: CreateResearchInput,
): Promise<Research> {
  const res = await fetch(`${API_URL}/research`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    let body: unknown = null;
    try {
      body = await res.json();
    } catch {
      // ignore
    }
    throw new ApiError(res.status, body, `POST /research → ${res.status}`);
  }
  const created = (await res.json()) as Research;
  // Invalida cualquier listado de research que haya en cache.
  globalMutate(
    (key) => typeof key === "string" && key.startsWith("/research"),
    undefined,
    { revalidate: true },
  );
  return created;
}

// ---------- Sessions / answers ----------

export function useSessionForResearch(researchId: string | null | undefined) {
  return useSWR<Session>(
    researchId ? `/research/${researchId}/session` : null,
    fetcher,
    { revalidateOnFocus: true },
  );
}

export function useAnswers(sessionId: string | null | undefined) {
  return useSWR<FormAnswer[]>(
    sessionId ? `/sessions/${sessionId}/answers` : null,
    fetcher,
    { revalidateOnFocus: true },
  );
}

export type AnswerInput = { question_id: string; answer_text: string };

export async function saveAnswers(sessionId: string, answers: AnswerInput[]) {
  const res = await fetch(`${API_URL}/sessions/${sessionId}/answers`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ answers }),
  });
  if (!res.ok) {
    let body: unknown = null;
    try {
      body = await res.json();
    } catch {
      // ignore
    }
    throw new ApiError(
      res.status,
      body,
      `PUT /sessions/${sessionId}/answers → ${res.status}`,
    );
  }
  const json = (await res.json()) as {
    answers: FormAnswer[];
    session: Session;
  };
  globalMutate(`/sessions/${sessionId}/answers`, json.answers, {
    revalidate: false,
  });
  globalMutate(`/research/${json.session.research_id}/session`, json.session, {
    revalidate: false,
  });
  return json;
}

// ---------- Insights ----------

export function useInsight(sessionId: string | null | undefined) {
  return useSWR<Insight>(
    sessionId ? `/sessions/${sessionId}/insights` : null,
    async (path: string) => {
      const res = await fetch(`${API_URL}${path}`, { cache: "no-store" });
      if (res.status === 404) {
        // Sin insight aún: devolvemos null tipado vía SWR (data === undefined).
        throw new ApiError(404, null, "no insight yet");
      }
      if (!res.ok) {
        let body: unknown = null;
        try {
          body = await res.json();
        } catch {
          // ignore
        }
        throw new ApiError(res.status, body, `${path} → ${res.status}`);
      }
      return res.json() as Promise<Insight>;
    },
    {
      refreshInterval: (latest) =>
        latest?.status === "generating" ? 4000 : 0,
      revalidateOnFocus: true,
      shouldRetryOnError: (err) =>
        !(err instanceof ApiError && err.status === 404),
    },
  );
}

export async function generateInsight(sessionId: string): Promise<Insight> {
  const res = await fetch(
    `${API_URL}/sessions/${sessionId}/insights/generate`,
    { method: "POST" },
  );
  if (!res.ok) {
    let body: unknown = null;
    try {
      body = await res.json();
    } catch {
      // ignore
    }
    throw new ApiError(
      res.status,
      body,
      `POST /sessions/${sessionId}/insights/generate → ${res.status}`,
    );
  }
  const created = (await res.json()) as Insight;
  globalMutate(`/sessions/${sessionId}/insights`, created, { revalidate: true });
  return created;
}

// ---------- Roadmap ----------

export function useRoadmap(sessionId: string | null | undefined) {
  return useSWR<Roadmap>(
    sessionId ? `/sessions/${sessionId}/roadmap` : null,
    async (path: string) => {
      const res = await fetch(`${API_URL}${path}`, { cache: "no-store" });
      if (res.status === 404) {
        throw new ApiError(404, null, "no roadmap yet");
      }
      if (!res.ok) {
        let body: unknown = null;
        try {
          body = await res.json();
        } catch {
          // ignore
        }
        throw new ApiError(res.status, body, `${path} → ${res.status}`);
      }
      return res.json() as Promise<Roadmap>;
    },
    {
      refreshInterval: (latest) =>
        latest?.status === "generating" ? 4000 : 0,
      revalidateOnFocus: true,
      shouldRetryOnError: (err) =>
        !(err instanceof ApiError && err.status === 404),
    },
  );
}

export async function generateRoadmap(sessionId: string): Promise<Roadmap> {
  const res = await fetch(
    `${API_URL}/sessions/${sessionId}/roadmap/generate`,
    { method: "POST" },
  );
  if (!res.ok) {
    let body: unknown = null;
    try {
      body = await res.json();
    } catch {
      // ignore
    }
    throw new ApiError(
      res.status,
      body,
      `POST /sessions/${sessionId}/roadmap/generate → ${res.status}`,
    );
  }
  const created = (await res.json()) as Roadmap;
  globalMutate(`/sessions/${sessionId}/roadmap`, created, { revalidate: true });
  return created;
}

export async function updateRoadmap(
  sessionId: string,
  payload: RoadmapPayload,
): Promise<Roadmap> {
  const res = await fetch(`${API_URL}/sessions/${sessionId}/roadmap`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ payload }),
  });
  if (!res.ok) {
    let body: unknown = null;
    try {
      body = await res.json();
    } catch {
      // ignore
    }
    throw new ApiError(
      res.status,
      body,
      `PUT /sessions/${sessionId}/roadmap → ${res.status}`,
    );
  }
  const updated = (await res.json()) as Roadmap;
  globalMutate(`/sessions/${sessionId}/roadmap`, updated, { revalidate: false });
  return updated;
}

export { ApiError };
