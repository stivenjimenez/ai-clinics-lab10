-- =====================================================================
-- Migration: rename `insights.payload` JSON keys to English
-- Las claves estructurales del payload pasan de español a inglés para que
-- todo el contrato técnico (DB, tipos TS, tool calls del LLM) sea uniforme.
-- Solo se renombran CLAVES; los valores de texto siguen en español.
-- =====================================================================

update public.insights
set payload = (
  -- Top-level rename + reconstruct nested arrays/objects
  jsonb_build_object(
    'executive_summary', payload->'resumen_ejecutivo',
    'pain_point',        payload->'dolor_principal',
    'ai_adoption',       jsonb_build_object(
      'level', payload#>'{adopcion_ia,nivel}'
    ),
    'opportunities', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'title',       op->'titulo',
            'description', op->'descripcion',
            'impact',      case op->>'impacto'
                             when 'alto'  then 'high'
                             when 'medio' then 'medium'
                             when 'bajo'  then 'low'
                             else op->>'impacto'
                           end,
            'effort',      case op->>'esfuerzo'
                             when 'alto'  then 'high'
                             when 'medio' then 'medium'
                             when 'bajo'  then 'low'
                             else op->>'esfuerzo'
                           end
          )
        )
        from jsonb_array_elements(payload->'oportunidades') as op
      ),
      '[]'::jsonb
    ),
    'initial_recommendations', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'order', rec->'orden',
            'text',  rec->'texto'
          )
        )
        from jsonb_array_elements(payload->'recomendaciones_iniciales') as rec
      ),
      '[]'::jsonb
    )
  )
)
where payload is not null
  and payload ? 'resumen_ejecutivo';
