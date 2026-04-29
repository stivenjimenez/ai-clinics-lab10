-- =====================================================================
-- Migration: initial_schema
-- Crea las 3 tablas base para la Etapa 1 del MVP de AI Clinics:
--   - companies   (empresas que vienen al booth)
--   - executives  (personas de cada empresa)
--   - sessions    (sesión de 20-30 min con un facilitador)
--
-- Las tablas de diagnóstico, roadmap, etc. se crean en migrations
-- posteriores (Etapa 3 en adelante).
-- =====================================================================


-- ---------------------------------------------------------------------
-- companies
-- Una empresa puede tener varios ejecutivos a lo largo del evento.
-- ---------------------------------------------------------------------
create table public.companies (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  website     text,
  industry    text,
  created_at  timestamptz not null default now()
);

-- Índice para buscar por nombre rápido (el facilitador puede tipear el nombre)
create index companies_name_idx on public.companies (lower(name));


-- ---------------------------------------------------------------------
-- executives
-- La persona específica que se sienta en el booth.
-- Pertenece a una empresa (foreign key a companies).
-- ---------------------------------------------------------------------
create table public.executives (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies(id) on delete cascade,
  full_name   text not null,
  email       text,
  role        text,
  created_at  timestamptz not null default now()
);

-- Índice para listar ejecutivos de una empresa rápido
create index executives_company_id_idx on public.executives (company_id);


-- ---------------------------------------------------------------------
-- sessions
-- Una sesión es un encuentro de 20-30 min entre facilitador y ejecutivo.
-- En etapas siguientes se le agregarán columnas (research, roadmap, etc).
-- ---------------------------------------------------------------------
create type session_status as enum ('draft', 'in_progress', 'completed', 'abandoned');

create table public.sessions (
  id            uuid primary key default gen_random_uuid(),
  executive_id  uuid not null references public.executives(id) on delete cascade,
  status        session_status not null default 'draft',
  started_at    timestamptz,
  completed_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index sessions_executive_id_idx on public.sessions (executive_id);
create index sessions_status_idx       on public.sessions (status);


-- ---------------------------------------------------------------------
-- Trigger: actualizar 'updated_at' automáticamente en sessions
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger sessions_set_updated_at
  before update on public.sessions
  for each row execute function public.set_updated_at();
