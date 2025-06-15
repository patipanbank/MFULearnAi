import { useEffect, useState } from 'react';
import RoleGuard from '../../src/components/guards/RoleGuard';
import { useAuth } from '../../src/context/AuthContext';

interface Stat {
  date: string;
  uniqueUsers: number;
  totalChats: number;
  totalTokens: number;
}

function formatDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

export default function StatisticsPage() {
  const { token } = useAuth();
  const [stats, setStats] = useState<Stat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return formatDate(d);
  });
  const [endDate, setEndDate] = useState(() => formatDate(new Date()));

  const fetchStats = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/stats/daily?startDate=${startDate}&endDate=${endDate}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to fetch statistics');
      const data = await res.json();
      setStats(data);
    } catch (e: any) {
      setError(e.message || 'Error fetching statistics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (token) fetchStats(); }, [token, startDate, endDate]);

  return (
    <RoleGuard allowed={['Admin', 'SuperAdmin']}>
      <div className="max-w-3xl mx-auto py-10">
        <h1 className="text-2xl font-bold mb-6">Statistics</h1>
        {error && (
          <div className="mb-4 text-red-600 bg-red-100 px-4 py-2 rounded">{error}</div>
        )}
        <div className="flex gap-4 mb-6">
          <div>
            <label className="block text-sm mb-1">Start Date</label>
            <input type="date" className="border rounded px-2 py-1" value={startDate} onChange={e => setStartDate(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm mb-1">End Date</label>
            <input type="date" className="border rounded px-2 py-1" value={endDate} onChange={e => setEndDate(e.target.value)} />
          </div>
          <button onClick={fetchStats} className="self-end bg-blue-600 text-white px-4 py-2 rounded">Refresh</button>
        </div>
        {loading ? (
          <div>Loading...</div>
        ) : (
          <>
            <table className="w-full border mb-8">
              <thead>
                <tr className="bg-gray-100">
                  <th className="p-2 text-left">Date</th>
                  <th className="p-2 text-right">Unique Users</th>
                  <th className="p-2 text-right">Total Chats</th>
                  <th className="p-2 text-right">Total Tokens</th>
                </tr>
              </thead>
              <tbody>
                {stats.map(stat => (
                  <tr key={stat.date} className="border-t">
                    <td className="p-2">{stat.date.slice(0, 10)}</td>
                    <td className="p-2 text-right">{stat.uniqueUsers}</td>
                    <td className="p-2 text-right">{stat.totalChats}</td>
                    <td className="p-2 text-right">{stat.totalTokens}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {/* Simple chart: bar for total chats per day */}
            <div className="bg-white p-4 rounded shadow">
              <h2 className="font-semibold mb-2">Total Chats (Bar Chart)</h2>
              <div className="flex items-end gap-2 h-40">
                {stats.map(stat => (
                  <div key={stat.date} className="flex flex-col items-center" style={{ width: '32px' }}>
                    <div
                      className="bg-blue-500 w-full rounded-t"
                      style={{ height: `${Math.max(10, stat.totalChats * 3)}px` }}
                      title={`Chats: ${stat.totalChats}`}
                    ></div>
                    <span className="text-xs mt-1">{stat.date.slice(5, 10)}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </RoleGuard>
  );
} 