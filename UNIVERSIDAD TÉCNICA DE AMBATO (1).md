### UNIVERSIDAD TÉCNICA DE AMBATO 

Facultad de Ingeniería en Sistemas, Electrónica e Industrial (FISEI) _Documento Técnico & Rúbrica Oficial de Evaluación — Edición Especial Ambato Meetup_ 

# Reto Oficial Hackathon 2026 

## Ecosistema Multi-Agente para Ventas y Gestión Conversacional 

Bases técnicas, especificaciones de arquitectura y rúbrica integral de calificación para el equipo evaluador de la Facultad de Ingeniería en Sistemas, Electrónica e Industrial. 

- Fecha y hora: 29 de Octubre • 08:00 

- Sede: Auditorio 1 Fac. Adm. 

- Ejes temáticos: Innovación • Redes • Tech 

- Ecosistema aliado: SpaceX • GDG Quito • Supabase 

## SECCIÓN 01: Contexto del Reto y Objetivos 

#### 1. Justificación del Problema 

Un centro de capacitación tecnológica enfrenta un desafío sustancial en su proceso de captación y soporte: los prospectos solicitan información en horarios heterogéneos (madrugadas, fines de semana y feriados). La respuesta tardía o 

la implementación de bots rígidos basados en menús reducen la tasa de conversión y generan fricción cognitiva. 

Objetivo: Desarrollar un modelo híbrido autónomo–humano que responda y persuada con naturalidad conversacional, respaldado por un panel de mando reactivo que faculte la intervención de un operador humano en tiempo real. 

#### 2. Componentes Fundamentales a Desarrollar 

Módulo A: Canal Conversacional — Agente de Atención (Telegram) 

- Agente impulsado por LLM. 

- Debe perfilar prospectos, resolver requerimientos técnicos del pénsum de cursos, argumentar ante objeciones comerciales y canalizar la inscripción con tono empático y no robótico. 

Módulo B: Supervisión y Handover — Panel de Mando (Dashboard Web) 

- Interfaz web en tiempo real que liste las interacciones activas concurrentes. 

- Permite al operador administrativo auditar métricas e intervenir inmediatamente en el hilo sin romper la experiencia del usuario. 

#### 3. Requisitos Críticos y Casos de Borde 

- 01. Transición Transparente (Seamless Handover): Al detectar frustración del cliente o recibir intervención directa del operador, la IA debe pausar su inferencia automáticamente. Los mensajes enviados por el administrador fluyen por Telegram bajo la misma identidad del bot. 

- 02. Termómetro de Interacción en Tiempo Real: Clasificación semántica del estado del prospecto ( _interesado, dudoso, frustrado o lead caliente_ ) visible instantáneamente en las tarjetas de chat mediante indicadores sutiles de estado. 

- 03. Resiliencia y Barreras de Seguridad (Prompt Injection): Defensa sólida contra intentos maliciosos de ingeniería de prompts orientados a obtener cursos gratuitos, forzar descuentos no autorizados o alterar las directrices del centro educativo. 

#### 4. Entregables Obligatorios para Evaluación 

1. Entregable 1 — Bot de Telegram en vivo: Desplegado y accesible para pruebas interactivas por parte del jurado. 

2. Entregable 2 — URL del Dashboard Web: Plataforma web funcional, reactiva y accesible sin restricciones de CORS. 

3. Entregable 3 — Repositorio y Documentación: Código fuente limpio, configuración de variables de entorno y guía de despliegue. 

## SECCIÓN 02: Rúbrica de Evaluación Académica y Técnica 

Puntaje Total: 100 puntos 

|Criterio de Evaluación|Descripción Detallada|Puntaje|
|---|---|---|
|A. Comportamiento y<br>Lógica del Agente<br>Conversacional||30 pts|
|• Capacidad de<br>persuasión y tono<br>humano|Adaptabilidad lingüística natural; evita<br>respuestas estructuradas como<br>catálogo y promueve el valor<br>académico del pénsum.|10 pts|
|• Identificación de<br>intención y derivación<br>oportuna|Discierne cuándo cerrar la inscripción<br>o transferir de forma oportuna la<br>consulta hacia un docente o asesor<br>humano.|10 pts|
|• Resiliencia ante casos<br>de borde e inyecciones|Tolerancia a faltas ortográficas, giros<br>temáticos inesperados y defensas<br>frente a jailbreaks o solicitudes de<br>descuento indebidas.|10 pts|
|B. Panel de Control Web<br>e Intervención Humana||30 pts|
|• Sincronización<br>bidireccional en tiempo<br>real|Actualización inmediata vía<br>WebSockets o Server-Sent Events sin<br>recarga manual de pantalla.|10 pts|
|• Mecanismo de<br>handover y pausa de IA|Facilidad para congelar la inferencia al<br>intervenir un operador y reanudar el<br>flujo de forma clara y sin fricción.|10 pts|



|• Diseño UI/UX y<br>visibilidad del estado de<br>chat|Claridad visual, termómetro de<br>intención y ergonomía para gestionar<br>múltiples conversaciones<br>concurrentes.|10 pts|
|---|---|---|
|C. Arquitectura,<br>Integración y Eficiencia<br>Técnica||20 pts|
|• Diseño modular y<br>separación de capas|Estructura limpia entre conectores de<br>mensajería, pipeline de inferencia y<br>persistencia de datos.|10 pts|
|• Gestión de tokens y<br>ventana de contexto|Prompt estructurado y gestión de<br>historial concisa para optimizar<br>latencia y consumo de recursos.|10 pts|
|D. Innovación, Valor<br>Agregado y Sustentación||20 pts|
|• Funcionalidades<br>complementarias de valor|Transcripción de audio, resúmenes<br>automáticos para el operador o<br>métricas analíticas destacadas.|10 pts|
|• Sustentación técnica y<br>demostración en vivo|Claridad en la resolución de preguntas<br>del jurado y estabilidad durante las<br>pruebas de interacción en vivo.|10 pts|



#### Validación del Comité Evaluador 

|Jurado Evaluador 1|Jurado Evaluador 2|Delegado de Industria|
|---|---|---|
|___________________<br>_______<br>Docente FISEI - UTA|___________________<br>_______<br>Docente FISEI - UTA|___________________<br>_______<br>GDG Quito / Comité<br>Organizador|



_Universidad Técnica de Ambato • Facultad de Ingeniería en Sistemas, Electrónica e Industrial (FISEI) • Ambato, Ecuador_ 

