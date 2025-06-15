import React from 'react';
import RoleGuard from '@/components/guards/RoleGuard';

export default function SystemPromptPage() {
  return (
    <RoleGuard allowed={['SuperAdmin']}>
      <div className="flex flex-col items-center justify-center h-full py-20">
        <h1 className="text-2xl font-bold mb-4">System Prompt</h1>
        <p className="text-gray-600">This is the system prompt management page. SuperAdmin can edit the system prompt here.</p>
      </div>
    </RoleGuard>
  );
} 