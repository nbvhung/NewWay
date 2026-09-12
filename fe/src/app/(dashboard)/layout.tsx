'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/providers/auth-provider';
import { Navbar } from '@/components/ui/navbar';
import { ToastProvider } from '@/components/ui/toast';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#fafaf9] flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen flex flex-col bg-[#fafaf9]">
      <ToastProvider>
        <Navbar />
        <main className="flex-1 w-full px-3 sm:px-5 py-5 sm:py-6">
          {children}
        </main>
      </ToastProvider>
    </div>
  );
}
