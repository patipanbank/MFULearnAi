import React, { useEffect, useState } from 'react';
import { FaPlus, FaEllipsisH } from 'react-icons/fa';

interface ModelCreationProps {
  userRole: string;
}

interface Model {
  id: string;
  name: string;
  // add additional fields as needed
}

const ModelCreation: React.FC<ModelCreationProps> = ({ userRole: _userRole }) => {
  const [models, setModels] = useState<Model[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [showModal, setShowModal] = useState<boolean>(false);
  const [creationType, setCreationType] = useState<'private' | 'official'>('private');
  const [creating, setCreating] = useState<boolean>(false);

  useEffect(() => {
    const fetchModels = async () => {
      try {
        const response = await fetch('/api/models');
        if (!response.ok) {
          throw new Error('Failed to fetch models');
        }
        const data = await response.json();
        setModels(data.models); // assuming response shape is { models: [...] }
      } catch (err) {
        console.error('Error fetching models:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchModels();
  }, []);

  const handleCreateClick = () => {
    setShowModal(true);
  };

  const handleConfirmCreation = async () => {
    setCreating(true);
    try {
      const response = await fetch('/api/models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: creationType })
      });
      if (!response.ok) {
        throw new Error('Failed to create model');
      }
      const newModel = await response.json();
      setModels(prevModels => [...prevModels, newModel]);
      setShowModal(false);
    } catch (err) {
      console.error('Creation error:', err);
    } finally {
      setCreating(false);
    }
  };

  const handleCancelModal = () => {
    setShowModal(false);
  };

  return (
    <div className="container mx-auto p-4 font-sans">
      <header className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100">Models</h1>
        <div className="flex space-x-2">
          <button
            onClick={handleCreateClick}
            title="Create new model"
            className="text-xl p-2 text-blue-500 hover:text-blue-600 transition duration-150"
          >
            <FaPlus />
          </button>
        </div>
      </header>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
        {loading ? (
          <p>Loading models...</p>
        ) : (
          models.map(model => (
            <div
              key={model.id}
              className="relative border border-gray-200 dark:border-gray-700 rounded p-4 shadow bg-white dark:bg-gray-900"
            >
              <button
                className="absolute top-2 right-2 text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-gray-100"
                title="Options"
              >
                <FaEllipsisH />
              </button>
              <div className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">
                Model
              </div>
              <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100 mb-2">
                {model.name}
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                No collections selected
              </p>
            </div>
          ))
        )}
      </div>

      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2>Create Model</h2>
            <p>Select the type of model to create:</p>
            <div>
              <label>
                <input
                  type="radio"
                  name="creationType"
                  value="private"
                  checked={creationType === 'private'}
                  onChange={() => setCreationType('private')}
                />
                Private
              </label>
            </div>
            <div>
              <label>
                <input
                  type="radio"
                  name="creationType"
                  value="official"
                  checked={creationType === 'official'}
                  onChange={() => setCreationType('official')}
                />
                Official
              </label>
            </div>
            <div className="modal-actions">
              <button onClick={handleConfirmCreation} disabled={creating}>
                {creating ? 'Creating...' : 'Create'}
              </button>
              <button onClick={handleCancelModal} disabled={creating}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ModelCreation;
