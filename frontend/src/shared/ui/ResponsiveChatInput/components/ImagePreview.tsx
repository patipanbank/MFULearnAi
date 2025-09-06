import React from 'react';
import { FiX } from 'react-icons/fi';
import type { ImagePreviewProps } from '../types/input.types';

const ImagePreview: React.FC<ImagePreviewProps> = ({
  images,
  onRemoveImage
}) => {
  if (images.length === 0) return null;

  return (
    <div className="mb-4 flex flex-wrap gap-2">
      {images.map((img, idx) => (
        <div key={idx} className="relative group">
          <img
            src={img.url}
            alt="Preview"
            className="w-16 h-16 object-cover rounded-lg border border-primary transition-transform group-hover:scale-105"
          />
          <button
            onClick={() => onRemoveImage(idx)}
            className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-xs hover:bg-red-600 transition-all duration-200 transform hover:scale-110"
          >
            <FiX className="w-3 h-3" />
          </button>
        </div>
      ))}
    </div>
  );
};

export default ImagePreview;