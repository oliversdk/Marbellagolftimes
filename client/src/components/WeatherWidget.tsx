import { useQuery } from "@tanstack/react-query";
import { useI18n } from "@/lib/i18n";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Cloud, Wind, Droplets, CloudOff, Sun, CloudRain, CloudSnow, CloudDrizzle } from "lucide-react";

interface WeatherData {
  temp: number;
  conditions: string;
  wind: number;
  humidity: number;
  icon: string;
}

interface WeatherWidgetProps {
  lat: string;
  lng: string;
}

export function WeatherWidget({ lat, lng }: WeatherWidgetProps) {
  const { t } = useI18n();

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
    if (!iconCode) return <Cloud className="h-8 w-8 text-muted-foreground" />;
    
    const code = iconCode.toLowerCase();
    if (code.includes('01')) return <Sun className="h-8 w-8 text-yellow-500" />;
    if (code.includes('02') || code.includes('03') || code.includes('04')) {
      return <Cloud className="h-8 w-8 text-muted-foreground" />;
    }
    if (code.includes('09') || code.includes('10')) {
      return <CloudRain className="h-8 w-8 text-blue-500" />;
    }
    if (code.includes('11')) {
      return <CloudRain className="h-8 w-8 text-purple-500" />;
    }
    if (code.includes('13')) {
      return <CloudSnow className="h-8 w-8 text-blue-300" />;
    }
    if (code.includes('50')) {
      return <CloudDrizzle className="h-8 w-8 text-gray-400" />;
    }
    return <Cloud className="h-8 w-8 text-muted-foreground" />;
  };

  if (isLoading) {
    return (
      <Card data-testid="card-weather">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Cloud className="h-5 w-5" />
            {t('weather.title')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground" data-testid="text-weather-loading">
            {t('common.loading')}
          </p>
        </CardContent>
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card data-testid="card-weather">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CloudOff className="h-5 w-5" />
            {t('weather.title')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground" data-testid="text-weather-unavailable">
            {t('weather.notAvailable')}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="card-weather">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Cloud className="h-5 w-5" />
          {t('weather.title')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between" data-testid="weather-summary">
          <div className="flex items-center gap-3">
            {getWeatherIcon(data.icon)}
            <div>
              <p className="text-3xl font-serif font-bold" data-testid="text-temperature">
                {Math.round(data.temp)}°C
              </p>
              <p className="text-sm text-muted-foreground capitalize" data-testid="text-conditions">
                {data.conditions}
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 pt-4 border-t">
          <div className="flex items-center gap-2" data-testid="weather-wind">
            <Wind className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">
                {t('weather.wind')}
              </p>
              <p className="text-sm font-medium" data-testid="text-wind">
                {Math.round(data.wind)} km/h
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2" data-testid="weather-humidity">
            <Droplets className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">
                {t('weather.humidity')}
              </p>
              <p className="text-sm font-medium" data-testid="text-humidity">
                {data.humidity}%
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
