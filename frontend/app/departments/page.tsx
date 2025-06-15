import React, { useEffect, useState } from 'react';
import RoleGuard from '../../src/components/guards/RoleGuard';
import { useAuth } from '../../src/context/AuthContext';

interface Department {
  _id: string;
  name: string;
  description?: string;
}

export default function DepartmentsPage() {
  const { token } = useAuth();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editDept, setEditDept] = useState<Department | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const fetchDepartments = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/departments', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to fetch departments');
      const data = await res.json();
      setDepartments(data);
    } catch (e: any) {
      setError(e.message || 'Error fetching departments');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (token) fetchDepartments(); }, [token]);

  const openAdd = () => {
    setEditDept(null);
    setName('');
    setDescription('');
    setShowModal(true);
  };
  const openEdit = (dept: Department) => {
    setEditDept(dept);
    setName(dept.name);
    setDescription(dept.description || '');
    setShowModal(true);
  };
  const closeModal = () => {
    setShowModal(false);
    setEditDept(null);
    setName('');
    setDescription('');
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const method = editDept ? 'PUT' : 'POST';
      const url = editDept ? `/api/departments/${editDept._id}` : '/api/departments';
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name, description }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Failed to save department');
      }
      setToast(editDept ? 'Department updated' : 'Department created');
      closeModal();
      fetchDepartments();
    } catch (e: any) {
      setError(e.message || 'Error saving department');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (dept: Department) => {
    if (!confirm(`Delete department "${dept.name}"?`)) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/departments/${dept._id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Failed to delete department');
      }
      setToast('Department deleted');
      fetchDepartments();
    } catch (e: any) {
      setError(e.message || 'Error deleting department');
    } finally {
      setSaving(false);
    }
  };

  return (
    <RoleGuard allowed={['SuperAdmin']}>
      <div className="max-w-2xl mx-auto py-10">
        <h1 className="text-2xl font-bold mb-6">Department Management</h1>
        {toast && (
          <div className="mb-4 text-green-600 bg-green-100 px-4 py-2 rounded">{toast}</div>
        )}
        {error && (
          <div className="mb-4 text-red-600 bg-red-100 px-4 py-2 rounded">{error}</div>
        )}
        <button onClick={openAdd} className="mb-4 bg-blue-600 text-white px-4 py-2 rounded">Add Department</button>
        {loading ? (
          <div>Loading...</div>
        ) : (
          <table className="w-full border">
            <thead>
              <tr className="bg-gray-100">
                <th className="p-2 text-left">Name</th>
                <th className="p-2 text-left">Description</th>
                <th className="p-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {departments.map((dept) => (
                <tr key={dept._id} className="border-t">
                  <td className="p-2">{dept.name}</td>
                  <td className="p-2">{dept.description}</td>
                  <td className="p-2 flex gap-2">
                    <button onClick={() => openEdit(dept)} className="bg-yellow-400 text-white px-2 py-1 rounded">Edit</button>
                    <button onClick={() => handleDelete(dept)} className="bg-red-500 text-white px-2 py-1 rounded">Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {showModal && (
          <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
            <form onSubmit={handleSave} className="bg-white p-6 rounded shadow w-96">
              <h2 className="text-lg font-bold mb-4">{editDept ? 'Edit' : 'Add'} Department</h2>
              <div className="mb-4">
                <label className="block mb-1">Name</label>
                <input className="w-full border rounded px-3 py-2" value={name} onChange={e => setName(e.target.value)} required maxLength={100} />
              </div>
              <div className="mb-4">
                <label className="block mb-1">Description</label>
                <input className="w-full border rounded px-3 py-2" value={description} onChange={e => setDescription(e.target.value)} maxLength={200} />
              </div>
              <div className="flex gap-2 justify-end">
                <button type="button" onClick={closeModal} className="px-4 py-2 rounded bg-gray-200">Cancel</button>
                <button type="submit" className="px-4 py-2 rounded bg-blue-600 text-white" disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
              </div>
            </form>
          </div>
        )}
      </div>
    </RoleGuard>
  );
} 