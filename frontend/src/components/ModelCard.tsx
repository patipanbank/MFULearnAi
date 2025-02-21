import React from 'react';
import { FaEllipsisH } from 'react-icons/fa';

interface Model {
  id: string;
  name: string;
  type: 'personal' | 'official';
  createdBy: string;
}

interface ModelCardProps {
  model: Model;
  activeDropdown: boolean;
  onDropdownToggle: () => void;
  onRename: () => void;
  onDelete: () => void;
  onSelect: () => void;
}

const ModelCard: React.FC<ModelCardProps> = ({
  model,
  activeDropdown,
  onDropdownToggle,
  onRename,
  onDelete,
  onSelect,
}) => (
  <div
    className="relative border rounded p-4 shadow cursor-pointer bg-white dark:bg-gray-900"
    onClick={onSelect}
  >
    <button
      onClick={(e) => {
        e.stopPropagation();
        onDropdownToggle();
      }}
      className="absolute top-2 right-2 p-1"
      title="Options"
    >
      <FaEllipsisH />
    </button>
    {activeDropdown && (
      <div className="absolute top-10 right-2 bg-white dark:bg-gray-800 border rounded shadow z-10">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRename();
          }}
          className="block px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 text-left w-full"
        >
          Rename
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="block px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 text-left w-full"
        >
          Delete
        </button>
      </div>
    )}
    <h2 className="text-xl font-semibold">{model.name}</h2>
    <p className="text-sm text-gray-600">{model.type}</p>
  </div>
);

export default ModelCard; 