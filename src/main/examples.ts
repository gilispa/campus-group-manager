import path from "node:path";
import type { PrismaClient, StudentLevel } from "@prisma/client";
import { appPaths } from "../config/paths";
import { bootstrapDatabase } from "../database/bootstrap";
import { disconnectPrisma, getPrismaClient } from "../database/prisma";
import { createBackendServices } from "./container";

type CatalogSeed = { name: string; description: string };
type GroupSeed = { nombre: string; descripcion: string; category: string };
type StudentSeed = {
  nombre: string;
  matricula: string;
  nivel: StudentLevel;
  career?: string;
  prepaProgram?: string;
  generacion: number;
  telefono: string;
  email: string;
  notas: string;
  activo?: boolean;
};
type MembershipSeed = { studentMatricula: string; groupName: string; role: string };

const careerSeeds: CatalogSeed[] = [
  { name: "Arquitectura", description: "Diseno arquitectonico, urbanismo y desarrollo del entorno construido." },
  { name: "Ingenieria Biomedica", description: "Tecnologia aplicada a la salud, dispositivos medicos y sistemas clinicos." },
  { name: "Ingenieria Civil", description: "Infraestructura, construccion, transporte y gestion de proyectos." },
  { name: "Ingenieria en Alimentos", description: "Desarrollo, innovacion y aseguramiento de calidad en la industria alimentaria." },
  { name: "Ingenieria en Biosistemas Agroalimentarios", description: "Produccion agroalimentaria sostenible y sistemas biologicos aplicados." },
  { name: "Ingenieria en Biotecnologia", description: "Bioprocesos, biologia molecular y soluciones basadas en organismos vivos." },
  { name: "Ingenieria en Desarrollo Sustentable", description: "Diseno de soluciones con enfoque ambiental, social y economico." },
  { name: "Ingenieria en Electronica y Semiconductores", description: "Circuitos, microelectronica y tecnologias de semiconductores." },
  { name: "Ingenieria en Fisica Industrial", description: "Modelado fisico y soluciones tecnologicas para la industria." },
  { name: "Ingenieria en Innovacion y Desarrollo", description: "Creacion de productos, innovacion y procesos de desarrollo tecnologico." },
  { name: "Ingenieria en Inteligencia Artificial y Ciencia de Datos", description: "Analitica avanzada, aprendizaje automatico e inteligencia artificial." },
  { name: "Ingenieria en Nanotecnologia y Materiales", description: "Diseno y aplicacion de materiales avanzados y nanoestructuras." },
  { name: "Ingenieria en Robotica y Sistemas Inteligentes", description: "Automatizacion, robotica y control inteligente." },
  { name: "Ingenieria en Tecnologias Computacionales", description: "Software, sistemas, ciberseguridad y desarrollo computacional." },
  { name: "Ingenieria en Transformacion Digital de Negocios", description: "Tecnologia y estrategia para evolucionar modelos de negocio." },
  { name: "Ingenieria Industrial y de Sistemas", description: "Optimizacion de procesos, operaciones y sistemas productivos." },
  { name: "Ingenieria Mecanica", description: "Diseno mecanico, manufactura y sistemas energeticos." },
  { name: "Ingenieria Mecatronica", description: "Integracion de mecanica, electronica, automatizacion y software." },
  { name: "Ingenieria Quimica", description: "Procesos quimicos, transformacion industrial y analisis de materiales." },
  { name: "Licenciatura en Arte Digital", description: "Narrativas visuales, animacion, medios digitales y expresion creativa." },
  { name: "Licenciatura en Biociencias", description: "Ciencias biologicas aplicadas a salud, investigacion e innovacion." },
  { name: "Licenciatura en Comunicacion y Produccion Digital", description: "Estrategia, contenidos y produccion multimedia para entornos digitales." },
  { name: "Licenciatura en Contaduria Publica y Finanzas", description: "Gestion contable, auditoria, finanzas y regulacion corporativa." },
  { name: "Licenciatura en Derecho", description: "Formacion juridica con enfoque en litigio, empresa y transformacion social." },
  { name: "Licenciatura en Desarrollo de Talento y Cultura Organizacional", description: "Gestion humana, liderazgo y desarrollo organizacional." },
  { name: "Licenciatura en Diseno", description: "Diseno de experiencias, productos, servicios y soluciones creativas." },
  { name: "Licenciatura en Economia", description: "Analisis economico, politicas publicas y mercados." },
  { name: "Licenciatura en Estrategia y Transformacion de Negocios", description: "Direccion estrategica, innovacion y evolucion de organizaciones." },
  { name: "Licenciatura en Finanzas", description: "Mercados financieros, inversion, riesgo y planeacion financiera." },
  { name: "Licenciatura en Gobierno y Transformacion Publica", description: "Politica publica, gobernanza y gestion del sector publico." },
  { name: "Licenciatura en Hospitalidad y Turismo", description: "Experiencias de servicio, gestion turistica y hospitalidad." },
  { name: "Licenciatura en Humanidades Digitales e Inteligencia Artificial", description: "Analisis cultural, pensamiento critico y herramientas digitales." },
  { name: "Licenciatura en Inteligencia de Negocios", description: "Analitica, datos y toma de decisiones para negocios." },
  { name: "Licenciatura en Innovacion y Transformacion Educativa", description: "Aprendizaje, tecnologia educativa y diseno de experiencias formativas." },
  { name: "Licenciatura en Logistica Internacional", description: "Cadena de suministro, comercio global y operaciones internacionales." },
  { name: "Licenciatura en Mercadotecnia", description: "Estrategia de marca, consumidor, creatividad y analitica comercial." },
  { name: "Licenciatura en Negocios Internacionales", description: "Estrategia global, comercio y expansion internacional de empresas." },
  { name: "Licenciatura en Nutricion y Bienestar Integral", description: "Salud preventiva, nutricion y promocion del bienestar." },
  { name: "Licenciatura en Periodismo", description: "Investigacion, narrativa periodistica y produccion informativa." },
  { name: "Licenciatura en Psicologia Clinica y de la Salud", description: "Bienestar emocional, intervencion clinica y salud mental." },
  { name: "Licenciatura en Relaciones Internacionales", description: "Diplomacia, cooperacion global y analisis internacional." },
  { name: "Licenciatura en Emprendimiento", description: "Creacion de empresas, innovacion y modelos de negocio escalables." },
  { name: "Medico Cirujano", description: "Formacion integral para atencion clinica, ciencia medica y salud." },
  { name: "Medico Cirujano Odontologo", description: "Salud bucal, diagnostico y tratamiento odontologico integral." }
];

const categorySeeds: CatalogSeed[] = [
  { name: "Academico y Competencias", description: "Grupos enfocados en aprendizaje, concursos, investigacion y desarrollo profesional." },
  { name: "Arte y Cultura", description: "Expresion artistica, produccion cultural y comunidad creativa." },
  { name: "Ciencia y Tecnologia", description: "Proyectos de innovacion, prototipado, robotica y tecnologia aplicada." },
  { name: "Debate y Ciudadania", description: "Dialogo publico, pensamiento critico, politica y participacion estudiantil." },
  { name: "Deportes y Bienestar", description: "Actividad fisica, trabajo en equipo y promocion de estilos de vida saludables." },
  { name: "Diversidad e Inclusion", description: "Espacios de representacion, apoyo mutuo e inclusion estudiantil." },
  { name: "Emprendimiento y Negocios", description: "Impulso de ideas, modelos de negocio y liderazgo emprendedor." },
  { name: "Impacto Social y Voluntariado", description: "Servicio comunitario, accion social y proyectos con causa." },
  { name: "Liderazgo y Representacion Estudiantil", description: "Consejos, sociedades de alumnos y representacion institucional." },
  { name: "Sustentabilidad", description: "Proyectos ambientales, conciencia ecologica y accion climatica." }
];

const roleSeeds: CatalogSeed[] = [
  { name: "Presidencia", description: "Coordina la vision general del grupo y su representacion institucional." },
  { name: "Vicepresidencia", description: "Da seguimiento operativo y sustituye a presidencia cuando es necesario." },
  { name: "Secretaria", description: "Organiza acuerdos, actas, comunicacion interna y seguimiento administrativo." },
  { name: "Tesoreria", description: "Gestiona presupuesto, gastos, ingresos y controles financieros." },
  { name: "Coordinacion General", description: "Alinea frentes de trabajo y da seguimiento a metas del equipo." },
  { name: "Coordinacion de Eventos", description: "Planea, ejecuta y evalua eventos del grupo estudiantil." },
  { name: "Coordinacion de Logistica", description: "Administra recursos, espacios, materiales y operacion de actividades." },
  { name: "Coordinacion de Comunicacion", description: "Lleva redes, difusion, identidad y mensajes del grupo." },
  { name: "Coordinacion de Vinculacion", description: "Construye alianzas con otras areas, patrocinadores o comunidad externa." },
  { name: "Coordinacion de Proyectos", description: "Gestiona iniciativas, entregables y seguimiento de objetivos." },
  { name: "Mentoria", description: "Acompana a integrantes nuevos y apoya el desarrollo del equipo." },
  { name: "Capitania", description: "Lidera grupos de trabajo o equipos de competencia." },
  { name: "Representacion", description: "Participa como enlace o portavoz del grupo en foros internos y externos." },
  { name: "Miembro Activo", description: "Colabora constantemente en actividades, proyectos y operacion del grupo." },
  { name: "Voluntariado", description: "Apoya actividades puntuales y participa en iniciativas del grupo." }
];

const groupSeeds: GroupSeed[] = [
  { nombre: "Sociedad de Alumnos de Ingenieria", descripcion: "Representacion estudiantil para carreras de ingenieria y ciencias aplicadas.", category: "Liderazgo y Representacion Estudiantil" },
  { nombre: "Club de Robotica Aplicada", descripcion: "Diseno, programacion y prototipado de robots para retos y competencias.", category: "Ciencia y Tecnologia" },
  { nombre: "Finanzas Tec", descripcion: "Comunidad para aprender de mercados, valuacion, inversiones y finanzas corporativas.", category: "Emprendimiento y Negocios" },
  { nombre: "Brigada de Impacto Social", descripcion: "Organiza voluntariados, campanas y proyectos con organizaciones civiles.", category: "Impacto Social y Voluntariado" },
  { nombre: "Foro de Debate y Politica Publica", descripcion: "Espacio para debate, analisis de coyuntura y simulaciones legislativas.", category: "Debate y Ciudadania" },
  { nombre: "Colectivo de Diseno y Arte Digital", descripcion: "Explora ilustracion, branding, animacion y produccion creativa estudiantil.", category: "Arte y Cultura" },
  { nombre: "Semillero Women in STEM", descripcion: "Comunidad para impulsar liderazgo, inclusion y referentes en STEM.", category: "Diversidad e Inclusion" },
  { nombre: "Laboratorio de Emprendimiento Estudiantil", descripcion: "Valida ideas, construye MVPs y conecta talento emprendedor.", category: "Emprendimiento y Negocios" },
  { nombre: "EcoTec Accion", descripcion: "Promueve reciclaje, consumo responsable y proyectos de sostenibilidad.", category: "Sustentabilidad" },
  { nombre: "Movimiento Bienestar Tec", descripcion: "Genera actividades para salud mental, autocuidado y bienestar estudiantil.", category: "Deportes y Bienestar" }
];

const studentSeeds: StudentSeed[] = [
  {
    nombre: "Valeria Salinas Cruz",
    matricula: "A01700001",
    nivel: "PROFESIONAL",
    career: "Ingenieria en Inteligencia Artificial y Ciencia de Datos",
    generacion: 2024,
    telefono: "6621000101",
    email: "valeria.salinas@demo.tec.mx",
    notas: "Perfil enfocado en analitica, liderazgo estudiantil y proyectos STEM."
  },
  {
    nombre: "Diego Montano Ruiz",
    matricula: "A01700002",
    nivel: "PROFESIONAL",
    career: "Ingenieria Mecatronica",
    generacion: 2023,
    telefono: "6621000102",
    email: "diego.montano@demo.tec.mx",
    notas: "Participa en robotica, prototipado y coordinacion tecnica."
  },
  {
    nombre: "Sofia Elizondo Perez",
    matricula: "A01700003",
    nivel: "PROFESIONAL",
    career: "Licenciatura en Finanzas",
    generacion: 2024,
    telefono: "6621000103",
    email: "sofia.elizondo@demo.tec.mx",
    notas: "Interes en mercados, analisis financiero y eventos academicos."
  },
  {
    nombre: "Mateo Carrasco Leon",
    matricula: "A01700004",
    nivel: "PROFESIONAL",
    career: "Licenciatura en Negocios Internacionales",
    generacion: 2022,
    telefono: "6621000104",
    email: "mateo.carrasco@demo.tec.mx",
    notas: "Apoya alianzas, vinculación y organizacion de encuentros."
  },
  {
    nombre: "Camila Robles Vega",
    matricula: "A01700005",
    nivel: "PROFESIONAL",
    career: "Licenciatura en Diseno",
    generacion: 2025,
    telefono: "6621000105",
    email: "camila.robles@demo.tec.mx",
    notas: "Se integra en branding, arte digital y produccion de materiales."
  },
  {
    nombre: "Andres Fierro Tapia",
    matricula: "A01700006",
    nivel: "PROFESIONAL",
    career: "Ingenieria Industrial y de Sistemas",
    generacion: 2023,
    telefono: "6621000106",
    email: "andres.fierro@demo.tec.mx",
    notas: "Fortaleza en logistica, procesos y mejora continua."
  },
  {
    nombre: "Renata Valdez Ibarra",
    matricula: "A01700007",
    nivel: "PROFESIONAL",
    career: "Licenciatura en Relaciones Internacionales",
    generacion: 2024,
    telefono: "6621000107",
    email: "renata.valdez@demo.tec.mx",
    notas: "Participa en debate, diplomacia y asuntos globales."
  },
  {
    nombre: "Emilio Noriega Soto",
    matricula: "A01700008",
    nivel: "PROFESIONAL",
    career: "Ingenieria en Tecnologias Computacionales",
    generacion: 2022,
    telefono: "6621000108",
    email: "emilio.noriega@demo.tec.mx",
    notas: "Apoya desarrollo de software, automatizacion y herramientas internas."
  },
  {
    nombre: "Lucia Palafox Mendoza",
    matricula: "A01700009",
    nivel: "PROFESIONAL",
    career: "Licenciatura en Psicologia Clinica y de la Salud",
    generacion: 2025,
    telefono: "6621000109",
    email: "lucia.palafox@demo.tec.mx",
    notas: "Colabora en iniciativas de bienestar y acompanamiento estudiantil."
  },
  {
    nombre: "Jose Manuel Acosta Lara",
    matricula: "A01700010",
    nivel: "PROFESIONAL",
    career: "Ingenieria en Desarrollo Sustentable",
    generacion: 2023,
    telefono: "6621000110",
    email: "jose.acosta@demo.tec.mx",
    notas: "Promueve proyectos ambientales y cultura de sostenibilidad."
  },
  {
    nombre: "Daniela Quiroz Acedo",
    matricula: "P24000001",
    nivel: "PREPA",
    prepaProgram: "Bicultural",
    generacion: 2026,
    telefono: "6621000111",
    email: "daniela.quiroz@demo.tec.mx",
    notas: "PrepaTec con interes en liderazgo, debate y servicio."
  },
  {
    nombre: "Rodrigo Lugo Espinoza",
    matricula: "P24000002",
    nivel: "PREPA",
    prepaProgram: "Multicultural",
    generacion: 2026,
    telefono: "6621000112",
    email: "rodrigo.lugo@demo.tec.mx",
    notas: "PrepaTec con enfoque en tecnologia, voluntariado e innovacion."
  }
];

const membershipSeeds: MembershipSeed[] = [
  { studentMatricula: "A01700001", groupName: "Sociedad de Alumnos de Ingenieria", role: "Presidencia" },
  { studentMatricula: "A01700001", groupName: "Semillero Women in STEM", role: "Mentoria" },
  { studentMatricula: "A01700002", groupName: "Club de Robotica Aplicada", role: "Capitania" },
  { studentMatricula: "A01700002", groupName: "Sociedad de Alumnos de Ingenieria", role: "Coordinacion de Proyectos" },
  { studentMatricula: "A01700003", groupName: "Finanzas Tec", role: "Presidencia" },
  { studentMatricula: "A01700003", groupName: "Laboratorio de Emprendimiento Estudiantil", role: "Coordinacion de Vinculacion" },
  { studentMatricula: "A01700004", groupName: "Laboratorio de Emprendimiento Estudiantil", role: "Vicepresidencia" },
  { studentMatricula: "A01700004", groupName: "Finanzas Tec", role: "Representacion" },
  { studentMatricula: "A01700005", groupName: "Colectivo de Diseno y Arte Digital", role: "Coordinacion de Comunicacion" },
  { studentMatricula: "A01700006", groupName: "Sociedad de Alumnos de Ingenieria", role: "Coordinacion de Logistica" },
  { studentMatricula: "A01700006", groupName: "Movimiento Bienestar Tec", role: "Miembro Activo" },
  { studentMatricula: "A01700007", groupName: "Foro de Debate y Politica Publica", role: "Presidencia" },
  { studentMatricula: "A01700007", groupName: "Brigada de Impacto Social", role: "Voluntariado" },
  { studentMatricula: "A01700008", groupName: "Club de Robotica Aplicada", role: "Coordinacion General" },
  { studentMatricula: "A01700008", groupName: "Semillero Women in STEM", role: "Miembro Activo" },
  { studentMatricula: "A01700009", groupName: "Movimiento Bienestar Tec", role: "Coordinacion General" },
  { studentMatricula: "A01700010", groupName: "EcoTec Accion", role: "Presidencia" },
  { studentMatricula: "A01700010", groupName: "Brigada de Impacto Social", role: "Coordinacion de Eventos" },
  { studentMatricula: "P24000001", groupName: "Foro de Debate y Politica Publica", role: "Miembro Activo" },
  { studentMatricula: "P24000001", groupName: "Brigada de Impacto Social", role: "Voluntariado" },
  { studentMatricula: "P24000002", groupName: "Club de Robotica Aplicada", role: "Miembro Activo" },
  { studentMatricula: "P24000002", groupName: "EcoTec Accion", role: "Voluntariado" }
];

async function upsertCareers(prisma: PrismaClient, items: CatalogSeed[]) {
  for (const item of items) {
    await prisma.career.upsert({
      where: { name: item.name },
      update: { description: item.description },
      create: item
    });
  }
}

async function upsertCategories(prisma: PrismaClient, items: CatalogSeed[]) {
  for (const item of items) {
    await prisma.category.upsert({
      where: { name: item.name },
      update: { description: item.description },
      create: item
    });
  }
}

async function upsertRoles(prisma: PrismaClient, items: CatalogSeed[]) {
  for (const item of items) {
    await prisma.role.upsert({
      where: { name: item.name },
      update: { description: item.description },
      create: item
    });
  }
}

async function upsertGroups(prisma: PrismaClient) {
  for (const seed of groupSeeds) {
    const category = await prisma.category.findUnique({ where: { name: seed.category } });
    if (!category) {
      continue;
    }

    const existing = await prisma.group.findFirst({ where: { nombre: seed.nombre } });
    if (existing) {
      await prisma.group.update({
        where: { id: existing.id },
        data: {
          descripcion: seed.descripcion,
          categoryId: category.id
        }
      });
      continue;
    }

    await prisma.group.create({
      data: {
        nombre: seed.nombre,
        descripcion: seed.descripcion,
        categoryId: category.id
      }
    });
  }
}

async function upsertStudents(prisma: PrismaClient) {
  for (const seed of studentSeeds) {
    const career = seed.career ? await prisma.career.findUnique({ where: { name: seed.career } }) : null;
    const prepaProgram = seed.prepaProgram
      ? await prisma.prepaProgram.findUnique({ where: { name: seed.prepaProgram } })
      : null;

    await prisma.student.upsert({
      where: { matricula: seed.matricula },
      update: {
        nombre: seed.nombre,
        nivel: seed.nivel,
        generacion: seed.generacion,
        telefono: seed.telefono,
        email: seed.email,
        notas: seed.notas,
        activo: seed.activo ?? true,
        careerId: seed.nivel === "PROFESIONAL" ? career?.id ?? null : null,
        prepaProgramId: seed.nivel === "PREPA" ? prepaProgram?.id ?? null : null
      },
      create: {
        nombre: seed.nombre,
        matricula: seed.matricula,
        nivel: seed.nivel,
        generacion: seed.generacion,
        telefono: seed.telefono,
        email: seed.email,
        notas: seed.notas,
        activo: seed.activo ?? true,
        careerId: seed.nivel === "PROFESIONAL" ? career?.id ?? null : null,
        prepaProgramId: seed.nivel === "PREPA" ? prepaProgram?.id ?? null : null
      }
    });
  }
}

async function upsertMemberships(prisma: PrismaClient) {
  for (const seed of membershipSeeds) {
    const [student, group, role] = await Promise.all([
      prisma.student.findUnique({ where: { matricula: seed.studentMatricula } }),
      prisma.group.findFirst({ where: { nombre: seed.groupName } }),
      prisma.role.findUnique({ where: { name: seed.role } })
    ]);

    if (!student || !group || !role) {
      continue;
    }

    const activeMembership = await prisma.studentGroup.findFirst({
      where: {
        studentId: student.id,
        groupId: group.id,
        active: true
      }
    });

    if (activeMembership) {
      await prisma.studentGroup.update({
        where: { id: activeMembership.id },
        data: { roleId: role.id }
      });
      continue;
    }

    await prisma.studentGroup.create({
      data: {
        studentId: student.id,
        groupId: group.id,
        roleId: role.id
      }
    });
  }
}

async function runExamples(): Promise<void> {
  await bootstrapDatabase();
  const prisma = getPrismaClient();
  const { adminAuthService, backupService } = createBackendServices();

  try {
    await adminAuthService.setInitialPassword({ password: "admin1234" });
  } catch {
    // Si ya existe, dejamos la configuracion actual.
  }

  await upsertCareers(prisma, careerSeeds);
  await upsertCategories(prisma, categorySeeds);
  await upsertRoles(prisma, roleSeeds);
  await upsertGroups(prisma);
  await upsertStudents(prisma);
  await upsertMemberships(prisma);

  const summary = {
    careers: await prisma.career.count(),
    categories: await prisma.category.count(),
    roles: await prisma.role.count(),
    groups: await prisma.group.count(),
    students: await prisma.student.count(),
    memberships: await prisma.studentGroup.count({ where: { active: true } })
  };

  const exportedPath = await backupService.exportDatabase(path.join(appPaths.databaseDir, "backup-example.db"));

  console.log({
    summary,
    exportedPath
  });

  await disconnectPrisma();
}

runExamples().catch(async (error: unknown) => {
  console.error("Error ejecutando ejemplos:", error);
  await disconnectPrisma();
  process.exitCode = 1;
});
