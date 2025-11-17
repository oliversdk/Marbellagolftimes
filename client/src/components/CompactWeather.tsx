import { useQuery } from "@tanstack/react-query";
import { Sun, Cloud, CloudRain, CloudSnow, CloudDrizzle, Wind, Droplets } from "lucide-react";

interface WeatherData {
  temp: number;
  conditions: string;
  wind: number;
  humidity: number;
  icon: string;
}

interface CompactWeatherProps {
  lat: string;
  lng: string;
  courseId: string;
}

export function CompactWeather({ lat, lng, courseId }: CompactWeatherProps) {
  const { data, isLoading, error } = useQuery<WeatherData>({
    queryKey: ['/api/weather', lat, lng],
    queryFn: async () => {
      const response = await fetch(`/api/weather/${lat}/${lng}`);
      if (!response.ok) {
        throw new Error('Weather data not available');
      }
      return response.json();
    },
    enabled: !!lat && !!lng,
    staleTime: 30 * 60 * 1000,
  });

  const getWeatherIcon = (iconCode: string) => {
    if (!iconCode) return <Cloud className="h-4 w-4" />;
    
    const code = iconCode.toLowerCase();
    if (code.includes('01')) return <Sun className="h-4 w-4 text-yellow-500" />;
    if (code.includes('02') || code.includes('03') || code.includes('04')) {
      return <Cloud className="h-4 w-4 text-muted-foreground" />;
    }
    if (code.includes('09') || code.includes('10')) {
      return <CloudRain className="h-4 w-4 text-blue-500" />;
    }
    if (code.includes('11')) {
      return <CloudRain className="h-4 w-4 text-purple-500" />;
    }
    if (code.includes('13')) {
      return <CloudSnow className="h-4 w-4 text-blue-300" />;
    }
    if (code.includes('50')) {
      return <CloudDrizzle className="h-4 w-4 text-gray-400" />;
    }
    return <Cloud className="h-4 w-4 text-muted-foreground" />;
  };

  if (isLoading || error || !data) {
    return null; // Don't show anything if loading or error
  }

  return (
    <div 
      className="flex items-center gap-3 text-xs text-muted-foreground my-1" 
      data-testid={`weather-compact-${courseId}`}
    >
      {/* Temperature */}
      <div className="flex items-center gap-1" data-testid={`weather-temp-${courseId}`}>
        {getWeatherIcon(data.icon)}
        <span className="font-medium text-foreground">
          {Math.round(data.temp)}°C
        </span>
      </div>
      
      {/* Wind */}
      <div className="flex items-center gap-1" data-testid={`weather-wind-${courseId}`}>
        <Wind className="h-3.5 w-3.5" />
        <span>{Math.round(data.wind)} km/h</span>
      </div>
      
      {/* Humidity */}
      <div className="flex items-center gap-1" data-testid={`weather-humidity-${courseId}`}>
        <Droplets className="h-3.5 w-3.5" />
        <span>{data.humidity}%</span>
      </div>
    </div>
  );
}
