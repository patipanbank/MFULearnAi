import React, { useEffect, useState } from 'react';
import RoleGuard from '@/components/guards/RoleGuard';
import { useAuth } from '@/context/AuthContext';
import { Model } from '@/types/model';
import { Collection } from '@/types/collection';
import ModelCollectionsModal from './ModelCollectionsModal';
import ModelDetailsModal from './ModelDetailsModal';

export default function ModelsPage() {
  const { token } = useAuth();
  const [models, setModels] = useState<Model[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detailsModel, setDetailsModel] = useState<Model | null>(null);
  const [editModel, setEditModel] = useState<Model | null>(null);
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const [modelsRes, collectionsRes] = await Promise.all([
          fetch('/api/models', { headers: { Authorization: `Bearer ${token}` } }),
          fetch('/api/collections', { headers: { Authorization: `Bearer ${token}` } }),
        ]);
        if (!modelsRes.ok) throw new Error('Failed to fetch models');
        if (!collectionsRes.ok) throw new Error('Failed to fetch collections');
        const modelsData = await modelsRes.json();
        const collectionsData = await collectionsRes.json();
        setModels(modelsData);
        setCollections(collectionsData);
      } catch (err) {
        setError('Failed to fetch models or collections');
      } finally {
        setLoading(false);
      }
    };
    if (token) fetchData();
  }, [token]);

  // Map collection name to collection object for quick lookup
  const collectionMap = React.useMemo(() => {
    const map: Record<string, Collection> = {};
    collections.forEach((c) => {
      map[c.name] = c;
    });
    return map;
  }, [collections]);

  const handleEditCollections = (model: Model) => {
    setEditModel(model);
  };

  const handleSaveCollections = async (updatedCollections: string[]) => {
    setEditLoading(true);
    setEditError(null);
    try {
      const response = await fetch('/api/models/' + model._id, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ collections: updatedCollections }),
      });
      if (!response.ok) throw new Error('Failed to update collections');
      const updatedModel = await response.json();
      setModels(models.map((m) => (m._id === updatedModel._id ? updatedModel : m)));
      setEditModel(null);
    } catch (err) {
      setEditError('Failed to update collections');
    } finally {
      setEditLoading(false);
    }
  };

  return (
    <RoleGuard allowed={['Students', 'Staffs', 'Admin', 'SuperAdmin']}>
      <div className="max-w-4xl mx-auto py-10">
        <h1 className="text-2xl font-bold mb-6">Model Management</h1>
        {loading && <div>Loading models...</div>}
        {error && <div className="text-red-600">{error}</div>}
        {editError && <div className="text-red-600">{editError}</div>}
        {!loading && !error && (
          <table className="w-full border mt-4">
            <thead>
              <tr className="bg-gray-100">
                <th className="py-2 px-4 text-left">Name</th>
                <th className="py-2 px-4 text-left">Type</th>
                <th className="py-2 px-4 text-left">Department</th>
                <th className="py-2 px-4 text-left">Collections</th>
                <th className="py-2 px-4 text-left">Action</th>
              </tr>
            </thead>
            <tbody>
              {models.map((model) => (
                <tr key={model._id} className="border-t">
                  <td className="py-2 px-4">{model.name}</td>
                  <td className="py-2 px-4 capitalize">{model.modelType}</td>
                  <td className="py-2 px-4">{model.department || '-'}</td>
                  <td className="py-2 px-4">
                    {model.collections.length === 0 ? (
                      <span>-</span>
                    ) : (
                      <ul className="list-disc ml-4">
                        {model.collections.map((colName) => {
                          const col = collectionMap[colName];
                          return col ? (
                            <li key={col.id}>
                              <span className="font-medium">{col.name}</span>
                              <span className="ml-2 text-xs text-gray-500">[{col.permission}]</span>
                            </li>
                          ) : (
                            <li key={colName}>{colName}</li>
                          );
                        })}
                      </ul>
                    )}
                  </td>
                  <td className="py-2 px-4 flex gap-2">
                    <button
                      className="bg-blue-600 text-white px-3 py-1 rounded text-xs"
                      onClick={() => handleEditCollections(model)}
                      disabled={editLoading}
                    >
                      Edit Collections
                    </button>
                    <button
                      className="bg-gray-500 text-white px-3 py-1 rounded text-xs"
                      onClick={() => setDetailsModel(model)}
                    >
                      Details
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {editModel && (
          <ModelCollectionsModal
            open={!!editModel}
            onClose={() => setEditModel(null)}
            model={editModel}
            collections={collections}
            onSave={handleSaveCollections}
            loading={editLoading}
          />
        )}
        {detailsModel && (
          <ModelDetailsModal
            open={!!detailsModel}
            onClose={() => setDetailsModel(null)}
            model={detailsModel}
            collections={collections}
          />
        )}
      </div>
    </RoleGuard>
  );
} 