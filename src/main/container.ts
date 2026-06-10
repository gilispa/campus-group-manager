import { AdminAuthService } from "../services/admin-auth.service";
import { BackupService } from "../services/backup.service";
import { CareerService } from "../services/career.service";
import { CategoryService } from "../services/category.service";
import { GroupManagementService } from "../services/group-management.service";
import { GroupService } from "../services/group.service";
import { MetaService } from "../services/meta.service";
import { PendingMembershipService } from "../services/pending-membership.service";
import { PortfolioService } from "../services/portfolio.service";
import { PrepaProgramService } from "../services/prepa-program.service";
import { RoleService } from "../services/role.service";
import { StudentGroupService } from "../services/student-group.service";
import { StudentService } from "../services/student.service";

export function createBackendServices() {
  return {
    categoryService: new CategoryService(),
    giroService: new CategoryService(),
    portfolioService: new PortfolioService(),
    roleService: new RoleService(),
    careerService: new CareerService(),
    prepaProgramService: new PrepaProgramService(),
    studentService: new StudentService(),
    groupService: new GroupService(),
    studentGroupService: new StudentGroupService(),
    groupManagementService: new GroupManagementService(),
    pendingMembershipService: new PendingMembershipService(),
    adminAuthService: new AdminAuthService(),
    backupService: new BackupService(),
    metaService: new MetaService()
  };
}

export type BackendServices = ReturnType<typeof createBackendServices>;
