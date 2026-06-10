import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { after, before, test } from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import ExcelJS from "exceljs";

let tempDataDir = "";
let services: Awaited<ReturnType<typeof loadServices>> | null = null;

before(async () => {
  const testRoot = path.join(process.cwd(), "data", "test-runs");
  await fs.mkdir(testRoot, { recursive: true });
  tempDataDir = await fs.mkdtemp(path.join(testRoot, "grupos-core-test-"));
  process.env.APP_DATA_DIR = tempDataDir;
  process.env.DATABASE_URL = `file:${path.resolve(tempDataDir, "database", "app.db").replace(/\\/g, "/")}`;
  services = await loadServices();
});

after(async () => {
  if (!services) {
    await removeTempDataDir();
    return;
  }

  const { disconnectPrisma } = await import("../src/database/prisma");
  await disconnectPrisma();
  await removeTempDataDir();
});

test("membership lifecycle validates duplicate and removal history", async () => {
  if (!services) {
    throw new Error("Servicios de prueba no disponibles.");
  }

  const seed = await seedBase(`life-${Date.now()}`);

  const created = await services.studentGroupService.addStudentToGroup({
    studentId: seed.student.id,
    groupId: seed.group.id,
    roleId: seed.role.id
  });
  assert.equal(created.active, true);

  await assert.rejects(
    () => services.studentGroupService.addStudentToGroup({
      studentId: seed.student.id,
      groupId: seed.group.id,
      roleId: seed.role.id
    }),
    /pertenencia vigente/i
  );

  const removed = await services.studentGroupService.removeStudentFromGroup({
    studentId: seed.student.id,
    groupId: seed.group.id
  });
  assert.equal(removed.active, false);
  assert.ok(removed.leftAt);

  await assert.rejects(
    () => services.studentGroupService.addStudentToGroup({
      studentId: "student-missing",
      groupId: seed.group.id,
      roleId: seed.role.id
    }),
    /Estudiante no encontrado/i
  );

  await assert.rejects(
    () => services.studentGroupService.addStudentToGroup({
      studentId: seed.student.id,
      groupId: "group-missing",
      roleId: seed.role.id
    }),
    /Grupo no encontrado/i
  );
});

test("participation CSV import returns row-level errors", async () => {
  if (!services) {
    throw new Error("Servicios de prueba no disponibles.");
  }

  const seed = await seedBase(`csv-${Date.now()}`);
  const result = await services.studentGroupService.importMemberships([
    {
      matricula: seed.student.matricula,
      groupName: seed.group.nombre,
      roleName: seed.role.name,
      active: true
    },
    {
      matricula: seed.student.matricula,
      groupName: seed.group.nombre,
      roleName: "Rol inexistente",
      active: true
    }
  ]);

  assert.equal(result.created, 1);
  assert.equal(result.failed, 1);
  assert.ok(result.errors[0]?.includes("Fila 3"));
});

test("operational summary and backup/restore work end-to-end", async () => {
  if (!services) {
    throw new Error("Servicios de prueba no disponibles.");
  }

  const suffix = `ops-${Date.now()}`;
  const emptyGiro = await services.giroService.createCategory({
    name: `GiroVacio-${suffix}`,
    description: "sin grupos"
  });

  const usedGiro = await services.giroService.createCategory({
    name: `GiroUsado-${suffix}`,
    description: "con grupos"
  });
  const portfolio = await services.portfolioService.createPortfolio({
    name: `PortafolioOps-${suffix}`,
    description: "test"
  });

  const roleLeader = await services.roleService.createRole({
    name: `Presidente-${suffix}`,
    description: "lider"
  });
  const roleUnused = await services.roleService.createRole({
    name: `RolSinUso-${suffix}`,
    description: "sin uso"
  });
  const roleMember = await services.roleService.createRole({
    name: `Miembro-${suffix}`,
    description: "miembro"
  });

  const career = await services.careerService.createCareer({
    name: `CarreraOps-${suffix}`,
    description: "test"
  });

  const groupLow = await services.groupService.createGroup({
    nombre: `GrupoBajo-${suffix}`,
    giroId: usedGiro.id,
    portfolioId: portfolio.id,
    descripcion: "baja pertenencia"
  });
  const groupWithLeader = await services.groupService.createGroup({
    nombre: `GrupoLider-${suffix}`,
    giroId: usedGiro.id,
    portfolioId: portfolio.id,
    descripcion: "con lider"
  });

  const studentWithoutGroup = await services.studentService.createStudent({
    nombre: `SinGrupo-${suffix}`,
    matricula: `MAT-SIN-${suffix}`,
    nivel: "PROFESIONAL",
    careerId: career.id,
    generacion: 2024
  });
  const inactiveStudent = await services.studentService.createStudent({
    nombre: `InactivoActivo-${suffix}`,
    matricula: `MAT-INA-${suffix}`,
    nivel: "PROFESIONAL",
    careerId: career.id,
    generacion: 2024,
    activo: false
  });
  const leaderStudent = await services.studentService.createStudent({
    nombre: `ConLider-${suffix}`,
    matricula: `MAT-LID-${suffix}`,
    nivel: "PROFESIONAL",
    careerId: career.id,
    generacion: 2024
  });

  await services.studentGroupService.addStudentToGroup({
    studentId: inactiveStudent.id,
    groupId: groupLow.id,
    roleId: roleMember.id
  });
  await services.studentGroupService.addStudentToGroup({
    studentId: leaderStudent.id,
    groupId: groupWithLeader.id,
    roleId: roleLeader.id
  });

  const summary = await services.metaService.getOperationalSummary();
  assert.ok(summary.studentAlerts.some((student) => student.id === studentWithoutGroup.id));
  assert.ok(summary.groupsWithoutLeaderRows.some((group) => group.id === groupLow.id));
  assert.ok(summary.groupsWithLowMembershipRows.some((group) => group.id === groupLow.id));
  assert.ok(summary.emptyCategoryRows.some((giro) => giro.id === emptyGiro.id));
  assert.ok(summary.unusedRoleRows.some((role) => role.id === roleUnused.id));
  assert.ok(summary.inactiveStudentRows.some((student) => student.id === inactiveStudent.id));

  const backupPath = path.join(tempDataDir, `backup-${suffix}.db`);
  await services.backupService.exportDatabase(backupPath);
  assert.equal(await fileExists(backupPath), true);

  await services.groupService.createGroup({
    nombre: `Temporal-${suffix}`,
    giroId: usedGiro.id,
    portfolioId: portfolio.id,
    descripcion: "debe desaparecer tras restore"
  });
  await services.backupService.importDatabase(backupPath);

  const groupsAfterRestore = await services.groupService.listGroups();
  assert.equal(groupsAfterRestore.some((group) => group.nombre === `Temporal-${suffix}`), false);
});

test("dashboard summary segments active students and unique group membership", async () => {
  if (!services) {
    throw new Error("Servicios de prueba no disponibles.");
  }

  const suffix = `dash-${Date.now()}`;
  const before = await services.metaService.getSummary();
  const giro = await services.giroService.createCategory({
    name: `GiroDash-${suffix}`,
    description: "dashboard"
  });
  const portfolio = await services.portfolioService.createPortfolio({
    name: `PortafolioDash-${suffix}`,
    description: "dashboard"
  });
  const role = await services.roleService.createRole({
    name: `RolDash-${suffix}`,
    description: "dashboard"
  });
  const career = await services.careerService.createCareer({
    name: `CarreraDash-${suffix}`,
    description: "dashboard"
  });
  const program = await services.prepaProgramService.createPrepaProgram({
    name: `ProgramaDash-${suffix}`,
    description: "dashboard"
  });
  const group = await services.groupService.createGroup({
    nombre: `GrupoDash-${suffix}`,
    giroId: giro.id,
    portfolioId: portfolio.id,
    descripcion: "dashboard"
  });
  const proStudent = await services.studentService.createStudent({
    nombre: `ProDash-${suffix}`,
    matricula: `MAT-PRO-DASH-${suffix}`,
    nivel: "PROFESIONAL",
    careerId: career.id,
    generacion: 2024
  });
  const prepaStudent = await services.studentService.createStudent({
    nombre: `PrepaDash-${suffix}`,
    matricula: `MAT-PREPA-DASH-${suffix}`,
    nivel: "PREPA",
    prepaProgramId: program.id,
    generacion: 2026
  });
  const inactiveStudent = await services.studentService.createStudent({
    nombre: `InactiveDash-${suffix}`,
    matricula: `MAT-INACTIVE-DASH-${suffix}`,
    nivel: "PROFESIONAL",
    careerId: career.id,
    generacion: 2024,
    activo: false
  });

  await services.studentGroupService.addStudentToGroup({ studentId: proStudent.id, groupId: group.id, roleId: role.id });
  await services.studentGroupService.addStudentToGroup({ studentId: prepaStudent.id, groupId: group.id, roleId: role.id });
  await services.studentGroupService.addStudentToGroup({ studentId: inactiveStudent.id, groupId: group.id, roleId: role.id });

  const after = await services.metaService.getSummary();
  assert.equal(after.general.students - before.general.students, 2);
  assert.equal(after.general.groups - before.general.groups, 1);
  assert.equal(after.general.studentsInGroups - before.general.studentsInGroups, 2);
  assert.equal(after.prepa.groups - before.prepa.groups, 1);
  assert.equal(after.profesional.groups - before.profesional.groups, 1);
});

test("group management import archives current members, creates memberships, and resolves pending students", async () => {
  if (!services) {
    throw new Error("Servicios de prueba no disponibles.");
  }

  const suffix = `gestion-${Date.now()}`;
  const seed = await seedBase(suffix);
  const newStudent = await services.studentService.createStudent({
    nombre: `NuevoGestion-${suffix}`,
    matricula: `MAT-NEW-GESTION-${suffix}`,
    nivel: "PROFESIONAL",
    careerId: seed.career.id,
    generacion: 2024
  });
  await services.studentGroupService.addStudentToGroup({
    studentId: seed.student.id,
    groupId: seed.group.id,
    roleId: seed.role.id
  });

  const templatePath = path.join(tempDataDir, `plantilla-gestion-${suffix}.xlsx`);
  await services.groupManagementService.exportTemplate(seed.group.id, templatePath);
  const templateWorkbook = new ExcelJS.Workbook();
  await templateWorkbook.xlsx.readFile(templatePath);
  const templateSheet = templateWorkbook.getWorksheet("Plantilla");
  const instructionsSheet = templateWorkbook.getWorksheet("Instrucciones");
  assert.ok(templateSheet);
  assert.ok(instructionsSheet);
  const templateHeaders = templateSheet.getRow(1).values;
  assert.deepEqual(templateHeaders.slice(1), ["Matricula", "Nombre", "Rol"]);
  assert.equal(templateSheet.rowCount, 1);
  assert.equal(templateHeaders.includes("FechaIngreso"), false);
  const instructionText = instructionsSheet
    .getSheetValues()
    .flat()
    .filter((value): value is string => typeof value === "string")
    .join(" ");
  assert.match(instructionText, /Ejemplo/);
  assert.match(instructionText, new RegExp(seed.role.name));
  assert.match(instructionText, /automaticamente/);

  const pendingMatricula = `MAT-PENDING-GESTION-${suffix}`;
  const cancelMatricula = `MAT-CANCEL-GESTION-${suffix}`;
  const workbookPath = path.join(tempDataDir, `gestion-${suffix}.xlsx`);
  await writeManagementWorkbook(workbookPath, [
    { matricula: newStudent.matricula, nombre: newStudent.nombre, rol: seed.role.name },
    { matricula: pendingMatricula, nombre: `PendienteGestion-${suffix}`, rol: seed.role.name },
    { matricula: cancelMatricula, nombre: `CancelarGestion-${suffix}`, rol: seed.role.name }
  ]);

  const preview = await services.groupManagementService.previewImport(seed.group.id, workbookPath);
  assert.equal(preview.ready, 1);
  assert.equal(preview.pending, 2);
  assert.equal(preview.errors, 0);
  assert.equal(Object.prototype.hasOwnProperty.call(preview.rows[0], "joinedAt"), false);

  const effectiveAt = new Date("2026-02-03T12:00:00.000Z");
  const result = await services.groupManagementService.applyImport({
    groupId: seed.group.id,
    filePath: workbookPath,
    label: "Gestion test",
    effectiveAt
  });
  assert.equal(result.archived, 1);
  assert.equal(result.created, 1);
  assert.equal(result.pending, 2);

  let groupHistory = await services.studentGroupService.getParticipationHistoryByGroup(seed.group.id);
  assert.equal(groupHistory.some((membership) => membership.studentId === seed.student.id && membership.active), false);
  assert.equal(groupHistory.some((membership) => membership.studentId === newStudent.id && membership.active), true);
  const newMembership = groupHistory.find((membership) => membership.studentId === newStudent.id && membership.active);
  assert.ok(newMembership);
  assert.equal(new Date(newMembership.joinedAt).toISOString().slice(0, 10), "2026-02-03");

  let pendingRows = await services.pendingMembershipService.listPendingMemberships({ groupId: seed.group.id, status: "PENDING" });
  assert.equal(pendingRows.length, 2);
  const pendingToResolve = pendingRows.find((pending) => pending.matricula === pendingMatricula);
  const pendingToCancel = pendingRows.find((pending) => pending.matricula === cancelMatricula);
  assert.ok(pendingToResolve);
  assert.ok(pendingToCancel);
  assert.equal(new Date(pendingToResolve.joinedAt ?? "").toISOString().slice(0, 10), "2026-02-03");

  const canceled = await services.pendingMembershipService.cancelPendingMembership(pendingToCancel.id);
  assert.equal(canceled.status, "CANCELLED");
  pendingRows = await services.pendingMembershipService.listPendingMemberships({ groupId: seed.group.id, status: "PENDING" });
  assert.equal(pendingRows.length, 1);
  assert.equal(pendingRows.some((pending) => pending.matricula === cancelMatricula), false);
  const canceledRows = await services.pendingMembershipService.listPendingMemberships({ groupId: seed.group.id, status: "CANCELLED" });
  assert.equal(canceledRows.some((pending) => pending.matricula === cancelMatricula), true);

  const resolvedStudent = await services.studentService.createStudent({
    nombre: `PendienteGestion-${suffix}`,
    matricula: pendingMatricula,
    nivel: "PROFESIONAL",
    careerId: seed.career.id,
    generacion: 2024
  });

  pendingRows = await services.pendingMembershipService.listPendingMemberships({ groupId: seed.group.id, status: "PENDING" });
  assert.equal(pendingRows.length, 0);
  groupHistory = await services.studentGroupService.getParticipationHistoryByGroup(seed.group.id);
  assert.equal(groupHistory.some((membership) => membership.studentId === resolvedStudent.id && membership.active), true);
});

test("graduate students deactivates professional students and transitions continuing prepa students", async () => {
  if (!services) {
    throw new Error("Servicios de prueba no disponibles.");
  }

  const suffix = `grad-${Date.now()}`;
  const seed = await seedBase(suffix);
  const program = await services.prepaProgramService.createPrepaProgram({
    name: `ProgramaGrad-${suffix}`,
    description: "graduacion"
  });
  const prepaContinuing = await services.studentService.createStudent({
    nombre: `PrepaContinua-${suffix}`,
    matricula: `MAT-PREPA-CONT-${suffix}`,
    nivel: "PREPA",
    prepaProgramId: program.id,
    generacion: 2026
  });
  const prepaLeaving = await services.studentService.createStudent({
    nombre: `PrepaSale-${suffix}`,
    matricula: `MAT-PREPA-SALE-${suffix}`,
    nivel: "PREPA",
    prepaProgramId: program.id,
    generacion: 2026
  });
  await services.studentGroupService.addStudentToGroup({ studentId: prepaContinuing.id, groupId: seed.group.id, roleId: seed.role.id });
  await services.studentGroupService.addStudentToGroup({ studentId: prepaLeaving.id, groupId: seed.group.id, roleId: seed.role.id });
  await services.studentGroupService.addStudentToGroup({ studentId: seed.student.id, groupId: seed.group.id, roleId: seed.role.id });

  const prepaResult = await services.studentService.graduateStudents({
    level: "PREPA",
    studentIds: [prepaContinuing.id, prepaLeaving.id],
    prepaContinuingStudentIds: [prepaContinuing.id]
  });
  assert.equal(prepaResult.graduated, 1);
  assert.equal(prepaResult.transitioned, 1);
  assert.equal(prepaResult.deactivatedMemberships, 2);

  const transitioned = await services.studentService.getStudentById(prepaContinuing.id);
  const inactive = await services.studentService.getStudentById(prepaLeaving.id);
  assert.equal(transitioned.nivel, "PROFESIONAL");
  assert.equal(transitioned.academicPending, true);
  assert.equal(transitioned.generacion, null);
  assert.equal(transitioned.careerId, null);
  assert.equal(inactive.activo, false);

  const professionalResult = await services.studentService.graduateStudents({
    level: "PROFESIONAL",
    studentIds: [seed.student.id]
  });
  assert.equal(professionalResult.graduated, 1);
  assert.equal(professionalResult.transitioned, 0);
  const professional = await services.studentService.getStudentById(seed.student.id);
  assert.equal(professional.activo, false);
});

test("soft delete deactivates memberships and dashboard counts ignore deleted records", async () => {
  if (!services) {
    throw new Error("Servicios de prueba no disponibles.");
  }

  const groupSeed = await seedBase(`delete-group-${Date.now()}`);
  await services.studentGroupService.addStudentToGroup({
    studentId: groupSeed.student.id,
    groupId: groupSeed.group.id,
    roleId: groupSeed.role.id
  });

  let summary = await services.metaService.getSummary();
  const studentsInGroupsBeforeGroupDelete = summary.general.studentsInGroups;

  await services.groupService.deleteGroup(groupSeed.group.id);
  let studentHistory = await services.studentGroupService.getParticipationHistoryByStudent(groupSeed.student.id);
  const deletedGroupMembership = studentHistory.find((membership) => membership.groupId === groupSeed.group.id);
  assert.equal(deletedGroupMembership?.active, false);
  assert.ok(deletedGroupMembership?.leftAt);

  summary = await services.metaService.getSummary();
  assert.equal(summary.general.studentsInGroups, studentsInGroupsBeforeGroupDelete - 1);
  assert.equal(studentHistory.some((membership) => membership.groupId === groupSeed.group.id && membership.active), false);

  const studentSeed = await seedBase(`delete-student-${Date.now()}`);
  await services.studentGroupService.addStudentToGroup({
    studentId: studentSeed.student.id,
    groupId: studentSeed.group.id,
    roleId: studentSeed.role.id
  });

  summary = await services.metaService.getSummary();
  const studentsInGroupsBeforeStudentDelete = summary.general.studentsInGroups;

  await services.studentService.deleteStudent(studentSeed.student.id);
  const groupHistory = await services.studentGroupService.getParticipationHistoryByGroup(studentSeed.group.id);
  const deletedStudentMembership = groupHistory.find((membership) => membership.studentId === studentSeed.student.id);
  assert.equal(deletedStudentMembership?.active, false);
  assert.ok(deletedStudentMembership?.leftAt);

  summary = await services.metaService.getSummary();
  assert.equal(summary.general.studentsInGroups, studentsInGroupsBeforeStudentDelete - 1);
  assert.equal(groupHistory.some((membership) => membership.studentId === studentSeed.student.id && membership.active), false);
});

test("restore from trash rejects duplicates with active records", async () => {
  if (!services) {
    throw new Error("Servicios de prueba no disponibles.");
  }

  const suffix = `restore-${Date.now()}`;
  const giro = await services.giroService.createCategory({
    name: `GiroRestore-${suffix}`,
    description: "restore"
  });
  const portfolio = await services.portfolioService.createPortfolio({
    name: `PortafolioRestore-${suffix}`,
    description: "restore"
  });
  const deletedGroup = await services.groupService.createGroup({
    nombre: `GrupoRestore-${suffix}`,
    giroId: giro.id,
    portfolioId: portfolio.id,
    descripcion: "deleted"
  });
  await services.groupService.deleteGroup(deletedGroup.id);
  await services.groupService.createGroup({
    nombre: deletedGroup.nombre,
    giroId: giro.id,
    portfolioId: portfolio.id,
    descripcion: "active duplicate"
  });

  await assert.rejects(
    () => services.groupService.restoreGroup(deletedGroup.id),
    /Ya existe un grupo con ese nombre/i
  );

  const career = await services.careerService.createCareer({
    name: `CarreraRestore-${suffix}`,
    description: "restore"
  });
  const deletedStudent = await services.studentService.createStudent({
    nombre: `AlumnoRestore-${suffix}`,
    matricula: `MAT-RESTORE-A-${suffix}`,
    nivel: "PROFESIONAL",
    careerId: career.id,
    generacion: 2024,
    email: `restore-${suffix}@test.local`
  });
  await services.studentService.deleteStudent(deletedStudent.id);
  await services.studentService.createStudent({
    nombre: deletedStudent.nombre,
    matricula: `MAT-RESTORE-B-${suffix}`,
    nivel: "PROFESIONAL",
    careerId: career.id,
    generacion: 2024,
    email: deletedStudent.email
  });

  await assert.rejects(
    () => services.studentService.restoreStudent(deletedStudent.id),
    /Ya existe un estudiante con ese (correo|nombre)/i
  );
});

test("admin password update validates current password in the backend", async () => {
  if (!services) {
    throw new Error("Servicios de prueba no disponibles.");
  }

  const suffix = Date.now();
  const currentPassword = `actual-${suffix}`;
  const nextPassword = `nueva-${suffix}`;

  await services.adminAuthService.setInitialPassword({ password: currentPassword });
  await assert.rejects(
    () => services.adminAuthService.updatePassword({
      currentPassword: `otra-${suffix}`,
      newPassword: nextPassword
    }),
    /contraseña anterior es incorrecta/i
  );

  await services.adminAuthService.updatePassword({ currentPassword, newPassword: nextPassword });
  await assert.rejects(
    () => services.adminAuthService.loginAdmin({ password: currentPassword }),
    /Contraseña incorrecta/i
  );

  const login = await services.adminAuthService.loginAdmin({ password: nextPassword });
  assert.equal(login.success, true);
});

async function loadServices() {
  const { bootstrapDatabase } = await import("../src/database/bootstrap");
  await bootstrapDatabase();
  const { createBackendServices } = await import("../src/main/container");
  return createBackendServices();
}

async function seedBase(suffix: string) {
  if (!services) {
    throw new Error("Servicios no inicializados.");
  }

  const giro = await services.giroService.createCategory({
    name: `Giro-${suffix}`,
    description: "seed"
  });
  const portfolio = await services.portfolioService.createPortfolio({
    name: `Portafolio-${suffix}`,
    description: "seed"
  });
  const role = await services.roleService.createRole({
    name: `Rol-${suffix}`,
    description: "seed"
  });
  const career = await services.careerService.createCareer({
    name: `Carrera-${suffix}`,
    description: "seed"
  });
  const group = await services.groupService.createGroup({
    nombre: `Grupo-${suffix}`,
    giroId: giro.id,
    portfolioId: portfolio.id,
    descripcion: "seed"
  });
  const student = await services.studentService.createStudent({
    nombre: `Alumno-${suffix}`,
    matricula: `MAT-${suffix}`,
    nivel: "PROFESIONAL",
    careerId: career.id,
    generacion: 2024
  });

  return { giro, portfolio, role, career, group, student };
}

async function writeManagementWorkbook(
  targetPath: string,
  rows: Array<{ matricula: string; nombre: string; rol: string }>
) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Plantilla");
  sheet.columns = [
    { header: "Matricula", key: "matricula" },
    { header: "Nombre", key: "nombre" },
    { header: "Rol", key: "rol" }
  ];
  for (const row of rows) {
    sheet.addRow({
      matricula: row.matricula,
      nombre: row.nombre,
      rol: row.rol
    });
  }
  await workbook.xlsx.writeFile(targetPath);
}

async function fileExists(targetPath: string) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function removeTempDataDir() {
  for (let attempt = 1; attempt <= 6; attempt += 1) {
    try {
      await fs.rm(tempDataDir, { recursive: true, force: true });
      return;
    } catch (error) {
      if (attempt === 6) {
        if (isTransientWindowsLock(error)) {
          return;
        }
        throw error;
      }
      await delay(150 * attempt);
    }
  }
}

function isTransientWindowsLock(error: unknown): boolean {
  return Boolean(
    error
      && typeof error === "object"
      && "code" in error
      && (error.code === "EBUSY" || error.code === "EPERM")
  );
}
