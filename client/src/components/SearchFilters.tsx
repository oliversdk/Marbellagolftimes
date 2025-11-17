import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { CalendarIcon, Search, Check } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import type { GolfCourse } from "@shared/schema";

interface SearchFiltersProps {
  currentFilters?: {
    date?: Date;
    players: number;
    fromTime: string;
    toTime: string;
    holes: number;
    courseSearch?: string;
  };
  onSearch: (filters: {
    date?: Date;
    players: number;
    fromTime: string;
    toTime: string;
    holes: number;
    courseSearch?: string;
  }) => void;
}

export function SearchFilters({ currentFilters, onSearch }: SearchFiltersProps) {
  const [date, setDate] = useState<Date | undefined>(currentFilters?.date);
  const [players, setPlayers] = useState<string>(currentFilters?.players.toString() || "2");
  const [fromTime, setFromTime] = useState<string>(currentFilters?.fromTime || "07:00");
  const [toTime, setToTime] = useState<string>(currentFilters?.toTime || "20:00");
  const [holes, setHoles] = useState<string>(currentFilters?.holes.toString() || "18");
  const [courseSearch, setCourseSearch] = useState<string>(currentFilters?.courseSearch || "");
  const [autocompleteOpen, setAutocompleteOpen] = useState(false);

  const { data: courses } = useQuery<GolfCourse[]>({
    queryKey: ["/api/courses"],
  });

  const handleSearch = () => {
    onSearch({
      date,
      players: parseInt(players),
      fromTime,
      toTime,
      holes: parseInt(holes),
      courseSearch: courseSearch.trim() || undefined,
    });
  };

  const handleSelectCourse = (courseName: string) => {
    setCourseSearch(courseName);
    setAutocompleteOpen(false);
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="course-search">Search Golf Course</Label>
        <Popover open={autocompleteOpen} onOpenChange={setAutocompleteOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={autocompleteOpen}
              className="w-full justify-start text-left font-normal"
              data-testid="input-course-search"
            >
              {courseSearch || "Search by course name..."}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-full p-0" align="start">
            <Command>
              <CommandInput
                placeholder="Search golf courses..."
                value={courseSearch}
                onValueChange={setCourseSearch}
              />
              <CommandList>
                <CommandEmpty>No golf course found.</CommandEmpty>
                <CommandGroup>
                  {courses
                    ?.filter((course) =>
                      course.name.toLowerCase().includes(courseSearch.toLowerCase())
                    )
                    .slice(0, 10)
                    .map((course) => (
                      <CommandItem
                        key={course.id}
                        value={course.name}
                        onSelect={handleSelectCourse}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            courseSearch === course.name ? "opacity-100" : "opacity-0"
                          )}
                        />
                        <div className="flex flex-col">
                          <span>{course.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {course.city}, {course.province}
                          </span>
                        </div>
                      </CommandItem>
                    ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="space-y-2">
          <Label htmlFor="filter-date">Date</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                id="filter-date"
                variant="outline"
                className="w-full justify-start text-left font-normal"
                data-testid="button-filter-date"
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {date ? format(date, "PPP") : "Any date"}
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
          <Label htmlFor="filter-players">Players</Label>
          <Select value={players} onValueChange={setPlayers}>
            <SelectTrigger id="filter-players" data-testid="select-filter-players">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[1, 2, 3, 4].map((num) => (
                <SelectItem key={num} value={num.toString()}>
                  {num} {num === 1 ? "Player" : "Players"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="filter-holes">Holes</Label>
          <Select value={holes} onValueChange={setHoles}>
            <SelectTrigger id="filter-holes" data-testid="select-filter-holes">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="9">9 Holes</SelectItem>
              <SelectItem value="18">18 Holes</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="filter-from-time">From Time</Label>
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
          <Label htmlFor="filter-to-time">To Time</Label>
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

      <Button onClick={handleSearch} className="w-full" size="lg" data-testid="button-apply-filters">
        <Search className="mr-2 h-4 w-4" />
        Apply Filters
      </Button>
    </div>
  );
}
