import { useState, useEffect } from 'react';
import { api } from '../lib/api';

interface Department {
  _id: string;
  name: string;
  code: string;
  faculty: string;
}

export const useDepartment = (departmentId?: string) => {
  const [department, setDepartment] = useState<Department | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!departmentId) {
      setDepartment(null);
      return;
    }

    const fetchDepartment = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const data = await api.get<Department>(`/departments/${departmentId}`);
        setDepartment(data);
      } catch (err) {
        console.error('Failed to fetch department:', err);
        setError('Failed to load department information');
      } finally {
        setLoading(false);
      }
    };

    fetchDepartment();
  }, [departmentId]);

  return { department, loading, error };
}; 