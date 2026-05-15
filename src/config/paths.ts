import path from "node:path";

const projectRoot = process.cwd();
const appDataRoot = process.env.APP_DATA_DIR?.trim() || path.join(projectRoot, "data");

export const appPaths = {
  projectRoot,
  prismaDir: path.join(projectRoot, "prisma"),
  dataDir: appDataRoot,
  databaseDir: path.join(appDataRoot, "database"),
  uploadsDir: path.join(appDataRoot, "uploads"),
  studentUploadsDir: path.join(appDataRoot, "uploads", "students"),
  groupUploadsDir: path.join(appDataRoot, "uploads", "groups"),
  sqliteFile: path.join(appDataRoot, "database", "app.db")
} as const;

export const uploadPrefixes = {
  students: "/uploads/students/",
  groups: "/uploads/groups/"
} as const;
