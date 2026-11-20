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
  // 只负责把 .dark / data-skin 写到 <html>；不要再在包裹 div 上重复 .dark，
  // 否则它会用默认皮肤的 token 覆盖其他皮肤（自定义属性按最近祖先继承）。
  useTheme();

  useEffect(() => {
    if (pageType === 'list') {
      document.title = '贴记 - 便签列表';
    } else if (pageType === 'settings') {
      document.title = '贴记 - 设置';
    }
  }, [pageType]);

  return (
    <div>
      {pageType === 'sticker' && stickerId && (
        <StickerEditor stickerId={stickerId} />
      )}
      {pageType === 'list' && <StickerList />}
      {pageType === 'settings' && <Settings />}
    </div>
  );
};

export default App;
