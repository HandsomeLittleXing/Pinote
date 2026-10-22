import type { PreloadAPI } from '../../shared/types';

/** 获取 window.api（统一入口，消除重复） */
export function getApi(): PreloadAPI {
  return (window as unknown as { api: PreloadAPI }).api;
}
