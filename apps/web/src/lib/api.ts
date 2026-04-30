import useSWR, { mutate as globalMutate } from "swr";

import type { Research, ResearchStatus } from "./types";

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

export { ApiError };
