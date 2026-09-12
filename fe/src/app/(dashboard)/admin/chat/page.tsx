'use client';

import { useAdminData } from '../layout';
import { ChatHistoryTab } from '@/components/admin/ChatHistoryTab';
import { useToast } from '@/components/ui/toast';

export default function AdminChatPage() {
  const { user, allUsers, loading } = useAdminData();
  const { toast } = useToast();
  if (loading) return <div className="py-16 text-center text-[#78716c] text-sm">Đang tải...</div>;
  return <ChatHistoryTab allUsers={allUsers} currentUser={user} toast={toast} />;
}