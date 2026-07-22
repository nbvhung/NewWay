import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/providers/auth-provider';

export const metadata: Metadata = {
  title: 'New Way — Xác nhận sản lượng xe',
  description: 'Hệ thống xác nhận sản lượng New Way',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body className="relative">
        <AuthProvider>{children}</AuthProvider>
        <div className="fixed bottom-2 right-3 text-[10px] text-[#94a3b8] select-none z-[200]">
          Được phát triển bởi Phòng Ứng dụng AI &amp; Chuyển đổi số – New Way
        </div>
      </body>
    </html>
  );
}
