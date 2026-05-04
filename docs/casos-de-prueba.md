# Casos de prueba — Demo AI Clinics

Cuatro empresas colombianas reales para usar en la demo. Cada caso trae los textos exactos para pegar en los dos formularios del flujo:

1. **Formulario inicial** (`Nuevo research`): EMPRESA, SITIO WEB, LINKEDIN, OBSERVACIONES.
2. **Formulario de diagnóstico** (3 preguntas): Dolor principal, Área de exploración con IA, Cómo se mide el éxito.

> Datos de las empresas tomados de fuentes públicas (web oficial, LinkedIn, Crunchbase, YC, prensa). Las respuestas del diagnóstico son construidas como ejemplo plausible para la demo, alineadas al área que se quiere explorar en cada caso.

---

## Resumen rápido

| Caso | Empresa | Industria | Área a explorar | Tamaño |
|---|---|---|---|---|
| 1 | Dapta | AI automation / agentes IA no-code | Mejorar el soporte al cliente | ~10-50 |
| 2 | Littio | Fintech (neobanco USD/cripto) | Reducir costo operativo | ~37 |
| 3 | Bacu | Foodtech / restaurantes | Mejorar las ventas | ~150 |
| 4 | C4c7us | DevOps / Cloud Ops B2B | Mejorar las ventas (funnel propio) | ~5 |

---

## Caso 1 — Dapta (mejorar el soporte)

### Formulario inicial

| Campo | Valor |
|---|---|
| EMPRESA | `Dapta` |
| SITIO WEB | `dapta.ai` |
| LINKEDIN | `linkedin.com/company/dapta` |
| OBSERVACIONES | `Plataforma colombiana no-code de agentes IA de voz y texto para automatizar ventas y operaciones en PyMEs. Fundada en 2022 por Nicolás Rojas, levantó USD 1.4M y reporta más de 27.000 negocios usando la plataforma. Reconocida en Forbes 30 Promesas 2024 y Shark Tank Colombia. El ejecutivo quiere explorar cómo aplicar IA al soporte al cliente del propio Dapta: el equipo está creciendo rápido y los tickets de clientes PyME están saturando al equipo de Customer Success.` |

### Diagnóstico

| Pregunta | Respuesta |
|---|---|
| Dolor principal | `El volumen de tickets de soporte creció 4x en los últimos 6 meses con la entrada de clientes PyME. Customer Success pasa más tiempo respondiendo dudas básicas de configuración (cómo conectar WhatsApp, cómo armar un flow) que ayudando a clientes grandes a expandir uso. El tiempo de primera respuesta subió de 2h a 14h y ya tenemos churn en cuentas que no logran activarse en la primera semana.` |
| Área de exploración con IA | `Queremos un agente IA de soporte L1 que resuelva las preguntas repetitivas (onboarding, troubleshooting básico, cómo-hacer) usando nuestra propia documentación y los flows que el cliente ya tiene activos. Que escale a humano solo cuando detecte un caso complejo o un cliente en riesgo de churn.` |
| Cómo se mide el éxito | `Bajar el tiempo de primera respuesta a menos de 30 minutos, deflectar al menos 60% de los tickets L1 sin intervención humana, y subir la activación a 7 días de 45% a 70%.` |

---

## Caso 2 — Littio (reducir costo operativo)

### Formulario inicial

| Campo | Valor |
|---|---|
| EMPRESA | `Littio` |
| SITIO WEB | `littio.co` |
| LINKEDIN | `linkedin.com/company/littio` |
| OBSERVACIONES | `Neobanco colombiano que ofrece cuentas en USD y EUR vía stablecoins (USDC/EURC), tarjeta Mastercard y apertura de cuentas bancarias en EE.UU. desde Colombia. Fundada en febrero 2022 por Christian Knudsen Daccach, Luis Huertas e Iván Torroledo. Y Combinator W23, pre-seed de USD 3.7M, equipo de 37 personas en Bogotá. El ejecutivo viene preocupado por el costo operativo: KYC/AML manual, soporte humano y back-office de compliance están consumiendo gran parte del runway y limitando la velocidad de onboarding de nuevos usuarios.` |

### Diagnóstico

| Pregunta | Respuesta |
|---|---|
| Dolor principal | `El costo operativo por usuario activo es demasiado alto para una fintech a nuestra escala. KYC/AML toma en promedio 18 horas de ida y vuelta entre el equipo de compliance y el usuario, soporte tier 1 atiende manualmente preguntas repetitivas sobre la tarjeta y conversiones, y el back-office de monitoreo de transacciones cripto-fiat exige analistas full-time. Cada nuevo usuario nos cuesta más de lo que debería en horas de equipo.` |
| Área de exploración con IA | `Queremos automatizar tres frentes: (1) KYC/AML con extracción y validación automática de documentos más scoring de riesgo, (2) un agente IA de soporte que entienda el contexto de la cuenta del usuario y resuelva preguntas frecuentes en español, (3) detección automática de patrones sospechosos en transacciones para que compliance solo revise los casos verdaderamente flagged.` |
| Cómo se mide el éxito | `Bajar el costo operativo por usuario activo en 40%, reducir el tiempo de KYC de 18h a menos de 1h, y que compliance pase de revisar 100% de las alertas a solo el 20% de mayor riesgo, sin aumentar pérdidas por fraude.` |

---

## Caso 3 — Bacu (mejorar las ventas)

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
| Dolor principal | `Tenemos buen tráfico en tienda y en apps de domicilio, pero el ticket promedio se quedó plano y la recompra de clientes después del primer pedido es baja. En domicilio competimos con marcas grandes y la decisión se toma en segundos en Rappi/iFood; perdemos ventas por foto, descripción o falta de combos sugeridos. En tienda física los cajeros no logran vender el upsell de bebida o postre de forma consistente.` |
| Área de exploración con IA | `Queremos usar IA para tres cosas: (1) optimizar fichas de productos en apps de domicilio (foto, copy, combos sugeridos) según lo que mejor convierte por zona y hora, (2) sugerencias dinámicas de upsell en el POS basadas en lo que el cliente ya pidió, (3) un sistema de recompra que detecte el momento óptimo para reactivar clientes inactivos con la promo correcta por canal.` |
| Cómo se mide el éxito | `Subir ticket promedio en domicilio en 15%, mejorar conversión en fichas de productos clave en 20%, y aumentar la tasa de recompra a 30 días de los clientes nuevos del 18% actual al 30%.` |

---

## Caso 4 — C4c7us (mejorar las ventas — funnel propio)

> Nota: C4c7us es una startup de DevOps / Cloud Ops B2B. Para el caso de "mejorar las ventas" el ángulo realista es su **propio funnel comercial**, no el producto. Equipo de ~5, los fundadores hacen ventas — caso típico de startup early-stage que necesita escalar outbound sin contratar SDRs.

### Formulario inicial

| Campo | Valor |
|---|---|
| EMPRESA | `C4c7us` |
| SITIO WEB | `c4c7ops.com` |
| LINKEDIN | `linkedin.com/company/c4c7us` |
| OBSERVACIONES | `Startup colombiana de gestión de infraestructura cloud y DevSecOps para founders y equipos técnicos. Servicios en Databases, Security, IoT, DBA, DevOps, FinOps, SRE y SecOps. Vendor en AWS Marketplace. Fundada en 2022 en Bogotá por Listman Gamboa Araque y Jennyfer Mogollón, equipo de ~5 personas, con inversión de Marathon Ventures. El ejecutivo (cofundador) viene a explorar cómo aplicar IA para escalar el funnel comercial sin contratar SDRs: hoy los fundadores hacen prospección, demos y seguimiento, y eso limita cuántos deals pueden cerrar al mes.` |

### Diagnóstico

| Pregunta | Respuesta |
|---|---|
| Dolor principal | `Somos un equipo de 5 y los dos fundadores hacemos ventas part-time además de operaciones técnicas. Tenemos buena conversión cuando logramos llegar a un CTO calificado, pero la prospección manual en LinkedIn y la calificación de inbounds desde AWS Marketplace nos consume 15-20 horas semanales por persona. Los leads se enfrían porque tardamos días en responder y no tenemos capacidad para hacer follow-up consistente.` |
| Área de exploración con IA | `Queremos un sistema con IA que haga (1) prospección outbound automatizada en LinkedIn segmentando por stack tecnológico y señales de crecimiento, (2) calificación inmediata de inbounds de AWS Marketplace y la web con un agente que recolecte contexto técnico antes de pasar a fundador, (3) follow-up automático por correo personalizado según la etapa del deal.` |
| Cómo se mide el éxito | `Triplicar el número de demos calificadas por mes (de 8 a 24) sin contratar SDR, bajar el tiempo de respuesta a inbounds de 2 días a menos de 15 minutos, y liberar al menos 10 horas semanales por fundador para enfocarse en cerrar y entregar.` |

---

## Notas para la demo

- Los **OBSERVACIONES** están escritos como notas que un facilitador tomaría antes/durante la sesión. Mantener tono conversacional.
- Las respuestas del diagnóstico están redactadas en primera persona plural ("nosotros / queremos / tenemos") para sonar como el ejecutivo respondiendo al facilitador.
- Para **C4c7us** el caso pivotea al funnel propio porque su producto no es de ventas. Si en la demo se quiere un caso 100% de salestech del producto, sustituir por otra startup.
- Cifras y métricas en las respuestas son **plausibles, no oficiales**. Si en la demo alguien las cuestiona, aclarar que son ejemplo construido para la sesión.
