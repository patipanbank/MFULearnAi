import React from 'react';
import RoleGuard from '@/components/guards/RoleGuard';

export default function StatisticsPage() {
  return (
    <RoleGuard allowed={['Admin', 'SuperAdmin']}>
      <div className="flex flex-col items-center justify-center h-full py-20">
        <h1 className="text-2xl font-bold mb-4">Statistics</h1>
        <p className="text-gray-600">This is the statistics page. Usage and analytics will be shown here.</p>
      </div>
    </RoleGuard>
  );
} 