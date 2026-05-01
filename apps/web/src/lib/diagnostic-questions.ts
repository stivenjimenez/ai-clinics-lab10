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
    id: "pain_point",
    order: 1,
    title: "Dolor principal",
    prompt: "¿Cuál es el problema que más les está costando dinero o tiempo hoy?",
  },
  {
    id: "ai_focus_area",
    order: 2,
    title: "Área de exploración con IA",
    prompt: "¿Dónde quieren empezar a aplicar IA primero?",
  },
  {
    id: "success_metric",
    order: 3,
    title: "Cómo se mide el éxito",
    prompt: "¿Qué métrica concreta tendría que moverse para que esto valga la pena?",
  },
];

export const TOTAL_DIAGNOSTIC_QUESTIONS = DIAGNOSTIC_QUESTIONS.length;
