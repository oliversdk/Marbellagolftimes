import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from "@/components/ui/command";
import { CalendarIcon, Search, X, Clock } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";
import { useRecentSearches } from "@/hooks/useRecentSearches";
import type { GolfCourse } from "@shared/schema";
import placeholderImage from "@assets/generated_images/Premium_Spanish_golf_signature_hole_153a6079.png";

interface SearchFiltersProps {
  currentFilters?: {
    date?: Date;
    players: number;
    fromTime: string;
    toTime: string;
    holes: number;
    courseSearch?: string;
    showFavoritesOnly?: boolean;
  };
  onSearch: (filters: {
    date?: Date;
    players: number;
    fromTime: string;
    toTime: string;
    holes: number;
    courseSearch?: string;
    showFavoritesOnly?: boolean;
  }) => void;
}

export function SearchFilters({ currentFilters, onSearch }: SearchFiltersProps) {
  const { t } = useI18n();
  const [date, setDate] = useState<Date | undefined>(currentFilters?.date);
  const [players, setPlayers] = useState<string>(currentFilters?.players.toString() || "2");
  const [fromTime, setFromTime] = useState<string>(currentFilters?.fromTime || "07:00");
  const [toTime, setToTime] = useState<string>(currentFilters?.toTime || "20:00");
  const [holes, setHoles] = useState<string>(currentFilters?.holes.toString() || "18");
  const [courseSearch, setCourseSearch] = useState<string>(currentFilters?.courseSearch || "");
  const [showFavoritesOnly, setShowFavoritesOnly] = useState<boolean>(currentFilters?.showFavoritesOnly ?? false);
  const [autocompleteOpen, setAutocompleteOpen] = useState(false);
  
  const { recentSearches, addRecentSearch, clearRecentSearches } = useRecentSearches();

  const { data: courses } = useQuery<GolfCourse[]>({
    queryKey: ["/api/courses"],
  });

  // Sync local showFavoritesOnly state when currentFilters changes
  useEffect(() => {
    setShowFavoritesOnly(currentFilters?.showFavoritesOnly ?? false);
  }, [currentFilters?.showFavoritesOnly]);

  const handleSearch = () => {
    onSearch({
      date,
      players: parseInt(players),
      fromTime,
      toTime,
      holes: parseInt(holes),
      courseSearch: courseSearch.trim() || undefined,
      showFavoritesOnly,
    });
  };

  const handleSelectCourse = (course: GolfCourse) => {
    setCourseSearch(course.name);
    addRecentSearch(course.id, course.name, course.imageUrl || undefined);
    setAutocompleteOpen(false);
  };

  const handleSelectRecentSearch = (courseId: string, courseName: string, imageUrl?: string) => {
    addRecentSearch(courseId, courseName, imageUrl);
    setCourseSearch(courseName);
    setAutocompleteOpen(false);
  };

  // Filter courses based on search input
  const filteredCourses = courses
    ?.filter((course) =>
      course.name.toLowerCase().includes(courseSearch.toLowerCase()) ||
      course.city.toLowerCase().includes(courseSearch.toLowerCase()) ||
      course.province.toLowerCase().includes(courseSearch.toLowerCase())
    )
    .slice(0, 10) || [];

  // Show recent searches when input is empty or focused
  const showRecentSearches = courseSearch.trim() === "" && recentSearches.length > 0;

  // Enrich recent searches with city/province if available in courses
  const recentSearchesWithData = recentSearches.map((recent) => {
    const course = courses?.find((c) => c.id === recent.courseId);
    return {
      ...recent,
      city: course?.city,
      province: course?.province,
    };
  });

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="course-search">{t('search.searchCourses')}</Label>
        <Popover open={autocompleteOpen} onOpenChange={setAutocompleteOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={autocompleteOpen}
              className="w-full justify-start text-left font-normal"
              data-testid="input-course-search"
            >
              <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
              <span className={cn(!courseSearch && "text-muted-foreground")}>
                {courseSearch || t('search.searchCourses')}
              </span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[400px] p-0" align="start">
            <Command>
              <CommandInput
                placeholder={t('search.searchCourses')}
                value={courseSearch}
                onValueChange={setCourseSearch}
                data-testid="input-course-search-field"
              />
              <CommandList>
                {showRecentSearches && (
                  <>
                    <CommandGroup heading={t('search.recentSearches')}>
                      {recentSearchesWithData.map((recent) => (
                        <CommandItem
                          key={recent.courseId}
                          value={recent.courseName}
                          onSelect={() => handleSelectRecentSearch(recent.courseId, recent.courseName, recent.imageUrl)}
                          className="gap-2"
                          data-testid={`recent-search-${recent.courseId}`}
                        >
                          <Clock className="h-4 w-4 shrink-0 opacity-50" />
                          <img
                            src={recent.imageUrl || placeholderImage}
                            alt={recent.courseName}
                            className="h-12 w-12 rounded-md object-cover shrink-0"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.src = placeholderImage;
                            }}
                          />
                          <div className="flex flex-col flex-1 min-w-0">
                            <span className="font-medium truncate">{recent.courseName}</span>
                            {recent.city && recent.province && (
                              <span className="text-xs text-muted-foreground truncate">
                                {recent.city}, {recent.province}
                              </span>
                            )}
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                    <div className="flex items-center justify-between px-2 py-1.5">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          clearRecentSearches();
                        }}
                        className="h-8 text-xs"
                        data-testid="button-clear-recent"
                      >
                        <X className="mr-1 h-3 w-3" />
                        {t('search.clearRecent')}
                      </Button>
                    </div>
                    <CommandSeparator />
                  </>
                )}
                {!showRecentSearches && (
                  <>
                    <CommandEmpty>{t('search.noResults')}</CommandEmpty>
                    <CommandGroup>
                      {filteredCourses.map((course) => (
                        <CommandItem
                          key={course.id}
                          value={course.name}
                          onSelect={() => handleSelectCourse(course)}
                          className="gap-2"
                          data-testid={`course-search-result-${course.id}`}
                        >
                          <img
                            src={course.imageUrl || placeholderImage}
                            alt={course.name}
                            className="h-12 w-12 rounded-md object-cover shrink-0"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.src = placeholderImage;
                            }}
                          />
                          <div className="flex flex-col flex-1 min-w-0">
                            <span className="font-medium truncate">{course.name}</span>
                            <span className="text-xs text-muted-foreground truncate">
                              {course.city}, {course.province}
                            </span>
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </>
                )}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="space-y-2">
          <Label htmlFor="filter-date">{t('search.date')}</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                id="filter-date"
                variant="outline"
                className="w-full justify-start text-left font-normal"
                data-testid="button-filter-date"
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {date ? format(date, "PPP") : t('search.date')}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={date}
                onSelect={setDate}
                disabled={(date) => date < new Date()}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>

        <div className="space-y-2">
          <Label htmlFor="filter-players">{t('search.players')}</Label>
          <Select value={players} onValueChange={setPlayers}>
            <SelectTrigger id="filter-players" data-testid="select-filter-players">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[1, 2, 3, 4].map((num) => (
                <SelectItem key={num} value={num.toString()}>
                  {num} {num === 1 ? t('search.player') : t('search.players')}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="filter-holes">{t('search.holes')}</Label>
          <Select value={holes} onValueChange={setHoles}>
            <SelectTrigger id="filter-holes" data-testid="select-filter-holes">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="9">{t('search.holes9')}</SelectItem>
              <SelectItem value="18">{t('search.holes18')}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="filter-from-time">{t('search.timeRange')}</Label>
          <Select value={fromTime} onValueChange={setFromTime}>
            <SelectTrigger id="filter-from-time" data-testid="select-from-time">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: 14 }, (_, i) => i + 7).map((hour) => (
                <SelectItem key={hour} value={`${hour.toString().padStart(2, "0")}:00`}>
                  {hour.toString().padStart(2, "0")}:00
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="filter-to-time">{t('search.timeRange')}</Label>
          <Select value={toTime} onValueChange={setToTime}>
            <SelectTrigger id="filter-to-time" data-testid="select-to-time">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: 14 }, (_, i) => i + 7).map((hour) => (
                <SelectItem key={hour} value={`${hour.toString().padStart(2, "0")}:00`}>
                  {hour.toString().padStart(2, "0")}:00
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex items-center space-x-2">
        <Checkbox
          id="filter-favorites"
          checked={showFavoritesOnly}
          onCheckedChange={(checked) => setShowFavoritesOnly(checked === true)}
          data-testid="checkbox-show-favorites"
        />
        <Label
          htmlFor="filter-favorites"
          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
        >
          {t('search.showFavoritesOnly')}
        </Label>
      </div>

      <Button onClick={handleSearch} className="w-full" size="lg" data-testid="button-apply-filters">
        <Search className="mr-2 h-4 w-4" />
        {t('common.apply')}
      </Button>
    </div>
  );
}
