import { useState } from "react";
import { Search, MapPin, SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/lib/i18n";

interface MobileHeaderProps {
  title?: string;
  subtitle?: string;
  locationName?: string;
  onLocationClick?: () => void;
  onSearchChange?: (value: string) => void;
  onFiltersClick?: () => void;
  searchValue?: string;
  showSearch?: boolean;
  activeFiltersCount?: number;
}

export function MobileHeader({
  title = "Marbella Golf Times",
  subtitle,
  locationName = "Costa del Sol",
  onLocationClick,
  onSearchChange,
  onFiltersClick,
  searchValue = "",
  showSearch = true,
  activeFiltersCount = 0,
}: MobileHeaderProps) {
  const { t } = useI18n();
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  return (
    <div className="sticky top-0 z-40 bg-gradient-to-b from-primary to-primary/95 text-white shadow-lg">
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-xl font-bold tracking-tight" data-testid="mobile-header-title">
              {title}
            </h1>
            {subtitle && (
              <p className="text-sm text-white/80">{subtitle}</p>
            )}
          </div>
          
          <button 
            onClick={onLocationClick}
            className="flex items-center gap-1.5 bg-white/20 backdrop-blur-sm px-3 py-1.5 rounded-full text-sm font-medium hover:bg-white/30 transition-colors"
            data-testid="mobile-location-button"
          >
            <MapPin className="h-4 w-4" />
            <span className="max-w-[100px] truncate">{locationName}</span>
          </button>
        </div>
        
        {showSearch && (
          <div className="flex gap-2">
            <div className={`flex-1 relative transition-all ${isSearchFocused ? "scale-[1.02]" : ""}`}>
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder={t('search.searchPlaceholder')}
                value={searchValue}
                onChange={(e) => onSearchChange?.(e.target.value)}
                onFocus={() => setIsSearchFocused(true)}
                onBlur={() => setIsSearchFocused(false)}
                className="pl-10 pr-10 bg-white text-foreground border-0 rounded-xl h-11 shadow-sm"
                data-testid="mobile-search-input"
              />
              {searchValue && (
                <button 
                  onClick={() => onSearchChange?.("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            
            <Button
              variant="secondary"
              size="icon"
              onClick={onFiltersClick}
              className="h-11 w-11 rounded-xl bg-white text-foreground shadow-sm relative"
              data-testid="mobile-filters-button"
            >
              <SlidersHorizontal className="h-5 w-5" />
              {activeFiltersCount > 0 && (
                <Badge 
                  variant="destructive" 
                  className="absolute -top-1.5 -right-1.5 h-5 min-w-[20px] p-0 flex items-center justify-center text-[10px]"
                >
                  {activeFiltersCount}
                </Badge>
              )}
            </Button>
          </div>
        )}
      </div>
      
      <div className="h-4 bg-gradient-to-b from-primary/95 to-transparent" />
    </div>
  );
}
