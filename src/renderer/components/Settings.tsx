import React, { useState, useEffect, useCallback } from 'react';
import { getApi } from '../utils/api';
import { ConfirmDialog } from './ConfirmDialog';
import type { AppSettings, StickerColor } from '../../shared/types';
import { COLOR_THEMES } from '../utils/colors';

const Settings: React.FC = () => {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [pendingSettings, setPendingSettings] = useState<Partial<AppSettings>>({});
  const [showImportConfirm, setShowImportConfirm] = useState(false);
  const [importMode, setImportMode] = useState<'merge' | 'overwrite'>('merge');
  const [saved, setSaved] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const s = await getApi().settings.get();
        setSettings(s);
      } catch (error) {
        console.error('加载设置失败:', error);
      }
    })();
  }, []);

  // 暂存修改（不立即生效）
  const updateSetting = useCallback((key: keyof AppSettings, value: unknown) => {
    setPendingSettings((prev) => ({ ...prev, [key]: value }));
    setHasChanges(true);
  }, []);

  // 保存所有修改
  const handleSave = useCallback(async () => {
    if (!settings || !hasChanges) return;
    try {
      const merged = { ...settings, ...pendingSettings };
      await getApi().settings.set(pendingSettings);
      setSettings(merged);
      setPendingSettings({});
      setHasChanges(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (error) {
      console.error('保存设置失败:', error);
    }
  }, [settings, pendingSettings, hasChanges]);

  // 取消修改
  const handleCancel = useCallback(() => {
    setPendingSettings({});
    setHasChanges(false);
  }, []);

  // 获取当前显示值（优先 pending，回退到 saved）
  const getValue = useCallback(
    <K extends keyof AppSettings>(key: K): AppSettings[K] => {
      if (key in pendingSettings) return pendingSettings[key] as AppSettings[K];
      return settings?.[key] ?? ({} as any)[key];
    },
    [settings, pendingSettings]
  );

  const handleExport = useCallback(async () => {
    try {
      const data = await getApi().data.export();
      const jsonStr = JSON.stringify(data, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `电脑便签备份-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('导出数据失败:', error);
    }
  }, []);

  const handleImport = useCallback(async () => {
    try {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';
      input.onchange = async (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (!file) return;
        const text = await file.text();
        const data = JSON.parse(text);
        await getApi().data.import(data, importMode);
        setShowImportConfirm(false);
        alert('导入成功！');
      };
      input.click();
    } catch (error) {
      console.error('导入数据失败:', error);
      alert('导入失败：数据格式不正确');
    }
  }, [importMode]);

  if (!settings) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50 dark:bg-gray-900">
        <div className="flex flex-col items-center gap-2">
          <div className="w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-gray-400">加载中...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* 顶部标题栏 */}
      <div className="flex items-center justify-between px-6 py-4 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <span className="text-lg">⚙</span>
          <h1 className="text-lg font-semibold text-gray-800 dark:text-gray-200">设置</h1>
        </div>
        <div className="flex items-center gap-2">
          {hasChanges && (
            <button
              onClick={handleCancel}
              className="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
            >
              取消
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={!hasChanges}
            className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-all ${
              hasChanges
                ? 'bg-blue-500 text-white hover:bg-blue-600 shadow-sm'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
            }`}
          >
            {saved ? '✓ 已保存' : '保存设置'}
          </button>
        </div>
      </div>

      {/* 设置内容 */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-lg mx-auto p-6 space-y-6">
          {/* 快捷键 */}
          <section className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4 flex items-center gap-2">
              <span>⌨</span> 快捷键
            </h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">新建便签</span>
                <input
                  type="text"
                  value={getValue('shortcutNew')}
                  onChange={(e) => updateSetting('shortcutNew', e.target.value)}
                  className="w-36 px-3 py-1.5 text-sm text-center border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent font-mono"
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">打开列表</span>
                <input
                  type="text"
                  value={getValue('shortcutList')}
                  onChange={(e) => updateSetting('shortcutList', e.target.value)}
                  className="w-36 px-3 py-1.5 text-sm text-center border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent font-mono"
                />
              </div>
            </div>
          </section>

          {/* 默认颜色 */}
          <section className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4 flex items-center gap-2">
              <span>🎨</span> 默认颜色
            </h2>
            <div className="grid grid-cols-4 gap-2">
              {COLOR_THEMES.map((theme) => (
                <button
                  key={theme.color}
                  onClick={() => updateSetting('defaultColor', theme.color)}
                  className={`flex flex-col items-center gap-1 p-2 rounded-lg border-2 transition-all ${
                    getValue('defaultColor') === theme.color
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30'
                      : 'border-transparent hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  <div
                    className="w-8 h-8 rounded-full shadow-sm"
                    style={{ backgroundColor: theme.color }}
                  />
                  <span className="text-xs text-gray-600 dark:text-gray-400">{theme.name}</span>
                </button>
              ))}
            </div>
          </section>

          {/* 主题模式 */}
          <section className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4 flex items-center gap-2">
              <span>🌓</span> 主题
            </h2>
            <div className="flex gap-2">
              {([
                { value: 'system' as const, label: '跟随系统', icon: '💻' },
                { value: 'light' as const, label: '浅色', icon: '☀️' },
                { value: 'dark' as const, label: '深色', icon: '🌙' },
              ]).map((option) => (
                <button
                  key={option.value}
                  onClick={() => updateSetting('themeMode', option.value)}
                  className={`flex-1 flex flex-col items-center gap-1 p-3 rounded-lg border-2 transition-all ${
                    getValue('themeMode') === option.value
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30'
                      : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                  }`}
                >
                  <span className="text-lg">{option.icon}</span>
                  <span className="text-xs text-gray-600 dark:text-gray-400">{option.label}</span>
                </button>
              ))}
            </div>
          </section>

          {/* 开机自启动 */}
          <section className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4 flex items-center gap-2">
              <span>🚀</span> 启动
            </h2>
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm text-gray-700 dark:text-gray-300">开机自启动</span>
                <p className="text-xs text-gray-400 mt-0.5">系统启动时自动运行电脑便签</p>
              </div>
              <button
                onClick={() => updateSetting('autoStart', !getValue('autoStart'))}
                className={`relative w-11 h-6 rounded-full transition-colors ${
                  getValue('autoStart') ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-600'
                }`}
              >
                <div
                  className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                    getValue('autoStart') ? 'translate-x-[22px]' : 'translate-x-0.5'
                  }`}
                />
              </button>
            </div>
          </section>

          {/* 数据管理 */}
          <section className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4 flex items-center gap-2">
              <span>💾</span> 数据管理
            </h2>
            <div className="space-y-3">
              <button
                onClick={handleExport}
                className="w-full px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-left flex items-center gap-2"
              >
                <span>📤</span> 导出数据
              </button>
              <div className="flex gap-2">
                <select
                  value={importMode}
                  onChange={(e) => setImportMode(e.target.value as 'merge' | 'overwrite')}
                  className="flex-1 px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
                >
                  <option value="merge">合并导入</option>
                  <option value="overwrite">覆盖导入</option>
                </select>
                <button
                  onClick={() => setShowImportConfirm(true)}
                  className="px-4 py-2 text-sm font-medium text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 rounded-lg hover:bg-amber-100 dark:hover:bg-amber-900/50 transition-colors"
                >
                  📥 导入
                </button>
              </div>
            </div>
          </section>

          {/* 关于 */}
          <section className="text-center py-4">
            <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">电脑便签 v1.1.0</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">开机即在，随手一贴</p>
          </section>
        </div>
      </div>

      <ConfirmDialog
        open={showImportConfirm}
        title="导入数据"
        message={`确定要${importMode === 'overwrite' ? '覆盖' : '合并'}导入数据吗？${importMode === 'overwrite' ? '覆盖模式将替换当前所有数据！' : '合并模式将追加新数据。'}`}
        confirmLabel="确认导入"
        onConfirm={handleImport}
        onCancel={() => setShowImportConfirm(false)}
      />
    </div>
  );
};

export default Settings;
