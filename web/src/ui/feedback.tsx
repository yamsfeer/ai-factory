import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

type Toast = { id: number; message: string; kind: 'ok' | 'err' };

const ToastContext = createContext<{ push: (message: string, kind?: 'ok' | 'err') => void }>({ push: () => {} });

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const push = useCallback((message: string, kind: 'ok' | 'err' = 'ok') => {
    const id = Date.now() + Math.random();
    setItems((prev) => [...prev, { id, message, kind }]);
    setTimeout(() => setItems((prev) => prev.filter((t) => t.id !== id)), 3200);
  }, []);
  const value = useMemo(() => ({ push }), [push]);
  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="af-toasts" role="status" aria-live="polite">
        {items.map((toast) => (
          <div key={toast.id} className={`af-toast ${toast.kind === 'err' ? 'err' : ''}`}>
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}

/** 当前操作人：localStorage + 自定义事件，Header 与 api 共用。 */
export function useOperator(): [string, (name: string) => void] {
  const [name, setName] = useState(() => {
    try {
      return localStorage.getItem('af.operator') || '本';
    } catch {
      return '本';
    }
  });
  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<string>).detail;
      if (typeof detail === 'string') setName(detail);
    };
    window.addEventListener('af-operator-changed', handler);
    return () => window.removeEventListener('af-operator-changed', handler);
  }, []);
  const update = (next: string) => {
    const value = next.trim().slice(0, 20) || '本';
    localStorage.setItem('af.operator', value);
    window.dispatchEvent(new CustomEvent('af-operator-changed', { detail: value }));
  };
  return [name, update];
}
