declare const __BUILD_ID__: string;
/** 测试构建（RIDE_AUDIT=1）才为 true：化身数据的检查接口只在测试构建里存在 */
declare const __RIDE_AUDIT__: boolean;
/** 实验室旧模块清单的文件名（生产构建为内容哈希，开发环境为 manifest.json），由 build/protect.ts 注入 */
declare const __LEGACY_MANIFEST__: string;

interface Window {
  LAB_EMIT?: (type: string, detail?: Record<string, unknown>) => void;
  MB_GLB_BUF?: ArrayBuffer | null;
  __LEGACY_LOADER__?: boolean;
  __LEGACY_BOOTED__?: boolean;
  /** 按需加载实验室旧模块里的一组脚本（立体结构图、跨科连线立体图） */
  __LEGACY_LOAD__?: (group: string, onProgress?: (f: number) => void) => Promise<void>;
  /** 实验室立体结构图的开关（由 legacy-src/js/09-tool.js 提供） */
  X_BOARD?: { open: () => Promise<void>; close: () => void; isOpen: () => boolean };
  /** 切到实验室里的某个实验并滚过去（由 02-chapters.js 提供） */
  X_OPEN_LAB?: (id: string) => void;
  X_OPEN_PROC?: (id: string) => boolean;
}

interface ImportMetaEnv {
  /** ICP 备案号（如「京ICP备XXXXXXXX号-1」），留空则页脚不显示 */
  readonly VITE_ICP_BEIAN?: string;
  /** 运营者联系邮箱，显示在用户协议与隐私政策里；留空则提示通过站内公告联系 */
  readonly VITE_CONTACT_EMAIL?: string;
}
