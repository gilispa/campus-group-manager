import path from "node:path";
import { app, BrowserWindow } from "electron";

const isDev = Boolean(process.env.ELECTRON_RENDERER_URL);
const appIconPath = path.join(process.cwd(), "images", "ml-v.png");

async function createWindow(): Promise<void> {
  console.log("[electron] Creating main window...");

  const window = new BrowserWindow({
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

  if (isDev) {
    console.log("[electron] Loading renderer URL:", process.env.ELECTRON_RENDERER_URL);
    await window.loadURL(process.env.ELECTRON_RENDERER_URL as string);
    window.webContents.openDevTools({ mode: "detach" });
    return;
  }

  console.log("[electron] Loading renderer file build...");
  await window.loadFile(path.join(__dirname, "..", "renderer", "index.html"));
}

async function bootstrapApp(): Promise<void> {
  await app.whenReady();
  console.log("[electron] App ready");
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
  app.quit();
});
