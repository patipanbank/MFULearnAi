import React, { useState } from 'react';
import { config } from '../config/config';

interface WebScrapeModalProps {
  collectionName: string;
  onClose: () => void;
  onSuccess: () => void;
}

const WebScrapeModal: React.FC<WebScrapeModalProps> = ({ collectionName, onClose, onSuccess }) => {
  const [url, setUrl] = useState('');
  const [maxPages, setMaxPages] = useState(50);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch(`${config.apiUrl}/api/training/scrape`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
        body: JSON.stringify({
          url,
          collectionName,
          maxPages
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to process website');
      }

      const data = await response.json();
      alert(`Successfully processed ${data.pagesScraped} pages and created ${data.chunks} chunks`);
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error scraping website:', error);
      alert('Failed to process website. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full">
        <h2 className="text-xl font-bold mb-4">Scrape Website Content</h2>
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block mb-2">Website URL</label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="w-full p-2 border rounded"
              required
            />
          </div>
          <div className="mb-4">
            <label className="block mb-2">Max Pages to Scrape</label>
            <input
              type="number"
              value={maxPages}
              onChange={(e) => setMaxPages(parseInt(e.target.value))}
              min="1"
              max="100"
              className="w-full p-2 border rounded"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border rounded"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-500 text-white rounded"
              disabled={loading}
            >
              {loading ? 'Processing...' : 'Start Scraping'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default WebScrapeModal; 