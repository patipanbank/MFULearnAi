import React from 'react';
import RoleGuard from '@/components/guards/RoleGuard';

export default function DepartmentsPage() {
  return (
    <RoleGuard allowed={['SuperAdmin']}>
      <div className="flex flex-col items-center justify-center h-full py-20">
        <h1 className="text-2xl font-bold mb-4">Department Management</h1>
        <p className="text-gray-600">This is the department management page. SuperAdmin can manage departments here.</p>
      </div>
    </RoleGuard>
  );
} 