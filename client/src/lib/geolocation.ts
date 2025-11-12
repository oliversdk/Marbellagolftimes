// Haversine formula for calculating distance between two coordinates
export function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(degrees: number): number {
  return degrees * (Math.PI / 180);
}

export interface GeolocationResult {
  latitude: number;
  longitude: number;
}

export function getCurrentLocation(): Promise<GeolocationResult> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation is not supported by this browser"));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      },
      (error) => {
        reject(error);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  });
}

// Predefined Costa del Sol cities with approximate coordinates
export const COSTA_DEL_SOL_CITIES = [
  { name: "Sotogrande", lat: 36.2876, lng: -5.2872 },
  { name: "San Roque", lat: 36.2094, lng: -5.3836 },
  { name: "Estepona", lat: 36.4277, lng: -5.1479 },
  { name: "Marbella", lat: 36.5095, lng: -4.8824 },
  { name: "Mijas", lat: 36.5951, lng: -4.6387 },
  { name: "Fuengirola", lat: 36.5397, lng: -4.6263 },
  { name: "Benalmádena", lat: 36.5988, lng: -4.5161 },
  { name: "Málaga", lat: 36.7213, lng: -4.4214 },
];
