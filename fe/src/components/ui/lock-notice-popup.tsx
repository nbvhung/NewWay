'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

interface LockNoticePopupProps {
  open: boolean;
  onClose: () => void;
}

export function LockNoticePopup({ open, onClose }: LockNoticePopupProps) {
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
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[1000] flex items-center justify-center p-5"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-[340px] bg-[#ffffff] border-2 border-[#ef4444] rounded-2xl overflow-hidden shadow-[0_20px_60px_rgba(239,68,68,0.35)]">
        <div className="bg-gradient-to-r from-[#ef4444] to-[#dc2626] px-6 py-4 flex items-center justify-between">
          <h2 className="text-sm font-bold text-white">🔒 Nhập liệu đã khóa</h2>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center bg-white/20 rounded-full text-white hover:bg-white/40 transition-all text-sm"
          >
            ✕
          </button>
        </div>
        <div className="px-6 py-6 text-center">
          <div className="text-4xl mb-3">🔒</div>
          <p className="text-sm font-medium text-[#1c1917] leading-relaxed">
            Bạn chỉ có thể nhập liệu qua ZALO, và liên hệ HƯNG để sửa.
          </p>
          <p className="text-sm font-bold text-[#1c1917] mt-1">SĐT: 082 558 7779</p>
        </div>
        <div className="px-6 pb-5">
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-xl bg-[#ef4444] text-white text-sm font-bold hover:bg-[#dc2626] transition-all cursor-pointer"
          >
            Đã hiểu
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}