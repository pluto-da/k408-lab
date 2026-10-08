declare const __BUILD_ID__: string;

interface Window {
  LAB_EMIT?: (type: string, detail?: Record<string, unknown>) => void;
  MB_GLB_BUF?: ArrayBuffer | null;
  __LEGACY_LOADER__?: boolean;
  __LEGACY_BOOTED__?: boolean;
}

interface ImportMetaEnv {
  /** ICP 备案号（如「京ICP备XXXXXXXX号-1」），留空则页脚不显示 */
  readonly VITE_ICP_BEIAN?: string;
}
