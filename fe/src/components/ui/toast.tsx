'use client';

import { useState, useCallback, createContext, useContext, ReactNode } from 'react';

interface ToastItem {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
}

interface ToastContextType {
  toast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

const ToastContext = createContext<ToastContextType>({ toast: () => {} });

let toastId = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const toast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'success') => {
    const id = ++toastId;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed top-[72px] right-5 z-[9999] flex flex-col gap-2 max-w-[380px]">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`bg-[#ffffff] border border-[rgba(0,0,0,0.08)] rounded-lg px-4 py-3 text-sm font-medium shadow-lg animate-[slideIn_0.3s_ease] ${
              t.type === 'success'
                ? 'border-l-3 border-l-[#10b981]'
                : t.type === 'error'
                ? 'border-l-3 border-l-[#ef4444]'
                : 'border-l-3 border-l-[#1a56db]'
            }`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
