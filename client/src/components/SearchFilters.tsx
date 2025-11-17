import { useState } from "react";
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
import { CalendarIcon, Search } from "lucide-react";
import { format } from "date-fns";

interface SearchFiltersProps {
  onSearch: (filters: {
    date?: Date;
    players: number;
    fromTime: string;
    toTime: string;
    holes: number;
  }) => void;
}

export function SearchFilters({ onSearch }: SearchFiltersProps) {
  const [date, setDate] = useState<Date>();
  const [players, setPlayers] = useState<string>("2");
  const [fromTime, setFromTime] = useState<string>("07:00");
  const [toTime, setToTime] = useState<string>("20:00");
  const [holes, setHoles] = useState<string>("18");

  const handleSearch = () => {
    onSearch({
      date,
      players: parseInt(players),
      fromTime,
      toTime,
      holes: parseInt(holes),
    });
  };

  return (
    <div className="space-y-4">
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
