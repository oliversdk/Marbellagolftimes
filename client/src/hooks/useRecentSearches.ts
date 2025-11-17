import { useState, useEffect } from 'react';

const STORAGE_KEY = 'golf-recent-searches';
const MAX_RECENT_SEARCHES = 5;

export interface RecentSearch {
  courseId: string;
  courseName: string;
  imageUrl?: string;
}

export function useRecentSearches() {
  const [recentSearches, setRecentSearches] = useState<RecentSearch[]>([]);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setRecentSearches(Array.isArray(parsed) ? parsed : []);
      } catch (error) {
        console.error('Failed to parse recent searches:', error);
        setRecentSearches([]);
      }
    }
  }, []);

  const addRecentSearch = (courseId: string, courseName: string, imageUrl?: string) => {
    setRecentSearches((prev) => {
      const filtered = prev.filter((search) => search.courseId !== courseId);
      const updated = [{ courseId, courseName, imageUrl }, ...filtered].slice(0, MAX_RECENT_SEARCHES);
      
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch (error) {
        console.error('Failed to save recent searches:', error);
      }
      
      return updated;
    });
  };

  const clearRecentSearches = () => {
    setRecentSearches([]);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.error('Failed to clear recent searches:', error);
    }
  };

  return {
    recentSearches,
    addRecentSearch,
    clearRecentSearches,
  };
}
