import { useState, useEffect, useMemo } from "react";

export type SearchFilters = {
  date?: Date;
  players: number;
  fromTime: string;
  toTime: string;
  holes: number;
  courseSearch?: string;
  showFavoritesOnly?: boolean;
};

export type SortMode = "distance-asc" | "distance-desc" | "price-asc" | "price-desc";
export type ViewMode = "list" | "map";

const STORAGE_KEY = "marbella-golf-filters";

// Get default date: tomorrow if after 5 PM, otherwise today
function getDefaultDate(): Date {
  const now = new Date();
  const hour = now.getHours();
  
  // After 5 PM (17:00), default to tomorrow for better availability
  if (hour >= 17) {
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    return tomorrow;
  }
  
  // Before 5 PM, use today
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  return today;
}

const DEFAULT_FILTERS: SearchFilters = {
  date: getDefaultDate(),
  players: 2,
  fromTime: "07:00",
  toTime: "20:00",
  holes: 18,
  showFavoritesOnly: false,
};

const DEFAULT_SORT_MODE: SortMode = "distance-asc";
const DEFAULT_VIEW_MODE: ViewMode = "list";

const VALID_SORT_MODES: SortMode[] = ['distance-asc', 'distance-desc', 'price-asc', 'price-desc'];
const VALID_VIEW_MODES: ViewMode[] = ['list', 'map'];

type StoredFilters = {
  searchFilters: Omit<SearchFilters, "date"> & { date?: string };
  sortMode: SortMode;
  viewMode: ViewMode;
};

function loadFromStorage(): {
  searchFilters: SearchFilters;
  sortMode: SortMode;
  viewMode: ViewMode;
} {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed: StoredFilters = JSON.parse(stored);
      
      // Use stored date only if it's valid and not in the past
      let dateValue: Date | undefined = getDefaultDate();
      if (parsed.searchFilters?.date) {
        const loadedDate = new Date(parsed.searchFilters.date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        // Only use stored date if it's today or in the future
        if (!isNaN(loadedDate.getTime()) && loadedDate >= today) {
          dateValue = loadedDate;
        }
      }
      
      const sortMode = VALID_SORT_MODES.includes(parsed.sortMode)
        ? parsed.sortMode
        : DEFAULT_SORT_MODE;

      const viewMode = VALID_VIEW_MODES.includes(parsed.viewMode)
        ? parsed.viewMode
        : DEFAULT_VIEW_MODE;

      return {
        searchFilters: {
          players: parsed.searchFilters.players ?? DEFAULT_FILTERS.players,
          fromTime: parsed.searchFilters.fromTime ?? DEFAULT_FILTERS.fromTime,
          toTime: parsed.searchFilters.toTime ?? DEFAULT_FILTERS.toTime,
          holes: parsed.searchFilters.holes ?? DEFAULT_FILTERS.holes,
          date: dateValue,
          courseSearch: parsed.searchFilters.courseSearch,
          showFavoritesOnly: parsed.searchFilters.showFavoritesOnly ?? DEFAULT_FILTERS.showFavoritesOnly,
        },
        sortMode,
        viewMode,
      };
    }
  } catch (error) {
    console.error("Failed to load filters from localStorage:", error);
  }
  
  return {
    searchFilters: DEFAULT_FILTERS,
    sortMode: DEFAULT_SORT_MODE,
    viewMode: DEFAULT_VIEW_MODE,
  };
}

export function useFilterPersistence() {
  const [state, setState] = useState(() => loadFromStorage());

  useEffect(() => {
    try {
      const toStore: StoredFilters = {
        searchFilters: {
          ...state.searchFilters,
          date: state.searchFilters.date?.toISOString(),
          showFavoritesOnly: state.searchFilters.showFavoritesOnly,
        },
        sortMode: state.sortMode,
        viewMode: state.viewMode,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(toStore));
    } catch (error) {
      console.error("Failed to save filters to localStorage:", error);
    }
  }, [state]);

  const setSearchFilters = (
    updates: Partial<SearchFilters> | ((prev: SearchFilters) => Partial<SearchFilters>)
  ) => {
    setState(prev => {
      // Get the partial updates from either function or object
      const partial = typeof updates === "function" ? updates(prev.searchFilters) : updates;
      
      // Apply all keys that exist in the partial object, even if their value is undefined
      // This allows explicitly clearing optional fields by setting them to undefined
      return {
        ...prev,
        searchFilters: {
          ...prev.searchFilters,
          ...partial,
        },
      };
    });
  };

  const setSortMode = (mode: SortMode | ((prev: SortMode) => SortMode)) => {
    setState(prev => ({
      ...prev,
      sortMode: typeof mode === "function" ? mode(prev.sortMode) : mode,
    }));
  };

  const setViewMode = (mode: ViewMode | ((prev: ViewMode) => ViewMode)) => {
    setState(prev => ({
      ...prev,
      viewMode: typeof mode === "function" ? mode(prev.viewMode) : mode,
    }));
  };

  const searchFilters = useMemo(
    () => state.searchFilters,
    [
      state.searchFilters.date?.toISOString(),
      state.searchFilters.players,
      state.searchFilters.fromTime,
      state.searchFilters.toTime,
      state.searchFilters.holes,
      state.searchFilters.courseSearch,
      state.searchFilters.showFavoritesOnly,
    ]
  );

  return {
    searchFilters,
    setSearchFilters,
    sortMode: state.sortMode,
    setSortMode,
    viewMode: state.viewMode,
    setViewMode,
  };
}
