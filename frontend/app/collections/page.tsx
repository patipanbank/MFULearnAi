import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import RoleGuard from '@/components/guards/RoleGuard';
import { useAuth } from '@/context/AuthContext';
import { Collection, CollectionPermission } from '@/types/collection';

interface EditState {
  id: string;
  name: string;
  permission: CollectionPermission;
}

export default function CollectionsPage() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: '', permission: 'PRIVATE' as CollectionPermission });
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [edit, setEdit] = useState<EditState | null>(null);
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const fetchCollections = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/collections', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to fetch collections');
      const data = await res.json();
      setCollections(data);
    } catch (err) {
      setError('Failed to fetch collections');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) fetchCollections();
    // eslint-disable-next-line
  }, [token]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setFormError(null);
    setFormSuccess(null);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);
    if (!form.name.trim()) {
      setFormError('Collection name is required');
      return;
    }
    setCreating(true);
    try {
      const res = await fetch('/api/collections', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || errData.message || 'Failed to create collection');
      }
      setForm({ name: '', permission: 'PRIVATE' });
      setFormSuccess('Collection created successfully');
      fetchCollections();
    } catch (err: any) {
      setFormError(err.message || 'Failed to create collection');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this collection?')) return;
    setDeletingId(id);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/collections/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || errData.message || 'Failed to delete collection');
      }
      fetchCollections();
    } catch (err: any) {
      setDeleteError(err.message || 'Failed to delete collection');
    } finally {
      setDeletingId(null);
    }
  };

  const openEdit = (col: Collection) => {
    setEdit({ id: col.id, name: col.name, permission: col.permission });
    setEditError(null);
  };

  const handleEditChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    if (!edit) return;
    setEdit({ ...edit, [e.target.name]: e.target.value });
    setEditError(null);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!edit) return;
    if (!edit.name.trim()) {
      setEditError('Collection name is required');
      return;
    }
    setEditLoading(true);
    setEditError(null);
    try {
      const res = await fetch(`/api/collections/${edit.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name: edit.name, permission: edit.permission }),
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || errData.message || 'Failed to update collection');
      }
      setEdit(null);
      fetchCollections();
    } catch (err: any) {
      setEditError(err.message || 'Failed to update collection');
    } finally {
      setEditLoading(false);
    }
  };

  return (
    <RoleGuard allowed={['Students', 'Staffs', 'Admin', 'SuperAdmin']}>
      <div className="max-w-3xl mx-auto py-10">
        <h1 className="text-2xl font-bold mb-6">Collections</h1>
        <form className="mb-8 p-4 bg-gray-50 rounded border" onSubmit={handleCreate}>
          <div className="flex flex-col md:flex-row gap-4 items-end">
            <div className="flex-1">
              <label className="block text-sm font-medium mb-1">Name</label>
              <input
                type="text"
                name="name"
                value={form.name}
                onChange={handleInputChange}
                className="w-full border px-3 py-2 rounded"
                disabled={creating}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Permission</label>
              <select
                name="permission"
                value={form.permission}
                onChange={handleInputChange}
                className="border px-3 py-2 rounded"
                disabled={creating}
              >
                <option value="PRIVATE">PRIVATE</option>
                <option value="PUBLIC">PUBLIC</option>
              </select>
            </div>
            <button
              type="submit"
              className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50"
              disabled={creating}
            >
              {creating ? 'Creating...' : 'Create'}
            </button>
          </div>
          {formError && <div className="text-red-600 mt-2">{formError}</div>}
          {formSuccess && <div className="text-green-600 mt-2">{formSuccess}</div>}
        </form>
        {loading && <div>Loading collections...</div>}
        {error && <div className="text-red-600">{error}</div>}
        {deleteError && <div className="text-red-600">{deleteError}</div>}
        {!loading && !error && (
          <table className="w-full border mt-4">
            <thead>
              <tr className="bg-gray-100">
                <th className="py-2 px-4 text-left">Name</th>
                <th className="py-2 px-4 text-left">Permission</th>
                <th className="py-2 px-4 text-left">Created By</th>
                <th className="py-2 px-4 text-left">Created At</th>
                <th className="py-2 px-4 text-left">Action</th>
              </tr>
            </thead>
            <tbody>
              {collections.map((col) => (
                <tr key={col.id} className="border-t">
                  <td className="py-2 px-4">{col.name}</td>
                  <td className="py-2 px-4">{col.permission}</td>
                  <td className="py-2 px-4">{col.createdBy}</td>
                  <td className="py-2 px-4">{col.createdAt ? new Date(col.createdAt).toLocaleString() : '-'}</td>
                  <td className="py-2 px-4 flex gap-2">
                    <button
                      className="bg-yellow-400 text-white px-3 py-1 rounded text-xs disabled:opacity-50"
                      onClick={() => openEdit(col)}
                      disabled={!!deletingId || editLoading}
                    >
                      Edit
                    </button>
                    <button
                      className="bg-gray-500 text-white px-3 py-1 rounded text-xs"
                      onClick={() => navigate(`/collections/${col.id}`)}
                    >
                      Details
                    </button>
                    <button
                      className="bg-red-500 text-white px-3 py-1 rounded text-xs disabled:opacity-50"
                      onClick={() => handleDelete(col.id)}
                      disabled={!!deletingId || editLoading}
                    >
                      {deletingId === col.id ? 'Deleting...' : 'Delete'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {/* Edit Modal */}
        {edit && (
          <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
            <div className="bg-white rounded shadow-lg p-6 w-full max-w-md relative">
              <button
                className="absolute top-2 right-2 text-gray-400 hover:text-gray-600"
                onClick={() => setEdit(null)}
                disabled={editLoading}
              >
                ×
              </button>
              <h2 className="text-lg font-bold mb-4">Edit Collection</h2>
              <form onSubmit={handleEditSubmit}>
                <div className="mb-4">
                  <label className="block text-sm font-medium mb-1">Name</label>
                  <input
                    type="text"
                    name="name"
                    value={edit.name}
                    onChange={handleEditChange}
                    className="w-full border px-3 py-2 rounded"
                    disabled={editLoading}
                    required
                  />
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium mb-1">Permission</label>
                  <select
                    name="permission"
                    value={edit.permission}
                    onChange={handleEditChange}
                    className="border px-3 py-2 rounded"
                    disabled={editLoading}
                  >
                    <option value="PRIVATE">PRIVATE</option>
                    <option value="PUBLIC">PUBLIC</option>
                  </select>
                </div>
                {editError && <div className="text-red-600 mb-2">{editError}</div>}
                <div className="flex gap-2 justify-end">
                  <button
                    type="button"
                    className="px-4 py-2 rounded bg-gray-200 text-gray-700"
                    onClick={() => setEdit(null)}
                    disabled={editLoading}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded bg-blue-600 text-white disabled:opacity-50"
                    disabled={editLoading}
                  >
                    {editLoading ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </RoleGuard>
  );
} 