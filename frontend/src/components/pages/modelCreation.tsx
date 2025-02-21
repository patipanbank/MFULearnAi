import React from 'react';
import { FaPlus, FaEllipsisH } from 'react-icons/fa';

const ModelCreation: React.FC = () => (
  <div className="container mx-auto p-4 font-sans">
    <header className="mb-6 flex justify-between items-center">
      <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100">Models</h1>
      <button
        className="text-xl p-2 text-blue-500 hover:text-blue-600 transition duration-150"
        title="Create Model"
      >
        <FaPlus />
      </button>
    </header>
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
      <div
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
          Sample Model Name
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-300">
          No collections selected
        </p>
      </div>
      {/* You can duplicate the above static model card as needed */}
    </div>
  </div>
);

export default ModelCreation;
