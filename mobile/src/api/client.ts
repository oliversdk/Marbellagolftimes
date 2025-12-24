const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'https://marbellagolftimes.com/api';

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: any;
  headers?: Record<string, string>;
}

class ApiClient {
  private baseUrl: string;
  private authToken: string | null = null;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  setAuthToken(token: string | null) {
    this.authToken = token;
  }

  async request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    const { method = 'GET', body, headers = {} } = options;

    const requestHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      ...headers,
    };

    if (this.authToken) {
      requestHeaders['Authorization'] = `Bearer ${this.authToken}`;
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method,
      headers: requestHeaders,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Request failed' }));
      throw new Error(error.message || `HTTP ${response.status}`);
    }

    return response.json();
  }

  async get<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET' });
  }

  async post<T>(endpoint: string, body: any): Promise<T> {
    return this.request<T>(endpoint, { method: 'POST', body });
  }
}

export const apiClient = new ApiClient(API_BASE_URL);

export interface GolfCourse {
  id: string;
  name: string;
  city: string;
  province: string;
  lat: number;
  lng: number;
  imageUrl: string | null;
  websiteUrl: string | null;
  bookingUrl: string | null;
  facilities: string[] | null;
}

export interface TeeTimeSlot {
  teeTime: string;
  greenFee: number;
  currency: string;
  players: number;
  holes: number;
  source: string;
  teeName?: string;
  slotsAvailable?: number;
}

export interface CourseWithSlots {
  courseId: string;
  courseName: string;
  distanceKm: number;
  slots: TeeTimeSlot[];
  course: GolfCourse;
  providerType?: string;
  providerName?: string;
}

export const golfApi = {
  getCourses: () => apiClient.get<GolfCourse[]>('/golf-courses'),
  
  searchSlots: (params: {
    lat: number;
    lng: number;
    date: string;
    players: number;
    holes: number;
  }) => {
    const query = new URLSearchParams({
      lat: params.lat.toString(),
      lng: params.lng.toString(),
      date: params.date,
      players: params.players.toString(),
      holes: params.holes.toString(),
    });
    return apiClient.get<CourseWithSlots[]>(`/slots/search?${query}`);
  },

  createBooking: (booking: {
    courseId: string;
    teeTime: string;
    players: number;
    holes: number;
    name: string;
    email: string;
    phone: string;
  }) => apiClient.post('/booking-requests', booking),
};
