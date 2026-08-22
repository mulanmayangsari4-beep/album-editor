import { useEffect, useRef, useState, useCallback } from 'react';
import { ProjectDocument } from '../types/editor';
import { projectService } from './projectService';

export type AutoSaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export interface UseAutoSaveOptions {
  debounceMs?: number; // 默认防抖 1000ms
  enabled?: boolean;
  onSaved?: (doc: ProjectDocument) => void;
  onError?: (error: Error) => void;
}

/**
 * 作品自动保存 Hook (useAutoSave)
 * 智能防抖合并高频编辑操作，提供轻量状态反馈，防止数据意外丢失
 */
export function useAutoSave(
  document: ProjectDocument | null,
  options: UseAutoSaveOptions = {}
) {
  const {
    debounceMs = 1000,
    enabled = true,
    onSaved,
    onError,
  } = options;

  const [saveStatus, setSaveStatus] = useState<AutoSaveStatus>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const timeoutRef = useRef<number | null>(null);
  const isFirstRender = useRef(true);
  const lastSavedPayloadRef = useRef<string>('');

  const executeSave = useCallback(
    async (docToSave: ProjectDocument) => {
      if (!docToSave || !docToSave.id) return;
      try {
        setSaveStatus('saving');
        await projectService.saveProject(docToSave);
        setSaveStatus('saved');
        setLastSavedAt(Date.now());
        setErrorMessage(null);
        if (onSaved) onSaved(docToSave);
      } catch (err: any) {
        console.error('[AutoSaveService] 自动保存失败:', err);
        setSaveStatus('error');
        setErrorMessage(err.message || '自动保存失败');
        if (onError) onError(err);
      }
    },
    [onSaved, onError]
  );

  useEffect(() => {
    if (!enabled || !document || !document.id) return;

    // 首次载入时不立即触发保存
    if (isFirstRender.current) {
      isFirstRender.current = false;
      lastSavedPayloadRef.current = JSON.stringify({
        title: document.title,
        pages: document.pages,
        photos: document.photos,
      });
      return;
    }

    const currentPayload = JSON.stringify({
      title: document.title,
      pages: document.pages,
      photos: document.photos,
    });

    // 内容未实质变动则跳过
    if (currentPayload === lastSavedPayloadRef.current) {
      return;
    }

    // 清理前置未执行的定时器
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
    }

    setSaveStatus('saving');

    timeoutRef.current = window.setTimeout(async () => {
      lastSavedPayloadRef.current = currentPayload;
      await executeSave(document);
    }, debounceMs);

    return () => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, [document, enabled, debounceMs, executeSave]);

  // 手动即时强制触发保存
  const forceSaveNow = useCallback(async () => {
    if (!document) return;
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
    }
    await executeSave(document);
  }, [document, executeSave]);

  return {
    saveStatus,
    lastSavedAt,
    errorMessage,
    forceSaveNow,
  };
}
