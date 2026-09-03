import {
  Children,
  isValidElement,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  type SelectHTMLAttributes
} from "react";
import { desktopApi } from "./api";
import { TrashList } from "./components/TrashList";
import { extractDroppedSourcePath } from "./utils/dropped-file";
import type { AppMetaSummary } from "../../src/types/ipc";
import type {
  BulkImportResult,
  Career,
  Giro,
  Group,
  GroupExportColumn,
  GroupManagementPreview,
  GroupSearchFilters,
  OperationalSummary,
  ParticipationExportScope,
  PendingMembership,
  Portfolio,
  PrepaProgram,
  ReportExportKind,
  Role,
  Student,
  StudentExportColumn,
  StudentLevel
} from "../../src/types/domain";

type View = "dashboard" | "students" | "groups" | "catalogs" | "account" | "backups";
type GroupWithCatalogs = Group & { giro: Giro | null; portfolio: Portfolio | null };
type StudentMembership = {
  id: string;
  studentId: string;
  groupId: string;
  joinedAt: string | Date;
  leftAt: string | Date | null;
  active: boolean;
  role: Role | null;
  group: GroupWithCatalogs;
};
type GroupMembership = {
  id: string;
  studentId: string;
  groupId: string;
  joinedAt: string | Date;
  leftAt: string | Date | null;
  active: boolean;
  role: Role | null;
  student: Student;
};
type PendingMembershipRow = PendingMembership & {
  group: GroupWithCatalogs;
  role: Role | null;
  resolvedStudent: Student | null;
};
type GraduationState = {
  open: boolean;
  level: StudentLevel;
  query: string;
  generation: string;
  selectedIds: string[];
  continuingIds: string[];
};
type AssetMap = Record<string, string>;
type CatalogType = "giro" | "portfolio" | "role" | "career" | "program";
type ExportTarget = "students" | "groups" | "memberships";
type ConfirmState = {
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => Promise<void>;
};
type StudentExportFilterState = {
  studentIds: string[];
  nombre: string;
  matricula: string;
  generacion: string;
  nivel: string;
  careerId: string;
  prepaProgramId: string;
  activo: string;
  groupIds: string[];
  giroIds: string[];
  portfolioIds: string[];
  roleIds: string[];
  participationStatus: ParticipationExportScope;
};
type GroupExportFilterState = {
  groupIds: string[];
  giroIds: string[];
  portfolioIds: string[];
  roleIds: string[];
  studentLevel: string;
  participationStatus: ParticipationExportScope;
};
type StudentCreateMembershipDraft = {
  id: string;
  groupId: string;
  roleId: string;
  joinedAt: string;
};
type ReportOption = {
  kind: ReportExportKind;
  label: string;
  description: string;
};
const CATALOG_PAGE_SIZE = 8;
const SEARCH_DEBOUNCE_MS = 350;

const sidebarLogoUrl = new URL("../../images/vincula.png", import.meta.url).href;

const emptyStudentSearch = {
  nombre: "",
  matricula: "",
  generacion: "",
  nivel: "",
  roleId: "",
  careerId: "",
  prepaProgramId: "",
  activo: ""
};

const emptyGroupSearch = { nombre: "", giroId: "", portfolioId: "" };

const studentExportColumnOptions: Array<{ id: StudentExportColumn; label: string }> = [
  { id: "nombre", label: "Nombre" },
  { id: "matricula", label: "Matricula" },
  { id: "nivel", label: "Nivel" },
  { id: "career", label: "Carrera" },
  { id: "prepaProgram", label: "Programa prepa" },
  { id: "generacion", label: "Generacion" },
  { id: "email", label: "Email" },
  { id: "telefono", label: "Telefono" },
  { id: "notas", label: "Notas" },
  { id: "activo", label: "Activo" },
  { id: "activeGroups", label: "Grupos activos" },
  { id: "activeRoles", label: "Roles activos" },
  { id: "activeGroupCount", label: "Total grupos activos" },
  { id: "createdAt", label: "Creado" },
  { id: "updatedAt", label: "Actualizado" }
];
const groupExportColumnOptions: Array<{ id: GroupExportColumn; label: string }> = [
  { id: "nombre", label: "Nombre" },
  { id: "giro", label: "Giro" },
  { id: "portfolio", label: "Portafolio" },
  { id: "descripcion", label: "Descripcion" },
  { id: "activeStudents", label: "Estudiantes activos" },
  { id: "activeMatriculas", label: "Matriculas activas" },
  { id: "activeEmails", label: "Correos activos" },
  { id: "activeRoles", label: "Roles presentes" },
  { id: "activeStudentCount", label: "Total estudiantes activos" },
  { id: "createdAt", label: "Creado" },
  { id: "updatedAt", label: "Actualizado" }
];
const defaultStudentExportColumns = studentExportColumnOptions.map((option) => option.id);
const defaultGroupExportColumns = groupExportColumnOptions.map((option) => option.id);
const defaultStudentExportFilters: StudentExportFilterState = {
  studentIds: [],
  nombre: "",
  matricula: "",
  generacion: "",
  nivel: "",
  careerId: "",
  prepaProgramId: "",
  activo: "",
  groupIds: [],
  giroIds: [],
  portfolioIds: [],
  roleIds: [],
  participationStatus: "active"
};
const defaultGroupExportFilters: GroupExportFilterState = {
  groupIds: [],
  giroIds: [],
  portfolioIds: [],
  roleIds: [],
  studentLevel: "",
  participationStatus: "active"
};

const defaultStudentForm = {
  nombre: "",
  matricula: "",
  nivel: "PROFESIONAL" as StudentLevel,
  careerId: "",
  prepaProgramId: "",
  generacion: "",
  foto: "",
  telefono: "",
  email: "",
  notas: "",
  activo: true
};

const defaultGroupForm = {
  nombre: "",
  descripcion: "",
  logo: "",
  giroId: "",
  portfolioId: ""
};

const defaultCatalogForm = {
  name: "",
  description: ""
};
const reportOptions: ReportOption[] = [
  { kind: "participations", label: "Pertenencias completas", description: "Incluye historicas y vigentes por alumno y grupo." },
  { kind: "studentsWithoutActiveGroup", label: "Estudiantes sin grupo", description: "Alumnos activos sin pertenencia vigente." },
  { kind: "groupsWithoutLeader", label: "Grupos sin lider", description: "Grupos activos sin rol lider, presidente o coordinador." },
  { kind: "groupsWithLowMembership", label: "Grupos con baja pertenencia", description: "Grupos con menos de 2 pertenencias vigentes." },
  { kind: "inactiveStudentsWithActiveMembership", label: "Inactivos con pertenencia", description: "Alumnos inactivos que aun figuran vigentes en grupos." }
];

export function App() {
  const [initialized, setInitialized] = useState<boolean | null>(null);
  const [authenticated, setAuthenticated] = useState(false);
  const [view, setView] = useState<View>("dashboard");
  const [busy, setBusy] = useState(false);
  const [busyLabel, setBusyLabel] = useState("Procesando...");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);

  const [summary, setSummary] = useState<AppMetaSummary | null>(null);
  const [operationalSummary, setOperationalSummary] = useState<OperationalSummary | null>(null);
  const [giros, setGiros] = useState<Giro[]>([]);
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [careers, setCareers] = useState<Career[]>([]);
  const [prepaPrograms, setPrepaPrograms] = useState<PrepaProgram[]>([]);
  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [allGroups, setAllGroups] = useState<GroupWithCatalogs[]>([]);
  const [groups, setGroups] = useState<GroupWithCatalogs[]>([]);
  const [deletedStudents, setDeletedStudents] = useState<Student[]>([]);
  const [deletedGroups, setDeletedGroups] = useState<GroupWithCatalogs[]>([]);
  const [deletedGiros, setDeletedGiros] = useState<Array<{ id: string; name: string; description?: string | null }>>([]);
  const [deletedPortfolios, setDeletedPortfolios] = useState<Array<{ id: string; name: string; description?: string | null }>>([]);
  const [deletedRoles, setDeletedRoles] = useState<Array<{ id: string; name: string; description?: string | null }>>([]);
  const [deletedCareers, setDeletedCareers] = useState<Array<{ id: string; name: string; description?: string | null }>>([]);
  const [deletedPrograms, setDeletedPrograms] = useState<Array<{ id: string; name: string; description?: string | null }>>([]);

  const [studentMemberships, setStudentMemberships] = useState<StudentMembership[]>([]);
  const [groupMemberships, setGroupMemberships] = useState<GroupMembership[]>([]);
  const [studentMembershipIndex, setStudentMembershipIndex] = useState<Record<string, StudentMembership[]>>({});
  const [assetUrls, setAssetUrls] = useState<AssetMap>({});

  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [selectedRoleId, setSelectedRoleId] = useState("");

  const [studentSearch, setStudentSearch] = useState(emptyStudentSearch);
  const [groupSearch, setGroupSearch] = useState(emptyGroupSearch);
  const [groupMemberSearch, setGroupMemberSearch] = useState("");
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportTarget, setExportTarget] = useState<ExportTarget>("students");
  const [studentExportFilters, setStudentExportFilters] = useState<StudentExportFilterState>(defaultStudentExportFilters);
  const [groupExportFilters, setGroupExportFilters] = useState<GroupExportFilterState>(defaultGroupExportFilters);
  const [studentExportColumns, setStudentExportColumns] = useState<StudentExportColumn[]>(defaultStudentExportColumns);
  const [groupExportColumns, setGroupExportColumns] = useState<GroupExportColumn[]>(defaultGroupExportColumns);

  const [studentForm, setStudentForm] = useState(defaultStudentForm);
  const [studentCreateMemberships, setStudentCreateMemberships] = useState<StudentCreateMembershipDraft[]>([]);
  const [pendingStudentPhotoSource, setPendingStudentPhotoSource] = useState<string | null>(null);
  const [editingStudentId, setEditingStudentId] = useState<string | null>(null);
  const [studentFormOpen, setStudentFormOpen] = useState(false);

  const [groupForm, setGroupForm] = useState(defaultGroupForm);
  const [pendingGroupLogoSource, setPendingGroupLogoSource] = useState<string | null>(null);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [groupFormOpen, setGroupFormOpen] = useState(false);

  const [catalogForm, setCatalogForm] = useState(defaultCatalogForm);
  const [catalogFormType, setCatalogFormType] = useState<CatalogType>("giro");
  const [editingCatalogId, setEditingCatalogId] = useState<string | null>(null);
  const [catalogFormOpen, setCatalogFormOpen] = useState(false);
  const [activeCatalogTab, setActiveCatalogTab] = useState<CatalogType>("giro");
  const [catalogSearchByType, setCatalogSearchByType] = useState<Record<CatalogType, string>>({
    giro: "",
    portfolio: "",
    role: "",
    career: "",
    program: ""
  });
  const [catalogPageByType, setCatalogPageByType] = useState<Record<CatalogType, number>>({
    giro: 1,
    portfolio: 1,
    role: 1,
    career: 1,
    program: 1
  });

  const [loginPassword, setLoginPassword] = useState("");
  const [setupPassword, setSetupPassword] = useState("");
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [studentDetailOpen, setStudentDetailOpen] = useState(false);
  const [groupDetailOpen, setGroupDetailOpen] = useState(false);
  const [membershipFormOpen, setMembershipFormOpen] = useState(false);
  const [studentHistoryOpen, setStudentHistoryOpen] = useState(false);
  const [groupHistoryOpen, setGroupHistoryOpen] = useState(false);
  const [membershipJoinedAt, setMembershipJoinedAt] = useState("");
  const [studentMembershipFormOpen, setStudentMembershipFormOpen] = useState(false);
  const [studentDetailGroupId, setStudentDetailGroupId] = useState("");
  const [studentDetailRoleId, setStudentDetailRoleId] = useState("");
  const [studentDetailJoinedAt, setStudentDetailJoinedAt] = useState("");
  const [membershipExportScope, setMembershipExportScope] = useState<ParticipationExportScope>("all");
  const [managementPreview, setManagementPreview] = useState<GroupManagementPreview | null>(null);
  const [pendingMemberships, setPendingMemberships] = useState<PendingMembershipRow[]>([]);
  const [pendingMembershipsOpen, setPendingMembershipsOpen] = useState(false);
  const [graduationState, setGraduationState] = useState<GraduationState>({
    open: false,
    level: "PROFESIONAL",
    query: "",
    generation: "",
    selectedIds: [],
    continuingIds: []
  });
  const studentMembershipFormRef = useRef<HTMLDivElement | null>(null);
  const studentHistoryRef = useRef<HTMLDivElement | null>(null);
  const groupMembershipFormRef = useRef<HTMLDivElement | null>(null);
  const groupHistoryRef = useRef<HTMLDivElement | null>(null);

  const selectedStudent = students.find((student) => student.id === selectedStudentId) ?? null;
  const selectedGroup = groups.find((group) => group.id === selectedGroupId) ?? null;

  useEffect(() => {
    void initializeAuth();
  }, []);

  useEffect(() => {
    if (!authenticated || view !== "students") {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void searchStudents(false);
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timeoutId);
  }, [authenticated, view, studentSearch]);

  useEffect(() => {
    if (!authenticated || view !== "groups") {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void searchGroups(false);
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timeoutId);
  }, [authenticated, view, groupSearch]);

  useEffect(() => {
    if (authenticated && view === "account") {
      void loadTrash();
    }
  }, [authenticated, view]);

  useEffect(() => {
    if (!notice) {
      return;
    }

    const timeoutId = window.setTimeout(() => setNotice(null), 4200);
    return () => window.clearTimeout(timeoutId);
  }, [notice]);

  useEffect(() => {
    if (!error) {
      return;
    }

    const timeoutId = window.setTimeout(() => setError(null), 5200);
    return () => window.clearTimeout(timeoutId);
  }, [error]);

  function scrollToOpenedSection(ref: { current: HTMLElement | null }) {
    window.setTimeout(() => {
      ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
  }

  function toggleStudentMembershipForm() {
    const willOpen = !studentMembershipFormOpen;
    setStudentMembershipFormOpen(willOpen);
    if (willOpen) {
      scrollToOpenedSection(studentMembershipFormRef);
    }
  }

  function toggleStudentHistory() {
    const willOpen = !studentHistoryOpen;
    setStudentHistoryOpen(willOpen);
    if (willOpen) {
      scrollToOpenedSection(studentHistoryRef);
    }
  }

  function toggleGroupMembershipForm() {
    const willOpen = !membershipFormOpen;
    setMembershipFormOpen(willOpen);
    if (willOpen) {
      scrollToOpenedSection(groupMembershipFormRef);
    }
  }

  function toggleGroupHistory() {
    const willOpen = !groupHistoryOpen;
    setGroupHistoryOpen(willOpen);
    if (willOpen) {
      scrollToOpenedSection(groupHistoryRef);
    }
  }

  async function initializeAuth() {
    setBusy(true);
    setError(null);

    try {
      const status = await desktopApi.auth.getStatus();
      setInitialized(status.initialized);
      setAuthenticated(status.authenticated);
      if (status.authenticated) {
        await refreshData();
      }
    } catch (caughtError) {
      setError(getErrorMessage(caughtError));
    } finally {
      setBusy(false);
    }
  }

  async function withAction(action: () => Promise<void>, successMessage?: string, actionLabel = "Procesando...") {
    setBusy(true);
    setBusyLabel(actionLabel);
    setError(null);
    setNotice(null);

    try {
      await action();
      if (successMessage) {
        setNotice(successMessage);
      }
    } catch (caughtError) {
      setError(getErrorMessage(caughtError));
    } finally {
      setBusy(false);
      setBusyLabel("Procesando...");
    }
  }

  async function hydrateSupportData(nextStudents: Student[], nextGroups: GroupWithCatalogs[]) {
    const uniqueAssetPaths = Array.from(new Set([
      ...nextStudents.map((student) => student.foto).filter(Boolean),
      ...nextGroups.map((group) => group.logo).filter(Boolean)
    ] as string[]));

    const assetEntries = await Promise.all(uniqueAssetPaths.map(async (assetPath) => {
      const resolved = await desktopApi.meta.resolveAssetUrl(assetPath);
      return [assetPath, resolved ?? ""] as const;
    }));

    const memberships = await desktopApi.memberships.listGroupsOfStudents(nextStudents.map((student) => student.id)) as StudentMembership[];
    const membershipEntries = nextStudents.map((student) => [
      student.id,
      memberships.filter((membership) => membership.studentId === student.id)
    ] as const);

    setAssetUrls(Object.fromEntries(assetEntries.filter((entry) => entry[1])));
    setStudentMembershipIndex(Object.fromEntries(membershipEntries));
  }

  async function refreshData() {
    const [
      summaryResult,
      operationalSummaryResult,
      girosResult,
      portfoliosResult,
      rolesResult,
      careersResult,
      prepaProgramsResult,
      studentsResult,
      groupsResult,
      pendingMembershipsResult
    ] = await Promise.all([
      desktopApi.meta.getSummary(),
      desktopApi.meta.getOperationalSummary(),
      desktopApi.giros.list() as Promise<Giro[]>,
      desktopApi.portfolios.list() as Promise<Portfolio[]>,
      desktopApi.roles.list() as Promise<Role[]>,
      desktopApi.careers.list() as Promise<Career[]>,
      desktopApi.prepaPrograms.list() as Promise<PrepaProgram[]>,
      desktopApi.students.list() as Promise<Student[]>,
      desktopApi.groups.list() as Promise<GroupWithCatalogs[]>,
      desktopApi.pendingMemberships.list({ status: "PENDING" }) as Promise<PendingMembershipRow[]>
    ]);

    setSummary(summaryResult);
    setOperationalSummary(operationalSummaryResult);
    setGiros(girosResult);
    setPortfolios(portfoliosResult);
    setRoles(rolesResult);
    setCareers(careersResult);
    setPrepaPrograms(prepaProgramsResult);
    setAllStudents(studentsResult);
    setStudents(studentsResult);
    setAllGroups(groupsResult);
    setGroups(groupsResult);
    setPendingMemberships(pendingMembershipsResult);

    if (!selectedStudentId || !studentsResult.some((student) => student.id === selectedStudentId)) {
      setSelectedStudentId(studentsResult[0]?.id ?? "");
    }

    if (!selectedGroupId || !groupsResult.some((group) => group.id === selectedGroupId)) {
      setSelectedGroupId(groupsResult[0]?.id ?? "");
    }

    if (selectedRoleId && !rolesResult.some((role) => role.id === selectedRoleId)) {
      setSelectedRoleId("");
    }

    await hydrateSupportData(studentsResult, groupsResult);
  }

  async function handleSetupPassword() {
    await withAction(async () => {
      await desktopApi.auth.setInitialPassword({ password: setupPassword });
      setInitialized(true);
      setSetupPassword("");
    }, "Contraseña inicial configurada.");
  }

  async function handleLogin() {
    await withAction(async () => {
      await desktopApi.auth.login({ password: loginPassword });
      setAuthenticated(true);
      setLoginPassword("");
      await refreshData();
    }, "Sesion iniciada.");
  }

  async function handleLogout() {
    await withAction(async () => {
      await desktopApi.auth.logout();
      setAuthenticated(false);
      setView("dashboard");
      setSummary(null);
      setOperationalSummary(null);
      setGiros([]);
      setPortfolios([]);
      setAllStudents([]);
      setStudents([]);
      setAllGroups([]);
      setGroups([]);
      setStudentMembershipIndex({});
      setPendingMemberships([]);
      setAssetUrls({});
    }, "Sesion cerrada.", "Cerrando sesion...");
  }

  async function handlePasswordChange() {
    await withAction(async () => {
      if (newPassword !== confirmPassword) {
        throw new Error("Las nuevas contraseñas no coinciden.");
      }

      await desktopApi.auth.updatePassword({
        currentPassword: oldPassword,
        newPassword
      });
      setPasswordModalOpen(false);
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
    }, "Contraseña actualizada.");
  }

  function buildStudentFilters() {
    return {
      ...(studentSearch.nombre ? { nombre: studentSearch.nombre } : {}),
      ...(studentSearch.matricula ? { matricula: studentSearch.matricula } : {}),
      ...(studentSearch.generacion ? { generacion: Number(studentSearch.generacion) } : {}),
      ...(studentSearch.nivel ? { nivel: studentSearch.nivel as StudentLevel } : {}),
      ...(studentSearch.roleId ? { roleId: studentSearch.roleId } : {}),
      ...(studentSearch.careerId ? { careerId: studentSearch.careerId } : {}),
      ...(studentSearch.prepaProgramId ? { prepaProgramId: studentSearch.prepaProgramId } : {}),
      ...(studentSearch.activo === "true" ? { activo: true } : {}),
      ...(studentSearch.activo === "false" ? { activo: false } : {})
    };
  }

  function buildGroupFilters() {
    return {
      ...(groupSearch.nombre ? { nombre: groupSearch.nombre } : {}),
      ...(groupSearch.giroId ? { giroId: groupSearch.giroId } : {}),
      ...(groupSearch.portfolioId ? { portfolioId: groupSearch.portfolioId } : {})
    };
  }

  async function searchStudents(showBusy = true) {
    const run = async () => {
      const results = await desktopApi.students.search(buildStudentFilters()) as Student[];

      setStudents(results);
      if (!results.some((student) => student.id === selectedStudentId)) {
        setSelectedStudentId(results[0]?.id ?? "");
      }

      await hydrateSupportData(results, groups);
    };

    if (showBusy) {
      await withAction(run, undefined, "Buscando estudiantes...");
      return;
    }

    try {
      await run();
    } catch (caughtError) {
      setError(getErrorMessage(caughtError));
    }
  }

  async function searchGroups(showBusy = true) {
    const run = async () => {
      const results = await desktopApi.groups.search(buildGroupFilters()) as GroupWithCatalogs[];

      setGroups(results);
      if (!results.some((group) => group.id === selectedGroupId)) {
        setSelectedGroupId(results[0]?.id ?? "");
      }

      await hydrateSupportData(students, results);
    };

    if (showBusy) {
      await withAction(run, undefined, "Buscando grupos...");
      return;
    }

    try {
      await run();
    } catch (caughtError) {
      setError(getErrorMessage(caughtError));
    }
  }

  async function submitStudent() {
    await withAction(async () => {
      const savedPhoto = pendingStudentPhotoSource
        ? await desktopApi.students.savePhoto(pendingStudentPhotoSource, studentForm.foto || undefined)
        : studentForm.foto;
      const payload = {
        academicPending: studentForm.nivel === "PROFESIONAL" && (!studentForm.careerId || !studentForm.generacion),
        nombre: studentForm.nombre,
        matricula: studentForm.matricula,
        nivel: studentForm.nivel,
        careerId: studentForm.nivel === "PROFESIONAL" ? studentForm.careerId : null,
        prepaProgramId: studentForm.nivel === "PREPA" ? studentForm.prepaProgramId : null,
        generacion: studentForm.generacion ? Number(studentForm.generacion) : null,
        foto: savedPhoto || null,
        telefono: studentForm.telefono,
        email: studentForm.email,
        notas: studentForm.notas,
        activo: studentForm.activo
      };

      if (editingStudentId) {
        await desktopApi.students.update(editingStudentId, payload);
        resetStudentForm();
        await refreshData();
        return;
      }

      const createdStudent = await desktopApi.students.create(payload) as Student;
      const draftMemberships = studentCreateMemberships.filter((membership) => membership.groupId);
      const creationErrors: string[] = [];

      for (const [index, membership] of draftMemberships.entries()) {
        try {
          await desktopApi.memberships.add({
            studentId: createdStudent.id,
            groupId: membership.groupId,
            roleId: membership.roleId || null,
            ...(membership.joinedAt ? { joinedAt: new Date(membership.joinedAt) } : {})
          });
        } catch (error) {
          creationErrors.push(`Pertenencia ${index + 1}: ${getErrorMessage(error)}`);
        }
      }

      resetStudentForm();
      await refreshData();

      if (creationErrors.length > 0) {
        setNotice("Estudiante creado con advertencias en pertenencias.");
        setError(creationErrors.slice(0, 3).join(" | "));
      } else {
        setNotice("Estudiante creado.");
      }
    }, editingStudentId ? "Estudiante actualizado." : undefined, editingStudentId ? "Guardando estudiante..." : "Creando estudiante...");
  }

  async function submitGroup() {
    await withAction(async () => {
      const savedLogo = pendingGroupLogoSource
        ? await desktopApi.groups.saveLogo(pendingGroupLogoSource, groupForm.logo || undefined)
        : groupForm.logo;
      const payload = {
        nombre: groupForm.nombre,
        descripcion: groupForm.descripcion,
        logo: savedLogo || null,
        giroId: groupForm.giroId || null,
        portfolioId: groupForm.portfolioId || null
      };

      if (editingGroupId) {
        await desktopApi.groups.update(editingGroupId, payload);
      } else {
        await desktopApi.groups.create(payload);
      }

      resetGroupForm();
      await refreshData();
    }, editingGroupId ? "Grupo actualizado." : "Grupo creado.", editingGroupId ? "Guardando grupo..." : "Creando grupo...");
  }

  async function submitCatalog() {
    await withAction(async () => {
      const payload = {
        name: catalogForm.name,
        description: catalogForm.description
      };

      if (catalogFormType === "giro") {
        if (editingCatalogId) {
          await desktopApi.giros.update(editingCatalogId, payload);
        } else {
          await desktopApi.giros.create(payload);
        }
      }

      if (catalogFormType === "portfolio") {
        if (editingCatalogId) {
          await desktopApi.portfolios.update(editingCatalogId, payload);
        } else {
          await desktopApi.portfolios.create(payload);
        }
      }

      if (catalogFormType === "role") {
        if (editingCatalogId) {
          await desktopApi.roles.update(editingCatalogId, payload);
        } else {
          await desktopApi.roles.create(payload);
        }
      }

      if (catalogFormType === "career") {
        if (editingCatalogId) {
          await desktopApi.careers.update(editingCatalogId, payload);
        } else {
          await desktopApi.careers.create(payload);
        }
      }

      if (catalogFormType === "program") {
        if (editingCatalogId) {
          await desktopApi.prepaPrograms.update(editingCatalogId, payload);
        } else {
          await desktopApi.prepaPrograms.create(payload);
        }
      }

      resetCatalogForm();
      await refreshData();
    }, editingCatalogId ? "Catalogo actualizado." : "Catalogo creado.");
  }

  async function openStudentDetail(studentId: string) {
    await withAction(async () => {
      setSelectedStudentId(studentId);
      const history = await desktopApi.memberships.historyByStudent(studentId) as StudentMembership[];
      setStudentMemberships(history);
      setStudentHistoryOpen(false);
      setStudentMembershipFormOpen(false);
      setStudentDetailGroupId("");
      setStudentDetailRoleId("");
      setStudentDetailJoinedAt("");
      setStudentDetailOpen(true);
    });
  }

  async function openGroupDetail(groupId: string) {
    await withAction(async () => {
      setSelectedGroupId(groupId);
      const history = await desktopApi.memberships.historyByGroup(groupId) as GroupMembership[];
      setGroupMemberships(history);
      setGroupHistoryOpen(false);
      setMembershipFormOpen(false);
      setMembershipJoinedAt("");
      setGroupMemberSearch("");
      setGroupDetailOpen(true);
    });
  }

  async function refreshSelectedStudentMemberships() {
    if (!selectedStudentId) {
      setStudentMemberships([]);
      return;
    }

    const history = await desktopApi.memberships.historyByStudent(selectedStudentId) as StudentMembership[];
    setStudentMemberships(history);
  }

  async function refreshSelectedGroupMemberships() {
    if (!selectedGroupId) {
      setGroupMemberships([]);
      return;
    }

    const history = await desktopApi.memberships.historyByGroup(selectedGroupId) as GroupMembership[];
    setGroupMemberships(history);
  }

  async function createMembership() {
    await withAction(async () => {
      if (!selectedStudentId || !selectedGroupId) {
        throw new Error("Debes seleccionar estudiante y grupo.");
      }

      await desktopApi.memberships.add({
        studentId: selectedStudentId,
        groupId: selectedGroupId,
        roleId: selectedRoleId || null,
        ...(membershipJoinedAt ? { joinedAt: new Date(membershipJoinedAt) } : {})
      });

      setMembershipJoinedAt("");
      setMembershipFormOpen(false);
      await refreshData();
      await refreshSelectedGroupMemberships();
      await refreshSelectedStudentMemberships();
    }, "Pertenencia agregada.");
  }

  async function createMembershipFromStudentDetail() {
    await withAction(async () => {
      if (!selectedStudentId || !studentDetailGroupId) {
        throw new Error("Debes seleccionar un grupo para agregar la pertenencia.");
      }

      await desktopApi.memberships.add({
        studentId: selectedStudentId,
        groupId: studentDetailGroupId,
        roleId: studentDetailRoleId || null,
        ...(studentDetailJoinedAt ? { joinedAt: new Date(studentDetailJoinedAt) } : {})
      });

      setStudentDetailGroupId("");
      setStudentDetailRoleId("");
      setStudentDetailJoinedAt("");
      setStudentMembershipFormOpen(false);
      await refreshData();
      await refreshSelectedStudentMemberships();
      if (selectedGroupId) {
        await refreshSelectedGroupMemberships();
      }
    }, "Pertenencia agregada al estudiante.");
  }

  async function removeMembership(studentId: string, groupId: string) {
    confirmAction("Remover pertenencia", "La pertenencia vigente pasara al historial del grupo.", "Remover", async () => {
      await withAction(async () => {
        await desktopApi.memberships.remove({ studentId, groupId });
        await refreshData();
        await refreshSelectedGroupMemberships();
        await refreshSelectedStudentMemberships();
      }, "Pertenencia archivada.", "Removiendo pertenencia...");
    });
  }

  async function changeMembershipRole(studentId: string, groupId: string, roleId: string) {
    await withAction(async () => {
      await desktopApi.memberships.changeRole({ studentId, groupId, roleId: roleId || null });
      await refreshSelectedGroupMemberships();
      await refreshSelectedStudentMemberships();
    }, "Rol actualizado.");
  }

  async function exportMembershipTemplateXlsx() {
    await withAction(async () => {
      const result = await desktopApi.memberships.exportTemplateXlsx();
      if (result) {
        setNotice(`Plantilla de pertenencias creada en ${result}`);
      }
    }, undefined, "Creando plantilla de pertenencias...");
  }

  async function importMembershipsFile() {
    await withAction(async () => {
      const result = await desktopApi.memberships.importCsv();
      await refreshData();
      setNotice(formatBulkImportNotice("pertenencias", result));
      if (result.errors.length > 0) {
        setError(result.errors.slice(0, 3).join(" | "));
      }
    }, undefined, "Importando pertenencias...");
  }

  async function exportOperationalReport(kind: ReportExportKind) {
    await withAction(async () => {
      const result = await desktopApi.reports.exportCsv({ kind });
      if (result) {
        const option = reportOptions.find((entry) => entry.kind === kind);
        setNotice(`${option?.label ?? "Reporte"} exportado en ${result}`);
      }
    }, undefined, "Exportando reporte...");
  }

  function confirmAction(title: string, message: string, confirmLabel: string, onConfirm: () => Promise<void>) {
    setConfirmState({ title, message, confirmLabel, onConfirm });
  }

  async function removeStudent(id: string) {
    confirmAction("Eliminar estudiante", "El estudiante se movera a la papelera y podra restaurarse despues.", "Eliminar", async () => {
      await withAction(async () => {
        await desktopApi.students.remove(id);
        await refreshData();
        await loadTrash();
      }, "Estudiante enviado a papelera.", "Eliminando estudiante...");
    });
  }

  async function removeGroup(id: string) {
    confirmAction("Eliminar grupo", "El grupo se movera a la papelera y podra restaurarse despues.", "Eliminar", async () => {
      await withAction(async () => {
        await desktopApi.groups.remove(id);
        await refreshData();
        await loadTrash();
      }, "Grupo enviado a papelera.", "Eliminando grupo...");
    });
  }

  async function removeCatalog(type: CatalogType, id: string) {
    confirmAction("Eliminar catalogo", "El registro se movera a la papelera y podra restaurarse despues.", "Eliminar", async () => {
      await withAction(async () => {
        if (type === "giro") {
          await desktopApi.giros.remove(id);
        }
        if (type === "portfolio") {
          await desktopApi.portfolios.remove(id);
        }
        if (type === "role") {
          await desktopApi.roles.remove(id);
        }
        if (type === "career") {
          await desktopApi.careers.remove(id);
        }
        if (type === "program") {
          await desktopApi.prepaPrograms.remove(id);
        }
        await refreshData();
        await loadTrash();
      }, "Catalogo enviado a papelera.", "Eliminando catalogo...");
    });
  }

  async function uploadStudentPhoto() {
    await withAction(async () => {
      const sourcePath = await desktopApi.students.pickPhoto();
      if (!sourcePath) {
        return;
      }

      setPendingStudentPhotoSource(sourcePath);
    }, "Foto lista para guardar.", "Preparando foto...");
  }

  async function handleDroppedStudentPhoto(candidatePath: string) {
    await withAction(async () => {
      const sourcePath = await desktopApi.meta.resolveDroppedPath(candidatePath, "student");
      if (!sourcePath) {
        throw new Error("No se pudo resolver el archivo arrastrado.");
      }

      setPendingStudentPhotoSource(sourcePath);
    }, "Foto lista para guardar.", "Validando foto arrastrada...");
  }

  async function uploadGroupLogo() {
    await withAction(async () => {
      const sourcePath = await desktopApi.groups.pickLogo();
      if (!sourcePath) {
        return;
      }

      setPendingGroupLogoSource(sourcePath);
    }, "Logo listo para guardar.", "Preparando logo...");
  }

  async function handleDroppedGroupLogo(candidatePath: string) {
    await withAction(async () => {
      const sourcePath = await desktopApi.meta.resolveDroppedPath(candidatePath, "group");
      if (!sourcePath) {
        throw new Error("No se pudo resolver el archivo arrastrado.");
      }

      setPendingGroupLogoSource(sourcePath);
    }, "Logo listo para guardar.", "Validando logo arrastrado...");
  }

  async function exportDatabaseDirect() {
    await withAction(async () => {
      const destinationPath = await desktopApi.backup.pickExportPath();
      if (!destinationPath) {
        return;
      }

      const result = await desktopApi.backup.exportDatabase(destinationPath);
      setNotice(`Base exportada a ${result}`);
    });
  }

  function openExportModal(target: ExportTarget) {
    setExportTarget(target);
    if (target === "students") {
      setStudentExportFilters({
        ...defaultStudentExportFilters,
        nombre: studentSearch.nombre,
        matricula: studentSearch.matricula,
        generacion: studentSearch.generacion,
        nivel: studentSearch.nivel,
        careerId: studentSearch.careerId,
        prepaProgramId: studentSearch.prepaProgramId,
        activo: studentSearch.activo,
        roleIds: studentSearch.roleId ? [studentSearch.roleId] : []
      });
    }
    if (target === "groups") {
      setGroupExportFilters({
        ...defaultGroupExportFilters,
        giroIds: groupSearch.giroId ? [groupSearch.giroId] : [],
        portfolioIds: groupSearch.portfolioId ? [groupSearch.portfolioId] : []
      });
    }
    setExportModalOpen(true);
  }

  function buildStudentExportFilters() {
    return {
      ...(studentExportFilters.studentIds.length ? { studentIds: studentExportFilters.studentIds } : {}),
      ...(studentExportFilters.nombre ? { nombre: studentExportFilters.nombre } : {}),
      ...(studentExportFilters.matricula ? { matricula: studentExportFilters.matricula } : {}),
      ...(studentExportFilters.generacion ? { generacion: Number(studentExportFilters.generacion) } : {}),
      ...(studentExportFilters.nivel ? { nivel: studentExportFilters.nivel as StudentLevel } : {}),
      ...(studentExportFilters.careerId ? { careerId: studentExportFilters.careerId } : {}),
      ...(studentExportFilters.prepaProgramId ? { prepaProgramId: studentExportFilters.prepaProgramId } : {}),
      ...(studentExportFilters.activo === "true" ? { activo: true } : {}),
      ...(studentExportFilters.activo === "false" ? { activo: false } : {}),
      ...(studentExportFilters.groupIds.length ? { groupIds: studentExportFilters.groupIds } : {}),
      ...(studentExportFilters.giroIds.length ? { giroIds: studentExportFilters.giroIds } : {}),
      ...(studentExportFilters.portfolioIds.length ? { portfolioIds: studentExportFilters.portfolioIds } : {}),
      ...(studentExportFilters.roleIds.length ? { roleIds: studentExportFilters.roleIds } : {}),
      participationStatus: studentExportFilters.participationStatus
    };
  }

  function buildGroupExportFilters(): GroupSearchFilters {
    return {
      ...(groupExportFilters.groupIds.length ? { groupIds: groupExportFilters.groupIds } : {}),
      ...(groupExportFilters.giroIds.length ? { giroIds: groupExportFilters.giroIds } : {}),
      ...(groupExportFilters.portfolioIds.length ? { portfolioIds: groupExportFilters.portfolioIds } : {}),
      ...(groupExportFilters.roleIds.length ? { roleIds: groupExportFilters.roleIds } : {}),
      ...(groupExportFilters.studentLevel ? { studentLevel: groupExportFilters.studentLevel as StudentLevel } : {}),
      participationStatus: groupExportFilters.participationStatus
    };
  }

  async function runConfiguredCsvExport() {
    await withAction(async () => {
      if (exportTarget === "students") {
        if (studentExportColumns.length === 0) {
          throw new Error("Selecciona al menos una columna para exportar estudiantes.");
        }
        const result = await desktopApi.students.exportCsv({
          filters: buildStudentExportFilters(),
          columns: studentExportColumns
        });
        if (result) {
          setExportModalOpen(false);
          setNotice(`Estudiantes exportados a ${result}`);
        }
        return;
      }

      if (exportTarget === "groups") {
        if (groupExportColumns.length === 0) {
          throw new Error("Selecciona al menos una columna para exportar grupos.");
        }
        const result = await desktopApi.groups.exportCsv({
          filters: buildGroupExportFilters(),
          columns: groupExportColumns
        });
        if (result) {
          setExportModalOpen(false);
          setNotice(`Grupos exportados a ${result}`);
        }
        return;
      }

      const result = await desktopApi.memberships.exportCsv({ participationStatus: membershipExportScope });
      if (result) {
        setExportModalOpen(false);
        setNotice(`Pertenencias exportadas a ${result}`);
      }
    }, undefined, exportTarget === "students"
      ? "Exportando estudiantes..."
      : exportTarget === "groups"
        ? "Exportando grupos..."
        : "Exportando pertenencias...");
  }

  async function exportStudentsTemplateXlsx() {
    await withAction(async () => {
      const result = await desktopApi.students.exportTemplateXlsx();
      if (result) {
        setNotice(`Plantilla de estudiantes creada en ${result}`);
      }
    }, undefined, "Creando plantilla...");
  }

  async function importStudentsFile() {
    await withAction(async () => {
      const result = await desktopApi.students.importCsv();
      await refreshData();
      setNotice(formatBulkImportNotice("estudiantes", result));
      if (result.errors.length > 0) {
        setError(result.errors.slice(0, 3).join(" | "));
      }
    }, undefined, "Importando estudiantes...");
  }

  async function exportGroupsTemplateXlsx() {
    await withAction(async () => {
      const result = await desktopApi.groups.exportTemplateXlsx();
      if (result) {
        setNotice(`Plantilla de grupos creada en ${result}`);
      }
    }, undefined, "Creando plantilla...");
  }

  async function importGroupsFile() {
    await withAction(async () => {
      const result = await desktopApi.groups.importCsv();
      await refreshData();
      setNotice(formatBulkImportNotice("grupos", result));
      if (result.errors.length > 0) {
        setError(result.errors.slice(0, 3).join(" | "));
      }
    }, undefined, "Importando grupos...");
  }

  async function loadPendingMemberships() {
    const rows = await desktopApi.pendingMemberships.list({ status: "PENDING" }) as PendingMembershipRow[];
    setPendingMemberships(rows);
  }

  async function cancelPendingMembership(pending: PendingMembershipRow) {
    confirmAction(
      "Cancelar pendiente",
      `La matricula ${pending.matricula} dejara de aparecer como alumno pendiente por agregar.`,
      "Cancelar pendiente",
      async () => {
        await withAction(async () => {
          await desktopApi.pendingMemberships.cancel(pending.id);
          await loadPendingMemberships();
        }, "Pendiente cancelado.", "Cancelando pendiente...");
      }
    );
  }

  async function exportManagementTemplate(groupId: string) {
    await withAction(async () => {
      const result = await desktopApi.groupManagement.exportTemplateXlsx(groupId);
      if (result) {
        setNotice(`Plantilla de cambio de gestion creada en ${result}`);
      }
    }, undefined, "Creando plantilla de gestion...");
  }

  async function previewManagementImport(groupId: string) {
    await withAction(async () => {
      const preview = await desktopApi.groupManagement.previewImportXlsx(groupId);
      setManagementPreview(preview.filePath ? preview : null);
      if (preview.filePath) {
        setNotice(`Preview listo: ${preview.ready} listos, ${preview.pending} pendientes, ${preview.errors} errores.`);
      }
    }, undefined, "Leyendo Excel de gestion...");
  }

  async function applyManagementImport(groupId: string) {
    if (!managementPreview?.filePath) {
      return;
    }

    confirmAction("Aplicar cambio de gestion", "Las pertenencias vigentes del grupo pasaran al historial y se cargara la nueva gestion.", "Aplicar", async () => {
      await withAction(async () => {
        const result = await desktopApi.groupManagement.applyImportXlsx({
          groupId,
          filePath: managementPreview.filePath ?? ""
        });
        await refreshData();
        await refreshSelectedGroupMemberships();
        await loadPendingMemberships();
        setManagementPreview(null);
        setNotice(`${result.archived} pertenencias archivadas. ${result.created} creadas. ${result.pending} pendientes.`);
        if (result.errors.length > 0) {
          setError(result.errors.slice(0, 3).join(" | "));
        }
      }, undefined, "Aplicando cambio de gestion...");
    });
  }

  function openGraduationModal() {
    setGraduationState({
      open: true,
      level: "PROFESIONAL",
      query: "",
      generation: "",
      selectedIds: [],
      continuingIds: []
    });
  }

  async function submitGraduation() {
    await withAction(async () => {
      const result = await desktopApi.students.graduate({
        level: graduationState.level,
        studentIds: graduationState.selectedIds,
        prepaContinuingStudentIds: graduationState.level === "PREPA" ? graduationState.continuingIds : []
      });
      setGraduationState((current) => ({ ...current, open: false }));
      await refreshData();
      setNotice(`${result.graduated} graduados. ${result.transitioned} pasan a Profesional. ${result.deactivatedMemberships} pertenencias archivadas.`);
    }, undefined, "Graduando alumnos...");
  }

  async function loadTrash() {
    const [trashStudents, trashGroups, girosTrash, portfoliosTrash, rolesTrash, careersTrash, programsTrash] = await Promise.all([
      desktopApi.students.listDeleted() as Promise<Student[]>,
      desktopApi.groups.listDeleted() as Promise<GroupWithCatalogs[]>,
      desktopApi.giros.listDeleted() as Promise<Array<{ id: string; name: string; description?: string | null }>>,
      desktopApi.portfolios.listDeleted() as Promise<Array<{ id: string; name: string; description?: string | null }>>,
      desktopApi.roles.listDeleted() as Promise<Array<{ id: string; name: string; description?: string | null }>>,
      desktopApi.careers.listDeleted() as Promise<Array<{ id: string; name: string; description?: string | null }>>,
      desktopApi.prepaPrograms.listDeleted() as Promise<Array<{ id: string; name: string; description?: string | null }>>
    ]);
    setDeletedStudents(trashStudents);
    setDeletedGroups(trashGroups);
    setDeletedGiros(girosTrash);
    setDeletedPortfolios(portfoliosTrash);
    setDeletedRoles(rolesTrash);
    setDeletedCareers(careersTrash);
    setDeletedPrograms(programsTrash);
  }

  async function restoreStudent(id: string) {
    await withAction(async () => {
      await desktopApi.students.restore(id);
      await refreshData();
      await loadTrash();
    }, "Estudiante restaurado.", "Restaurando estudiante...");
  }

  async function restoreGroup(id: string) {
    await withAction(async () => {
      await desktopApi.groups.restore(id);
      await refreshData();
      await loadTrash();
    }, "Grupo restaurado.", "Restaurando grupo...");
  }

  async function restoreCatalog(type: CatalogType, id: string) {
    await withAction(async () => {
      if (type === "giro") {
        await desktopApi.giros.restore(id);
      }
      if (type === "portfolio") {
        await desktopApi.portfolios.restore(id);
      }
      if (type === "role") {
        await desktopApi.roles.restore(id);
      }
      if (type === "career") {
        await desktopApi.careers.restore(id);
      }
      if (type === "program") {
        await desktopApi.prepaPrograms.restore(id);
      }
      await refreshData();
      await loadTrash();
    }, "Catalogo restaurado.", "Restaurando catalogo...");
  }

  async function permanentlyDeleteStudent(id: string) {
    confirmAction(
      "Eliminar estudiante definitivamente",
      "Esta accion es irreversible y eliminara el estudiante de forma permanente. Si tiene foto guardada, tambien se eliminara.",
      "Eliminar definitivamente",
      async () => {
        await withAction(async () => {
          await desktopApi.students.permanentDelete(id);
          await refreshData();
          await loadTrash();
        }, "Estudiante eliminado definitivamente.", "Eliminando de papelera...");
      }
    );
  }

  async function permanentlyDeleteGroup(id: string) {
    confirmAction(
      "Eliminar grupo definitivamente",
      "Esta accion es irreversible y eliminara el grupo de forma permanente. Si tiene logo guardado, tambien se eliminara.",
      "Eliminar definitivamente",
      async () => {
        await withAction(async () => {
          await desktopApi.groups.permanentDelete(id);
          await refreshData();
          await loadTrash();
        }, "Grupo eliminado definitivamente.", "Eliminando de papelera...");
      }
    );
  }

  async function permanentlyDeleteCatalog(type: CatalogType, id: string) {
    confirmAction(
      "Eliminar catalogo definitivamente",
      "Esta accion es irreversible y eliminara el registro de forma permanente.",
      "Eliminar definitivamente",
      async () => {
        await withAction(async () => {
          if (type === "giro") {
            await desktopApi.giros.permanentDelete(id);
          }
          if (type === "portfolio") {
            await desktopApi.portfolios.permanentDelete(id);
          }
          if (type === "role") {
            await desktopApi.roles.permanentDelete(id);
          }
          if (type === "career") {
            await desktopApi.careers.permanentDelete(id);
          }
          if (type === "program") {
            await desktopApi.prepaPrograms.permanentDelete(id);
          }
          await refreshData();
          await loadTrash();
        }, "Catalogo eliminado definitivamente.", "Eliminando de papelera...");
      }
    );
  }

  async function importDatabaseDirect() {
    confirmAction("Importar respaldo", "Esto reemplazara la base actual. Asegurate de tener una copia antes de continuar.", "Importar", async () => {
      await withAction(async () => {
        const sourcePath = await desktopApi.backup.pickImportPath();
        if (!sourcePath) {
          return;
        }

        const result = await desktopApi.backup.importDatabase(sourcePath);
        setNotice(`Base importada desde ${result}`);
        await refreshData();
        await refreshSelectedGroupMemberships();
        await refreshSelectedStudentMemberships();
      }, undefined, "Importando respaldo...");
    });
  }

  function openCreateStudentModal(pending?: PendingMembershipRow) {
    setEditingStudentId(null);
    setPendingStudentPhotoSource(null);
    setStudentCreateMemberships([createStudentMembershipDraft()]);
    setStudentForm({
      ...defaultStudentForm,
      nombre: pending?.nombre ?? "",
      matricula: pending?.matricula ?? "",
      careerId: careers[0]?.id ?? "",
      prepaProgramId: prepaPrograms[0]?.id ?? ""
    });
    setStudentFormOpen(true);
  }

  function openCreateStudentFromPending(pending: PendingMembershipRow) {
    setPendingMembershipsOpen(false);
    openCreateStudentModal(pending);
  }

  function openEditStudentModal(student: Student) {
    setEditingStudentId(student.id);
    setPendingStudentPhotoSource(null);
    setStudentCreateMemberships([]);
    setStudentForm({
      nombre: student.nombre,
      matricula: student.matricula,
      nivel: student.nivel,
      careerId: student.careerId ?? "",
      prepaProgramId: student.prepaProgramId ?? "",
      generacion: student.generacion == null ? "" : String(student.generacion),
      foto: student.foto ?? "",
      telefono: student.telefono ?? "",
      email: student.email ?? "",
      notas: student.notas ?? "",
      activo: student.activo
    });
    setStudentFormOpen(true);
  }

  function resetStudentForm() {
    setEditingStudentId(null);
    setPendingStudentPhotoSource(null);
    setStudentCreateMemberships([]);
    setStudentForm(defaultStudentForm);
    setStudentFormOpen(false);
  }

  function addStudentCreateMembershipRow() {
    setStudentCreateMemberships((current) => [...current, createStudentMembershipDraft()]);
  }

  function updateStudentCreateMembershipRow(id: string, patch: Partial<StudentCreateMembershipDraft>) {
    setStudentCreateMemberships((current) => current.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }

  function removeStudentCreateMembershipRow(id: string) {
    setStudentCreateMemberships((current) => {
      if (current.length <= 1) {
        return [createStudentMembershipDraft()];
      }

      return current.filter((row) => row.id !== id);
    });
  }

  function openCreateGroupModal() {
    setEditingGroupId(null);
    setPendingGroupLogoSource(null);
    setGroupForm({
      ...defaultGroupForm,
      giroId: giros[0]?.id ?? "",
      portfolioId: portfolios[0]?.id ?? ""
    });
    setGroupFormOpen(true);
  }

  function openEditGroupModal(group: GroupWithCatalogs) {
    setEditingGroupId(group.id);
    setPendingGroupLogoSource(null);
    setGroupForm({
      nombre: group.nombre,
      descripcion: group.descripcion ?? "",
      logo: group.logo ?? "",
      giroId: group.giroId ?? "",
      portfolioId: group.portfolioId ?? ""
    });
    setGroupFormOpen(true);
  }

  function resetGroupForm() {
    setEditingGroupId(null);
    setPendingGroupLogoSource(null);
    setGroupForm(defaultGroupForm);
    setGroupFormOpen(false);
  }

  function openCatalogModal(type: CatalogType, entity?: { id: string; name: string; description?: string | null }) {
    setCatalogFormType(type);
    setEditingCatalogId(entity?.id ?? null);
    setCatalogForm({
      name: entity?.name ?? "",
      description: entity?.description ?? ""
    });
    setCatalogFormOpen(true);
  }

  function resetCatalogForm() {
    setEditingCatalogId(null);
    setCatalogForm(defaultCatalogForm);
    setCatalogFormType("giro");
    setCatalogFormOpen(false);
  }

  const selectedStudentAssetUrl = resolveAssetUrl(assetUrls, selectedStudent?.foto);
  const selectedGroupAssetUrl = resolveAssetUrl(assetUrls, selectedGroup?.logo);
  const selectedStudentActiveMemberships = studentMemberships.filter((membership) => membership.active && membership.group.deletedAt === null);
  const normalizedGroupMemberSearch = groupMemberSearch.trim().toLowerCase();
  const filteredActiveMembers = groupMemberships
    .filter((membership) => membership.active && membership.student.deletedAt === null)
    .filter((membership) => matchesMembershipSearch(membership, normalizedGroupMemberSearch));
  const filteredGroupHistory = groupMemberships.filter((membership) => matchesMembershipSearch(membership, normalizedGroupMemberSearch));
  const groupSelectOptions = allGroups.map((group) => ({
    value: group.id,
    label: group.nombre
  }));
  const giroSelectOptions = giros.map((giro) => ({
    value: giro.id,
    label: giro.name
  }));
  const portfolioSelectOptions = portfolios.map((portfolio) => ({
    value: portfolio.id,
    label: portfolio.name
  }));
  const roleSelectOptions = roles.map((role) => ({
    value: role.id,
    label: role.name
  }));
  const studentSelectOptions = allStudents.map((student) => ({
    value: student.id,
    label: `${student.nombre} - ${student.matricula}`
  }));
  const catalogItemsByType: Record<CatalogType, Array<{ id: string; name: string; description?: string | null }>> = {
    giro: giros,
    portfolio: portfolios,
    role: roles,
    career: careers,
    program: prepaPrograms
  };
  const activeCatalogSearch = catalogSearchByType[activeCatalogTab].trim().toLowerCase();
  const activeCatalogItems = activeCatalogSearch
    ? catalogItemsByType[activeCatalogTab].filter((item) => [
        item.name,
        item.description ?? ""
      ].join(" ").toLowerCase().includes(activeCatalogSearch))
    : catalogItemsByType[activeCatalogTab];
  const activeCatalogPage = Math.min(
    catalogPageByType[activeCatalogTab] ?? 1,
    Math.max(1, Math.ceil(activeCatalogItems.length / CATALOG_PAGE_SIZE))
  );
  const totalCatalogPages = Math.max(1, Math.ceil(activeCatalogItems.length / CATALOG_PAGE_SIZE));
  const paginatedCatalogItems = activeCatalogItems.slice((activeCatalogPage - 1) * CATALOG_PAGE_SIZE, activeCatalogPage * CATALOG_PAGE_SIZE);
  const graduationCandidates = allStudents
    .filter((student) => student.activo && student.nivel === graduationState.level)
    .filter((student) => !graduationState.generation || String(student.generacion ?? "").includes(graduationState.generation))
    .filter((student) => {
      const query = graduationState.query.trim().toLowerCase();
      if (!query) {
        return true;
      }

      return [student.nombre, student.matricula, String(student.generacion ?? "")]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  const graduationSelectedSet = new Set(graduationState.selectedIds);
  const graduationContinuingSet = new Set(graduationState.continuingIds);

  if (initialized === null) {
    return <LoadingScreen message="Inicializando sistema..." />;
  }

  if (!initialized) {
    return (
      <AuthScreen
        logoUrl={sidebarLogoUrl}
        title="Iniciar sesión"
        description="Ingrese contraseña"
        password={setupPassword}
        setPassword={setSetupPassword}
        busy={busy}
        error={error}
        notice={notice}
        actionLabel="Guardar contraseña inicial"
        onSubmit={() => void handleSetupPassword()}
      />
    );
  }

  if (!authenticated) {
    return (
      <AuthScreen
        logoUrl={sidebarLogoUrl}
        title="Iniciar sesión"
        description="Ingrese contraseña"
        password={loginPassword}
        setPassword={setLoginPassword}
        busy={busy}
        error={error}
        notice={notice}
        actionLabel="Login"
        onSubmit={() => void handleLogin()}
      />
    );
  }

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand-block">
          <div className="sidebar-brand">
            <img src={sidebarLogoUrl} alt="ML Vincula" className="sidebar-logo sidebar-logo-wide" />
          </div>
          <p className="muted">Plataforma de gestion de grupos estudiantiles by Maquila LAB</p>
        </div>

        <nav className="nav">
          {(["dashboard", "students", "groups", "catalogs", "account", "backups"] as View[]).map((item) => (
            <button key={item} className={view === item ? "nav-item active" : "nav-item"} onClick={() => setView(item)}>
              {getViewLabel(item)}
            </button>
          ))}
        </nav>

        <button className="ghost-button" onClick={() => void handleLogout()}>Cerrar sesion</button>
      </aside>

      <main className="content">
        <header className="topbar">
          <div>
            <h2>{getViewLabel(view)}</h2>
            {view === "dashboard" ? null : <p className="muted">Operacion diaria y administracion del sistema.</p>}
          </div>
          <div className="status-row">
            {busy ? <span className="pill info">{busyLabel}</span> : null}
          </div>
        </header>

        {view === "dashboard" ? (
          <section className="stack-gap dashboard-layout">
            <div className="section-head dashboard-section-head">
              <div className="dashboard-section-copy">
                <h3>Indicadores generales</h3>
              </div>
              <button className="small-button ghost-button button-with-icon" onClick={() => void refreshData()}>
                <DashboardIcon name="refresh" />
                <span>Recargar</span>
              </button>
            </div>
            <div className="dashboard-panels">
              <div className="dashboard-primary-row">
                <DashboardSegmentCard
                  title="General"
                  segment={summary?.general}
                  pendingCount={pendingMemberships.length}
                  onPendingClick={() => setPendingMembershipsOpen(true)}
                />
              </div>
              <div className="dashboard-secondary-row">
                <DashboardSegmentCard title="Prepa" segment={summary?.prepa} />
                <DashboardSegmentCard title="Profesional" segment={summary?.profesional} />
              </div>
            </div>
          </section>
        ) : null}

        {view === "students" ? (
          <section className="stack-gap">
            <div className="search-bar-horizontal student-search-bar">
              <input className="student-filter-name" value={studentSearch.nombre} onKeyDown={(event) => handleSearchKeyDown(event, () => searchStudents())} onChange={(event) => setStudentSearch({ ...studentSearch, nombre: event.target.value })} placeholder="Nombre" />
              <input className="student-filter-matricula" value={studentSearch.matricula} onKeyDown={(event) => handleSearchKeyDown(event, () => searchStudents())} onChange={(event) => setStudentSearch({ ...studentSearch, matricula: event.target.value })} placeholder="Matricula" />
              <input className="student-filter-generacion" type="number" min="1" step="1" value={studentSearch.generacion} onKeyDown={(event) => handleSearchKeyDown(event, () => searchStudents())} onChange={(event) => setStudentSearch({ ...studentSearch, generacion: event.target.value })} placeholder="Generacion" />
              <SelectField shellClassName="student-filter-level" value={studentSearch.nivel} onChange={(event) => setStudentSearch({ ...studentSearch, nivel: event.target.value })}>
                <option value="">Todos los niveles</option>
                <option value="PROFESIONAL">PROFESIONAL</option>
                <option value="PREPA">PREPA</option>
              </SelectField>
              <SelectField shellClassName="student-filter-career" value={studentSearch.careerId} onChange={(event) => setStudentSearch({ ...studentSearch, careerId: event.target.value })}>
                <option value="">Todas las carreras</option>
                {careers.map((career) => (
                  <option key={career.id} value={career.id}>{career.name}</option>
                ))}
              </SelectField>
              <SelectField shellClassName="student-filter-program" value={studentSearch.prepaProgramId} onChange={(event) => setStudentSearch({ ...studentSearch, prepaProgramId: event.target.value })}>
                <option value="">Todos los programas</option>
                {prepaPrograms.map((program) => (
                  <option key={program.id} value={program.id}>{program.name}</option>
                ))}
              </SelectField>
              <SelectField shellClassName="student-filter-role" value={studentSearch.roleId} onChange={(event) => setStudentSearch({ ...studentSearch, roleId: event.target.value })}>
                <option value="">Todos los roles</option>
                {roles.map((role) => (
                  <option key={role.id} value={role.id}>{role.name}</option>
                ))}
              </SelectField>
              <SelectField shellClassName="student-filter-status student-status-filter" value={studentSearch.activo} onChange={(event) => setStudentSearch({ ...studentSearch, activo: event.target.value })}>
                <option value="">Activos e inactivos</option>
                <option value="true">Solo activos</option>
                <option value="false">Solo inactivos</option>
              </SelectField>
              <div className="search-actions student-search-actions">
                <button onClick={() => void searchStudents()}>Buscar</button>
                <button className="ghost-button" onClick={() => { setStudentSearch(emptyStudentSearch); void refreshData(); }}>Limpiar</button>
                <button className="ghost-button" onClick={() => openExportModal("students")}>Exportar CSV</button>
                <button className="ghost-button" onClick={() => setPendingMembershipsOpen(true)}>
                  Pendientes por agregar ({pendingMemberships.length})
                </button>
                <button className="ghost-button" onClick={openGraduationModal}>Graduar alumnos</button>
                <button onClick={() => openCreateStudentModal()}>Nuevo estudiante</button>
              </div>
            </div>

            <div className="card table-card">
              <h3>Listado de estudiantes</h3>
              <div className="list-stack">
                {students.length === 0 ? <p className="muted">No hay estudiantes con esos filtros.</p> : null}
                {students.map((student) => {
                  const allMemberships = studentMembershipIndex[student.id] ?? [];
                  const activeMemberships = allMemberships.filter((membership) => membership.active && membership.group.deletedAt === null);
                  const studentAssetUrl = resolveAssetUrl(assetUrls, student.foto);
                  return (
                    <button key={student.id} className="list-card-button" onClick={() => void openStudentDetail(student.id)}>
                      <div className="list-card-main">
                        <AvatarImage src={studentAssetUrl} fallback={getInitials(student.nombre)} small />
                        <div className="list-copy">
                          <strong className="title-dark clamp-one-line">{student.nombre}</strong>
                          <p className="muted clamp-one-line">Matricula: {student.matricula}</p>
                          <p className="muted clamp-one-line">{getStudentAcademicLabel(student)} - Gen {student.generacion ?? "Pendiente"}</p>
                          <div className="chip-row chip-row-tight">
                            {activeMemberships.slice(0, 3).map((membership) => (
                              <span key={membership.id} className="mini-chip" title={`${membership.group.nombre} - ${getMembershipRoleName(membership)}`}>
                                {membership.group.nombre}
                              </span>
                            ))}
                            {activeMemberships.length > 3 ? <span className="mini-chip muted-chip">+{activeMemberships.length - 3}</span> : null}
                            {activeMemberships.length === 0 ? <span className="mini-chip muted-chip">Sin pertenencias vigentes</span> : null}
                          </div>
                        </div>
                      </div>

                      <div className="inline-actions">
                        <span className={student.activo ? "badge success" : "badge danger"}>{student.activo ? "Activo" : "Inactivo"}</span>
                        <button className="small-button" onClick={(event) => { event.stopPropagation(); openEditStudentModal(student); }}>Editar</button>
                        <button
                          className="small-button danger-button"
                          onClick={(event) => {
                            event.stopPropagation();
                            void removeStudent(student.id);
                          }}
                        >
                          Eliminar
                        </button>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </section>
        ) : null}

        {view === "groups" ? (
          <section className="stack-gap">
            <div className="search-bar-horizontal group-search-bar">
              <input value={groupSearch.nombre} onKeyDown={(event) => handleSearchKeyDown(event, () => searchGroups())} onChange={(event) => setGroupSearch({ ...groupSearch, nombre: event.target.value })} placeholder="Nombre de grupo" />
              <SelectField value={groupSearch.giroId} onChange={(event) => setGroupSearch({ ...groupSearch, giroId: event.target.value })}>
                <option value="">Todos los giros</option>
                {giros.map((giro) => (
                  <option key={giro.id} value={giro.id}>{giro.name}</option>
                ))}
              </SelectField>
              <SelectField value={groupSearch.portfolioId} onChange={(event) => setGroupSearch({ ...groupSearch, portfolioId: event.target.value })}>
                <option value="">Todos los portafolios</option>
                {portfolios.map((portfolio) => (
                  <option key={portfolio.id} value={portfolio.id}>{portfolio.name}</option>
                ))}
              </SelectField>
              <div className="search-actions">
                <button onClick={() => void searchGroups()}>Buscar</button>
                <button className="ghost-button" onClick={() => { setGroupSearch(emptyGroupSearch); void refreshData(); }}>Limpiar</button>
                <button className="ghost-button" onClick={() => openExportModal("groups")}>Exportar CSV</button>
                <button onClick={openCreateGroupModal}>Nuevo grupo</button>
              </div>
            </div>

            <div className="card table-card">
              <h3>Listado de grupos</h3>
              <div className="list-stack">
                {groups.length === 0 ? <p className="muted">No hay grupos con esos filtros.</p> : null}
                {groups.map((group) => {
                  const groupAssetUrl = resolveAssetUrl(assetUrls, group.logo);
                  return (
                    <button key={group.id} className="list-card-button" onClick={() => void openGroupDetail(group.id)}>
                      <div className="list-card-main">
                          <AvatarImage src={groupAssetUrl} fallback={getInitials(group.nombre)} small />
                        <div className="list-copy">
                          <strong className="title-dark clamp-one-line">{group.nombre}</strong>
                          <p className="muted clamp-one-line">Giro: {getGroupGiroName(group)} - Portafolio: {getGroupPortfolioName(group)}</p>
                          <p className="muted clamp-two-lines">{group.descripcion ?? "Sin descripcion"}</p>
                        </div>
                      </div>
                      <div className="inline-actions">
                        <button className="small-button" onClick={(event) => { event.stopPropagation(); openEditGroupModal(group); }}>Editar</button>
                        <button className="small-button danger-button" onClick={(event) => { event.stopPropagation(); void removeGroup(group.id); }}>Eliminar</button>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </section>
        ) : null}

        {view === "catalogs" ? (
          <section className="stack-gap">
            <div className="catalog-nav">
              {(["giro", "portfolio", "role", "career", "program"] as CatalogType[]).map((tab) => (
                <button
                  key={tab}
                  className={activeCatalogTab === tab ? "catalog-tab active" : "catalog-tab"}
                  onClick={() => setActiveCatalogTab(tab)}
                >
                  {getCatalogSectionTitle(tab)}
                </button>
              ))}
            </div>

            <div className="search-bar-horizontal catalog-search-bar">
              <input
                value={catalogSearchByType[activeCatalogTab]}
                onChange={(event) => {
                  setCatalogSearchByType({ ...catalogSearchByType, [activeCatalogTab]: event.target.value });
                  setCatalogPageByType({ ...catalogPageByType, [activeCatalogTab]: 1 });
                }}
                placeholder={`Buscar en ${getCatalogSectionTitle(activeCatalogTab).toLowerCase()}`}
              />
              <button
                className="ghost-button"
                onClick={() => {
                  setCatalogSearchByType({ ...catalogSearchByType, [activeCatalogTab]: "" });
                  setCatalogPageByType({ ...catalogPageByType, [activeCatalogTab]: 1 });
                }}
              >
                Limpiar
              </button>
            </div>

            <CatalogSection
              title={getCatalogSectionTitle(activeCatalogTab)}
              items={paginatedCatalogItems}
              currentPage={activeCatalogPage}
              totalPages={totalCatalogPages}
              onPrevPage={() => setCatalogPageByType((current) => ({ ...current, [activeCatalogTab]: Math.max(1, activeCatalogPage - 1) }))}
              onNextPage={() => setCatalogPageByType((current) => ({ ...current, [activeCatalogTab]: Math.min(totalCatalogPages, activeCatalogPage + 1) }))}
              onCreate={() => openCatalogModal(activeCatalogTab)}
              onEdit={(item) => openCatalogModal(activeCatalogTab, item)}
              onDelete={(id) => void removeCatalog(activeCatalogTab, id)}
            />
          </section>
        ) : null}

        {view === "account" ? (
          <section className="stack-gap">
            <div className="card form-stack trash-section-card">
              <h3>Contraseña</h3>
              <div className="password-preview">••••••••••</div>
              <button onClick={() => setPasswordModalOpen(true)}>Cambiar contraseña</button>
            </div>
            <div className="card form-stack">
              <div className="section-head">
                <h3>Papelera</h3>
                <button className="ghost-button" onClick={() => void loadTrash()}>Actualizar</button>
              </div>
              <p className="muted">Restaura estudiantes, grupos y catalogos eliminados.</p>
              <div className="trash-grid six-panels">
                <TrashList title="Estudiantes" items={deletedStudents.map((student) => ({ id: student.id, label: student.nombre }))} onRestore={(id) => void restoreStudent(id)} onPermanentDelete={(id) => void permanentlyDeleteStudent(id)} />
                <TrashList title="Grupos" items={deletedGroups.map((group) => ({ id: group.id, label: group.nombre }))} onRestore={(id) => void restoreGroup(id)} onPermanentDelete={(id) => void permanentlyDeleteGroup(id)} />
                <TrashList title="Giros" items={deletedGiros.map((item) => ({ id: item.id, label: item.name }))} onRestore={(id) => void restoreCatalog("giro", id)} onPermanentDelete={(id) => void permanentlyDeleteCatalog("giro", id)} />
                <TrashList title="Portafolios" items={deletedPortfolios.map((item) => ({ id: item.id, label: item.name }))} onRestore={(id) => void restoreCatalog("portfolio", id)} onPermanentDelete={(id) => void permanentlyDeleteCatalog("portfolio", id)} />
                <TrashList title="Roles" items={deletedRoles.map((item) => ({ id: item.id, label: item.name }))} onRestore={(id) => void restoreCatalog("role", id)} onPermanentDelete={(id) => void permanentlyDeleteCatalog("role", id)} />
                <TrashList title="Carreras" items={deletedCareers.map((item) => ({ id: item.id, label: item.name }))} onRestore={(id) => void restoreCatalog("career", id)} onPermanentDelete={(id) => void permanentlyDeleteCatalog("career", id)} />
                <TrashList title="Programas" items={deletedPrograms.map((item) => ({ id: item.id, label: item.name }))} onRestore={(id) => void restoreCatalog("program", id)} onPermanentDelete={(id) => void permanentlyDeleteCatalog("program", id)} />
              </div>
            </div>
          </section>
        ) : null}

        {view === "backups" ? (
          <section className="stack-gap">
            <div className="grid two-columns">
              <div className="card form-stack">
                <h3>Exportar respaldo</h3>
                <p className="muted">Exporta un respaldo .zip con base de datos e imagenes. .db sigue disponible como formato legado.</p>
                <button onClick={() => void exportDatabaseDirect()}>Exportar respaldo</button>
              </div>
              <div className="card form-stack">
                <h3>Importar respaldo</h3>
                <p className="muted">Importa .zip (recomendado) o .db legado. El .zip restaura base e imagenes.</p>
                <button className="danger-button" onClick={() => void importDatabaseDirect()}>Importar y reemplazar datos actuales</button>
              </div>
            </div>
            <div className="grid backups-csv-grid">
              <div className="card form-stack backup-domain-card">
                <h3>Estudiantes CSV</h3>
                <p className="muted">Plantilla e importacion masiva de estudiantes.</p>
                <div className="row-actions backup-domain-actions">
                  <button className="ghost-button" onClick={() => void exportStudentsTemplateXlsx()}>Descargar plantilla Excel para importar estudiantes</button>
                  <button className="danger-button" onClick={() => void importStudentsFile()}>Importar estudiantes desde Excel o CSV</button>
                </div>
              </div>
              <div className="card form-stack backup-domain-card">
                <h3>Grupos CSV</h3>
                <p className="muted">Plantilla e importacion masiva de grupos.</p>
                <div className="row-actions backup-domain-actions">
                  <button className="ghost-button" onClick={() => void exportGroupsTemplateXlsx()}>Descargar plantilla Excel para importar grupos</button>
                  <button className="danger-button" onClick={() => void importGroupsFile()}>Importar grupos desde Excel o CSV</button>
                </div>
              </div>
              <div className="card form-stack backup-domain-card">
                <h3>Pertenencias CSV</h3>
                <p className="muted">Plantilla e importacion masiva de pertenencias.</p>
                <div className="row-actions backup-domain-actions">
                  <button className="ghost-button" onClick={() => void exportMembershipTemplateXlsx()}>Descargar plantilla Excel para importar pertenencias</button>
                  <button className="danger-button" onClick={() => void importMembershipsFile()}>Importar pertenencias desde Excel o CSV</button>
                </div>
              </div>
            </div>
          </section>
        ) : null}
      </main>

      {studentFormOpen ? (
        <Modal title={editingStudentId ? "Editar estudiante" : "Nuevo estudiante"} onClose={resetStudentForm}>
          <div className="grid compact-grid">
            <input value={studentForm.nombre} onChange={(event) => setStudentForm({ ...studentForm, nombre: event.target.value })} placeholder="Nombre" />
            <input value={studentForm.matricula} onChange={(event) => setStudentForm({ ...studentForm, matricula: event.target.value })} placeholder="Matricula" />
            <SelectField value={studentForm.nivel} onChange={(event) => setStudentForm({
              ...studentForm,
              nivel: event.target.value as StudentLevel,
              careerId: event.target.value === "PROFESIONAL" ? studentForm.careerId || careers[0]?.id || "" : "",
              prepaProgramId: event.target.value === "PREPA" ? studentForm.prepaProgramId || prepaPrograms[0]?.id || "" : ""
            })}>
              <option value="PROFESIONAL">PROFESIONAL</option>
              <option value="PREPA">PREPA</option>
            </SelectField>
            <input type="number" min="1" step="1" value={studentForm.generacion} onChange={(event) => setStudentForm({ ...studentForm, generacion: event.target.value })} placeholder="Generacion" />
            {studentForm.nivel === "PROFESIONAL" ? (
              <SelectField value={studentForm.careerId} onChange={(event) => setStudentForm({ ...studentForm, careerId: event.target.value })}>
                <option value="">Selecciona carrera</option>
                {careers.map((career) => (
                  <option key={career.id} value={career.id}>{career.name}</option>
                ))}
              </SelectField>
            ) : (
              <SelectField value={studentForm.prepaProgramId} onChange={(event) => setStudentForm({ ...studentForm, prepaProgramId: event.target.value })}>
                <option value="">Selecciona programa</option>
                {prepaPrograms.map((program) => (
                  <option key={program.id} value={program.id}>{program.name}</option>
                ))}
              </SelectField>
            )}
            <input value={studentForm.email} onChange={(event) => setStudentForm({ ...studentForm, email: event.target.value })} placeholder="Email" />
            <input value={studentForm.telefono} onChange={(event) => setStudentForm({ ...studentForm, telefono: event.target.value })} placeholder="Telefono" />
            <label className="checkbox-row modal-checkbox">
              <input type="checkbox" checked={studentForm.activo} onChange={(event) => setStudentForm({ ...studentForm, activo: event.target.checked })} />
              <span>Estudiante activo</span>
            </label>
          </div>

          <ImagePickerCard
            title="Foto del estudiante"
            src={pendingStudentPhotoSource ? localFileUrl(pendingStudentPhotoSource) : resolveAssetUrl(assetUrls, studentForm.foto)}
            fallback={studentForm.nombre ? getInitials(studentForm.nombre) : "ST"}
            buttonLabel="Elegir foto"
            onPick={() => void uploadStudentPhoto()}
            onDropSource={(sourcePath) => void handleDroppedStudentPhoto(sourcePath)}
          />

          {!editingStudentId ? (
            <div className="card form-stack form-card-embedded">
              <div className="section-head">
                <h4>Pertenencias iniciales</h4>
                <button className="small-button ghost-button" onClick={addStudentCreateMembershipRow}>Agregar fila</button>
              </div>
              {studentCreateMemberships.map((membership, index) => (
                <div key={membership.id} className="grid compact-grid">
                  <SelectField value={membership.groupId} onChange={(event) => updateStudentCreateMembershipRow(membership.id, { groupId: event.target.value })}>
                    <option value="">Grupo (opcional)</option>
                    {allGroups.map((group) => (
                      <option key={group.id} value={group.id}>{group.nombre}</option>
                    ))}
                  </SelectField>
                  <SelectField value={membership.roleId} onChange={(event) => updateStudentCreateMembershipRow(membership.id, { roleId: event.target.value })}>
                    <option value="">Rol (opcional)</option>
                    {roles.map((role) => (
                      <option key={role.id} value={role.id}>{role.name}</option>
                    ))}
                  </SelectField>
                  <input
                    type="datetime-local"
                    value={membership.joinedAt}
                    onChange={(event) => updateStudentCreateMembershipRow(membership.id, { joinedAt: event.target.value })}
                    placeholder="Ingreso"
                  />
                  <div className="row-actions">
                    <span className="muted tiny-text">Pertenencia {index + 1}</span>
                    <button className="small-button danger-button" onClick={() => removeStudentCreateMembershipRow(membership.id)}>Quitar</button>
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          <textarea value={studentForm.notas} onChange={(event) => setStudentForm({ ...studentForm, notas: event.target.value })} placeholder="Notas" />

          <div className="row-actions">
            <button onClick={() => void submitStudent()}>{editingStudentId ? "Guardar cambios" : "Crear estudiante"}</button>
            <button className="ghost-button" onClick={resetStudentForm}>Cancelar</button>
          </div>
        </Modal>
      ) : null}

      {pendingMembershipsOpen ? (
        <Modal title="Pendientes por agregar" onClose={() => setPendingMembershipsOpen(false)} className="pending-memberships-modal-card">
          <div className="section-head">
            <p className="muted">Alumnos detectados en cambios de gestion que todavia no existen en la base.</p>
            <button className="small-button ghost-button" onClick={() => void loadPendingMemberships()}>Actualizar</button>
          </div>
          <DataTable
            title="Estudiantes pendientes"
            headers={["Matricula", "Nombre", "Grupo", "Rol", "Creado", "Acciones"]}
            rows={pendingMemberships.map((pending) => [
              pending.matricula,
              pending.nombre ?? "-",
              pending.group?.nombre ?? "-",
              pending.role?.name ?? pending.roleName ?? "Sin rol",
              formatDate(pending.createdAt),
              <div key={pending.id} className="row-actions pending-membership-actions">
                <button className="small-button" onClick={() => openCreateStudentFromPending(pending)}>Agregar</button>
                <button className="small-button danger-button" onClick={() => void cancelPendingMembership(pending)}>Cancelar</button>
              </div>
            ])}
          />
        </Modal>
      ) : null}

      {groupFormOpen ? (
        <Modal title={editingGroupId ? "Editar grupo" : "Nuevo grupo"} onClose={resetGroupForm}>
          <div className="grid compact-grid">
            <input value={groupForm.nombre} onChange={(event) => setGroupForm({ ...groupForm, nombre: event.target.value })} placeholder="Nombre" />
            <SelectField value={groupForm.giroId} onChange={(event) => setGroupForm({ ...groupForm, giroId: event.target.value })}>
              <option value="">Selecciona giro</option>
              {giros.map((giro) => (
                <option key={giro.id} value={giro.id}>{giro.name}</option>
              ))}
            </SelectField>
            <SelectField value={groupForm.portfolioId} onChange={(event) => setGroupForm({ ...groupForm, portfolioId: event.target.value })}>
              <option value="">Selecciona portafolio</option>
              {portfolios.map((portfolio) => (
                <option key={portfolio.id} value={portfolio.id}>{portfolio.name}</option>
              ))}
            </SelectField>
          </div>

          <ImagePickerCard
            title="Logo del grupo"
            src={pendingGroupLogoSource ? localFileUrl(pendingGroupLogoSource) : resolveAssetUrl(assetUrls, groupForm.logo)}
            fallback={groupForm.nombre ? getInitials(groupForm.nombre) : "GR"}
            buttonLabel="Elegir logo"
            onPick={() => void uploadGroupLogo()}
            onDropSource={(sourcePath) => void handleDroppedGroupLogo(sourcePath)}
          />

          <textarea value={groupForm.descripcion} onChange={(event) => setGroupForm({ ...groupForm, descripcion: event.target.value })} placeholder="Descripcion" />

          <div className="row-actions">
            <button onClick={() => void submitGroup()}>{editingGroupId ? "Guardar cambios" : "Crear grupo"}</button>
            <button className="ghost-button" onClick={resetGroupForm}>Cancelar</button>
          </div>
        </Modal>
      ) : null}

      {catalogFormOpen ? (
        <Modal title={getCatalogModalTitle(catalogFormType, Boolean(editingCatalogId))} onClose={resetCatalogForm}>
          <input value={catalogForm.name} onChange={(event) => setCatalogForm({ ...catalogForm, name: event.target.value })} placeholder="Nombre" />
          <textarea value={catalogForm.description} onChange={(event) => setCatalogForm({ ...catalogForm, description: event.target.value })} placeholder="Descripcion" />
          <div className="row-actions">
            <button onClick={() => void submitCatalog()}>{editingCatalogId ? "Guardar cambios" : "Crear"}</button>
            <button className="ghost-button" onClick={resetCatalogForm}>Cancelar</button>
          </div>
        </Modal>
      ) : null}

      {passwordModalOpen ? (
        <Modal title="Cambiar contraseña" onClose={() => setPasswordModalOpen(false)}>
          <input value={oldPassword} onChange={(event) => setOldPassword(event.target.value)} placeholder="Contraseña actual" type="password" />
          <input value={newPassword} onChange={(event) => setNewPassword(event.target.value)} placeholder="Nueva contraseña" type="password" />
          <input value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Confirmar nueva contraseña" type="password" />
          <div className="row-actions">
            <button onClick={() => void handlePasswordChange()}>Guardar nueva contraseña</button>
            <button className="ghost-button" onClick={() => setPasswordModalOpen(false)}>Cancelar</button>
          </div>
        </Modal>
      ) : null}

      {studentDetailOpen && selectedStudent ? (
        <Modal title="Expediente de estudiante" onClose={() => setStudentDetailOpen(false)}>
          <div className="profile-grid detail-layout">
            <AvatarImage src={selectedStudentAssetUrl} fallback={getInitials(selectedStudent.nombre)} />
            <div className="detail-copy">
              <h4 className="clamp-two-lines">{selectedStudent.nombre}</h4>
              <div className="badge-row">
                <span className="badge">{selectedStudent.nivel}</span>
                <span className={selectedStudent.activo ? "badge success" : "badge danger"}>{selectedStudent.activo ? "Activo" : "Inactivo"}</span>
              </div>
              <p className="muted clamp-two-lines">Matricula: {selectedStudent.matricula}</p>
              <p className="muted clamp-two-lines">{getStudentAcademicLabel(selectedStudent)}</p>
              <p className="muted clamp-two-lines">Generacion: {selectedStudent.generacion ?? "Pendiente"}</p>
              <p className="muted clamp-two-lines">Email: {selectedStudent.email ?? "-"}</p>
              <p className="muted clamp-two-lines">Telefono: {selectedStudent.telefono ?? "-"}</p>
              {selectedStudent.notas ? <p className="muted clamp-three-lines">{selectedStudent.notas}</p> : null}
            </div>
          </div>

          <div className="detail-section">
            <h4>Grupos activos</h4>
            {selectedStudentActiveMemberships.length === 0 ? <p className="muted">No tiene pertenencias vigentes.</p> : null}
            <DataTable
              title="Pertenencias vigentes"
              headers={["Grupo", "Giro", "Portafolio", "Rol", "Ingreso", "Acciones"]}
              rows={selectedStudentActiveMemberships.map((membership) => [
                membership.group.nombre,
                getGroupGiroName(membership.group),
                getGroupPortfolioName(membership.group),
                getMembershipRoleName(membership),
                formatDate(membership.joinedAt),
                <div key={membership.id} className="inline-actions">
                  <button className="small-button" onClick={() => void removeMembership(membership.studentId, membership.groupId)}>Remover</button>
                  <SelectField
                    compact
                    className="small-select"
                    value={membership.role?.id ?? ""}
                    onChange={(event) => {
                      void changeMembershipRole(membership.studentId, membership.groupId, event.target.value);
                    }}
                  >
                    <option value="">Sin rol</option>
                    {roles.map((role) => (
                      <option key={role.id} value={role.id}>{role.name}</option>
                    ))}
                  </SelectField>
                </div>
              ])}
            />
          </div>

          <div className="row-actions">
            <button className="small-button" onClick={toggleStudentMembershipForm}>
              {studentMembershipFormOpen ? "Ocultar formulario" : "Agregar pertenencia"}
            </button>
            <button className="small-button" onClick={toggleStudentHistory}>
              {studentHistoryOpen ? "Ocultar historial" : "Ver historial de pertenencias"}
            </button>
          </div>

          {studentMembershipFormOpen ? (
            <div ref={studentMembershipFormRef} className="card form-stack form-card-embedded">
              <h4>Nueva pertenencia</h4>
              <SelectField value={studentDetailGroupId} onChange={(event) => setStudentDetailGroupId(event.target.value)}>
                <option value="">Selecciona grupo</option>
                {allGroups.map((group) => (
                  <option key={group.id} value={group.id}>{group.nombre}</option>
                ))}
              </SelectField>
              <SelectField value={studentDetailRoleId} onChange={(event) => setStudentDetailRoleId(event.target.value)}>
                <option value="">Selecciona rol</option>
                {roles.map((role) => (
                  <option key={role.id} value={role.id}>{role.name}</option>
                ))}
              </SelectField>
              <input type="datetime-local" value={studentDetailJoinedAt} onChange={(event) => setStudentDetailJoinedAt(event.target.value)} />
              <div className="row-actions">
                <button onClick={() => void createMembershipFromStudentDetail()}>Guardar pertenencia</button>
                <button className="ghost-button" onClick={() => {
                  setStudentMembershipFormOpen(false);
                  setStudentDetailGroupId("");
                  setStudentDetailRoleId("");
                  setStudentDetailJoinedAt("");
                }}
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : null}

          {studentHistoryOpen ? (
            <div ref={studentHistoryRef} className="detail-section-anchor">
              <DataTable
                title="Historial de pertenencias"
                headers={["Grupo", "Giro", "Portafolio", "Rol", "Ingreso", "Salida", "Estado"]}
                rows={studentMemberships.map((membership) => [
                  membership.group.nombre,
                  getGroupGiroName(membership.group),
                  getGroupPortfolioName(membership.group),
                  getMembershipRoleName(membership),
                  formatDate(membership.joinedAt),
                  formatDate(membership.leftAt),
                  membership.active ? "Vigente" : "Historica"
                ])}
              />
            </div>
          ) : null}
        </Modal>
      ) : null}

      {groupDetailOpen && selectedGroup ? (
        <Modal title="Expediente de grupo" onClose={() => { setGroupDetailOpen(false); setMembershipFormOpen(false); setManagementPreview(null); }}>
          <div className="profile-grid detail-layout">
            <AvatarImage src={selectedGroupAssetUrl} fallback={getInitials(selectedGroup.nombre)} />
            <div className="detail-copy">
              <h4 className="clamp-two-lines">{selectedGroup.nombre}</h4>
              <div className="badge-row">
                <span className="badge" title={getGroupGiroName(selectedGroup)}>{getGroupGiroName(selectedGroup)}</span>
                <span className="badge" title={getGroupPortfolioName(selectedGroup)}>{getGroupPortfolioName(selectedGroup)}</span>
              </div>
              <p className="muted clamp-three-lines">{selectedGroup.descripcion ?? "-"}</p>
              <p className="muted clamp-two-lines">Creado: {formatDate(selectedGroup.createdAt)}</p>
            </div>
          </div>

          <div className="row-actions">
            <button className="small-button" onClick={toggleGroupMembershipForm}>
              {membershipFormOpen ? "Ocultar formulario" : "Agregar pertenencia"}
            </button>
            <button className="ghost-button" onClick={toggleGroupHistory}>
              {groupHistoryOpen ? "Ocultar historial" : "Ver historial de pertenencias"}
            </button>
          </div>

          {membershipFormOpen ? (
            <div ref={groupMembershipFormRef} className="card form-stack form-card-embedded">
              <h4>Nueva pertenencia</h4>
              <SelectField value={selectedStudentId} onChange={(event) => setSelectedStudentId(event.target.value)}>
                <option value="">Selecciona estudiante</option>
                {allStudents.map((student) => (
                  <option key={student.id} value={student.id}>{student.nombre} - {student.matricula}</option>
                ))}
              </SelectField>
              <SelectField value={selectedRoleId} onChange={(event) => setSelectedRoleId(event.target.value)}>
                <option value="">Selecciona rol</option>
                {roles.map((role) => (
                  <option key={role.id} value={role.id}>{role.name}</option>
                ))}
              </SelectField>
              <input type="datetime-local" value={membershipJoinedAt} onChange={(event) => setMembershipJoinedAt(event.target.value)} />
              <div className="row-actions">
                <button onClick={() => void createMembership()}>Guardar pertenencia</button>
                <button className="ghost-button" onClick={() => { setMembershipFormOpen(false); setMembershipJoinedAt(""); }}>Cancelar</button>
              </div>
            </div>
          ) : null}

          <div className="card form-stack form-card-embedded">
            <div className="section-head">
              <h4>Miembros vigentes</h4>
              <input value={groupMemberSearch} onChange={(event) => setGroupMemberSearch(event.target.value)} placeholder="Buscar miembro o rol" />
            </div>
            <DataTable
              title="Miembros del grupo"
              headers={["Estudiante", "Rol", "Ingreso", "Acciones"]}
              rows={filteredActiveMembers.map((membership) => [
                `${membership.student.nombre} - ${membership.student.matricula}`,
                getMembershipRoleName(membership),
                formatDate(membership.joinedAt),
                <div key={membership.id} className="inline-actions">
                  <button className="small-button" onClick={() => void removeMembership(membership.studentId, membership.groupId)}>Remover</button>
                  <SelectField
                    compact
                    className="small-select"
                    value={membership.role?.id ?? ""}
                    onChange={(event) => {
                      void changeMembershipRole(membership.studentId, membership.groupId, event.target.value);
                    }}
                  >
                    <option value="">Sin rol</option>
                    {roles.map((role) => (
                      <option key={role.id} value={role.id}>{role.name}</option>
                    ))}
                  </SelectField>
                </div>
              ])}
            />
          </div>

          {groupHistoryOpen ? (
            <div ref={groupHistoryRef} className="detail-section-anchor">
              <DataTable
                title="Historial del grupo"
                headers={["Estudiante", "Rol", "Ingreso", "Salida", "Estado"]}
                rows={filteredGroupHistory.map((membership) => [
                  `${membership.student.nombre} - ${membership.student.matricula}`,
                  getMembershipRoleName(membership),
                  formatDate(membership.joinedAt),
                  formatDate(membership.leftAt),
                  membership.active ? "Vigente" : "Historica"
                ])}
              />
            </div>
          ) : null}

          <div className="card form-stack form-card-embedded">
            <div className="section-head">
              <h4>Cambio de gestion</h4>
              <button className="small-button ghost-button" onClick={() => void exportManagementTemplate(selectedGroup.id)}>Descargar plantilla Excel</button>
            </div>
            <div className="row-actions">
              <button className="ghost-button" onClick={() => void previewManagementImport(selectedGroup.id)}>Seleccionar Excel y previsualizar</button>
              <button
                className="danger-button"
                disabled={!managementPreview?.filePath || managementPreview.errors > 0}
                onClick={() => void applyManagementImport(selectedGroup.id)}
              >
                Aplicar cambio de gestion
              </button>
            </div>
            {managementPreview ? (
              <div className="form-stack">
                <div className="stats-strip compact-stats">
                  <StatCard label="Listos" value={managementPreview.ready} />
                  <StatCard label="Pendientes" value={managementPreview.pending} />
                  <StatCard label="Errores" value={managementPreview.errors} />
                </div>
                <DataTable
                  title="Preview de gestion"
                  headers={["Fila", "Matricula", "Nombre", "Rol", "Estado"]}
                  rows={managementPreview.rows.map((row) => [
                    row.lineNumber,
                    row.matricula,
                    row.nombre ?? "-",
                    row.roleName ?? "Sin rol",
                    row.message
                  ])}
                />
              </div>
            ) : null}
          </div>

          <div className="card form-stack form-card-embedded">
            <div className="section-head">
              <h4>Alumnos pendientes</h4>
              <button className="small-button ghost-button" onClick={() => void loadPendingMemberships()}>Actualizar</button>
            </div>
            <DataTable
              title="Pendientes del grupo"
              headers={["Matricula", "Nombre", "Rol", "Estado"]}
              rows={pendingMemberships
                .filter((pending) => pending.groupId === selectedGroup.id)
                .map((pending) => [
                  pending.matricula,
                  pending.nombre ?? "-",
                  pending.role?.name ?? pending.roleName ?? "Sin rol",
                  getPendingMembershipStatusLabel(pending.status)
                ])}
            />
          </div>
        </Modal>
      ) : null}

      {graduationState.open ? (
        <Modal title="Graduar alumnos" onClose={() => setGraduationState((current) => ({ ...current, open: false }))} className="graduation-modal-card">
          <div className="grid compact-grid">
            <SelectField value={graduationState.level} onChange={(event) => setGraduationState({
              open: true,
              level: event.target.value as StudentLevel,
              query: "",
              generation: "",
              selectedIds: [],
              continuingIds: []
            })}>
              <option value="PROFESIONAL">Profesional</option>
              <option value="PREPA">Prepa</option>
            </SelectField>
            <input value={graduationState.generation} onChange={(event) => setGraduationState((current) => ({ ...current, generation: event.target.value }))} placeholder="Filtrar por generacion" />
            <input value={graduationState.query} onChange={(event) => setGraduationState((current) => ({ ...current, query: event.target.value }))} placeholder="Buscar alumno" />
          </div>

          <div className="card form-stack form-card-embedded graduation-list">
            <div className="section-head">
              <h4>Alumnos</h4>
              <span className="muted">{graduationState.selectedIds.length} seleccionados</span>
            </div>
            {graduationCandidates.length === 0 ? <p className="muted">No hay alumnos con esos filtros.</p> : null}
            {graduationCandidates.map((student) => (
              <div key={student.id} className="list-line-row graduation-row">
                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={graduationSelectedSet.has(student.id)}
                    onChange={(event) => {
                      setGraduationState((current) => {
                        const selectedIds = event.target.checked
                          ? [...current.selectedIds, student.id]
                          : current.selectedIds.filter((id) => id !== student.id);
                        const continuingIds = event.target.checked
                          ? current.continuingIds
                          : current.continuingIds.filter((id) => id !== student.id);
                        return { ...current, selectedIds, continuingIds };
                      });
                    }}
                  />
                  <span>{student.nombre} - {student.matricula} - {student.generacion ?? "Generacion pendiente"}</span>
                </label>
                {graduationState.level === "PREPA" && graduationSelectedSet.has(student.id) ? (
                  <label className="checkbox-row">
                    <input
                      type="checkbox"
                      checked={graduationContinuingSet.has(student.id)}
                      onChange={(event) => {
                        setGraduationState((current) => ({
                          ...current,
                          continuingIds: event.target.checked
                            ? [...current.continuingIds, student.id]
                            : current.continuingIds.filter((id) => id !== student.id)
                        }));
                      }}
                    />
                    <span>Continua en Profesional</span>
                  </label>
                ) : null}
              </div>
            ))}
          </div>

          <div className="row-actions">
            <button className="danger-button" disabled={graduationState.selectedIds.length === 0} onClick={() => void submitGraduation()}>Graduar seleccionados</button>
            <button className="ghost-button" onClick={() => setGraduationState((current) => ({ ...current, open: false }))}>Cancelar</button>
          </div>
        </Modal>
      ) : null}

      {exportModalOpen ? (
        <Modal
          title="Exportar CSV"
          onClose={() => setExportModalOpen(false)}
          className={exportTarget === "memberships" ? "export-modal-card export-modal-card-compact" : "export-modal-card"}
        >
          <div className="catalog-nav export-tabs">
            <button className={exportTarget === "students" ? "catalog-tab active" : "catalog-tab"} onClick={() => setExportTarget("students")}>
              Estudiantes
            </button>
            <button className={exportTarget === "groups" ? "catalog-tab active" : "catalog-tab"} onClick={() => setExportTarget("groups")}>
              Grupos
            </button>
            <button className={exportTarget === "memberships" ? "catalog-tab active" : "catalog-tab"} onClick={() => setExportTarget("memberships")}>
              Pertenencias
            </button>
          </div>

          {exportTarget === "students" ? (
            <div className="form-stack">
              <div className="export-filter-grid">
                <MultiSelectField
                  label="Estudiantes"
                  options={studentSelectOptions}
                  selectedValues={studentExportFilters.studentIds}
                  onChange={(studentIds) => setStudentExportFilters({ ...studentExportFilters, studentIds })}
                />
                <input type="number" min="1" step="1" value={studentExportFilters.generacion} onChange={(event) => setStudentExportFilters({ ...studentExportFilters, generacion: event.target.value })} placeholder="Generacion" />
                <SelectField value={studentExportFilters.nivel} onChange={(event) => setStudentExportFilters({ ...studentExportFilters, nivel: event.target.value })}>
                  <option value="">Todos los niveles</option>
                  <option value="PROFESIONAL">PROFESIONAL</option>
                  <option value="PREPA">PREPA</option>
                </SelectField>
                <SelectField value={studentExportFilters.careerId} onChange={(event) => setStudentExportFilters({ ...studentExportFilters, careerId: event.target.value })}>
                  <option value="">Todas las carreras</option>
                  {careers.map((career) => (
                    <option key={career.id} value={career.id}>{career.name}</option>
                  ))}
                </SelectField>
                <SelectField value={studentExportFilters.prepaProgramId} onChange={(event) => setStudentExportFilters({ ...studentExportFilters, prepaProgramId: event.target.value })}>
                  <option value="">Todos los programas</option>
                  {prepaPrograms.map((program) => (
                    <option key={program.id} value={program.id}>{program.name}</option>
                  ))}
                </SelectField>
                <SelectField value={studentExportFilters.activo} onChange={(event) => setStudentExportFilters({ ...studentExportFilters, activo: event.target.value })}>
                  <option value="">Activos e inactivos</option>
                  <option value="true">Solo activos</option>
                  <option value="false">Solo inactivos</option>
                </SelectField>
                <SelectField value={studentExportFilters.participationStatus} onChange={(event) => setStudentExportFilters({ ...studentExportFilters, participationStatus: event.target.value as ParticipationExportScope })}>
                  <option value="active">Pertenencias vigentes</option>
                  <option value="all">Todo el historial</option>
                </SelectField>
                <MultiSelectField
                  label="Grupos"
                  options={groupSelectOptions}
                  selectedValues={studentExportFilters.groupIds}
                  onChange={(groupIds) => setStudentExportFilters({ ...studentExportFilters, groupIds })}
                />
                <MultiSelectField
                  label="Giros"
                  options={giroSelectOptions}
                  selectedValues={studentExportFilters.giroIds}
                  onChange={(giroIds) => setStudentExportFilters({ ...studentExportFilters, giroIds })}
                />
                <MultiSelectField
                  label="Portafolios"
                  options={portfolioSelectOptions}
                  selectedValues={studentExportFilters.portfolioIds}
                  onChange={(portfolioIds) => setStudentExportFilters({ ...studentExportFilters, portfolioIds })}
                />
                <MultiSelectField
                  label="Roles"
                  options={roleSelectOptions}
                  selectedValues={studentExportFilters.roleIds}
                  onChange={(roleIds) => setStudentExportFilters({ ...studentExportFilters, roleIds })}
                />
              </div>
              <ExportColumnSelector
                title="Campos de estudiantes"
                options={studentExportColumnOptions}
                selectedValues={studentExportColumns}
                defaultValues={defaultStudentExportColumns}
                onChange={(columns) => setStudentExportColumns(columns as StudentExportColumn[])}
              />
            </div>
          ) : null}

          {exportTarget === "groups" ? (
            <div className="form-stack">
              <div className="export-filter-grid">
                <SelectField value={groupExportFilters.studentLevel} onChange={(event) => setGroupExportFilters({ ...groupExportFilters, studentLevel: event.target.value })}>
                  <option value="">Todos los niveles</option>
                  <option value="PROFESIONAL">PROFESIONAL</option>
                  <option value="PREPA">PREPA</option>
                </SelectField>
                <SelectField value={groupExportFilters.participationStatus} onChange={(event) => setGroupExportFilters({ ...groupExportFilters, participationStatus: event.target.value as ParticipationExportScope })}>
                  <option value="active">Pertenencias vigentes</option>
                  <option value="all">Todo el historial</option>
                </SelectField>
                <MultiSelectField
                  label="Grupos"
                  options={groupSelectOptions}
                  selectedValues={groupExportFilters.groupIds}
                  onChange={(groupIds) => setGroupExportFilters({ ...groupExportFilters, groupIds })}
                />
                <MultiSelectField
                  label="Giros"
                  options={giroSelectOptions}
                  selectedValues={groupExportFilters.giroIds}
                  onChange={(giroIds) => setGroupExportFilters({ ...groupExportFilters, giroIds })}
                />
                <MultiSelectField
                  label="Portafolios"
                  options={portfolioSelectOptions}
                  selectedValues={groupExportFilters.portfolioIds}
                  onChange={(portfolioIds) => setGroupExportFilters({ ...groupExportFilters, portfolioIds })}
                />
                <MultiSelectField
                  label="Roles"
                  options={roleSelectOptions}
                  selectedValues={groupExportFilters.roleIds}
                  onChange={(roleIds) => setGroupExportFilters({ ...groupExportFilters, roleIds })}
                />
              </div>
              <ExportColumnSelector
                title="Campos de grupos"
                options={groupExportColumnOptions}
                selectedValues={groupExportColumns}
                defaultValues={defaultGroupExportColumns}
                onChange={(columns) => setGroupExportColumns(columns as GroupExportColumn[])}
              />
            </div>
          ) : null}

          {exportTarget === "memberships" ? (
            <div className="form-stack export-simple-panel export-memberships-panel">
              <SelectField value={membershipExportScope} onChange={(event) => setMembershipExportScope(event.target.value as ParticipationExportScope)}>
                <option value="all">Todas las pertenencias</option>
                <option value="active">Solo pertenencias vigentes</option>
              </SelectField>
            </div>
          ) : null}

          <div className="row-actions">
            <button onClick={() => void runConfiguredCsvExport()}>
              {exportTarget === "memberships" ? "Exportar pertenencias CSV" : "Exportar CSV"}
            </button>
            <button
              className="ghost-button"
              onClick={() => {
                if (exportTarget === "students") {
                  setStudentExportFilters(defaultStudentExportFilters);
                  setStudentExportColumns(defaultStudentExportColumns);
                } else if (exportTarget === "groups") {
                  setGroupExportFilters(defaultGroupExportFilters);
                  setGroupExportColumns(defaultGroupExportColumns);
                } else {
                  setMembershipExportScope("all");
                }
              }}
            >
              Restaurar predeterminado
            </button>
            <button className="ghost-button" onClick={() => setExportModalOpen(false)}>Cancelar</button>
          </div>
        </Modal>
      ) : null}

      {confirmState ? (
        <ConfirmModal
          state={confirmState}
          onCancel={() => setConfirmState(null)}
          onConfirm={() => {
            const action = confirmState.onConfirm;
            setConfirmState(null);
            void action();
          }}
        />
      ) : null}

      <div className="toast-stack">
        {notice ? <div className="toast success">{notice}</div> : null}
        {error ? <div className="toast danger">{error}</div> : null}
      </div>
    </div>
  );
}

function LoadingScreen({ message }: { message: string }) {
  return (
    <div className="auth-shell">
      <div className="auth-card">
        <h1>{message}</h1>
      </div>
    </div>
  );
}

function AuthScreen(props: {
  logoUrl: string;
  title: string;
  description: string;
  password: string;
  setPassword: (value: string) => void;
  busy: boolean;
  error: string | null;
  notice: string | null;
  actionLabel: string;
  onSubmit: () => void;
}) {
  return (
    <div className="auth-shell">
      <div className="auth-panel">
        <img src={props.logoUrl} alt="Vincula" className="auth-login-logo" />
        <div className="auth-card auth-brand-card">
          <div className="auth-heading">
            <h1>{props.title}</h1>
            <p>{props.description}</p>
          </div>
          <label className="auth-field-label" htmlFor="auth-password">Contraseña</label>
          <input
            id="auth-password"
            type="password"
            value={props.password}
            onChange={(event) => props.setPassword(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                props.onSubmit();
              }
            }}
            placeholder="Contraseña"
          />
          <button className="auth-submit-button" onClick={props.onSubmit} disabled={props.busy}>{props.actionLabel}</button>
          {props.notice ? <p className="success-text">{props.notice}</p> : null}
          {props.error ? <p className="error-text">{props.error}</p> : null}
        </div>
      </div>
    </div>
  );
}

function Modal({ title, onClose, children, className }: { title: string; onClose: () => void; children: ReactNode; className?: string }) {
  const modalClassName = ["modal-card", className].filter(Boolean).join(" ");

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className={modalClassName} onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <h3>{title}</h3>
          <button className="ghost-button" onClick={onClose}>Cerrar</button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

function ConfirmModal(props: { state: ConfirmState; onCancel: () => void; onConfirm: () => void }) {
  return (
    <Modal title={props.state.title} onClose={props.onCancel}>
      <p className="muted">{props.state.message}</p>
      <div className="row-actions">
        <button className="danger-button" onClick={props.onConfirm}>{props.state.confirmLabel}</button>
        <button className="ghost-button" onClick={props.onCancel}>Cancelar</button>
      </div>
    </Modal>
  );
}

function AvatarImage(props: { src?: string | null | undefined; fallback: string; small?: boolean }) {
  if (props.src) {
    return <img className={props.small ? "profile-photo small" : "profile-photo"} src={props.src} alt={props.fallback} />;
  }

  return <div className={props.small ? "profile-avatar small" : "profile-avatar"}>{props.fallback}</div>;
}

function ImagePickerCard(props: {
  title: string;
  src?: string | null | undefined;
  fallback: string;
  buttonLabel: string;
  onPick: () => void;
  onDropSource: (sourcePath: string) => void;
}) {
  return (
    <div
      className="image-picker-card"
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        void extractDroppedSourcePath(event).then((droppedSource) => {
          if (droppedSource) {
            props.onDropSource(droppedSource);
          }
        });
      }}
    >
      <div>
        <p className="muted">{props.title}</p>
        <AvatarImage src={props.src} fallback={props.fallback} />
        <span className="muted tiny-text">Arrastra una imagen aqui o elige un archivo.</span>
      </div>
      <button className="ghost-button" onClick={props.onPick}>{props.buttonLabel}</button>
    </div>
  );
}

function CatalogSection(props: {
  title: string;
  items: Array<{ id: string; name: string; description?: string | null }>;
  currentPage: number;
  totalPages: number;
  onPrevPage: () => void;
  onNextPage: () => void;
  onCreate: () => void;
  onEdit: (item: { id: string; name: string; description?: string | null }) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="card form-stack">
      <div className="section-head">
        <h3>{props.title}</h3>
        <button onClick={props.onCreate}>Nuevo</button>
      </div>
      <div className="list-stack">
        {props.items.length === 0 ? <p className="muted">No hay registros en este catalogo.</p> : null}
        {props.items.map((item) => (
          <div key={item.id} className="list-line-row">
            <div className="catalog-copy">
              <strong className="clamp-two-lines">{item.name}</strong>
              <p className="muted clamp-three-lines">{item.description ?? "Sin descripcion"}</p>
            </div>
            <div className="inline-actions">
              <button className="small-button" onClick={() => props.onEdit(item)}>Editar</button>
              <button className="small-button danger-button" onClick={() => props.onDelete(item.id)}>Eliminar</button>
            </div>
          </div>
        ))}
      </div>
      <div className="catalog-pagination">
        <button className="ghost-button small-button" onClick={props.onPrevPage} disabled={props.currentPage <= 1}>Anterior</button>
        <span className="muted">Pagina {props.currentPage} de {props.totalPages}</span>
        <button className="ghost-button small-button" onClick={props.onNextPage} disabled={props.currentPage >= props.totalPages}>Siguiente</button>
      </div>
    </div>
  );
}

function SelectField({
  children,
  className = "",
  shellClassName = "",
  compact = false,
  value,
  disabled,
  onChange,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { children: ReactNode; compact?: boolean; shellClassName?: string }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement | null>(null);
  const options = useMemo(() => getSelectOptions(children), [children]);
  const filteredOptions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) {
      return options;
    }

      return options.filter((option) => option.label.toLowerCase().includes(normalizedQuery));
  }, [options, query]);
  const selectedValue = value == null ? "" : String(value);
  const selectedOption = options.find((option) => option.value === selectedValue) ?? null;
  const selectedLabel = selectedOption?.label ?? "";
  const shellClassNames = [
    compact ? "select-shell compact" : "select-shell",
    open ? "open" : "",
    shellClassName
  ].filter(Boolean).join(" ");
  const fieldClassName = className ? `select-trigger ${className}` : "select-trigger";

  useEffect(() => {
    if (!open) {
      setQuery("");
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    window.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  function handleSelect(nextValue: string) {
    setOpen(false);
    if (!onChange || nextValue === selectedValue) {
      return;
    }

    const syntheticEvent = {
      target: { value: nextValue },
      currentTarget: { value: nextValue }
    } as ChangeEvent<HTMLSelectElement>;
    onChange(syntheticEvent);
  }

  return (
    <div className={shellClassNames} title={selectedLabel} ref={containerRef}>
      <button
        type="button"
        className={fieldClassName}
        onClick={() => {
          if (!disabled) {
            setOpen((current) => !current);
          }
        }}
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled}
      >
        <span className={selectedOption ? "select-trigger-label" : "select-trigger-label muted"}>
          {selectedLabel || "Selecciona una opcion"}
        </span>
        <span className={open ? "select-caret open" : "select-caret"} aria-hidden="true" />
      </button>

      {open ? (
        <div className="select-menu" role="listbox">
          <input className="select-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar opcion" autoFocus />
          <div className="select-menu-options">
            {filteredOptions.length === 0 ? <span className="select-empty muted">Sin resultados</span> : null}
            {filteredOptions.map((option) => (
              <button
                key={option.value || "__empty__"}
                type="button"
                role="option"
                className={option.value === selectedValue ? "select-option selected" : "select-option"}
                aria-selected={option.value === selectedValue}
                onClick={() => handleSelect(option.value)}
                title={option.label}
              >
                <span className="select-option-label">{option.label}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <select
        {...props}
        value={value}
        onChange={onChange}
        disabled={disabled}
        className="select-native"
        tabIndex={-1}
        aria-hidden="true"
      >
        {children}
      </select>
    </div>
  );
}

function MultiSelectField(props: {
  label: string;
  options: Array<{ value: string; label: string }>;
  selectedValues: string[];
  onChange: (values: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement | null>(null);
  const selectedSet = useMemo(() => new Set(props.selectedValues), [props.selectedValues]);
  const filteredOptions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) {
      return props.options;
    }

    return props.options.filter((option) => option.label.toLowerCase().includes(normalizedQuery));
  }, [props.options, query]);
  const summary = props.selectedValues.length === 0
    ? props.label
    : `${props.label}: ${props.selectedValues.length}`;

  useEffect(() => {
    if (!open) {
      setQuery("");
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    window.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  function toggleValue(value: string) {
    if (selectedSet.has(value)) {
      props.onChange(props.selectedValues.filter((selectedValue) => selectedValue !== value));
      return;
    }

    props.onChange([...props.selectedValues, value]);
  }

  return (
    <div className={open ? "select-shell open" : "select-shell"} ref={containerRef}>
      <button type="button" className="select-trigger" onClick={() => setOpen((current) => !current)} aria-haspopup="listbox" aria-expanded={open}>
        <span className={props.selectedValues.length ? "select-trigger-label" : "select-trigger-label muted"}>{summary}</span>
        <span className={open ? "select-caret open" : "select-caret"} aria-hidden="true" />
      </button>
      {open ? (
        <div className="select-menu multi-select-menu" role="listbox">
          <input className="select-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Buscar ${props.label.toLowerCase()}`} autoFocus />
          <div className="select-menu-options">
            {filteredOptions.length === 0 ? <span className="select-empty muted">Sin resultados</span> : null}
            {filteredOptions.map((option) => (
              <label key={option.value} className="multi-select-option">
                <input type="checkbox" checked={selectedSet.has(option.value)} onChange={() => toggleValue(option.value)} />
                <span className="select-option-label">{option.label}</span>
              </label>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ExportColumnSelector(props: {
  title: string;
  options: Array<{ id: string; label: string }>;
  selectedValues: string[];
  defaultValues: string[];
  onChange: (values: string[]) => void;
}) {
  const selectedSet = useMemo(() => new Set(props.selectedValues), [props.selectedValues]);

  function toggleColumn(column: string) {
    if (selectedSet.has(column)) {
      props.onChange(props.selectedValues.filter((selectedValue) => selectedValue !== column));
      return;
    }

    props.onChange([...props.selectedValues, column]);
  }

  return (
    <div className="card form-stack form-card-embedded export-columns-card">
      <div className="section-head">
        <h4>{props.title}</h4>
        <div className="inline-actions">
          <button className="small-button ghost-button" onClick={() => props.onChange(props.options.map((option) => option.id))}>Seleccionar todo</button>
          <button className="small-button ghost-button" onClick={() => props.onChange(props.defaultValues)}>Restaurar</button>
        </div>
      </div>
      <div className="export-columns-grid">
        {props.options.map((option) => (
          <label key={option.id} className="checkbox-card">
            <input type="checkbox" checked={selectedSet.has(option.id)} onChange={() => toggleColumn(option.id)} />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

function DataTable(props: { title: string; headers: string[]; rows: Array<Array<string | number | ReactNode>> }) {
  return (
    <div className="card table-card">
      <h3>{props.title}</h3>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              {props.headers.map((header) => (
                <th key={header}>{header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {props.rows.length === 0 ? (
              <tr>
                <td colSpan={props.headers.length} className="empty-row">Sin resultados</td>
              </tr>
            ) : (
              props.rows.map((row, rowIndex) => (
                <tr key={`${props.title}-${rowIndex}`}>
                  {row.map((cell, cellIndex) => (
                    <td key={`${props.title}-${rowIndex}-${cellIndex}`}>
                      <div className="table-cell-content">{cell}</div>
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  wide = false,
  icon,
  hint,
  onClick,
  accent = "default"
}: {
  label: string;
  value: number;
  wide?: boolean;
  icon?: DashboardIconName;
  hint?: string;
  onClick?: (() => void) | undefined;
  accent?: "default" | "warm";
}) {
  const className = [
    wide ? "stat-card wide" : "stat-card",
    onClick ? "stat-card-action" : "",
    accent === "warm" ? "stat-card-warm" : ""
  ].filter(Boolean).join(" ");

  const content = (
    <>
      <div className="stat-card-top">
        <span className="stat-card-label">{label}</span>
        {icon ? (
          <span className="stat-card-icon" aria-hidden="true">
            <DashboardIcon name={icon} />
          </span>
        ) : null}
      </div>
      <strong className="stat-card-value">{value}</strong>
      {hint ? (
        <span className="stat-card-hint">
          <span>{hint}</span>
          {onClick ? <DashboardIcon name="openList" /> : null}
        </span>
      ) : null}
    </>
  );

  if (onClick) {
    return (
      <button type="button" className={className} onClick={onClick}>
        {content}
      </button>
    );
  }

  return <div className={className}>{content}</div>;
}

type DashboardSegmentMetrics = {
  students: number;
  groups: number;
  studentsInGroups: number;
  studentsWithoutGroup: number;
};

type DashboardIconName = "refresh" | "students" | "groups" | "membership" | "pending" | "openList";

function DashboardIcon(props: { name: DashboardIconName }) {
  switch (props.name) {
    case "refresh":
      return (
        <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M21 12a9 9 0 0 1-15.36 6.36" />
          <path d="M3 12A9 9 0 0 1 18.36 5.64" />
          <path d="M7 17H5v-2" />
          <path d="M17 7h2v2" />
        </svg>
      );
    case "students":
      return (
        <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" />
          <path d="M9.5 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" />
          <path d="M17 8a3 3 0 0 1 0 6" />
          <path d="M21 21v-2a3 3 0 0 0-3-3" />
        </svg>
      );
    case "groups":
      return (
        <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M3 21h18" />
          <path d="M5 21V9l7-4 7 4v12" />
          <path d="M9 21v-5h6v5" />
          <path d="M9 11h.01" />
          <path d="M15 11h.01" />
        </svg>
      );
    case "membership":
      return (
        <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
          <path d="m8.5 12 2.2 2.2 4.8-4.8" />
        </svg>
      );
    case "pending":
      return (
        <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </svg>
      );
    case "openList":
      return (
        <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M7 17 17 7" />
          <path d="M8 7h9v9" />
        </svg>
      );
  }
}

function DashboardSegmentCard(props: {
  title: string;
  segment: DashboardSegmentMetrics | undefined;
  pendingCount?: number;
  onPendingClick?: (() => void) | undefined;
}) {
  const segment = props.segment ?? { students: 0, groups: 0, studentsInGroups: 0, studentsWithoutGroup: 0 };
  const isGeneral = typeof props.pendingCount === "number";
  const stats = [
    { label: "Estudiantes registrados", value: segment.students, icon: "students" as DashboardIconName },
    ...(isGeneral ? [{ label: "Grupos registrados", value: segment.groups, icon: "groups" as DashboardIconName }] : []),
    { label: "Estudiantes con grupo", value: segment.studentsInGroups, icon: "membership" as DashboardIconName }
  ];

  return (
    <div className={`card dashboard-segment-card${isGeneral ? " dashboard-segment-card-featured" : " dashboard-segment-card-compact"}`}>
      <div className="section-head dashboard-card-head">
        <div className="dashboard-card-title">
          <h3>{props.title}</h3>
        </div>
      </div>
      {isGeneral ? (
        <div className="dashboard-card-inner dashboard-card-inner-general">
          <div className="stats-strip dashboard-segment-stats dashboard-segment-stats-expanded">
            {stats.map((stat) => (
              <StatCard key={`${props.title}-${stat.label}`} label={stat.label} value={stat.value} icon={stat.icon} />
            ))}
            <StatCard
              label="Estudiantes pendientes por agregar"
              value={props.pendingCount ?? 0}
              icon="pending"
              hint="Ver lista"
              onClick={props.onPendingClick}
              accent="warm"
            />
          </div>
          <MembershipPieChart variant="general" inGroup={segment.studentsInGroups} withoutGroup={segment.studentsWithoutGroup} />
        </div>
      ) : (
        <div className="dashboard-card-inner dashboard-card-inner-compact">
          <div className="dashboard-compact-body">
            <MembershipPieChart variant="minimal" inGroup={segment.studentsInGroups} withoutGroup={segment.studentsWithoutGroup} />
            <div className="dashboard-segment-stats dashboard-segment-stats-rail">
              {stats.map((stat) => (
                <StatCard key={`${props.title}-${stat.label}`} label={stat.label} value={stat.value} icon={stat.icon} />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MembershipPieChart(props: { variant: "general" | "minimal"; inGroup: number; withoutGroup: number }) {
  const total = props.inGroup + props.withoutGroup;
  const percentage = total > 0 ? Math.round((props.inGroup / total) * 100) : 0;
  const withoutGroupPercentage = total > 0 ? 100 - percentage : 0;
  const background = total > 0
    ? `conic-gradient(var(--chart-blue-strong) 0 ${percentage}%, #f6f8fb ${percentage}% ${Math.min(percentage + 1, 100)}%, var(--chart-blue-soft) ${Math.min(percentage + 1, 100)}% 100%)`
    : "conic-gradient(var(--chart-empty) 0 100%)";
  const isMinimal = props.variant === "minimal";

  return (
    <div className={`dashboard-pie-row${isMinimal ? " dashboard-pie-row-minimal" : ""}`}>
      <div className="dashboard-pie-shell">
        <div className="dashboard-pie" style={{ background }} aria-label={`${props.inGroup} estudiantes con grupo, ${props.withoutGroup} estudiantes sin grupo`}>
          <div className="dashboard-pie-center">
            <strong>{percentage}%</strong>
            <span>con grupo</span>
          </div>
        </div>
      </div>
      <div className="dashboard-pie-copy">
        <div className="dashboard-pie-legend">
          <div className="dashboard-pie-legend-row">
            <span className="dashboard-pie-legend-label"><i className="legend-dot in-group" />Estudiantes con grupo</span>
            <div className="dashboard-pie-legend-values">
              <strong>{props.inGroup}</strong>
              <span>{percentage}%</span>
            </div>
          </div>
          <div className="dashboard-pie-legend-row">
            <span className="dashboard-pie-legend-label"><i className="legend-dot without-group" />Estudiantes sin grupo</span>
            <div className="dashboard-pie-legend-values">
              <strong>{props.withoutGroup}</strong>
              <span>{withoutGroupPercentage}%</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function handleSearchKeyDown(event: ReactKeyboardEvent<HTMLInputElement>, search: () => Promise<void>) {
  if (event.key === "Enter") {
    void search();
  }
}

function formatBulkImportNotice(entityName: string, result: { created: number; failed: number }): string {
  if (result.created === 0 && result.failed === 0) {
    return "Importacion cancelada.";
  }

  return `${result.created} ${entityName} creados. ${result.failed} filas con error.`;
}

function createStudentMembershipDraft(): StudentCreateMembershipDraft {
  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    groupId: "",
    roleId: "",
    joinedAt: ""
  };
}

function localFileUrl(sourcePath: string): string {
  return `file:///${sourcePath.replace(/\\/g, "/")}`;
}

function getViewLabel(view: View): string {
  switch (view) {
    case "dashboard":
      return "Dashboard";
    case "students":
      return "Estudiantes";
    case "groups":
      return "Grupos";
    case "catalogs":
      return "Catalogos";
    case "account":
      return "Cuenta";
    case "backups":
      return "Respaldos";
  }
}

function getPendingMembershipStatusLabel(status: string): string {
  if (status === "RESOLVED") {
    return "Resuelto";
  }
  if (status === "CANCELLED") {
    return "Cancelado";
  }
  return "Pendiente";
}

function getCatalogModalTitle(type: CatalogType, editing: boolean): string {
  const prefix = editing ? "Editar" : "Nuevo";

  switch (type) {
    case "giro":
      return `${prefix} giro`;
    case "portfolio":
      return editing ? "Editar portafolio" : "Nuevo portafolio";
    case "role":
      return `${prefix} rol`;
    case "career":
      return editing ? "Editar carrera" : "Nueva carrera";
    case "program":
      return editing ? "Editar programa prepa" : "Nuevo programa prepa";
  }
}

function getCatalogSectionTitle(type: CatalogType): string {
  switch (type) {
    case "giro":
      return "Giros";
    case "portfolio":
      return "Portafolios";
    case "role":
      return "Roles";
    case "career":
      return "Carreras";
    case "program":
      return "Programas prepa";
  }
}

function getStudentAcademicLabel(student: Student): string {
  if (student.nivel === "PROFESIONAL") {
    return student.academicPending
      ? "Carrera: pendiente"
      : `Carrera: ${student.career?.name ?? "Sin carrera"}`;
  }

  return `Programa: ${student.prepaProgram?.name ?? "Sin programa"}`;
}

function getErrorMessage(error: unknown): string {
  if (error && typeof error === "object") {
    const maybeError = error as { message?: string };
    if (maybeError.message) {
      return maybeError.message
        .replace(/^Error invoking remote method '[^']+':\s*/i, "")
        .replace(/^(?:(?:[A-Z][A-Za-z]*Error|Error):\s*)+/, "")
        .trim();
    }
  }

  return "Ocurrio un error inesperado.";
}

function formatDate(value: string | Date | null): string {
  if (!value) {
    return "-";
  }

  return new Date(value).toLocaleString("es-MX");
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return "--";
  }

  const first = parts[0]?.[0] ?? "";
  const second = parts[1]?.[0] ?? "";
  return `${first}${second}`.toUpperCase();
}

function resolveAssetUrl(assetUrls: AssetMap, assetPath: string | null | undefined): string | null {
  if (!assetPath) {
    return null;
  }

  return assetUrls[assetPath] ?? null;
}

function getSelectOptions(children: ReactNode): Array<{ value: string; label: string }> {
  const options: Array<{ value: string; label: string }> = [];

  for (const child of Children.toArray(children)) {
    if (!isValidElement<{ value?: string | number; children?: ReactNode }>(child)) {
      continue;
    }

    if (child.type === "option") {
      options.push({
        value: String(child.props.value ?? ""),
        label: getNodeText(child.props.children)
      });
    }
  }

  return options;
}

function getNodeText(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") {
    return String(node);
  }

  if (Array.isArray(node)) {
    return node.map((child) => getNodeText(child)).join(" ").trim();
  }

  if (isValidElement<{ children?: ReactNode }>(node)) {
    return getNodeText(node.props.children);
  }

  return "";
}

function getGroupGiroName(group: { giro?: { name: string } | null }): string {
  return group.giro?.name ?? "Sin giro";
}

function getGroupPortfolioName(group: { portfolio?: { name: string } | null }): string {
  return group.portfolio?.name ?? "Sin portafolio";
}

function getMembershipRoleName(membership: { role?: { name: string } | null }): string {
  return membership.role?.name ?? "Sin rol";
}

function matchesMembershipSearch(membership: GroupMembership, query: string): boolean {
  if (!query) {
    return true;
  }

  const haystack = [
    membership.student.nombre,
    membership.student.matricula,
    membership.role?.name ?? "",
    membership.student.career?.name ?? "",
    membership.student.prepaProgram?.name ?? ""
  ].join(" ").toLowerCase();

  return haystack.includes(query);
}
