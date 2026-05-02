-- =====================================================================
-- Migration: roadmaps (Etapa 5)
-- Roadmap lineal de checkpoints generado por LLM a partir de
-- dossier + respuestas + insights. Una fila por sesión: regenerar
-- sobrescribe el payload (sin historial de versiones).
--
-- Estructura del `payload` (claves en inglés, valores en español):
--   {
--     nodes: [{
--       id: string,
--       type: "problem" | "action" | "milestone",
--       data: { title: string, description: string },
--       position: { x: number, y: number }
--     }],
--     edges: [{ id: string, source: string, target: string }]
--   }
-- =====================================================================

create type roadmap_status as enum ('generating', 'ready', 'failed');

create table public.roadmaps (
  id            uuid primary key default gen_random_uuid(),
  session_id    uuid not null unique references public.sessions(id) on delete cascade,
  status        roadmap_status not null default 'generating',
  payload       jsonb,
  model         text,
  error_text    text,
  generated_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index roadmaps_session_id_idx on public.roadmaps (session_id);
create index roadmaps_status_idx     on public.roadmaps (status);

create trigger roadmaps_set_updated_at
  before update on public.roadmaps
  for each row execute function public.set_updated_at();
