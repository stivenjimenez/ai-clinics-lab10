-- =====================================================================
-- Migration: form_answers (Etapa 3)
-- Respuestas del formulario de diagnóstico. Una fila por (sesión, pregunta).
-- El catálogo de preguntas vive por ahora en un JSON del frontend; aquí solo
-- guardamos el `question_id` y el texto de la respuesta.
-- =====================================================================

create table public.form_answers (
  id           uuid primary key default gen_random_uuid(),
  session_id   uuid not null references public.sessions(id) on delete cascade,
  question_id  text not null,
  answer_text  text not null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (session_id, question_id)
);

create index form_answers_session_id_idx on public.form_answers (session_id);

create trigger form_answers_set_updated_at
  before update on public.form_answers
  for each row execute function public.set_updated_at();
