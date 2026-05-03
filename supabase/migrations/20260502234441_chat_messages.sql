-- =====================================================================
-- Migration: chat_messages (Etapa 7)
-- Conversación del chat-agente que refina el roadmap. Una fila por
-- mensaje. `parts` guarda el array de UIMessage parts del Vercel AI SDK
-- (text, tool-input-available, tool-output-available, etc.) tal cual,
-- para hidratar `useChat({ messages })` y mostrar tool calls aplicados.
-- =====================================================================

create table public.chat_messages (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid not null references public.sessions(id) on delete cascade,
  role        text not null check (role in ('user', 'assistant', 'system')),
  parts       jsonb not null,
  model       text,
  created_at  timestamptz not null default now()
);

create index chat_messages_session_id_idx
  on public.chat_messages (session_id, created_at);
