'use client';

import { ReactNode, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'md' | 'lg' | 'xl';
}

const SIZES: Record<string, string> = {
  md: 'max-w-[580px]',
  lg: 'max-w-[780px]',
  xl: 'max-w-[960px]',
};

export function Modal({ open, onClose, title, children, footer, size = 'md' }: ModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  if (!open || !mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[1000] flex items-center justify-center p-5"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className={`w-full ${SIZES[size]} max-h-[90vh] overflow-y-auto bg-[#ffffff] border border-[#e7e5e4] rounded-xl shadow-lg`}>
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-[#e7e5e4]">
          <h2 className="text-base font-bold">{title}</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center bg-[#f5f5f4] rounded-lg text-[#78716c] hover:bg-[#ef4444] hover:text-white transition-all text-lg"
          >
            ×
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
        {footer && (
          <div className="flex justify-end gap-2.5 px-6 pb-5 pt-4 border-t border-[#e7e5e4]">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
