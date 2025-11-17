import { useState, useEffect } from "react";

export type SearchFilters = {
  date?: Date;
  players: number;
  fromTime: string;
  toTime: string;
  holes: number;
  courseSearch?: string;
};

export type SortMode = "distance-asc" | "distance-desc" | "price-asc" | "price-desc";
export type ViewMode = "list" | "map";

const STORAGE_KEY = "fridas-golf-filters";

const DEFAULT_FILTERS: SearchFilters = {
  players: 2,
  fromTime: "07:00",
  toTime: "20:00",
  holes: 18,
};

const DEFAULT_SORT_MODE: SortMode = "distance-asc";
const DEFAULT_VIEW_MODE: ViewMode = "list";

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
      return {
        searchFilters: {
          players: parsed.searchFilters.players ?? DEFAULT_FILTERS.players,
          fromTime: parsed.searchFilters.fromTime ?? DEFAULT_FILTERS.fromTime,
          toTime: parsed.searchFilters.toTime ?? DEFAULT_FILTERS.toTime,
          holes: parsed.searchFilters.holes ?? DEFAULT_FILTERS.holes,
          date: parsed.searchFilters.date ? new Date(parsed.searchFilters.date) : undefined,
          courseSearch: parsed.searchFilters.courseSearch,
        },
        sortMode: parsed.sortMode || DEFAULT_SORT_MODE,
        viewMode: parsed.viewMode || DEFAULT_VIEW_MODE,
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
    filters: Partial<SearchFilters> | ((prev: SearchFilters) => Partial<SearchFilters>)
  ) => {
    setState(prev => ({
      ...prev,
      searchFilters: {
        ...prev.searchFilters,
        ...(typeof filters === "function" ? filters(prev.searchFilters) : filters),
      },
    }));
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

  return {
    searchFilters: state.searchFilters,
    setSearchFilters,
    sortMode: state.sortMode,
    setSortMode,
    viewMode: state.viewMode,
    setViewMode,
  };
}
