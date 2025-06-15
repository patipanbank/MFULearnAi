import React, { useEffect, useState } from 'react';
import RoleGuard from '../../src/components/guards/RoleGuard';
import { useAuth } from '../../src/context/AuthContext';

export default function SystemPromptPage() {
  const { token } = useAuth();
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const fetchPrompt = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/system-prompt', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to fetch system prompt');
      const data = await res.json();
      setPrompt(data.prompt || '');
    } catch (e: any) {
      setError(e.message || 'Error fetching system prompt');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (token) fetchPrompt(); }, [token]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/system-prompt', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ prompt }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to update system prompt');
      }
      setToast('System prompt updated');
      fetchPrompt();
    } catch (e: any) {
      setError(e.message || 'Error updating system prompt');
    } finally {
      setSaving(false);
    }
  };

  return (
    <RoleGuard allowed={['SuperAdmin']}>
      <div className="max-w-2xl mx-auto py-10">
        <h1 className="text-2xl font-bold mb-6">System Prompt</h1>
        {toast && (
          <div className="mb-4 text-green-600 bg-green-100 px-4 py-2 rounded">{toast}</div>
        )}
        {error && (
          <div className="mb-4 text-red-600 bg-red-100 px-4 py-2 rounded">{error}</div>
        )}
        {loading ? (
          <div>Loading...</div>
        ) : (
          <form onSubmit={handleSave} className="bg-white p-6 rounded shadow">
            <label className="block mb-2 font-semibold">Prompt</label>
            <textarea
              className="w-full border rounded px-3 py-2 mb-4 min-h-[180px] font-mono"
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              required
              maxLength={4000}
            />
            <div className="flex gap-2 justify-end">
              <button type="submit" className="px-4 py-2 rounded bg-blue-600 text-white" disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
            </div>
          </form>
        )}
      </div>
    </RoleGuard>
  );
} 