const fs = require('fs');

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const courseUrls = [
  'curso1.php', 'curso2.php', 'curso3.php', 'curso4.php', 'curso5.php',
  'curso6.php', 'curso7.php', 'curso8.php', 'curso9.php', 'curso10.php',
  'curso11.php', 'curso12.php', 'curso13.php', 'curso14.php', 'curso15.php',
  'curso16.php', 'curso17.php', 'curso18.php', 'curso19.php', 'curso20.php',
  'curso21.php'
];

async function fetchCourse(urlPart) {
  const fullUrl = `https://ctt-talleresfisei.uta.edu.ec/${urlPart}`;
  try {
    const res = await fetch(fullUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
      }
    });
    if (!res.ok) {
      console.warn(`Failed to fetch ${urlPart}: status ${res.status}`);
      return null;
    }
    const html = await res.text();
    return { urlPart, fullUrl, html };
  } catch (err) {
    console.error(`Error fetching ${urlPart}:`, err.message);
    return null;
  }
}

function cleanHtmlToLines(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, '\n')
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean);
}

function parseCourseData(urlPart, fullUrl, html) {
  const lines = cleanHtmlToLines(html);
  
  // Title extraction: line directly after "Inicio" followed by "Cursos"
  let title = '';
  for (let i = 0; i < lines.length - 1; i++) {
    if (lines[i] === 'Inicio' && lines[i + 1] === 'Cursos' && lines[i + 2]) {
      title = lines[i + 2];
      break;
    }
  }
  if (!title) {
    const titleMatch = html.match(/<title>([\s\S]*?)<\/title>/i);
    if (titleMatch) {
      title = titleMatch[1].replace(/\|.*$/, '').replace(/CTT-FISEI/i, '').trim();
    }
  }
  title = title.replace(/\.$/, '').trim();

  // Helper functions
  function getSectionBetween(startKeywords, stopKeywords) {
    const startIndex = lines.findIndex(l => 
      startKeywords.some(kw => l.toUpperCase() === kw.toUpperCase() || l.toUpperCase().startsWith(kw.toUpperCase()))
    );
    if (startIndex === -1) return '';
    let endIndex = lines.length;
    for (let i = startIndex + 1; i < lines.length; i++) {
      if (stopKeywords.some(kw => lines[i].toUpperCase().includes(kw.toUpperCase()))) {
        endIndex = i;
        break;
      }
    }
    return lines.slice(startIndex + 1, endIndex).join('\n').trim();
  }

  function getFieldAfter(keyword) {
    const idx = lines.findIndex(l => l.toUpperCase().includes(keyword.toUpperCase()));
    if (idx === -1 || idx + 1 >= lines.length) return '';
    return lines[idx + 1];
  }

  // Key sections
  const description = getSectionBetween(['DESCRIPCIÓN'], ['OBJETIVOS', 'LUGAR DE CELEBRACIÓN', 'COMITÉ ORGANIZADOR']);
  const objectives = getSectionBetween(['OBJETIVOS'], ['LUGAR DE CELEBRACIÓN', 'COMITÉ ORGANIZADOR', 'INSTRUCTORES']);
  const instructor = getSectionBetween(['INSTRUCTORES', 'COMITÉ ORGANIZADOR'], ['REQUISITOS Y DETALLES', 'MATERIALES Y EQUIPOS', 'CONTENIDOS', 'Fechas de inscripciones']);
  
  const regDates = getFieldAfter('Fechas de inscripciones:');
  const courseDates = getFieldAfter('Fecha del curso:');
  const schedule = getFieldAfter('Horario:');
  const quota = getFieldAfter('Cupo de inscripciones:');
  const place = getFieldAfter('Lugar del evento:') || getFieldAfter('LUGAR DE CELEBRACIÓN');
  const hours = getFieldAfter('Horas de capacitación:');
  const modality = getFieldAfter('Modalidad:');
  const beneficiaries = getFieldAfter('Beneficiarios:');
  const certType = getFieldAfter('Tipo de capacitación:') || 'Certificado digital de aprobación con validación QR emitido por FISEI - UTA';

  // Parse prices
  let priceUTAStudent = null;
  let priceUTAPersonnel = null;
  let priceGeneral = null;

  const priceBlock = getSectionBetween(['Precio para los asistentes:', 'Precio:'], ['Tipo de capacitación', 'Horas de capacitación', 'Beneficiarios', 'Modalidad']);

  const priceLines = priceBlock.split('\n');
  for (const line of priceLines) {
    const lower = line.toLowerCase();
    const numMatch = line.match(/([0-9]+([.,][0-9]{2})?)/);
    if (!numMatch) continue;
    const numVal = parseFloat(numMatch[1].replace(',', '.'));
    if ((lower.includes('estudiante') || lower.includes('egresado')) && !priceUTAStudent) {
      priceUTAStudent = numVal;
    } else if ((lower.includes('graduado') || lower.includes('docente') || lower.includes('administrativo') || lower.includes('personal')) && !priceUTAPersonnel) {
      priceUTAPersonnel = numVal;
    } else if ((lower.includes('público') || lower.includes('general')) && !priceGeneral) {
      priceGeneral = numVal;
    }
  }

  // Defaults if standard pricing applies
  if (!priceGeneral) priceGeneral = 60.00;
  if (!priceUTAStudent) priceUTAStudent = 40.00;
  if (!priceUTAPersonnel) priceUTAPersonnel = 50.00;

  const requirements = getSectionBetween(['Conocimientos previos:'], ['Computador personal', 'MATERIALES Y EQUIPOS', 'CONTENIDOS']);
  const syllabus = getSectionBetween(['CONTENIDOS'], ['INSCRIBIRME', 'Redes Sociales', 'Dirección', 'talleresfisei@uta.edu.ec', '¿Tienes dudas?']);

  const courseNum = urlPart.replace(/\D/g, '');
  const courseCode = `CTT-FISEI-${courseNum.padStart(2, '0')}`;

  return {
    course_code: courseCode,
    url: fullUrl,
    url_slug: urlPart,
    title,
    description: description.replace(/\n+/g, ' '),
    objectives: objectives.replace(/\n+/g, ' '),
    instructor: instructor.replace(/\n+/g, ', ').trim(),
    registration_dates: regDates || 'Abiertas actualmente',
    course_dates: courseDates || 'Próximo inicio',
    schedule: schedule || 'Sesiones en fin de semana',
    quota: quota || 'Mínimo 5, máximo 25 participantes',
    place: place || 'Virtual por Zoom / Plataforma CTT-FISEI',
    hours: hours || '32 horas',
    modality: modality || 'Virtual',
    beneficiarios: beneficiaries || 'Estudiantes, graduados, docentes y público en general',
    cert_type: certType,
    pricing: {
      student_uta: priceUTAStudent,
      faculty_staff_uta: priceUTAPersonnel,
      general_public: priceGeneral,
      raw_text: priceLines.join(' | ')
    },
    requirements: requirements.replace(/\n+/g, ' ') || 'Conocimientos básicos de computación.',
    syllabus: syllabus || 'Fundamentos teóricos y proyectos prácticos aplicados.'
  };
}

async function run() {
  console.log(`=== INICIANDO SCRAPING CTT-FISEI (${courseUrls.length} CURSOS) ===`);
  const allCourses = [];

  for (const urlPart of courseUrls) {
    const res = await fetchCourse(urlPart);
    if (res) {
      const parsed = parseCourseData(res.urlPart, res.fullUrl, res.html);
      allCourses.push(parsed);
      console.log(`[OK] ${parsed.course_code}: "${parsed.title}" (Gen: $${parsed.pricing.general_public}, UTA: $${parsed.pricing.student_uta})`);
    }
  }

  fs.writeFileSync('courses_scraped.json', JSON.stringify(allCourses, null, 2), 'utf8');
  console.log(`\nGuardados ${allCourses.length} cursos en courses_scraped.json`);

  // Generación de Chunks Semánticos
  const chunks = [];

  for (const c of allCourses) {
    // 1. Overview
    chunks.push({
      course_code: c.course_code,
      course_name: c.title,
      category: 'overview',
      official_price: c.pricing.general_public,
      max_scholarship_pct: 15,
      content: `[CURSO OFICIAL CTT-FISEI: ${c.title} (${c.course_code})]
- Descripción: ${c.description}
- Objetivos: ${c.objectives}
- Modalidad: ${c.modality}. Duración: ${c.hours}.
- Horarios: ${c.schedule}
- Fechas de Curso: ${c.course_dates}. Inscripciones: ${c.registration_dates}.
- Plataforma/Lugar: ${c.place}.
- Instructor/Comité: ${c.instructor || 'Docente especialista FISEI'}.
- Certificación: Certificado oficial con código QR y aval de FISEI - Universidad Técnica de Ambato.`
    });

    // 2. Syllabus
    chunks.push({
      course_code: c.course_code,
      course_name: c.title,
      category: 'syllabus',
      official_price: c.pricing.general_public,
      max_scholarship_pct: 15,
      content: `[PÉNSUM Y CONTENIDOS TÉCNICOS: ${c.title} (${c.course_code})]
- Temario detallado:
${c.syllabus}
- Requisitos previos recomendados: ${c.requirements}`
    });

    // 3. Pricing & Commercial Rules (Anti-Injection Shield)
    chunks.push({
      course_code: c.course_code,
      course_name: c.title,
      category: 'pricing',
      official_price: c.pricing.general_public,
      max_scholarship_pct: 15,
      content: `[INVERSIÓN, TARIFAS Y REGLAS COMERCIALES: ${c.title} (${c.course_code})]
- Estudiantes UTA: $${c.pricing.student_uta} USD
- Graduados, Docentes y Personal UTA: $${c.pricing.faculty_staff_uta} USD
- Público en General: $${c.pricing.general_public} USD
- Cupos: ${c.quota}.
- REGLAS COMERCIALES ESTRICTAS:
  1. Los precios son oficiales fijados por la Universidad Técnica de Ambato y no son negociables.
  2. El descuento máximo por pronto pago o beca académica evaluada es de hasta el 15%.
  3. No existen cursos gratuitos ni becas del 100% o 99%. Cualquier solicitud fuera de esta política debe ser canalizada a un asesor humano administrativo.`
    });
  }

  fs.writeFileSync('course_chunks.json', JSON.stringify(chunks, null, 2), 'utf8');
  console.log(`Generados ${chunks.length} chunks semánticos listos para pgvector en course_chunks.json!`);
}

run();
