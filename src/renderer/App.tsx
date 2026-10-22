import React, { useEffect, useState } from 'react';
import StickerEditor from './components/StickerEditor';
import StickerList from './components/StickerList';
import Settings from './components/Settings';
import { useTheme } from './hooks/useTheme';

/** 判断当前页面类型 */
function getPageType(): 'sticker' | 'list' | 'settings' {
  const params = new URLSearchParams(window.location.search);
  const page = params.get('page');
  if (page === 'list') return 'list';
  if (page === 'settings') return 'settings';
  return 'sticker';
}

/** 获取便签 ID */
function getStickerId(): string | null {
  const params = new URLSearchParams(window.location.search);
  return params.get('id');
}

const App: React.FC = () => {
  const [pageType] = useState(getPageType);
  const [stickerId] = useState(getStickerId);
  const { isDark } = useTheme();

  useEffect(() => {
    if (pageType === 'list') {
      document.title = '电脑便签 - 便签列表';
    } else if (pageType === 'settings') {
      document.title = '电脑便签 - 设置';
    }
  }, [pageType]);

  return (
    <div className={isDark ? 'dark' : ''}>
      {pageType === 'sticker' && stickerId && (
        <StickerEditor stickerId={stickerId} />
      )}
      {pageType === 'list' && <StickerList />}
      {pageType === 'settings' && <Settings />}
    </div>
  );
};

export default App;
