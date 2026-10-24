import type { PreloadAPI } from './shared/types';

declare global {
  /** 由 vite.config.ts 从 package.json 注入 */
  const __APP_VERSION__: string;

  interface Window {
    api: PreloadAPI;
  }
}

export {};
