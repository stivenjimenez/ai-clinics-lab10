// Catálogo temporal de preguntas del diagnóstico.
// Vive como código hasta que definamos el set definitivo y lo movamos a BD.

export type DiagnosticQuestion = {
  id: string;
  order: number;
  title: string;
  prompt: string;
};

export const DIAGNOSTIC_QUESTIONS: DiagnosticQuestion[] = [
  {
    id: "pain_quantified",
    order: 1,
    title: "El dolor en números",
    prompt:
      "¿Cuánto tiempo o dinero está consumiendo ese problema hoy? " +
      "(ej. '4 horas/persona/día', '$30k/mes en retrabajos', '10% de clientes perdidos por demoras')",
  },
  {
    id: "current_process",
    order: 2,
    title: "Cómo se hace hoy",
    prompt:
      "¿Cómo resuelven ese problema hoy paso a paso? ¿Quién lo hace, " +
      "con qué herramientas y dónde vive la información que se usa?",
  },
  {
    id: "data_and_systems",
    order: 3,
    title: "Datos y sistemas disponibles",
    prompt:
      "¿Qué datos tienen disponibles sobre ese proceso? " +
      "(ej. Excel, CRM, ERP, base de datos propia) ¿Están digitalizados o hay pasos sin registro?",
  },
  {
    id: "tools_and_access",
    order: 4,
    title: "Herramientas de IA disponibles",
    prompt:
      "¿Qué herramientas de IA o automatización ya tienen licenciadas o en uso? " +
      "(ej. ChatGPT, Copilot, Zapier, n8n, Make, APIs propias) ¿El equipo tiene acceso hoy sin gestiones adicionales?",
  },
  {
    id: "prior_attempts",
    order: 5,
    title: "Intentos previos",
    prompt:
      "¿Ya intentaron resolver esto con tecnología o IA antes? Si es así, " +
      "¿qué frenó el avance? (presupuesto, integración técnica, adopción del equipo, falta de datos, aprobaciones)",
  },
  {
    id: "success_metric",
    order: 6,
    title: "Métrica de éxito en 30 días",
    prompt:
      "Si en 30 días ejecutan un primer piloto de IA en ese proceso, " +
      "¿qué número concreto tendría que moverse para que el equipo diga 'esto funcionó'? ¿Quién tiene autoridad para aprobarlo hoy?",
  },
];

export const TOTAL_DIAGNOSTIC_QUESTIONS = DIAGNOSTIC_QUESTIONS.length;
