import type { WindowState } from '../../shared/types';

export { extractTitle } from '../../shared/note';

/** 计算新便签的偏移位置 */
export function calculateOffsetPosition(
  existingWindows: WindowState[],
  screenWidth: number,
  screenHeight: number
): WindowState {
  const OFFSET = 20;
  const DEFAULT_WIDTH = 240;
  const DEFAULT_HEIGHT = 200;

  if (existingWindows.length === 0) {
    return {
      x: 100,
      y: 100,
      width: DEFAULT_WIDTH,
      height: DEFAULT_HEIGHT,
    };
  }

  const lastWindow = existingWindows[existingWindows.length - 1];
  let x = lastWindow.x + OFFSET;
  let y = lastWindow.y + OFFSET;

  // 如果超出屏幕右边界，从左侧重新开始
  if (x + DEFAULT_WIDTH > screenWidth) {
    x = 50;
  }

  // 如果超出屏幕下边界，从顶部重新开始
  if (y + DEFAULT_HEIGHT > screenHeight) {
    y = 50;
  }

  return {
    x,
    y,
    width: DEFAULT_WIDTH,
    height: DEFAULT_HEIGHT,
  };
}

/** 确保窗口位置在屏幕可见区域内 */
export function ensureInScreen(
  state: WindowState,
  screenWidth: number,
  screenHeight: number
): WindowState {
  let { x, y, width, height } = state;

  if (x + width > screenWidth) {
    x = Math.max(0, screenWidth - width);
  }
  if (y + height > screenHeight) {
    y = Math.max(0, screenHeight - height);
  }
  if (x < 0) x = 0;
  if (y < 0) y = 0;

  return { x, y, width, height };
}
