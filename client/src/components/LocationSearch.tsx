import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MapPin, Navigation } from "lucide-react";
import { getCurrentLocation, COSTA_DEL_SOL_CITIES } from "@/lib/geolocation";
import { useToast } from "@/hooks/use-toast";

interface LocationSearchProps {
  onLocationSelected: (lat: number, lng: number) => void;
}

export function LocationSearch({ onLocationSelected }: LocationSearchProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [selectedCity, setSelectedCity] = useState<string>("");
  const { toast } = useToast();

  const handleCurrentLocation = async () => {
    setIsLoading(true);
    try {
      const location = await getCurrentLocation();
      onLocationSelected(location.latitude, location.longitude);
      toast({
        title: "Location Found",
        description: "Using your current location to find nearby courses.",
      });
    } catch (error) {
      toast({
        title: "Location Error",
        description: "Could not get your location. Please select a city manually.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCitySelect = (cityName: string) => {
    setSelectedCity(cityName);
    const city = COSTA_DEL_SOL_CITIES.find((c) => c.name === cityName);
    if (city) {
      onLocationSelected(city.lat, city.lng);
      const isAll = cityName === "All Costa del Sol";
      toast({
        title: isAll ? "Showing All Courses" : "City Selected",
        description: isAll 
          ? "Showing all Costa del Sol courses sorted by distance"
          : `Finding courses near ${city.name}`,
      });
    }
  };

  return (
    <div className="space-y-4">
      <Tabs defaultValue="gps" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="gps" data-testid="tab-gps">
            <Navigation className="mr-2 h-4 w-4" />
            Use GPS
          </TabsTrigger>
          <TabsTrigger value="city" data-testid="tab-city">
            <MapPin className="mr-2 h-4 w-4" />
            Select City
          </TabsTrigger>
        </TabsList>

        <TabsContent value="gps" className="space-y-4 mt-4">
          <p className="text-sm text-muted-foreground">
            Allow location access to find golf courses nearest to you.
          </p>
          <Button
            onClick={handleCurrentLocation}
            disabled={isLoading}
            className="w-full min-h-11"
            size="lg"
            data-testid="button-use-location"
          >
            {isLoading ? (
              "Getting Location..."
            ) : (
              <>
                <Navigation className="mr-2 h-4 w-4" />
                Use My Current Location
              </>
            )}
          </Button>
        </TabsContent>

        <TabsContent value="city" className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="city-select">Select a City</Label>
            <Select value={selectedCity} onValueChange={handleCitySelect}>
              <SelectTrigger id="city-select" data-testid="select-city">
                <SelectValue placeholder="Choose a Costa del Sol city" />
              </SelectTrigger>
              <SelectContent>
                {COSTA_DEL_SOL_CITIES.map((city) => (
                  <SelectItem key={city.name} value={city.name}>
                    {city.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
