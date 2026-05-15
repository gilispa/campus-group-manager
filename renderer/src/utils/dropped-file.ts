import type { DragEvent } from "react";

export function extractDroppedSourcePath(event: DragEvent<HTMLDivElement>): string | null {
  const droppedFile = event.dataTransfer.files[0] as (File & { path?: string }) | undefined;
  if (droppedFile?.path) {
    return droppedFile.path;
  }

  const uriList = event.dataTransfer.getData("text/uri-list");
  if (uriList) {
    const [firstLine] = uriList.split(/\r?\n/).filter(Boolean);
    if (firstLine) {
      return decodeDroppedUri(firstLine);
    }
  }

  const plainText = event.dataTransfer.getData("text/plain");
  if (plainText?.startsWith("file://")) {
    return decodeDroppedUri(plainText.trim());
  }

  return null;
}

function decodeDroppedUri(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
