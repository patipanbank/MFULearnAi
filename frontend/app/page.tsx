import React from 'react';
import RoleGuard from '@/components/guards/RoleGuard';

export default function HomePage() {
  return (
    <RoleGuard allowed={['Students', 'Staffs', 'Admin', 'SuperAdmin']}>
      <div className="flex flex-col items-center justify-center h-full py-20">
        <h1 className="text-3xl font-bold mb-4">Welcome to MFULearnAi 🎓🤖</h1>
        <p className="text-lg text-gray-600 mb-2">AI Chatbot & Model Management for Mae Fah Luang University</p>
        <p className="text-gray-500">Use the sidebar to navigate through the app.</p>
      </div>
    </RoleGuard>
  );
} 