import React, { useState, useEffect } from 'react';
import { Model } from '@/types/model';
import { Collection } from '@/types/collection';

interface ModelCollectionsModalProps {
  open: boolean;
  onClose: () => void;
  model: Model;
  collections: Collection[];
  onSave: (selected: string[]) => void;
  loading: boolean;
}

export default function ModelCollectionsModal({ open, onClose, model, collections, onSave, loading }: ModelCollectionsModalProps) {
  const [selected, setSelected] = useState<string[]>(model.collections);

  useEffect(() => {
    setSelected(model.collections);
  }, [model]);

  const handleToggle = (name: string) => {
    setSelected((prev) => prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(selected);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
      <div className="bg-white rounded shadow-lg p-6 w-full max-w-md relative">
        <button
          className="absolute top-2 right-2 text-gray-400 hover:text-gray-600"
          onClick={onClose}
          disabled={loading}
        >
          ×
        </button>
        <h2 className="text-lg font-bold mb-4">Edit Collections for {model.name}</h2>
        <form onSubmit={handleSave}>
          <div className="mb-4 max-h-60 overflow-y-auto">
            {collections.map((col) => (
              <label key={col.id} className="flex items-center gap-2 mb-2">
                <input
                  type="checkbox"
                  checked={selected.includes(col.name)}
                  onChange={() => handleToggle(col.name)}
                  disabled={loading}
                />
                <span>{col.name} <span className="text-xs text-gray-500">[{col.permission}]</span></span>
              </label>
            ))}
          </div>
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              className="px-4 py-2 rounded bg-gray-200 text-gray-700"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded bg-blue-600 text-white disabled:opacity-50"
              disabled={loading}
            >
              {loading ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
} 