import path from "node:path";
import fs from "node:fs";
import Module from "node:module";
import { app, BrowserWindow, dialog } from "electron";

const isDev = Boolean(process.env.ELECTRON_RENDERER_URL);
const appIconPath = path.join(process.cwd(), "images", "ml-v.png");
let mainWindow: BrowserWindow | null = null;

app.disableHardwareAcceleration();
app.commandLine.appendSwitch("disable-gpu");
app.commandLine.appendSwitch("disable-gpu-compositing");
app.commandLine.appendSwitch("use-angle", "swiftshader");
app.commandLine.appendSwitch("use-gl", "swiftshader");
app.commandLine.appendSwitch("enable-unsafe-swiftshader");

async function createWindow(): Promise<void> {
  console.log("[electron] Creating main window...");

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 940,
    minWidth: 1200,
    minHeight: 760,
    backgroundColor: "#0f172a",
    icon: appIconPath,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  mainWindow.on("closed", () => {
    if (mainWindow) {
      mainWindow = null;
    }
  });

  if (isDev) {
    console.log("[electron] Loading renderer URL:", process.env.ELECTRON_RENDERER_URL);
    await mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL as string);
    mainWindow.webContents.openDevTools({ mode: "detach" });
    return;
  }

  console.log("[electron] Loading renderer file build...");
  await mainWindow.loadFile(path.join(__dirname, "..", "renderer", "index.html"));
}

async function bootstrapApp(): Promise<void> {
  await app.whenReady();
  console.log("[electron] App ready");

  if (!process.env.APP_PROJECT_ROOT?.trim()) {
    process.env.APP_PROJECT_ROOT = app.getAppPath();
  }

  if (!process.env.APP_DATA_DIR?.trim() && app.isPackaged) {
    process.env.APP_DATA_DIR = app.getPath("userData");
  }

  if (app.isPackaged) {
    registerPackagedNodeModulesPath();
  }

  console.log("[electron] APP_DATA_DIR:", process.env.APP_DATA_DIR ?? "(default workspace data)");

  const [{ bootstrapDatabase }, { registerIpcHandlers }] = await Promise.all([
    import("../database/bootstrap"),
    import("./ipc")
  ]);

  console.log("[electron] Bootstrapping database...");
  await bootstrapDatabase();

  console.log("[electron] Registering IPC handlers...");
  registerIpcHandlers();

  await createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void createWindow();
    }
  });
}

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

void bootstrapApp().catch((error) => {
  console.error("[electron] Fatal startup error:", error);
  recordStartupError(error);
  void dialog.showErrorBox("Gestion Grupos Estudiantiles no pudo iniciar", formatStartupError(error));
  app.quit();
});

function recordStartupError(error: unknown): void {
  const message = formatStartupError(error);
  const logFile = path.join(app.getPath("userData"), "startup-error.log");

  try {
    fs.mkdirSync(path.dirname(logFile), { recursive: true });
    fs.writeFileSync(logFile, `${new Date().toISOString()}\n${message}\n`, "utf8");
  } catch {
    // Best effort only.
  }
}

function formatStartupError(error: unknown): string {
  return error instanceof Error ? `${error.name}: ${error.message}\n${error.stack ?? ""}` : String(error);
}

function registerPackagedNodeModulesPath(): void {
  const resourcesNodeModules = path.join(process.resourcesPath, "node_modules");
  process.env.NODE_PATH = process.env.NODE_PATH?.trim()
    ? `${resourcesNodeModules}${path.delimiter}${process.env.NODE_PATH}`
    : resourcesNodeModules;
  (Module as unknown as { _initPaths: () => void })._initPaths();
}
