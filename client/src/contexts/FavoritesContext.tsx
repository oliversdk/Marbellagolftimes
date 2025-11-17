import { createContext, useState, useEffect, ReactNode } from 'react';

const STORAGE_KEY = 'fridas-golf-favorites';

interface FavoritesContextType {
  favorites: Set<string>;
  toggleFavorite: (courseId: string) => void;
  isFavorite: (courseId: string) => boolean;
  addFavorite: (courseId: string) => void;
  removeFavorite: (courseId: string) => void;
}

export const FavoritesContext = createContext<FavoritesContextType | undefined>(undefined);

interface FavoritesProviderProps {
  children: ReactNode;
}

export function FavoritesProvider({ children }: FavoritesProviderProps) {
  const [favorites, setFavorites] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          return new Set(parsed);
        }
      }
    } catch (error) {
      console.error('Failed to load favorites from localStorage:', error);
    }
    return new Set<string>();
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(favorites)));
    } catch (error) {
      console.error('Failed to save favorites to localStorage:', error);
    }
  }, [favorites]);

  const addFavorite = (courseId: string) => {
    setFavorites(prev => {
      const next = new Set(prev);
      next.add(courseId);
      return next;
    });
  };

  const removeFavorite = (courseId: string) => {
    setFavorites(prev => {
      const next = new Set(prev);
      next.delete(courseId);
      return next;
    });
  };

  const toggleFavorite = (courseId: string) => {
    setFavorites(prev => {
      const next = new Set(prev);
      if (next.has(courseId)) {
        next.delete(courseId);
      } else {
        next.add(courseId);
      }
      return next;
    });
  };

  const isFavorite = (courseId: string): boolean => {
    return favorites.has(courseId);
  };

  const value: FavoritesContextType = {
    favorites,
    addFavorite,
    removeFavorite,
    toggleFavorite,
    isFavorite,
  };

  return (
    <FavoritesContext.Provider value={value}>
      {children}
    </FavoritesContext.Provider>
  );
}
