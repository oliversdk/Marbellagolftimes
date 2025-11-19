import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { TrendingUp, TrendingDown, Euro, ChartBar } from "lucide-react";

type CommissionAnalytics = {
  totalCommission: number;
  commissionsPerCourse: Array<{ courseId: string; courseName: string; commission: number; bookingCount: number }>;
};

type CommissionByPeriod = Array<{ date: string; commission: number }>;

type ROIAnalytics = {
  totalCommission: number;
  totalAdSpend: number;
  netProfit: number;
  roi: number;
};

export function CommissionDashboard() {
  const [period, setPeriod] = useState<'day' | 'week' | 'month'>('day');

  // Fetch ROI analytics
  const { data: roiData, isLoading: roiLoading, error: roiError } = useQuery<ROIAnalytics>({
    queryKey: ['/api/admin/analytics/roi'],
    queryFn: async () => {
      const response = await fetch('/api/admin/analytics/roi');
      if (!response.ok) throw new Error('Failed to fetch ROI analytics');
      return response.json();
    },
  });

  // Fetch commission by period
  const { data: commissionByPeriodData, isLoading: commissionPeriodLoading, error: commissionPeriodError } = useQuery<CommissionByPeriod>({
    queryKey: ['/api/admin/analytics/commission-by-period', period],
    queryFn: async () => {
      const response = await fetch(`/api/admin/analytics/commission-by-period?period=${period}`);
      if (!response.ok) throw new Error('Failed to fetch commission by period');
      return response.json();
    },
  });

  // Fetch commission analytics
  const { data: commissionData, isLoading: commissionLoading, error: commissionError } = useQuery<CommissionAnalytics>({
    queryKey: ['/api/admin/analytics/commission'],
    queryFn: async () => {
      const response = await fetch('/api/admin/analytics/commission');
      if (!response.ok) throw new Error('Failed to fetch commission analytics');
      return response.json();
    },
  });

  // Sort commission per course by commission amount (highest first)
  const sortedCommissionsPerCourse = commissionData?.commissionsPerCourse
    ? [...commissionData.commissionsPerCourse]
        .filter(course => course.commission > 0)
        .sort((a, b) => b.commission - a.commission)
    : [];

  // Determine ROI color based on value
  const getRoiColor = (roi: number) => {
    if (roi > 0) return 'text-green-600';
    if (roi < 0) return 'text-destructive';
    return 'text-muted-foreground';
  };

  const getRoiPrefix = (roi: number) => {
    if (roi > 0) return '+';
    return '';
  };

  return (
    <div className="space-y-6">
      {/* ROI Metrics Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card data-testid="card-total-commission">
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Commission</CardTitle>
            <Euro className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {roiLoading ? (
              <>
                <Skeleton className="h-8 w-32 mb-2" data-testid="skeleton-total-commission" />
                <Skeleton className="h-4 w-40" />
              </>
            ) : roiError ? (
              <div className="text-sm text-destructive" data-testid="error-total-commission">
                Failed to load ROI data
              </div>
            ) : (
              <>
                <div className="text-2xl font-bold" data-testid="text-total-commission">
                  €{roiData ? roiData.totalCommission.toFixed(2) : '0.00'}
                </div>
                <p className="text-xs text-muted-foreground">
                  Total earned commission
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card data-testid="card-total-ad-spend">
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Ad Spend</CardTitle>
            <Euro className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {roiLoading ? (
              <>
                <Skeleton className="h-8 w-32 mb-2" data-testid="skeleton-total-ad-spend" />
                <Skeleton className="h-4 w-40" />
              </>
            ) : roiError ? (
              <div className="text-sm text-destructive" data-testid="error-total-ad-spend">
                Failed to load ROI data
              </div>
            ) : (
              <>
                <div className="text-2xl font-bold" data-testid="text-total-ad-spend">
                  €{roiData ? roiData.totalAdSpend.toFixed(2) : '0.00'}
                </div>
                <p className="text-xs text-muted-foreground">
                  Marketing investment
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card data-testid="card-net-profit">
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Net Profit</CardTitle>
            <Euro className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {roiLoading ? (
              <>
                <Skeleton className="h-8 w-32 mb-2" data-testid="skeleton-net-profit" />
                <Skeleton className="h-4 w-40" />
              </>
            ) : roiError ? (
              <div className="text-sm text-destructive" data-testid="error-net-profit">
                Failed to load ROI data
              </div>
            ) : (
              <>
                <div className="text-2xl font-bold" data-testid="text-net-profit">
                  €{roiData ? roiData.netProfit.toFixed(2) : '0.00'}
                </div>
                <p className="text-xs text-muted-foreground">
                  Commission minus ad spend
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card data-testid="card-roi">
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">ROI %</CardTitle>
            {roiData && roiData.roi > 0 ? (
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <TrendingDown className="h-4 w-4 text-muted-foreground" />
            )}
          </CardHeader>
          <CardContent>
            {roiLoading ? (
              <>
                <Skeleton className="h-8 w-32 mb-2" data-testid="skeleton-roi" />
                <Skeleton className="h-4 w-40" />
              </>
            ) : roiError ? (
              <div className="text-sm text-destructive" data-testid="error-roi">
                Failed to load ROI data
              </div>
            ) : (
              <>
                <div className={`text-2xl font-bold ${getRoiColor(roiData?.roi || 0)}`} data-testid="text-roi">
                  {getRoiPrefix(roiData?.roi || 0)}{roiData ? roiData.roi.toFixed(2) : '0.00'}%
                </div>
                <p className="text-xs text-muted-foreground">
                  Return on investment
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Commission Timeline Chart */}
      <Card data-testid="card-commission-timeline">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Commission Timeline</CardTitle>
              <CardDescription>Commission earned over time</CardDescription>
            </div>
            <Tabs value={period} onValueChange={(v) => setPeriod(v as any)}>
              <TabsList>
                <TabsTrigger value="day" data-testid="period-day">Daily</TabsTrigger>
                <TabsTrigger value="week" data-testid="period-week">Weekly</TabsTrigger>
                <TabsTrigger value="month" data-testid="period-month">Monthly</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardHeader>
        <CardContent>
          {commissionPeriodLoading ? (
            <div className="flex items-center justify-center h-[300px]" data-testid="loading-commission-timeline">
              <div className="space-y-3 w-full">
                <Skeleton className="h-6 w-full" />
                <Skeleton className="h-6 w-full" />
                <Skeleton className="h-6 w-full" />
                <Skeleton className="h-6 w-full" />
                <Skeleton className="h-6 w-full" />
              </div>
            </div>
          ) : commissionPeriodError ? (
            <div className="flex items-center justify-center h-[300px] text-destructive" data-testid="error-commission-timeline">
              Failed to load commission timeline
            </div>
          ) : commissionByPeriodData && commissionByPeriodData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={commissionByPeriodData}>
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
                  dataKey="commission" 
                  stroke="hsl(var(--primary))" 
                  strokeWidth={2}
                  name="Commission (€)"
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[300px] text-muted-foreground" data-testid="empty-commission-timeline">
              No commission data available for this period
            </div>
          )}
        </CardContent>
      </Card>

      {/* Commission per Course Chart */}
      <Card data-testid="card-commission-per-course">
        <CardHeader>
          <div className="flex items-center gap-2">
            <ChartBar className="h-5 w-5" />
            <CardTitle>Commission per Course</CardTitle>
          </div>
          <CardDescription>Top courses by commission earned</CardDescription>
        </CardHeader>
        <CardContent>
          {commissionLoading ? (
            <div className="flex items-center justify-center h-[400px]" data-testid="loading-commission-per-course">
              <div className="space-y-3 w-full">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
              </div>
            </div>
          ) : commissionError ? (
            <div className="flex items-center justify-center h-[400px] text-destructive" data-testid="error-commission-per-course">
              Failed to load commission per course
            </div>
          ) : sortedCommissionsPerCourse && sortedCommissionsPerCourse.length > 0 ? (
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={sortedCommissionsPerCourse} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis 
                  dataKey="courseName" 
                  type="category" 
                  width={200}
                  tick={{ fontSize: 12 }}
                />
                <Tooltip />
                <Legend />
                <Bar 
                  dataKey="commission" 
                  fill="hsl(var(--primary))" 
                  name="Commission (€)"
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[400px] text-muted-foreground" data-testid="empty-commission-per-course">
              No commission data available
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
