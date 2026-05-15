import { spawn } from "node:child_process";
import waitOn from "wait-on";

try {
  console.log("[dev-electron] Waiting for Vite and Electron build outputs...");

  await waitOn({
    resources: ["tcp:127.0.0.1:5173", "dist/electron/main.js", "dist/electron/preload.js"],
    timeout: 120000
  });

  console.log("[dev-electron] Starting Electron...");

  const child = spawn(
    process.platform === "win32" ? "npx.cmd" : "npx",
    ["electron", "dist/electron/main.js"],
    {
      stdio: "inherit",
      env: {
        ...process.env,
        ELECTRON_RENDERER_URL: "http://127.0.0.1:5173"
      }
    }
  );

  child.on("exit", (code) => {
    process.exit(code ?? 0);
  });
} catch (error) {
  console.error("[dev-electron] Could not start Electron.");
  console.error("[dev-electron] Verify that port 5173 is free and TypeScript watch produced dist/electron/main.js.");
  console.error(error);
  process.exit(1);
}
