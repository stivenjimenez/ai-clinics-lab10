-- =====================================================================
-- Migration: research_drop_unused_columns
-- Limpia columnas que dejaron de usarse al simplificar el flujo de research:
-- el form ahora solo captura company_name + website + linkedin + notes,
-- y el dossier del LLM se redujo a un único `summary`.
-- =====================================================================

alter table public.research
  drop column if exists industry,
  drop column if exists contact_name,
  drop column if exists contact_role,
  drop column if exists area_of_interest;
