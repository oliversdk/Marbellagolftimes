import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';

const STORAGE_KEY = 'marbella-golf-booking-cart';

export interface CartPackage {
  id: number | string;
  name: string;
  price: number;
  includesBuggy?: boolean;
  includesLunch?: boolean;
}

export interface CartAddOn {
  id: number | string;
  name: string;
  price: number;
  totalPrice: number;
}

export interface CartItem {
  id: string;
  courseId: string;
  courseName: string;
  date: string;
  time: string;
  players: number;
  package: CartPackage;
  addOns?: CartAddOn[];
  totalPrice: number;
  providerType: string;
}

interface BookingCartContextType {
  items: CartItem[];
  addItem: (item: CartItem) => void;
  removeItem: (id: string) => void;
  updateItem: (id: string, updates: Partial<CartItem>) => void;
  clearCart: () => void;
  getTotalPrice: () => number;
  getItemCount: () => number;
  hasItem: (courseId: string, time: string) => boolean;
}

const BookingCartContext = createContext<BookingCartContextType | undefined>(undefined);

interface BookingCartProviderProps {
  children: ReactNode;
}

export function BookingCartProvider({ children }: BookingCartProviderProps) {
  const [items, setItems] = useState<CartItem[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      }
    } catch (error) {
      console.error('Failed to load cart from localStorage:', error);
    }
    return [];
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch (error) {
      console.error('Failed to save cart to localStorage:', error);
    }
  }, [items]);

  const addItem = useCallback((item: CartItem) => {
    setItems(prev => {
      const existingIndex = prev.findIndex(
        i => i.courseId === item.courseId && i.time === item.time
      );
      if (existingIndex >= 0) {
        const updated = [...prev];
        updated[existingIndex] = item;
        return updated;
      }
      return [...prev, item];
    });
  }, []);

  const removeItem = useCallback((id: string) => {
    setItems(prev => prev.filter(item => item.id !== id));
  }, []);

  const updateItem = useCallback((id: string, updates: Partial<CartItem>) => {
    setItems(prev => prev.map(item => 
      item.id === id ? { ...item, ...updates } : item
    ));
  }, []);

  const clearCart = useCallback(() => {
    setItems([]);
  }, []);

  const getTotalPrice = useCallback(() => {
    return items.reduce((sum, item) => sum + item.totalPrice, 0);
  }, [items]);

  const getItemCount = useCallback(() => {
    return items.length;
  }, [items]);

  const hasItem = useCallback((courseId: string, time: string) => {
    return items.some(item => item.courseId === courseId && item.time === time);
  }, [items]);

  const value: BookingCartContextType = {
    items,
    addItem,
    removeItem,
    updateItem,
    clearCart,
    getTotalPrice,
    getItemCount,
    hasItem,
  };

  return (
    <BookingCartContext.Provider value={value}>
      {children}
    </BookingCartContext.Provider>
  );
}

export function useBookingCart() {
  const context = useContext(BookingCartContext);
  if (!context) {
    throw new Error('useBookingCart must be used within a BookingCartProvider');
  }
  return context;
}
