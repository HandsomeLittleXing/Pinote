import React, { useCallback, useEffect, useState } from 'react';
import { Database, Download, History, RotateCcw, Upload } from 'lucide-react';
import { SectionCard } from './SectionCard';
import { Button } from '../ui/Button';
import { ConfirmDialog } from '../ConfirmDialog';
import { useToast } from '../ui/Toast';
import { getApi } from '../../utils/api';
import { extractTitle } from '../../utils/position';
import type { ImportMode, Sticker } from '../../../shared/types';

/** 数据：导出/导入与最近删除 */
export function DataSettings() {
  const { toast } = useToast();
  const [importMode, setImportMode] = useState<ImportMode>('merge');
  const [showImport, setShowImport] = useState(false);
  const [deleted, setDeleted] = useState<Sticker[]>([]);
  const [loadingDeleted, setLoadingDeleted] = useState(true);

  const loadDeleted = useCallback(async () => {
    setLoadingDeleted(true);
    try {
      setDeleted(await getApi().sticker.getDeleted());
    } catch (error) {
      console.error('加载最近删除失败:', error);
    } finally {
      setLoadingDeleted(false);
    }
  }, []);

  useEffect(() => {
    void loadDeleted();
  }, [loadDeleted]);

  const handleExport = useCallback(async () => {
    try {
      const data = await getApi().data.export();
      const jsonStr = JSON.stringify(data, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `电脑便签备份-${new Date().toISOString().slice(0, 10)}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
      toast({ title: '已导出数据', variant: 'success' });
    } catch (error) {
      console.error('导出数据失败:', error);
      toast({ title: '导出失败', variant: 'error' });
    }
  }, [toast]);

  const handleImportFile = useCallback(async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (event) => {
      const file = (event.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        await getApi().data.import(data, importMode);
        await loadDeleted();
        toast({ title: '导入成功', variant: 'success' });
      } catch (error) {
        console.error('导入数据失败:', error);
        toast({
          title: '导入失败',
          description: '数据格式不正确或写入失败',
          variant: 'error',
        });
      }
    };
    input.click();
  }, [importMode, loadDeleted, toast]);

  const handleRestore = useCallback(
    async (id: string) => {
      try {
        await getApi().sticker.restore(id);
        await loadDeleted();
        toast({ title: '已恢复便签', variant: 'success', duration: 1800 });
      } catch (error) {
        console.error('恢复便签失败:', error);
        toast({ title: '恢复失败', variant: 'error' });
      }
    },
    [loadDeleted, toast]
  );

  return (
    <>
      <SectionCard
        title="数据管理"
        icon={<Database size={16} className="text-ink-muted" />}
        description="导出备份，或从 JSON 恢复便签。"
      >
        <div className="space-y-3">
          <Button variant="secondary" className="w-full justify-start" onClick={handleExport}>
            <Download size={15} /> 导出数据
          </Button>
          <div className="flex gap-2">
            <select
              value={importMode}
              onChange={(event) => setImportMode(event.target.value as ImportMode)}
              className="flex-1 rounded-md border border-line/10 bg-muted px-3 py-2 text-sm text-ink focus:border-transparent focus:outline-none focus:ring-2 focus:ring-accent/40"
            >
              <option value="merge">合并导入</option>
              <option value="overwrite">覆盖导入</option>
            </select>
            <Button variant="secondary" onClick={() => setShowImport(true)}>
              <Upload size={15} /> 导入
            </Button>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="最近删除"
        icon={<History size={16} className="text-ink-muted" />}
        description="恢复最近删除的便签（最多 20 条）。"
      >
        <div className="space-y-2">
          <div className="flex justify-end">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                void loadDeleted();
              }}
            >
              刷新
            </Button>
          </div>
          {loadingDeleted ? (
            <p className="text-xs text-ink-subtle">加载中...</p>
          ) : deleted.length === 0 ? (
            <p className="text-xs text-ink-subtle">暂无已删除便签</p>
          ) : (
            <ul className="space-y-2">
              {deleted.slice(0, 20).map((sticker) => (
                <li
                  key={sticker.id}
                  className="flex items-center justify-between gap-2 rounded-lg bg-muted px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm text-ink">{extractTitle(sticker.content)}</p>
                    <p className="text-xs text-ink-subtle">
                      {sticker.deletedAt ? new Date(sticker.deletedAt).toLocaleString() : ''}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      void handleRestore(sticker.id);
                    }}
                  >
                    <RotateCcw size={13} /> 恢复
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </SectionCard>

      <ConfirmDialog
        open={showImport}
        title="导入数据"
        message={`确定要${importMode === 'overwrite' ? '覆盖' : '合并'}导入数据吗？${importMode === 'overwrite' ? '覆盖模式将替换当前所有数据！' : '合并模式将追加新数据。'}`}
        confirmLabel="选择文件"
        confirmVariant={importMode === 'overwrite' ? 'danger' : 'primary'}
        onConfirm={() => {
          setShowImport(false);
          void handleImportFile();
        }}
        onCancel={() => setShowImport(false)}
      />
    </>
  );
}
