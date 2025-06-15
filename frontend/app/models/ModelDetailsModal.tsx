import React from 'react';
import { Model } from '@/types/model';
import { Collection } from '@/types/collection';

interface ModelDetailsModalProps {
  open: boolean;
  onClose: () => void;
  model: Model;
  collections: Collection[];
}

export default function ModelDetailsModal({ open, onClose, model, collections }: ModelDetailsModalProps) {
  if (!open) return null;
  const modelCollections = model.collections.map((name) => collections.find((c) => c.name === name)).filter(Boolean) as Collection[];
  return (
    <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
      <div className="bg-white rounded shadow-lg p-6 w-full max-w-md relative">
        <button
          className="absolute top-2 right-2 text-gray-400 hover:text-gray-600"
          onClick={onClose}
        >
          ×
        </button>
        <h2 className="text-lg font-bold mb-4">Model Details</h2>
        <div className="mb-2"><b>Name:</b> {model.name}</div>
        <div className="mb-2"><b>Type:</b> {model.modelType}</div>
        <div className="mb-2"><b>Department:</b> {model.department || '-'}</div>
        <div className="mb-2"><b>Created By:</b> {model.createdBy}</div>
        <div className="mb-2"><b>Created At:</b> {new Date(model.createdAt).toLocaleString()}</div>
        <div className="mb-2"><b>Updated At:</b> {new Date(model.updatedAt).toLocaleString()}</div>
        <div className="mb-2"><b>Collections:</b></div>
        <ul className="list-disc ml-6">
          {modelCollections.length === 0 ? <li>-</li> : modelCollections.map((col) => (
            <li key={col.id}>
              <span className="font-medium">{col.name}</span>
              <span className="ml-2 text-xs text-gray-500">[{col.permission}]</span>
            </li>
          ))}
        </ul>
        <div className="flex justify-end mt-4">
          <button
            className="px-4 py-2 rounded bg-gray-200 text-gray-700"
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
} 