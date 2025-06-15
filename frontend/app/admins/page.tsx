import React, { useEffect, useState } from 'react';
import RoleGuard from '../../src/components/guards/RoleGuard';
import { useAuth } from '../../src/context/AuthContext';

interface Admin {
  _id: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  department: string;
  role: string;
}

export default function AdminsPage() {
  const { token } = useAuth();
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editAdmin, setEditAdmin] = useState<Admin | null>(null);
  const [form, setForm] = useState({
    username: '',
    password: '',
    email: '',
    firstName: '',
    lastName: '',
    department: '',
  });
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const fetchAdmins = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/all', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to fetch admins');
      const data = await res.json();
      setAdmins(data);
    } catch (e: any) {
      setError(e.message || 'Error fetching admins');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (token) fetchAdmins(); }, [token]);

  const openAdd = () => {
    setEditAdmin(null);
    setForm({ username: '', password: '', email: '', firstName: '', lastName: '', department: '' });
    setShowModal(true);
  };
  const openEdit = (admin: Admin) => {
    setEditAdmin(admin);
    setForm({
      username: admin.username,
      password: '',
      email: admin.email,
      firstName: admin.firstName,
      lastName: admin.lastName,
      department: admin.department,
    });
    setShowModal(true);
  };
  const closeModal = () => {
    setShowModal(false);
    setEditAdmin(null);
    setForm({ username: '', password: '', email: '', firstName: '', lastName: '', department: '' });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      let res;
      if (editAdmin) {
        res = await fetch(`/api/admin/${editAdmin._id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(form),
        });
      } else {
        res = await fetch('/api/admin/create', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(form),
        });
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to save admin');
      setToast(editAdmin ? 'Admin updated' : 'Admin created');
      closeModal();
      fetchAdmins();
    } catch (e: any) {
      setError(e.message || 'Error saving admin');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (admin: Admin) => {
    if (!confirm(`Delete admin "${admin.username}"?`)) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/${admin._id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to delete admin');
      setToast('Admin deleted');
      fetchAdmins();
    } catch (e: any) {
      setError(e.message || 'Error deleting admin');
    } finally {
      setSaving(false);
    }
  };

  return (
    <RoleGuard allowed={['SuperAdmin']}>
      <div className="max-w-2xl mx-auto py-10">
        <h1 className="text-2xl font-bold mb-6">Admin Management</h1>
        {toast && (
          <div className="mb-4 text-green-600 bg-green-100 px-4 py-2 rounded">{toast}</div>
        )}
        {error && (
          <div className="mb-4 text-red-600 bg-red-100 px-4 py-2 rounded">{error}</div>
        )}
        <button onClick={openAdd} className="mb-4 bg-blue-600 text-white px-4 py-2 rounded">Add Admin</button>
        {loading ? (
          <div>Loading...</div>
        ) : (
          <table className="w-full border">
            <thead>
              <tr className="bg-gray-100">
                <th className="p-2 text-left">Username</th>
                <th className="p-2 text-left">Name</th>
                <th className="p-2 text-left">Email</th>
                <th className="p-2 text-left">Department</th>
                <th className="p-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {admins.map((admin) => (
                <tr key={admin._id} className="border-t">
                  <td className="p-2">{admin.username}</td>
                  <td className="p-2">{admin.firstName} {admin.lastName}</td>
                  <td className="p-2">{admin.email}</td>
                  <td className="p-2">{admin.department}</td>
                  <td className="p-2 flex gap-2">
                    <button onClick={() => openEdit(admin)} className="bg-yellow-400 text-white px-2 py-1 rounded">Edit</button>
                    <button onClick={() => handleDelete(admin)} className="bg-red-500 text-white px-2 py-1 rounded">Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {showModal && (
          <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
            <form onSubmit={handleSave} className="bg-white p-6 rounded shadow w-96">
              <h2 className="text-lg font-bold mb-4">{editAdmin ? 'Edit' : 'Add'} Admin</h2>
              <div className="mb-4">
                <label className="block mb-1">Username</label>
                <input className="w-full border rounded px-3 py-2" value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} required maxLength={100} />
              </div>
              <div className="mb-4">
                <label className="block mb-1">Password {editAdmin && <span className="text-xs text-gray-500">(leave blank to keep current)</span>}</label>
                <input className="w-full border rounded px-3 py-2" type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} minLength={editAdmin ? 0 : 6} required={!editAdmin} />
              </div>
              <div className="mb-4">
                <label className="block mb-1">First Name</label>
                <input className="w-full border rounded px-3 py-2" value={form.firstName} onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))} required maxLength={100} />
              </div>
              <div className="mb-4">
                <label className="block mb-1">Last Name</label>
                <input className="w-full border rounded px-3 py-2" value={form.lastName} onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))} required maxLength={100} />
              </div>
              <div className="mb-4">
                <label className="block mb-1">Email</label>
                <input className="w-full border rounded px-3 py-2" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required maxLength={100} />
              </div>
              <div className="mb-4">
                <label className="block mb-1">Department</label>
                <input className="w-full border rounded px-3 py-2" value={form.department} onChange={e => setForm(f => ({ ...f, department: e.target.value }))} required maxLength={100} />
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