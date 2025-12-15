import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { MobileCardGrid } from "@/components/ui/mobile-card-grid";
import { useBreakpoint } from "@/hooks/use-breakpoint";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { TrendingUp, Euro, Calendar, Trophy, Users } from "lucide-react";

type BookingsAnalytics = Array<{ date: string; count: number }>;
type RevenueAnalytics = { totalRevenue: number; averageBookingValue: number; confirmedBookings: number };
type PopularCourse = { courseId: string; courseName: string; bookingCount: number };
type OnboardingProgress = { date: string; NOT_CONTACTED: number; OUTREACH_SENT: number; INTERESTED: number; NOT_INTERESTED: number; PARTNERSHIP_ACCEPTED: number; CREDENTIALS_RECEIVED: number };

const STAGE_COLORS = {
  NOT_CONTACTED: '#9CA3AF',
  OUTREACH_SENT: '#3B82F6',
  INTERESTED: '#10B981',
  NOT_INTERESTED: '#EF4444',
  PARTNERSHIP_ACCEPTED: '#8B5CF6',
  CREDENTIALS_RECEIVED: '#059669',
};

export function AnalyticsDashboard() {
  const [bookingsPeriod, setBookingsPeriod] = useState<'day' | 'week' | 'month'>('day');
  const [onboardingPeriod, setOnboardingPeriod] = useState<'day' | 'week' | 'month'>('week');
  const { isMobile } = useBreakpoint();

  // Fetch bookings analytics
  const { data: bookingsData, isLoading: bookingsLoading, error: bookingsError } = useQuery<BookingsAnalytics>({
    queryKey: ['/api/admin/analytics/bookings', bookingsPeriod],
    queryFn: async () => {
      const response = await fetch(`/api/admin/analytics/bookings?period=${bookingsPeriod}`);
      if (!response.ok) throw new Error('Failed to fetch bookings analytics');
      return response.json();
    },
  });

  // Fetch revenue analytics
  const { data: revenueData, isLoading: revenueLoading, error: revenueError } = useQuery<RevenueAnalytics>({
    queryKey: ['/api/admin/analytics/revenue'],
    queryFn: async () => {
      const response = await fetch('/api/admin/analytics/revenue');
      if (!response.ok) throw new Error('Failed to fetch revenue analytics');
      return response.json();
    },
  });

  // Fetch popular courses
  const { data: popularCourses, isLoading: coursesLoading, error: coursesError } = useQuery<PopularCourse[]>({
    queryKey: ['/api/admin/analytics/popular-courses', 10],
    queryFn: async () => {
      const response = await fetch('/api/admin/analytics/popular-courses?limit=10');
      if (!response.ok) throw new Error('Failed to fetch popular courses');
      return response.json();
    },
  });

  // Fetch onboarding progress
  const { data: onboardingData, isLoading: onboardingLoading, error: onboardingError } = useQuery<OnboardingProgress[]>({
    queryKey: ['/api/admin/analytics/onboarding-progress', onboardingPeriod],
    queryFn: async () => {
      const response = await fetch(`/api/admin/analytics/onboarding-progress?period=${onboardingPeriod}`);
      if (!response.ok) throw new Error('Failed to fetch onboarding progress');
      return response.json();
    },
  });

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card data-testid="card-total-revenue">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <Euro className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {revenueLoading ? (
              <>
                <Skeleton className="h-8 w-32 mb-2" data-testid="skeleton-total-revenue" />
                <Skeleton className="h-4 w-48" />
              </>
            ) : revenueError ? (
              <div className="text-sm text-destructive" data-testid="error-total-revenue">
                Failed to load revenue data
              </div>
            ) : (
              <>
                <div className="text-2xl font-bold" data-testid="text-total-revenue">
                  €{revenueData ? revenueData.totalRevenue.toFixed(2) : '0.00'}
                </div>
                <p className="text-xs text-muted-foreground">
                  From {revenueData ? revenueData.confirmedBookings : 0} confirmed bookings
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card data-testid="card-average-booking">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg. Booking Value</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {revenueLoading ? (
              <>
                <Skeleton className="h-8 w-32 mb-2" data-testid="skeleton-avg-booking" />
                <Skeleton className="h-4 w-40" />
              </>
            ) : revenueError ? (
              <div className="text-sm text-destructive" data-testid="error-avg-booking">
                Failed to load revenue data
              </div>
            ) : (
              <>
                <div className="text-2xl font-bold" data-testid="text-avg-booking">
                  €{revenueData ? revenueData.averageBookingValue.toFixed(2) : '0.00'}
                </div>
                <p className="text-xs text-muted-foreground">
                  Per confirmed booking
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card data-testid="card-confirmed-bookings">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Confirmed Bookings</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {revenueLoading ? (
              <>
                <Skeleton className="h-8 w-24 mb-2" data-testid="skeleton-confirmed-count" />
                <Skeleton className="h-4 w-36" />
              </>
            ) : revenueError ? (
              <div className="text-sm text-destructive" data-testid="error-confirmed-count">
                Failed to load revenue data
              </div>
            ) : (
              <>
                <div className="text-2xl font-bold" data-testid="text-confirmed-count">
                  {revenueData ? revenueData.confirmedBookings : 0}
                </div>
                <p className="text-xs text-muted-foreground">
                  Successfully completed
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card data-testid="card-bookings-chart">
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Booking Trends</CardTitle>
              <CardDescription>Number of bookings over time</CardDescription>
            </div>
            <Tabs value={bookingsPeriod} onValueChange={(v) => setBookingsPeriod(v as any)}>
              <TabsList>
                <TabsTrigger value="day" data-testid="period-day">Daily</TabsTrigger>
                <TabsTrigger value="week" data-testid="period-week">Weekly</TabsTrigger>
                <TabsTrigger value="month" data-testid="period-month">Monthly</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardHeader>
        <CardContent>
          {bookingsLoading ? (
            <div className="flex items-center justify-center h-[300px]" data-testid="loading-bookings-chart">
              <div className="space-y-3 w-full">
                <Skeleton className="h-6 w-full" />
                <Skeleton className="h-6 w-full" />
                <Skeleton className="h-6 w-full" />
                <Skeleton className="h-6 w-full" />
                <Skeleton className="h-6 w-full" />
              </div>
            </div>
          ) : bookingsError ? (
            <div className="flex items-center justify-center h-[300px] text-destructive" data-testid="error-bookings-chart">
              Failed to load bookings data
            </div>
          ) : bookingsData && bookingsData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={bookingsData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="date" 
                  tick={{ fontSize: 12 }}
                  angle={-45}
                  textAnchor="end"
                  height={80}
                />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="count" 
                  stroke="hsl(var(--primary))" 
                  strokeWidth={2}
                  name="Bookings"
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[300px] text-muted-foreground" data-testid="empty-bookings-chart">
              No booking data available for this period
            </div>
          )}
        </CardContent>
      </Card>

      <Card data-testid="card-popular-courses">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Trophy className="h-5 w-5" />
            <CardTitle>Most Popular Courses</CardTitle>
          </div>
          <CardDescription>Top 10 courses by booking count</CardDescription>
        </CardHeader>
        <CardContent>
          {coursesLoading ? (
            <div className="flex items-center justify-center h-[400px]" data-testid="loading-courses-chart">
              <div className="space-y-3 w-full">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
              </div>
            </div>
          ) : coursesError ? (
            <div className="flex items-center justify-center h-[400px] text-destructive" data-testid="error-courses-chart">
              Failed to load popular courses data
            </div>
          ) : popularCourses && popularCourses.length > 0 ? (
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={popularCourses} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis 
                  dataKey="courseName" 
                  type="category" 
                  width={isMobile ? 100 : 200}
                  tick={{ fontSize: isMobile ? 10 : 12 }}
                />
                <Tooltip />
                <Legend />
                <Bar 
                  dataKey="bookingCount" 
                  fill="hsl(var(--primary))" 
                  name="Bookings"
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[400px] text-muted-foreground" data-testid="empty-courses-chart">
              No course data available
            </div>
          )}
        </CardContent>
      </Card>
      </div>

      <Card data-testid="card-onboarding-progress">
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              <div>
                <CardTitle>Partnership Funnel Progress</CardTitle>
                <CardDescription>Course stage transitions over time</CardDescription>
              </div>
            </div>
            <Tabs value={onboardingPeriod} onValueChange={(v) => setOnboardingPeriod(v as any)}>
              <TabsList>
                <TabsTrigger value="day" data-testid="onboarding-period-day">Daily</TabsTrigger>
                <TabsTrigger value="week" data-testid="onboarding-period-week">Weekly</TabsTrigger>
                <TabsTrigger value="month" data-testid="onboarding-period-month">Monthly</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardHeader>
        <CardContent>
          {onboardingLoading ? (
            <div className="flex items-center justify-center h-[350px]" data-testid="loading-onboarding-chart">
              <div className="space-y-3 w-full">
                <Skeleton className="h-6 w-full" />
                <Skeleton className="h-6 w-full" />
                <Skeleton className="h-6 w-full" />
                <Skeleton className="h-6 w-full" />
                <Skeleton className="h-6 w-full" />
              </div>
            </div>
          ) : onboardingError ? (
            <div className="flex items-center justify-center h-[350px] text-destructive" data-testid="error-onboarding-chart">
              Failed to load onboarding progress data
            </div>
          ) : onboardingData && onboardingData.length > 0 ? (
            <ResponsiveContainer width="100%" height={350}>
              <AreaChart data={onboardingData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="date" 
                  tick={{ fontSize: 12 }}
                  angle={-45}
                  textAnchor="end"
                  height={80}
                />
                <YAxis />
                <Tooltip />
                <Legend />
                <Area 
                  type="monotone" 
                  dataKey="CREDENTIALS_RECEIVED" 
                  stackId="1"
                  stroke={STAGE_COLORS.CREDENTIALS_RECEIVED}
                  fill={STAGE_COLORS.CREDENTIALS_RECEIVED}
                  name="Credentials Received"
                />
                <Area 
                  type="monotone" 
                  dataKey="PARTNERSHIP_ACCEPTED" 
                  stackId="1"
                  stroke={STAGE_COLORS.PARTNERSHIP_ACCEPTED}
                  fill={STAGE_COLORS.PARTNERSHIP_ACCEPTED}
                  name="Partnership Accepted"
                />
                <Area 
                  type="monotone" 
                  dataKey="INTERESTED" 
                  stackId="1"
                  stroke={STAGE_COLORS.INTERESTED}
                  fill={STAGE_COLORS.INTERESTED}
                  name="Interested"
                />
                <Area 
                  type="monotone" 
                  dataKey="NOT_INTERESTED" 
                  stackId="1"
                  stroke={STAGE_COLORS.NOT_INTERESTED}
                  fill={STAGE_COLORS.NOT_INTERESTED}
                  name="Not Interested"
                />
                <Area 
                  type="monotone" 
                  dataKey="OUTREACH_SENT" 
                  stackId="1"
                  stroke={STAGE_COLORS.OUTREACH_SENT}
                  fill={STAGE_COLORS.OUTREACH_SENT}
                  name="Outreach Sent"
                />
                <Area 
                  type="monotone" 
                  dataKey="NOT_CONTACTED" 
                  stackId="1"
                  stroke={STAGE_COLORS.NOT_CONTACTED}
                  fill={STAGE_COLORS.NOT_CONTACTED}
                  name="Not Contacted"
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[350px] text-muted-foreground" data-testid="empty-onboarding-chart">
              No onboarding progress data available for this period
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
