import { useState, useCallback } from 'react';

export const useImageUpload = () => {
  const [images, setImages] = useState<Array<{ url: string; mediaType: string }>>([]);

  const addImages = useCallback((newImages: Array<{ url: string; mediaType: string }>) => {
    setImages(prev => [...prev, ...newImages]);
  }, []);

  const removeImage = useCallback((index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  }, []);

  const clearImages = useCallback(() => {
    setImages([]);
  }, []);

  return {
    images,
    addImages,
    removeImage,
    clearImages,
    setImages
  };
};