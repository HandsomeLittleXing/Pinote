import type { PreloadAPI } from './shared/types';

declare global {
  interface Window {
    api: PreloadAPI;
  }
}

export {};
