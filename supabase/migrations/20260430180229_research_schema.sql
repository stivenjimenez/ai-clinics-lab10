-- =====================================================================
-- Migration: research_schema (Etapa 2)
-- Cambia el modelo a un esquema plano centrado en `research`:
--   - Drop `companies` y `executives` (no se usan en este flujo)
--   - Recrea `sessions` ligada a `research_id`
--   - Crea `research` con dossier jsonb generado por el LLM
-- =====================================================================


-- ---------------------------------------------------------------------
-- Limpiar el esquema anterior (orden importa por las FK).
-- ---------------------------------------------------------------------
drop trigger if exists sessions_set_updated_at on public.sessions;
drop table if exists public.sessions cascade;
drop table if exists public.executives cascade;
drop table if exists public.companies cascade;
-- Conservamos session_status por si más adelante reaparece, pero lo recreamos limpio.
drop type if exists session_status;


-- ---------------------------------------------------------------------
-- research
-- Entrada del flujo: el facilitador captura datos mínimos de la empresa
-- y el ejecutivo, y el LLM (OpenRouter / openai/gpt-5:online) genera un
-- dossier estructurado en `dossier` (jsonb).
-- ---------------------------------------------------------------------
create type research_status as enum ('pending', 'researching', 'ready', 'failed');

create table public.research (
  id                 uuid primary key default gen_random_uuid(),
  company_name       text not null,
  website            text,
  linkedin           text,
  industry           text,
  contact_name       text,
  contact_role       text,
  area_of_interest   text,
  notes              text,
  dossier            jsonb,
  status             research_status not null default 'pending',
  error_message      text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index research_status_idx     on public.research (status);
create index research_created_at_idx on public.research (created_at desc);
create index research_company_idx    on public.research (lower(company_name));


-- ---------------------------------------------------------------------
-- sessions
-- Una sesión es el encuentro de 20-30 min. Ahora cuelga directamente del
-- research (sin tabla intermedia de ejecutivo).
-- ---------------------------------------------------------------------
create type session_status as enum ('draft', 'in_progress', 'completed', 'abandoned');

create table public.sessions (
  id            uuid primary key default gen_random_uuid(),
  research_id   uuid not null references public.research(id) on delete cascade,
  status        session_status not null default 'draft',
  started_at    timestamptz,
  completed_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index sessions_research_id_idx on public.sessions (research_id);
create index sessions_status_idx      on public.sessions (status);


-- ---------------------------------------------------------------------
-- Trigger: actualizar `updated_at` automáticamente.
-- La función `set_updated_at` ya fue creada en la migración inicial,
-- así que solo enganchamos los nuevos triggers.
-- ---------------------------------------------------------------------
create trigger research_set_updated_at
  before update on public.research
  for each row execute function public.set_updated_at();

create trigger sessions_set_updated_at
  before update on public.sessions
  for each row execute function public.set_updated_at();
