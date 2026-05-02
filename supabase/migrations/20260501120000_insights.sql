-- =====================================================================
-- Migration: insights (Etapa 4)
-- Salida estructurada del LLM al final del diagnóstico. Una fila por sesión:
-- al regenerar se sobrescribe el `payload` (sin historial de versiones).
-- =====================================================================

create type insight_status as enum ('generating', 'ready', 'failed');

create table public.insights (
  id            uuid primary key default gen_random_uuid(),
  session_id    uuid not null unique references public.sessions(id) on delete cascade,
  status        insight_status not null default 'generating',
  payload       jsonb,
  model         text,
  error_text    text,
  generated_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index insights_session_id_idx on public.insights (session_id);
create index insights_status_idx     on public.insights (status);

create trigger insights_set_updated_at
  before update on public.insights
  for each row execute function public.set_updated_at();
