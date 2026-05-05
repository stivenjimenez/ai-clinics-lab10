# Casos de prueba — Demo AI Clinics

Un caso de empresa colombiana real para usar en la demo. Trae los textos exactos para pegar en los dos formularios del flujo:

1. **Formulario inicial** (`Nuevo research`): EMPRESA, SITIO WEB, LINKEDIN, OBSERVACIONES.
2. **Formulario de diagnóstico** (6 preguntas): El dolor en números, Cómo se hace hoy, Datos y sistemas disponibles, Herramientas de IA disponibles, Intentos previos, Métrica de éxito en 30 días.

> Datos de la empresa tomados de fuentes públicas (web oficial, LinkedIn, Crunchbase, prensa). Las respuestas del diagnóstico son construidas como ejemplo plausible para la demo, alineadas al área que se quiere explorar.

---

## Caso — Bacu (mejorar las ventas)

### Formulario inicial

| Campo | Valor |
|---|---|
| EMPRESA | `Bacu` |
| SITIO WEB | `bacu.co` |
| LINKEDIN | `linkedin.com/company/bacufoods` |
| OBSERVACIONES | `Foodtech colombiana de "smart food", próxima generación de tecnología para restaurantes en LatAm. Fundada en 2022, sede en Bogotá (Carrera 11b #99-25), expansión reciente a Medellín (Centro Comercial Oviedo, dic 2024). Equipo de ~150 personas, más del 60% menor de 25 años. El ejecutivo viene a explorar cómo IA puede ayudarles a mejorar la venta por tienda: ticket promedio, conversión en domicilios y recompra de clientes recurrentes.` |

### Diagnóstico

| Pregunta | Respuesta |
|---|---|
| El dolor en números | `El ticket promedio en domicilio lleva 4 meses plano en $28.000 COP. La tasa de recompra a 30 días de clientes nuevos es del 18%, cuando el target del negocio es 30%. En tienda física, el upsell de bebida o postre solo ocurre en el 12% de las transacciones aunque el margen de esos ítems es el doble que el plato principal.` |
| Cómo se hace hoy | `Las fichas de productos en Rappi e iFood las actualiza manualmente el equipo de marketing cada 2-3 semanas: editan fotos, textos y combos en el portal de cada plataforma. En caja, los cajeros intentan ofrecer el combo del día de memoria, sin sugerencia del POS. El equipo de CRM envía un cupón genérico por WhatsApp a los clientes que no han pedido en 30 días, sin segmentar por lo que compraron o por qué canal prefieren.` |
| Datos y sistemas disponibles | `Tenemos histórico de órdenes en Rappi e iFood desde 2022 exportable a Excel (fecha, productos, monto, zona). El POS es propio y guarda cada transacción en una base de datos SQL a la que tenemos acceso directo. CRM es HubSpot con contactos de clientes registrados con teléfono y correo. Los datos están digitalizados; el cuello de botella es que nadie los cruza.` |
| Herramientas de IA disponibles | `Tenemos licencias activas de ChatGPT Teams para 8 personas del equipo de marketing y operaciones. Usamos Make (Integromat) para algunos flujos de notificación interna por Slack. El equipo técnico tiene acceso a la API de OpenAI pero nunca la ha usado en producción. No tenemos Zapier ni n8n.` |
| Intentos previos | `Hace 6 meses probamos cambiar manualmente las fotos de los productos top en Rappi durante un fin de semana: subió la conversión en esos ítems un 9% pero lo dejamos porque era muy manual y no teníamos forma de saber qué fotos funcionaban mejor por zona. No hemos intentado nada de IA en el POS ni en el CRM todavía.` |
| Métrica de éxito en 30 días | `Que el upsell en caja suba del 12% al 20% de las transacciones. Quien lo puede aprobar es la Gerente de Operaciones, que tiene autoridad sobre el POS y el equipo de caja. No requiere aprobación de junta.` |
