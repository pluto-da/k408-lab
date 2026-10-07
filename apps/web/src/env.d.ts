declare const __BUILD_ID__: string;

interface Window {
  LAB_EMIT?: (type: string, detail?: Record<string, unknown>) => void;
  MB_GLB_BUF?: ArrayBuffer | null;
  __LEGACY_LOADER__?: boolean;
  __LEGACY_BOOTED__?: boolean;
}
