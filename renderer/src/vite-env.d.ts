/// <reference types="vite/client" />

import type { DesktopApi } from "../../src/types/ipc";

declare global {
  interface Window {
    desktopApi: DesktopApi;
  }
}

export {};
