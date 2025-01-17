import React from 'react';

const TrainAI: React.FC = () => {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="bg-white rounded-lg shadow p-6">
        <h1 className="text-2xl font-bold text-gray-800 mb-6">
          Train AI Model
        </h1>
        
        <div className="space-y-6">
          {/* Upload Section */}
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
            <input
              type="file"
              className="hidden"
              id="fileUpload"
              accept=".pdf,.doc,.docx,.txt"
              multiple
            />
            <label
              htmlFor="fileUpload"
              className="cursor-pointer flex flex-col items-center"
            >
              <svg
                className="w-12 h-12 text-gray-400 mb-3"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                />
              </svg>
              <span className="text-gray-600">
                Drop files here or click to upload
              </span>
              <span className="text-sm text-gray-500 mt-2">
                Support: PDF, DOC, DOCX, TXT
              </span>
            </label>
          </div>

          {/* Training Status */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h2 className="text-lg font-semibold text-gray-700 mb-3">
              Training Status
            </h2>
            <div className="space-y-2">
              <div className="flex items-center">
                <div className="w-full bg-gray-200 rounded-full h-2.5">
                  <div className="bg-blue-600 h-2.5 rounded-full w-0"></div>
                </div>
                <span className="ml-4 text-sm text-gray-600">0%</span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end space-x-4">
            <button
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors"
            >
              Cancel
            </button>
            <button
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
            >
              Start Training
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TrainAI; 