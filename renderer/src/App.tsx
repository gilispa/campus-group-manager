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
  Career,
  Category,
  Group,
  PrepaProgram,
  Role,
  Student,
  StudentLevel
} from "../../src/types/domain";

type View = "dashboard" | "students" | "groups" | "catalogs" | "account" | "backups";
type GroupWithCategory = Group & { category: Category | null };
type StudentMembership = {
  id: string;
  studentId: string;
  groupId: string;
  joinedAt: string | Date;
  leftAt: string | Date | null;
  active: boolean;
  role: Role | null;
  group: GroupWithCategory;
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
type AssetMap = Record<string, string>;
type CatalogType = "category" | "role" | "career" | "program";
type ConfirmState = {
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => Promise<void>;
};
const CATALOG_PAGE_SIZE = 8;
const SEARCH_DEBOUNCE_MS = 350;

const loginLogoUrl = new URL("../../images/ml-completo.png", import.meta.url).href;
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

const emptyGroupSearch = { nombre: "", categoryName: "" };

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
  categoryId: ""
};

const defaultCatalogForm = {
  name: "",
  description: ""
};

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
  const [categories, setCategories] = useState<Category[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [careers, setCareers] = useState<Career[]>([]);
  const [prepaPrograms, setPrepaPrograms] = useState<PrepaProgram[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [groups, setGroups] = useState<GroupWithCategory[]>([]);
  const [deletedStudents, setDeletedStudents] = useState<Student[]>([]);
  const [deletedGroups, setDeletedGroups] = useState<GroupWithCategory[]>([]);
  const [deletedCategories, setDeletedCategories] = useState<Array<{ id: string; name: string; description?: string | null }>>([]);
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

  const [studentForm, setStudentForm] = useState(defaultStudentForm);
  const [pendingStudentPhotoSource, setPendingStudentPhotoSource] = useState<string | null>(null);
  const [editingStudentId, setEditingStudentId] = useState<string | null>(null);
  const [studentFormOpen, setStudentFormOpen] = useState(false);

  const [groupForm, setGroupForm] = useState(defaultGroupForm);
  const [pendingGroupLogoSource, setPendingGroupLogoSource] = useState<string | null>(null);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [groupFormOpen, setGroupFormOpen] = useState(false);

  const [catalogForm, setCatalogForm] = useState(defaultCatalogForm);
  const [catalogFormType, setCatalogFormType] = useState<CatalogType>("category");
  const [editingCatalogId, setEditingCatalogId] = useState<string | null>(null);
  const [catalogFormOpen, setCatalogFormOpen] = useState(false);
  const [activeCatalogTab, setActiveCatalogTab] = useState<CatalogType>("category");
  const [catalogPageByType, setCatalogPageByType] = useState<Record<CatalogType, number>>({
    category: 1,
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

  async function hydrateSupportData(nextStudents: Student[], nextGroups: GroupWithCategory[]) {
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
      categoriesResult,
      rolesResult,
      careersResult,
      prepaProgramsResult,
      studentsResult,
      groupsResult
    ] = await Promise.all([
      desktopApi.meta.getSummary(),
      desktopApi.categories.list() as Promise<Category[]>,
      desktopApi.roles.list() as Promise<Role[]>,
      desktopApi.careers.list() as Promise<Career[]>,
      desktopApi.prepaPrograms.list() as Promise<PrepaProgram[]>,
      desktopApi.students.list() as Promise<Student[]>,
      desktopApi.groups.list() as Promise<GroupWithCategory[]>
    ]);

    setSummary(summaryResult);
    setCategories(categoriesResult);
    setRoles(rolesResult);
    setCareers(careersResult);
    setPrepaPrograms(prepaProgramsResult);
    setStudents(studentsResult);
    setGroups(groupsResult);

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
    }, "Contrasena inicial configurada.");
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
      setStudents([]);
      setGroups([]);
      setStudentMembershipIndex({});
      setAssetUrls({});
    }, "Sesion cerrada.", "Cerrando sesion...");
  }

  async function handlePasswordChange() {
    await withAction(async () => {
      if (newPassword !== confirmPassword) {
        throw new Error("Las nuevas contrasenas no coinciden.");
      }

      const isValid = await desktopApi.auth.verifyPassword(oldPassword);
      if (!isValid) {
        throw new Error("La contrasena anterior es incorrecta.");
      }

      await desktopApi.auth.updatePassword({ password: newPassword });
      setPasswordModalOpen(false);
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
    }, "Contrasena actualizada.");
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
      ...(groupSearch.categoryName ? { categoryName: groupSearch.categoryName } : {})
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
      const results = await desktopApi.groups.search(buildGroupFilters()) as GroupWithCategory[];

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
        nombre: studentForm.nombre,
        matricula: studentForm.matricula,
        nivel: studentForm.nivel,
        careerId: studentForm.nivel === "PROFESIONAL" ? studentForm.careerId : null,
        prepaProgramId: studentForm.nivel === "PREPA" ? studentForm.prepaProgramId : null,
        generacion: Number(studentForm.generacion),
        foto: savedPhoto || null,
        telefono: studentForm.telefono,
        email: studentForm.email,
        notas: studentForm.notas,
        activo: studentForm.activo
      };

      if (editingStudentId) {
        await desktopApi.students.update(editingStudentId, payload);
      } else {
        await desktopApi.students.create(payload);
      }

      resetStudentForm();
      await refreshData();
    }, editingStudentId ? "Estudiante actualizado." : "Estudiante creado.", editingStudentId ? "Guardando estudiante..." : "Creando estudiante...");
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
        categoryId: groupForm.categoryId || null
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

      if (catalogFormType === "category") {
        if (editingCatalogId) {
          await desktopApi.categories.update(editingCatalogId, payload);
        } else {
          await desktopApi.categories.create(payload);
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
    }, "Participacion agregada.");
  }

  async function removeMembership(studentId: string, groupId: string) {
    confirmAction("Remover participacion", "La participacion activa pasara al historial del grupo.", "Remover", async () => {
      await withAction(async () => {
        await desktopApi.memberships.remove({ studentId, groupId });
        await refreshData();
        await refreshSelectedGroupMemberships();
        await refreshSelectedStudentMemberships();
      }, "Participacion desactivada.", "Removiendo participacion...");
    });
  }

  async function changeMembershipRole(studentId: string, groupId: string, roleId: string) {
    await withAction(async () => {
      await desktopApi.memberships.changeRole({ studentId, groupId, roleId: roleId || null });
      await refreshSelectedGroupMemberships();
      await refreshSelectedStudentMemberships();
    }, "Rol actualizado.");
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
        if (type === "category") {
          await desktopApi.categories.remove(id);
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

  async function exportStudentsCsv() {
    await withAction(async () => {
      const result = await desktopApi.students.exportCsv(buildStudentFilters());
      if (result) {
        setNotice(`Estudiantes exportados a ${result}`);
      }
    }, undefined, "Exportando estudiantes...");
  }

  async function exportGroupsCsv() {
    await withAction(async () => {
      const result = await desktopApi.groups.exportCsv(buildGroupFilters());
      if (result) {
        setNotice(`Grupos exportados a ${result}`);
      }
    }, undefined, "Exportando grupos...");
  }

  async function loadTrash() {
    const [trashStudents, trashGroups, categoriesTrash, rolesTrash, careersTrash, programsTrash] = await Promise.all([
      desktopApi.students.listDeleted() as Promise<Student[]>,
      desktopApi.groups.listDeleted() as Promise<GroupWithCategory[]>,
      desktopApi.categories.listDeleted() as Promise<Array<{ id: string; name: string; description?: string | null }>>,
      desktopApi.roles.listDeleted() as Promise<Array<{ id: string; name: string; description?: string | null }>>,
      desktopApi.careers.listDeleted() as Promise<Array<{ id: string; name: string; description?: string | null }>>,
      desktopApi.prepaPrograms.listDeleted() as Promise<Array<{ id: string; name: string; description?: string | null }>>
    ]);
    setDeletedStudents(trashStudents);
    setDeletedGroups(trashGroups);
    setDeletedCategories(categoriesTrash);
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
      if (type === "category") {
        await desktopApi.categories.restore(id);
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
          if (type === "category") {
            await desktopApi.categories.permanentDelete(id);
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

  function openCreateStudentModal() {
    setEditingStudentId(null);
    setPendingStudentPhotoSource(null);
    setStudentForm({
      ...defaultStudentForm,
      careerId: careers[0]?.id ?? "",
      prepaProgramId: prepaPrograms[0]?.id ?? ""
    });
    setStudentFormOpen(true);
  }

  function openEditStudentModal(student: Student) {
    setEditingStudentId(student.id);
    setPendingStudentPhotoSource(null);
    setStudentForm({
      nombre: student.nombre,
      matricula: student.matricula,
      nivel: student.nivel,
      careerId: student.careerId ?? "",
      prepaProgramId: student.prepaProgramId ?? "",
      generacion: String(student.generacion),
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
    setStudentForm(defaultStudentForm);
    setStudentFormOpen(false);
  }

  function openCreateGroupModal() {
    setEditingGroupId(null);
    setPendingGroupLogoSource(null);
    setGroupForm({
      ...defaultGroupForm,
      categoryId: categories[0]?.id ?? ""
    });
    setGroupFormOpen(true);
  }

  function openEditGroupModal(group: GroupWithCategory) {
    setEditingGroupId(group.id);
    setPendingGroupLogoSource(null);
    setGroupForm({
      nombre: group.nombre,
      descripcion: group.descripcion ?? "",
      logo: group.logo ?? "",
      categoryId: group.categoryId ?? ""
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
    setCatalogFormType("category");
    setCatalogFormOpen(false);
  }

  const selectedStudentAssetUrl = resolveAssetUrl(assetUrls, selectedStudent?.foto);
  const selectedGroupAssetUrl = resolveAssetUrl(assetUrls, selectedGroup?.logo);
  const selectedStudentActiveMemberships = studentMemberships.filter((membership) => membership.active);
  const normalizedGroupMemberSearch = groupMemberSearch.trim().toLowerCase();
  const filteredActiveMembers = groupMemberships
    .filter((membership) => membership.active)
    .filter((membership) => matchesMembershipSearch(membership, normalizedGroupMemberSearch));
  const filteredGroupHistory = groupMemberships.filter((membership) => matchesMembershipSearch(membership, normalizedGroupMemberSearch));
  const catalogItemsByType: Record<CatalogType, Array<{ id: string; name: string; description?: string | null }>> = {
    category: categories,
    role: roles,
    career: careers,
    program: prepaPrograms
  };
  const activeCatalogItems = catalogItemsByType[activeCatalogTab];
  const activeCatalogPage = Math.min(
    catalogPageByType[activeCatalogTab] ?? 1,
    Math.max(1, Math.ceil(activeCatalogItems.length / CATALOG_PAGE_SIZE))
  );
  const totalCatalogPages = Math.max(1, Math.ceil(activeCatalogItems.length / CATALOG_PAGE_SIZE));
  const paginatedCatalogItems = activeCatalogItems.slice((activeCatalogPage - 1) * CATALOG_PAGE_SIZE, activeCatalogPage * CATALOG_PAGE_SIZE);

  if (initialized === null) {
    return <LoadingScreen message="Inicializando sistema..." />;
  }

  if (!initialized) {
    return (
      <AuthScreen
        logoUrl={loginLogoUrl}
        title="Acceso a ML Vincula"
        description="Ingresa la contrasena para acceder"
        password={setupPassword}
        setPassword={setSetupPassword}
        busy={busy}
        error={error}
        notice={notice}
        actionLabel="Guardar contrasena inicial"
        onSubmit={() => void handleSetupPassword()}
      />
    );
  }

  if (!authenticated) {
    return (
      <AuthScreen
        logoUrl={loginLogoUrl}
        title="Acceso a ML Vincula"
        description="Ingresa la contrasena para acceder"
        password={loginPassword}
        setPassword={setLoginPassword}
        busy={busy}
        error={error}
        notice={notice}
        actionLabel="Entrar al sistema"
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
            <p className="muted">Operacion diaria y administracion del sistema.</p>
          </div>
          <div className="status-row">
            {busy ? <span className="pill info">{busyLabel}</span> : null}
          </div>
        </header>

        {view === "dashboard" ? (
          <section className="grid two-columns">
            <div className="card stats-grid">
              <StatCard label="Estudiantes" value={summary?.students ?? 0} />
              <StatCard label="Grupos" value={summary?.groups ?? 0} />
              <StatCard label="Participaciones activas" value={summary?.activeMemberships ?? 0} wide />
            </div>
            <div className="card form-stack account-password-card">
              <h3>Grupos recientes</h3>
              {groups.slice(0, 6).map((group) => (
                <div key={group.id} className="list-line">
                  <strong>{group.nombre}</strong>
                  <span className="muted clamp-one-line">{getGroupCategoryName(group)} - {formatDate(group.createdAt)}</span>
                </div>
              ))}
              <button className="ghost-button" onClick={() => void refreshData()}>Recargar dashboard</button>
            </div>
          </section>
        ) : null}

        {view === "students" ? (
          <section className="stack-gap">
            <div className="search-bar-horizontal student-search-bar">
              <input className="student-filter-name" value={studentSearch.nombre} onKeyDown={(event) => handleSearchKeyDown(event, () => searchStudents())} onChange={(event) => setStudentSearch({ ...studentSearch, nombre: event.target.value })} placeholder="Nombre" />
              <input className="student-filter-matricula" value={studentSearch.matricula} onKeyDown={(event) => handleSearchKeyDown(event, () => searchStudents())} onChange={(event) => setStudentSearch({ ...studentSearch, matricula: event.target.value })} placeholder="Matricula" />
              <input className="student-filter-generacion" value={studentSearch.generacion} onKeyDown={(event) => handleSearchKeyDown(event, () => searchStudents())} onChange={(event) => setStudentSearch({ ...studentSearch, generacion: event.target.value })} placeholder="Generacion" />
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
                <button className="ghost-button" onClick={() => void exportStudentsCsv()}>Exportar CSV</button>
                <button onClick={openCreateStudentModal}>Nuevo estudiante</button>
              </div>
            </div>

            <div className="card table-card">
              <h3>Listado de estudiantes</h3>
              <div className="list-stack">
                {students.length === 0 ? <p className="muted">No hay estudiantes con esos filtros.</p> : null}
                {students.map((student) => {
                  const allMemberships = studentMembershipIndex[student.id] ?? [];
                  const activeMemberships = allMemberships.filter((membership) => membership.active);
                  const studentAssetUrl = resolveAssetUrl(assetUrls, student.foto);
                  return (
                    <button key={student.id} className="list-card-button" onClick={() => void openStudentDetail(student.id)}>
                      <div className="list-card-main">
                        <AvatarImage src={studentAssetUrl} fallback={getInitials(student.nombre)} small />
                        <div className="list-copy">
                          <strong className="title-dark clamp-one-line">{student.nombre}</strong>
                          <p className="muted clamp-one-line">Matricula: {student.matricula}</p>
                          <p className="muted clamp-one-line">{getStudentAcademicLabel(student)} - Gen {student.generacion}</p>
                          <div className="chip-row chip-row-tight">
                            {activeMemberships.slice(0, 3).map((membership) => (
                              <span key={membership.id} className="mini-chip" title={`${membership.group.nombre} - ${getMembershipRoleName(membership)}`}>
                                {membership.group.nombre}
                              </span>
                            ))}
                            {activeMemberships.length > 3 ? <span className="mini-chip muted-chip">+{activeMemberships.length - 3}</span> : null}
                            {activeMemberships.length === 0 ? <span className="mini-chip muted-chip">Sin grupos activos</span> : null}
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
            <div className="search-bar-horizontal">
              <input value={groupSearch.nombre} onKeyDown={(event) => handleSearchKeyDown(event, () => searchGroups())} onChange={(event) => setGroupSearch({ ...groupSearch, nombre: event.target.value })} placeholder="Nombre de grupo" />
              <input value={groupSearch.categoryName} onKeyDown={(event) => handleSearchKeyDown(event, () => searchGroups())} onChange={(event) => setGroupSearch({ ...groupSearch, categoryName: event.target.value })} placeholder="Categoria" />
              <div className="search-actions">
                <button onClick={() => void searchGroups()}>Buscar</button>
                <button className="ghost-button" onClick={() => { setGroupSearch(emptyGroupSearch); void refreshData(); }}>Limpiar</button>
                <button className="ghost-button" onClick={() => void exportGroupsCsv()}>Exportar CSV</button>
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
                          <p className="muted clamp-one-line">Categoria: {getGroupCategoryName(group)}</p>
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
              {(["category", "role", "career", "program"] as CatalogType[]).map((tab) => (
                <button
                  key={tab}
                  className={activeCatalogTab === tab ? "catalog-tab active" : "catalog-tab"}
                  onClick={() => setActiveCatalogTab(tab)}
                >
                  {getCatalogSectionTitle(tab)}
                </button>
              ))}
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
              <h3>Contrasena</h3>
              <div className="password-preview">••••••••••</div>
              <button onClick={() => setPasswordModalOpen(true)}>Cambiar contrasena</button>
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
                <TrashList title="Categorias" items={deletedCategories.map((item) => ({ id: item.id, label: item.name }))} onRestore={(id) => void restoreCatalog("category", id)} onPermanentDelete={(id) => void permanentlyDeleteCatalog("category", id)} />
                <TrashList title="Roles" items={deletedRoles.map((item) => ({ id: item.id, label: item.name }))} onRestore={(id) => void restoreCatalog("role", id)} onPermanentDelete={(id) => void permanentlyDeleteCatalog("role", id)} />
                <TrashList title="Carreras" items={deletedCareers.map((item) => ({ id: item.id, label: item.name }))} onRestore={(id) => void restoreCatalog("career", id)} onPermanentDelete={(id) => void permanentlyDeleteCatalog("career", id)} />
                <TrashList title="Programas" items={deletedPrograms.map((item) => ({ id: item.id, label: item.name }))} onRestore={(id) => void restoreCatalog("program", id)} onPermanentDelete={(id) => void permanentlyDeleteCatalog("program", id)} />
              </div>
            </div>
          </section>
        ) : null}

        {view === "backups" ? (
          <section className="grid two-columns">
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
            <input value={studentForm.generacion} onChange={(event) => setStudentForm({ ...studentForm, generacion: event.target.value })} placeholder="Generacion" />
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

          <textarea value={studentForm.notas} onChange={(event) => setStudentForm({ ...studentForm, notas: event.target.value })} placeholder="Notas" />

          <div className="row-actions">
            <button onClick={() => void submitStudent()}>{editingStudentId ? "Guardar cambios" : "Crear estudiante"}</button>
            <button className="ghost-button" onClick={resetStudentForm}>Cancelar</button>
          </div>
        </Modal>
      ) : null}

      {groupFormOpen ? (
        <Modal title={editingGroupId ? "Editar grupo" : "Nuevo grupo"} onClose={resetGroupForm}>
          <div className="grid compact-grid">
            <input value={groupForm.nombre} onChange={(event) => setGroupForm({ ...groupForm, nombre: event.target.value })} placeholder="Nombre" />
            <SelectField value={groupForm.categoryId} onChange={(event) => setGroupForm({ ...groupForm, categoryId: event.target.value })}>
              <option value="">Selecciona categoria</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>{category.name}</option>
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
        <Modal title="Cambiar contrasena" onClose={() => setPasswordModalOpen(false)}>
          <input value={oldPassword} onChange={(event) => setOldPassword(event.target.value)} placeholder="Contrasena actual" type="password" />
          <input value={newPassword} onChange={(event) => setNewPassword(event.target.value)} placeholder="Nueva contrasena" type="password" />
          <input value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Confirmar nueva contrasena" type="password" />
          <div className="row-actions">
            <button onClick={() => void handlePasswordChange()}>Guardar nueva contrasena</button>
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
              <p className="muted clamp-two-lines">Generacion: {selectedStudent.generacion}</p>
              <p className="muted clamp-two-lines">Email: {selectedStudent.email ?? "-"}</p>
              <p className="muted clamp-two-lines">Telefono: {selectedStudent.telefono ?? "-"}</p>
              {selectedStudent.notas ? <p className="muted clamp-three-lines">{selectedStudent.notas}</p> : null}
            </div>
          </div>

          <div className="detail-section">
            <h4>Grupos activos</h4>
            {selectedStudentActiveMemberships.length === 0 ? <p className="muted">No tiene participaciones activas.</p> : null}
            <ul className="bullet-cards">
              {selectedStudentActiveMemberships.map((membership) => (
                <li key={membership.id} className="bullet-card">
                  <span className="bullet-title clamp-two-lines">{membership.group.nombre}</span>
                  <span className="muted clamp-two-lines">{getGroupCategoryName(membership.group)}</span>
                  <span className="mini-chip" title={getMembershipRoleName(membership)}>{getMembershipRoleName(membership)}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="row-actions">
            <button className="small-button" onClick={() => setStudentHistoryOpen((current) => !current)}>
              {studentHistoryOpen ? "Ocultar historial" : "Ver historial de participacion"}
            </button>
          </div>

          {studentHistoryOpen ? (
            <DataTable
              title="Historial de participaciones"
              headers={["Grupo", "Categoria", "Rol", "Ingreso", "Salida", "Estado"]}
              rows={studentMemberships.map((membership) => [
                membership.group.nombre,
                getGroupCategoryName(membership.group),
                getMembershipRoleName(membership),
                formatDate(membership.joinedAt),
                formatDate(membership.leftAt),
                membership.active ? "Activa" : "Historica"
              ])}
            />
          ) : null}
        </Modal>
      ) : null}

      {groupDetailOpen && selectedGroup ? (
        <Modal title="Expediente de grupo" onClose={() => { setGroupDetailOpen(false); setMembershipFormOpen(false); }}>
          <div className="profile-grid detail-layout">
            <AvatarImage src={selectedGroupAssetUrl} fallback={getInitials(selectedGroup.nombre)} />
            <div className="detail-copy">
              <h4 className="clamp-two-lines">{selectedGroup.nombre}</h4>
              <div className="badge-row">
                <span className="badge" title={getGroupCategoryName(selectedGroup)}>{getGroupCategoryName(selectedGroup)}</span>
              </div>
              <p className="muted clamp-three-lines">{selectedGroup.descripcion ?? "-"}</p>
              <p className="muted clamp-two-lines">Creado: {formatDate(selectedGroup.createdAt)}</p>
            </div>
          </div>

          <div className="row-actions">
            <button className="small-button" onClick={() => setMembershipFormOpen((current) => !current)}>
              {membershipFormOpen ? "Ocultar formulario" : "Agregar participacion"}
            </button>
            <button className="ghost-button" onClick={() => setGroupHistoryOpen((current) => !current)}>
              {groupHistoryOpen ? "Ocultar historial" : "Ver historial de participacion"}
            </button>
          </div>

          {membershipFormOpen ? (
            <div className="card form-stack form-card-embedded">
              <h4>Nueva participacion</h4>
              <SelectField value={selectedStudentId} onChange={(event) => setSelectedStudentId(event.target.value)}>
                <option value="">Selecciona estudiante</option>
                {students.map((student) => (
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
                <button onClick={() => void createMembership()}>Guardar participacion</button>
                <button className="ghost-button" onClick={() => { setMembershipFormOpen(false); setMembershipJoinedAt(""); }}>Cancelar</button>
              </div>
            </div>
          ) : null}

          <div className="card form-stack form-card-embedded">
            <div className="section-head">
              <h4>Miembros activos</h4>
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
            <DataTable
              title="Historial del grupo"
              headers={["Estudiante", "Rol", "Ingreso", "Salida", "Estado"]}
              rows={filteredGroupHistory.map((membership) => [
                `${membership.student.nombre} - ${membership.student.matricula}`,
                getMembershipRoleName(membership),
                formatDate(membership.joinedAt),
                formatDate(membership.leftAt),
                membership.active ? "Activa" : "Historica"
              ])}
            />
          ) : null}
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
      <div className="auth-card auth-brand-card">
        <div className="auth-logo-row">
          <img src={props.logoUrl} alt="ML Vincula" className="auth-logo" />
        </div>
        <h1>{props.title}</h1>
        <p className="muted">{props.description}</p>
        <input
          type="password"
          value={props.password}
          onChange={(event) => props.setPassword(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              props.onSubmit();
            }
          }}
          placeholder="Contrasena"
        />
        <button onClick={props.onSubmit} disabled={props.busy}>{props.actionLabel}</button>
        {props.notice ? <p className="success-text">{props.notice}</p> : null}
        {props.error ? <p className="error-text">{props.error}</p> : null}
      </div>
    </div>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(event) => event.stopPropagation()}>
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
        const droppedSource = extractDroppedSourcePath(event);
        if (droppedSource) {
          props.onDropSource(droppedSource);
        }
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
  const containerRef = useRef<HTMLDivElement | null>(null);
  const options = useMemo(() => getSelectOptions(children), [children]);
  const selectedValue = value == null ? "" : String(value);
  const selectedOption = options.find((option) => option.value === selectedValue) ?? null;
  const selectedLabel = selectedOption?.label ?? "";
  const shellClassNames = [
    compact ? "select-shell compact" : "select-shell",
    shellClassName
  ].filter(Boolean).join(" ");
  const fieldClassName = className ? `select-trigger ${className}` : "select-trigger";

  useEffect(() => {
    if (!open) {
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
          {options.map((option) => (
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

function StatCard({ label, value, wide = false }: { label: string; value: number; wide?: boolean }) {
  return (
    <div className={wide ? "stat-card wide" : "stat-card"}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function handleSearchKeyDown(event: ReactKeyboardEvent<HTMLInputElement>, search: () => Promise<void>) {
  if (event.key === "Enter") {
    void search();
  }
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

function getCatalogModalTitle(type: CatalogType, editing: boolean): string {
  const prefix = editing ? "Editar" : "Nuevo";

  switch (type) {
    case "category":
      return `${prefix} categoria`;
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
    case "category":
      return "Categorias";
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
    return `Carrera: ${student.career?.name ?? "Sin carrera"}`;
  }

  return `Programa: ${student.prepaProgram?.name ?? "Sin programa"}`;
}

function getErrorMessage(error: unknown): string {
  if (error && typeof error === "object") {
    const maybeError = error as { message?: string };
    if (maybeError.message) {
      return maybeError.message;
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

function getGroupCategoryName(group: { category?: { name: string } | null }): string {
  return group.category?.name ?? "Sin categoria";
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
