export const mockCourses = [
  {
    "id": "curso-python-1",
    "name": "Fundamentos de Python 1 (Python Essentials 1)",
    "category": "Programación & CISCO",
    "modality": "Virtual (plataforma CISCO SkillsForAll)",
    "duration_hours": 32,
    "schedule": "A elección del participante (Auto-didacta / Asistido)",
    "official_price_usd": 40,
    "pricing_details": {
      "student_uta": 30,
      "graduates_and_staff": 35,
      "general_public": 40
    },
    "max_allowed_discount_usd": 30,
    "discount_policy": "Tarifa especial de $30 USD exclusivamente para estudiantes activos UTA. Prohibido otorgar becas del 100% o gratuidad sin resolución formal de Decanato.",
    "prerequisites": "Conocimientos básicos de computación y computador personal con internet.",
    "pensum_summary": [
      "Módulo 1: Introducción a Python y lógica de programación",
      "Módulo 2: Tipos de datos, variables, operaciones E/S y operadores",
      "Módulo 3: Flujos booleanos, condicionales, bucles y listas",
      "Módulo 4: Funciones, tuplas, diccionarios y procesamiento de datos",
      "Certificación digital con código QR de asistencia y aprobación"
    ]
  },
  {
    "id": "curso-fullstack-ts",
    "name": "Fullstack Moderno con Next.js & TypeScript",
    "category": "Desarrollo Web",
    "modality": "Online en vivo",
    "duration_hours": 60,
    "schedule": "Martes y Jueves de 19:00 a 22:00",
    "official_price_usd": 250,
    "max_allowed_discount_usd": 220,
    "discount_policy": "Descuento de $30 solo por pronto pago antes del inicio.",
    "prerequisites": "Fundamentos de programación.",
    "pensum_summary": [
      "TypeScript y Clean Architecture",
      "Next.js App Router y Server Actions",
      "Supabase PostgreSQL y Realtime",
      "Despliegue y CI/CD en Vercel"
    ]
  },
  {
    "id": "curso-ia-python",
    "name": "Inteligencia Artificial Aplicada con Python",
    "category": "Inteligencia Artificial",
    "modality": "Híbrido (Virtual + Laboratorio FISEI)",
    "duration_hours": 80,
    "schedule": "Sábados de 08:00 a 14:00",
    "official_price_usd": 320,
    "max_allowed_discount_usd": 290,
    "discount_policy": "Tarifa preferencial con carnet de estudiante FISEI.",
    "prerequisites": "Python intermedio y álgebra lineal básica.",
    "pensum_summary": [
      "Machine Learning y Tratamiento de Datos",
      "Modelos Fundacionales y Gemini API",
      "Sistemas Multi-Agente y Function Calling",
      "Proyecto de Automatización Real"
    ]
  }
] as const;
