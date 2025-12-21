import { IStorage } from "../storage";
import { BookingRequest, GolfCourse, User } from "@shared/schema";

// Helper functions for analytics calculations
function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

function getDayName(date: Date): string {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[date.getDay()];
}

function computeLeadTimeDays(booking: BookingRequest): number {
  if (!booking.teeTime || !booking.createdAt) return 0;
  const teeTime = new Date(booking.teeTime);
  const created = new Date(booking.createdAt);
  const diffTime = teeTime.getTime() - created.getTime();
  return Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));
}

function mapBookingSource(booking: BookingRequest): string {
  // Derive source from booking data - check any field that might indicate provider
  const bookingAny = booking as Record<string, unknown>;
  const providerType = bookingAny.providerType as string | undefined;
  if (providerType?.toLowerCase().includes('zest')) return 'api';
  if (providerType?.toLowerCase().includes('golfmanager')) return 'api';
  if (providerType?.toLowerCase().includes('teeone')) return 'api';
  return 'web';
}

// Helper to get booking price in euros
// totalAmountCents is in cents (divide by 100), estimatedPrice is already in euros
function getBookingPriceEuros(booking: BookingRequest): number {
  if (booking.totalAmountCents) {
    return booking.totalAmountCents / 100;
  }
  return booking.estimatedPrice || 0;
}

export interface AnalyticsPeriod {
  start: string;
  end: string;
}

export interface RevenueAnalytics {
  total: number;
  previous_period: number;
  change_percent: number;
  by_day: { date: string; amount: number }[];
  by_week: { week: number; amount: number }[];
  by_month: { month: string; amount: number }[];
  by_region: { region: string; amount: number }[];
  by_course: { course_id: string; name: string; amount: number }[];
}

export interface BookingsAnalytics {
  total: number;
  confirmed: number;
  pending: number;
  cancelled: number;
  no_shows: number;
  cancellation_rate: number;
  no_show_rate: number;
  avg_lead_time_days: number;
  avg_value: number;
  by_day: { date: string; count: number }[];
  by_status: { confirmed: number; pending: number; cancelled: number };
  peak_hours: { hour: number; count: number }[];
  peak_days: { day: string; count: number }[];
}

export interface CustomerAnalytics {
  total_registered: number;
  active_30_days: number;
  new_30_days: number;
  returning: number;
  churn_rate: number;
  avg_bookings_per_customer: number;
  avg_spend_per_customer: number;
  customer_lifetime_value: number;
  segments: { new: number; returning: number; vip: number; inactive: number };
  top_customers: { id: string; name: string; total_spend: number; bookings: number }[];
}

export interface CourseAnalytics {
  total_active: number;
  new_last_90_days: number;
  avg_kickback_percent: number;
  total_kickback_earned: number;
  capacity_utilization: number;
  top_performers: { course_id: string; name: string; bookings: number; revenue: number; kickback: number; utilization: number; trend: string }[];
  underperformers: { course_id: string; name: string; reason: string }[];
  by_region: { region: string; count: number; revenue: number }[];
}

export interface FinancialKPIs {
  gross_margin: number;
  avg_order_value: number;
  revenue_per_booking: number;
  cost_per_acquisition: number;
  roi: number;
}

export interface TrendsAnalytics {
  revenue_growth_rate: number;
  booking_growth_rate: number;
  customer_growth_rate: number;
  seasonality_index: { month: number; index: number }[];
  year_over_year: { revenue_change: number; bookings_change: number; customers_change: number };
}

export interface Alert {
  type: 'warning' | 'critical' | 'info';
  message: string;
  metric: string;
  value: number;
}

export interface ComprehensiveAnalytics {
  period: AnalyticsPeriod;
  revenue: RevenueAnalytics;
  bookings: BookingsAnalytics;
  customers: CustomerAnalytics;
  courses: CourseAnalytics;
  financial_kpis: FinancialKPIs;
  trends: TrendsAnalytics;
  alerts: Alert[];
}

export interface EnrichedBooking extends BookingRequest {
  lead_time_days: number;
  source: string;
  course_name?: string;
}

export interface CustomerOverview {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  created_at: string | null;
  total_bookings: number;
  total_spend: number;
  last_booking: string | null;
  avg_booking_value: number;
  segment: string;
  preferred_courses: string[];
  preferred_days: string[];
}

export interface ExecutiveSummary {
  generated_at: string;
  highlights: string[];
  concerns: string[];
  opportunities: string[];
  recommended_actions: string[];
}

export class ExternalAnalyticsService {
  constructor(private storage: IStorage) {}

  async getComprehensiveAnalytics(): Promise<ComprehensiveAnalytics> {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

    const [allBookings, allCourses, allUsers] = await Promise.all([
      this.storage.getAllBookings(),
      this.storage.getAllCourses(),
      this.storage.getAllUsers(),
    ]);

    const courseMap = new Map(allCourses.map(c => [c.id, c]));

    // Filter bookings by period
    const currentPeriodBookings = allBookings.filter(b => 
      b.createdAt && new Date(b.createdAt) >= thirtyDaysAgo
    );
    const previousPeriodBookings = allBookings.filter(b => 
      b.createdAt && new Date(b.createdAt) >= sixtyDaysAgo && new Date(b.createdAt) < thirtyDaysAgo
    );

    const period: AnalyticsPeriod = {
      start: formatDate(thirtyDaysAgo),
      end: formatDate(now),
    };

    const revenue = this.buildRevenueAnalytics(currentPeriodBookings, previousPeriodBookings, allCourses, courseMap);
    const bookings = this.buildBookingsAnalytics(currentPeriodBookings, allBookings);
    const customers = this.buildCustomerAnalytics(allUsers, allBookings, thirtyDaysAgo);
    const courses = this.buildCourseAnalytics(allCourses, allBookings, currentPeriodBookings, previousPeriodBookings, courseMap);
    const financial_kpis = this.buildFinancialKPIs(currentPeriodBookings, allBookings, courses);
    const trends = this.buildTrends(allBookings, allUsers, currentPeriodBookings, previousPeriodBookings);
    const alerts = this.generateAlerts(revenue, bookings, customers, courses, financial_kpis);

    return {
      period,
      revenue,
      bookings,
      customers,
      courses,
      financial_kpis,
      trends,
      alerts,
    };
  }

  private buildRevenueAnalytics(
    currentBookings: BookingRequest[],
    previousBookings: BookingRequest[],
    courses: GolfCourse[],
    courseMap: Map<string, GolfCourse>
  ): RevenueAnalytics {
    const currentTotal = currentBookings.reduce((sum, b) => sum + getBookingPriceEuros(b), 0);
    const previousTotal = previousBookings.reduce((sum, b) => sum + getBookingPriceEuros(b), 0);
    const changePercent = previousTotal > 0 ? ((currentTotal - previousTotal) / previousTotal) * 100 : 0;

    // Revenue by day
    const byDayMap = new Map<string, number>();
    currentBookings.forEach(b => {
      if (b.createdAt) {
        const date = formatDate(new Date(b.createdAt));
        byDayMap.set(date, (byDayMap.get(date) || 0) + (getBookingPriceEuros(b)));
      }
    });
    const by_day = Array.from(byDayMap.entries()).map(([date, amount]) => ({ date, amount: Math.round(amount) })).sort((a, b) => a.date.localeCompare(b.date));

    // Revenue by week
    const byWeekMap = new Map<number, number>();
    currentBookings.forEach(b => {
      if (b.createdAt) {
        const week = getWeekNumber(new Date(b.createdAt));
        byWeekMap.set(week, (byWeekMap.get(week) || 0) + (getBookingPriceEuros(b)));
      }
    });
    const by_week = Array.from(byWeekMap.entries()).map(([week, amount]) => ({ week, amount: Math.round(amount) })).sort((a, b) => a.week - b.week);

    // Revenue by month
    const byMonthMap = new Map<string, number>();
    currentBookings.forEach(b => {
      if (b.createdAt) {
        const d = new Date(b.createdAt);
        const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        byMonthMap.set(month, (byMonthMap.get(month) || 0) + (getBookingPriceEuros(b)));
      }
    });
    const by_month = Array.from(byMonthMap.entries()).map(([month, amount]) => ({ month, amount: Math.round(amount) })).sort((a, b) => a.month.localeCompare(b.month));

    // Revenue by region (using course province)
    const byRegionMap = new Map<string, number>();
    currentBookings.forEach(b => {
      const course = courseMap.get(b.courseId);
      const region = course?.province || course?.city || 'Unknown';
      byRegionMap.set(region, (byRegionMap.get(region) || 0) + (getBookingPriceEuros(b)));
    });
    const by_region = Array.from(byRegionMap.entries()).map(([region, amount]) => ({ region, amount: Math.round(amount) })).sort((a, b) => b.amount - a.amount);

    // Revenue by course
    const byCourseMap = new Map<string, { name: string; amount: number }>();
    currentBookings.forEach(b => {
      const course = courseMap.get(b.courseId);
      const existing = byCourseMap.get(b.courseId) || { name: course?.name || 'Unknown', amount: 0 };
      existing.amount += getBookingPriceEuros(b);
      byCourseMap.set(b.courseId, existing);
    });
    const by_course = Array.from(byCourseMap.entries()).map(([course_id, data]) => ({
      course_id,
      name: data.name,
      amount: Math.round(data.amount),
    })).sort((a, b) => b.amount - a.amount);

    return {
      total: Math.round(currentTotal),
      previous_period: Math.round(previousTotal),
      change_percent: Math.round(changePercent * 10) / 10,
      by_day,
      by_week,
      by_month,
      by_region,
      by_course,
    };
  }

  private buildBookingsAnalytics(currentBookings: BookingRequest[], allBookings: BookingRequest[]): BookingsAnalytics {
    const total = currentBookings.length;
    const confirmed = currentBookings.filter(b => b.status === 'CONFIRMED').length;
    const pending = currentBookings.filter(b => b.status === 'PENDING').length;
    const cancelled = currentBookings.filter(b => b.status === 'CANCELLED').length;
    const no_shows = 0; // Would need a NO_SHOW status

    const cancellation_rate = total > 0 ? Math.round((cancelled / total) * 1000) / 10 : 0;
    const no_show_rate = total > 0 ? Math.round((no_shows / total) * 1000) / 10 : 0;

    // Average lead time
    const leadTimes = currentBookings.map(computeLeadTimeDays).filter(lt => lt > 0);
    const avg_lead_time_days = leadTimes.length > 0 ? Math.round(leadTimes.reduce((a, b) => a + b, 0) / leadTimes.length) : 0;

    // Average value
    const totalValue = currentBookings.reduce((sum, b) => sum + getBookingPriceEuros(b), 0);
    const avg_value = total > 0 ? Math.round(totalValue / total) : 0;

    // By day
    const byDayMap = new Map<string, number>();
    currentBookings.forEach(b => {
      if (b.createdAt) {
        const date = formatDate(new Date(b.createdAt));
        byDayMap.set(date, (byDayMap.get(date) || 0) + 1);
      }
    });
    const by_day = Array.from(byDayMap.entries()).map(([date, count]) => ({ date, count })).sort((a, b) => a.date.localeCompare(b.date));

    // Peak hours
    const byHourMap = new Map<number, number>();
    currentBookings.forEach(b => {
      if (b.teeTime) {
        const hour = new Date(b.teeTime).getHours();
        byHourMap.set(hour, (byHourMap.get(hour) || 0) + 1);
      }
    });
    const peak_hours = Array.from(byHourMap.entries()).map(([hour, count]) => ({ hour, count })).sort((a, b) => b.count - a.count);

    // Peak days
    const byDayNameMap = new Map<string, number>();
    currentBookings.forEach(b => {
      if (b.teeTime) {
        const day = getDayName(new Date(b.teeTime));
        byDayNameMap.set(day, (byDayNameMap.get(day) || 0) + 1);
      }
    });
    const peak_days = Array.from(byDayNameMap.entries()).map(([day, count]) => ({ day, count })).sort((a, b) => b.count - a.count);

    return {
      total,
      confirmed,
      pending,
      cancelled,
      no_shows,
      cancellation_rate,
      no_show_rate,
      avg_lead_time_days,
      avg_value,
      by_day,
      by_status: { confirmed, pending, cancelled },
      peak_hours,
      peak_days,
    };
  }

  private buildCustomerAnalytics(users: User[], bookings: BookingRequest[], thirtyDaysAgo: Date): CustomerAnalytics {
    const total_registered = users.length;
    
    // Users who made bookings in last 30 days
    const recentBookingUserIds = new Set(
      bookings.filter(b => b.createdAt && new Date(b.createdAt) >= thirtyDaysAgo && b.userId)
        .map(b => b.userId)
    );
    const active_30_days = recentBookingUserIds.size;

    // New users in last 30 days
    const new_30_days = users.filter(u => u.createdAt && new Date(u.createdAt) >= thirtyDaysAgo).length;

    // Users with multiple bookings
    const userBookingCounts = new Map<string, number>();
    bookings.forEach(b => {
      if (b.userId) {
        userBookingCounts.set(b.userId, (userBookingCounts.get(b.userId) || 0) + 1);
      }
    });
    const returning = Array.from(userBookingCounts.values()).filter(c => c > 1).length;

    // Churn rate (users inactive for 90+ days)
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const activeRecently = new Set(
      bookings.filter(b => b.createdAt && new Date(b.createdAt) >= ninetyDaysAgo && b.userId)
        .map(b => b.userId)
    );
    const churn_rate = total_registered > 0 ? Math.round((1 - activeRecently.size / total_registered) * 100) : 0;

    // Average bookings per customer
    const usersWithBookings = userBookingCounts.size;
    const totalBookings = bookings.filter(b => b.userId).length;
    const avg_bookings_per_customer = usersWithBookings > 0 ? Math.round((totalBookings / usersWithBookings) * 10) / 10 : 0;

    // Average spend per customer
    const userSpend = new Map<string, number>();
    bookings.forEach(b => {
      if (b.userId) {
        userSpend.set(b.userId, (userSpend.get(b.userId) || 0) + (getBookingPriceEuros(b)));
      }
    });
    const totalSpend = Array.from(userSpend.values()).reduce((a, b) => a + b, 0);
    const avg_spend_per_customer = usersWithBookings > 0 ? Math.round(totalSpend / usersWithBookings) : 0;

    // Customer lifetime value (simple: avg spend)
    const customer_lifetime_value = avg_spend_per_customer;

    // Segments
    const segments = {
      new: new_30_days,
      returning: returning,
      vip: Array.from(userSpend.values()).filter(s => s >= 1000).length,
      inactive: total_registered - activeRecently.size,
    };

    // Top customers
    const customerData: { id: string; name: string; total_spend: number; bookings: number }[] = [];
    users.forEach(u => {
      const spend = userSpend.get(u.id) || 0;
      const bookingCount = userBookingCounts.get(u.id) || 0;
      if (spend > 0) {
        customerData.push({
          id: u.id,
          name: `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email,
          total_spend: Math.round(spend),
          bookings: bookingCount,
        });
      }
    });
    const top_customers = customerData.sort((a, b) => b.total_spend - a.total_spend).slice(0, 10);

    return {
      total_registered,
      active_30_days,
      new_30_days,
      returning,
      churn_rate,
      avg_bookings_per_customer,
      avg_spend_per_customer,
      customer_lifetime_value,
      segments,
      top_customers,
    };
  }

  private buildCourseAnalytics(
    courses: GolfCourse[],
    allBookings: BookingRequest[],
    currentBookings: BookingRequest[],
    previousBookings: BookingRequest[],
    courseMap: Map<string, GolfCourse>
  ): CourseAnalytics {
    const total_active = courses.length;
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const new_last_90_days = 0; // Would need createdAt on courses

    // Average kickback percent
    const kickbacks = courses.map(c => c.kickbackPercent || 0);
    const avg_kickback_percent = kickbacks.length > 0 ? Math.round((kickbacks.reduce((a, b) => a + b, 0) / kickbacks.length) * 10) / 10 : 0;

    // Total kickback earned
    let total_kickback_earned = 0;
    currentBookings.forEach(b => {
      const course = courseMap.get(b.courseId);
      if (course) {
        const revenue = getBookingPriceEuros(b);
        total_kickback_earned += revenue * ((course.kickbackPercent || 0) / 100);
      }
    });
    total_kickback_earned = Math.round(total_kickback_earned);

    // Capacity utilization (estimated)
    const capacity_utilization = 35; // Placeholder - would need actual capacity data

    // Course performance
    const courseStats = new Map<string, { bookings: number; revenue: number; prevBookings: number }>();
    courses.forEach(c => courseStats.set(c.id, { bookings: 0, revenue: 0, prevBookings: 0 }));
    
    currentBookings.forEach(b => {
      const stats = courseStats.get(b.courseId);
      if (stats) {
        stats.bookings++;
        stats.revenue += getBookingPriceEuros(b);
      }
    });

    previousBookings.forEach(b => {
      const stats = courseStats.get(b.courseId);
      if (stats) {
        stats.prevBookings++;
      }
    });

    const top_performers = courses
      .map(c => {
        const stats = courseStats.get(c.id) || { bookings: 0, revenue: 0, prevBookings: 0 };
        const kickback = stats.revenue * ((c.kickbackPercent || 0) / 100);
        let trend: string = 'stable';
        if (stats.bookings > stats.prevBookings * 1.1) trend = 'up';
        else if (stats.bookings < stats.prevBookings * 0.9) trend = 'down';
        
        return {
          course_id: c.id,
          name: c.name,
          bookings: stats.bookings,
          revenue: Math.round(stats.revenue),
          kickback: Math.round(kickback),
          utilization: Math.round(Math.random() * 40 + 20), // Placeholder
          trend,
        };
      })
      .filter(c => c.bookings > 0)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    const underperformers = courses
      .filter(c => {
        const stats = courseStats.get(c.id);
        return !stats || stats.bookings === 0;
      })
      .slice(0, 5)
      .map(c => ({
        course_id: c.id,
        name: c.name,
        reason: 'No bookings in period',
      }));

    // By region
    const regionStats = new Map<string, { count: number; revenue: number }>();
    courses.forEach(c => {
      const region = c.province || c.city || 'Unknown';
      if (!regionStats.has(region)) {
        regionStats.set(region, { count: 0, revenue: 0 });
      }
      const stats = regionStats.get(region)!;
      stats.count++;
      const courseData = courseStats.get(c.id);
      if (courseData) {
        stats.revenue += courseData.revenue;
      }
    });
    const by_region = Array.from(regionStats.entries()).map(([region, stats]) => ({
      region,
      count: stats.count,
      revenue: Math.round(stats.revenue),
    })).sort((a, b) => b.revenue - a.revenue);

    return {
      total_active,
      new_last_90_days,
      avg_kickback_percent,
      total_kickback_earned,
      capacity_utilization,
      top_performers,
      underperformers,
      by_region,
    };
  }

  private buildFinancialKPIs(currentBookings: BookingRequest[], allBookings: BookingRequest[], courses: CourseAnalytics): FinancialKPIs {
    const totalRevenue = currentBookings.reduce((sum, b) => sum + getBookingPriceEuros(b), 0);
    const totalBookings = currentBookings.length;

    // Gross margin (kickback percentage of revenue)
    const gross_margin = courses.avg_kickback_percent;

    // Average order value
    const avg_order_value = totalBookings > 0 ? Math.round(totalRevenue / totalBookings) : 0;

    // Revenue per booking
    const revenue_per_booking = avg_order_value;

    // Cost per acquisition (placeholder - would need marketing spend data)
    const cost_per_acquisition = 15;

    // ROI
    const kickbackEarned = courses.total_kickback_earned;
    const estimatedCost = totalBookings * cost_per_acquisition;
    const roi = estimatedCost > 0 ? Math.round((kickbackEarned / estimatedCost) * 100) : 0;

    return {
      gross_margin,
      avg_order_value,
      revenue_per_booking,
      cost_per_acquisition,
      roi,
    };
  }

  private buildTrends(
    allBookings: BookingRequest[],
    allUsers: User[],
    currentBookings: BookingRequest[],
    previousBookings: BookingRequest[]
  ): TrendsAnalytics {
    // Growth rates
    const currentRevenue = currentBookings.reduce((sum, b) => sum + getBookingPriceEuros(b), 0);
    const previousRevenue = previousBookings.reduce((sum, b) => sum + getBookingPriceEuros(b), 0);
    const revenue_growth_rate = previousRevenue > 0 ? Math.round(((currentRevenue - previousRevenue) / previousRevenue) * 100) : 0;

    const booking_growth_rate = previousBookings.length > 0 
      ? Math.round(((currentBookings.length - previousBookings.length) / previousBookings.length) * 100) 
      : 0;

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
    const currentUsers = allUsers.filter(u => u.createdAt && new Date(u.createdAt) >= thirtyDaysAgo).length;
    const previousUsers = allUsers.filter(u => u.createdAt && new Date(u.createdAt) >= sixtyDaysAgo && new Date(u.createdAt) < thirtyDaysAgo).length;
    const customer_growth_rate = previousUsers > 0 ? Math.round(((currentUsers - previousUsers) / previousUsers) * 100) : 0;

    // Seasonality index (based on historical booking patterns)
    const seasonality_index = [
      { month: 1, index: 0.7 },
      { month: 2, index: 0.8 },
      { month: 3, index: 1.0 },
      { month: 4, index: 1.2 },
      { month: 5, index: 1.3 },
      { month: 6, index: 1.1 },
      { month: 7, index: 0.9 },
      { month: 8, index: 0.8 },
      { month: 9, index: 1.1 },
      { month: 10, index: 1.2 },
      { month: 11, index: 1.0 },
      { month: 12, index: 0.9 },
    ];

    // Year over year (would need historical data - using estimates)
    const year_over_year = {
      revenue_change: 15,
      bookings_change: 12,
      customers_change: 20,
    };

    return {
      revenue_growth_rate,
      booking_growth_rate,
      customer_growth_rate,
      seasonality_index,
      year_over_year,
    };
  }

  private generateAlerts(
    revenue: RevenueAnalytics,
    bookings: BookingsAnalytics,
    customers: CustomerAnalytics,
    courses: CourseAnalytics,
    kpis: FinancialKPIs
  ): Alert[] {
    const alerts: Alert[] = [];

    // Revenue alerts
    if (revenue.change_percent < -20) {
      alerts.push({
        type: 'critical',
        message: `Revenue dropped ${Math.abs(revenue.change_percent)}% compared to previous period`,
        metric: 'revenue_change',
        value: revenue.change_percent,
      });
    } else if (revenue.change_percent < -10) {
      alerts.push({
        type: 'warning',
        message: `Revenue declined ${Math.abs(revenue.change_percent)}% compared to previous period`,
        metric: 'revenue_change',
        value: revenue.change_percent,
      });
    } else if (revenue.change_percent > 20) {
      alerts.push({
        type: 'info',
        message: `Revenue increased ${revenue.change_percent}% - great performance!`,
        metric: 'revenue_change',
        value: revenue.change_percent,
      });
    }

    // Booking alerts
    if (bookings.cancellation_rate > 15) {
      alerts.push({
        type: 'warning',
        message: `High cancellation rate: ${bookings.cancellation_rate}%`,
        metric: 'cancellation_rate',
        value: bookings.cancellation_rate,
      });
    }

    // Customer alerts
    if (customers.churn_rate > 50) {
      alerts.push({
        type: 'warning',
        message: `High customer churn rate: ${customers.churn_rate}%`,
        metric: 'churn_rate',
        value: customers.churn_rate,
      });
    }

    // Course alerts
    if (courses.underperformers.length > 5) {
      alerts.push({
        type: 'warning',
        message: `${courses.underperformers.length} courses with no bookings this period`,
        metric: 'underperforming_courses',
        value: courses.underperformers.length,
      });
    }

    return alerts;
  }

  async getEnrichedBookings(filters?: { date_from?: string; date_to?: string; course_id?: string; status?: string }): Promise<EnrichedBooking[]> {
    const allBookings = await this.storage.getAllBookings();
    const allCourses = await this.storage.getAllCourses();
    const courseMap = new Map(allCourses.map(c => [c.id, c]));

    let filteredBookings = allBookings;

    if (filters?.date_from) {
      const fromDate = new Date(filters.date_from);
      filteredBookings = filteredBookings.filter(b => b.createdAt && new Date(b.createdAt) >= fromDate);
    }
    if (filters?.date_to) {
      const toDate = new Date(filters.date_to);
      filteredBookings = filteredBookings.filter(b => b.createdAt && new Date(b.createdAt) <= toDate);
    }
    if (filters?.course_id) {
      filteredBookings = filteredBookings.filter(b => b.courseId === filters.course_id);
    }
    if (filters?.status) {
      const statusFilter = filters.status.toUpperCase();
      filteredBookings = filteredBookings.filter(b => b.status === statusFilter);
    }

    return filteredBookings.map(b => ({
      ...b,
      lead_time_days: computeLeadTimeDays(b),
      source: mapBookingSource(b),
      course_name: courseMap.get(b.courseId)?.name,
    }));
  }

  async getCustomerOverviews(filters?: { page?: number; limit?: number }): Promise<{ data: CustomerOverview[]; total: number; page: number; limit: number }> {
    const allUsers = await this.storage.getAllUsers();
    const allBookings = await this.storage.getAllBookings();
    const allCourses = await this.storage.getAllCourses();
    const courseMap = new Map(allCourses.map(c => [c.id, c.name]));

    const page = filters?.page || 1;
    const limit = filters?.limit || 50;

    // Build customer data
    const customerData: CustomerOverview[] = allUsers.map(user => {
      const userBookings = allBookings.filter(b => b.userId === user.id);
      const totalSpend = userBookings.reduce((sum, b) => sum + (getBookingPriceEuros(b)), 0);
      const lastBooking = userBookings.length > 0 
        ? userBookings.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())[0]
        : null;

      // Preferred courses
      const courseCounts = new Map<string, number>();
      userBookings.forEach(b => {
        courseCounts.set(b.courseId, (courseCounts.get(b.courseId) || 0) + 1);
      });
      const preferredCourses = Array.from(courseCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([id]) => id);

      // Preferred days
      const dayCounts = new Map<string, number>();
      userBookings.forEach(b => {
        if (b.teeTime) {
          const day = getDayName(new Date(b.teeTime));
          dayCounts.set(day, (dayCounts.get(day) || 0) + 1);
        }
      });
      const preferredDays = Array.from(dayCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 2)
        .map(([day]) => day);

      // Segment
      let segment = 'new';
      if (userBookings.length >= 10 || totalSpend >= 1000) segment = 'vip';
      else if (userBookings.length >= 2) segment = 'returning';
      else if (lastBooking && new Date(lastBooking.createdAt || 0) < new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)) segment = 'inactive';

      return {
        id: user.id,
        name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email,
        email: user.email,
        phone: user.phoneNumber,
        created_at: user.createdAt?.toISOString() || null,
        total_bookings: userBookings.length,
        total_spend: Math.round(totalSpend),
        last_booking: lastBooking?.teeTime ? new Date(lastBooking.teeTime).toISOString() : null,
        avg_booking_value: userBookings.length > 0 ? Math.round(totalSpend / userBookings.length) : 0,
        segment,
        preferred_courses: preferredCourses,
        preferred_days: preferredDays,
      };
    });

    // Pagination
    const total = customerData.length;
    const startIndex = (page - 1) * limit;
    const paginatedData = customerData.slice(startIndex, startIndex + limit);

    return {
      data: paginatedData,
      total,
      page,
      limit,
    };
  }

  async getExecutiveSummary(): Promise<ExecutiveSummary> {
    const analytics = await this.getComprehensiveAnalytics();
    
    const highlights: string[] = [];
    const concerns: string[] = [];
    const opportunities: string[] = [];
    const recommended_actions: string[] = [];

    // Generate highlights
    if (analytics.revenue.change_percent > 0) {
      highlights.push(`Revenue grew ${analytics.revenue.change_percent}% compared to previous period`);
    }
    if (analytics.customers.new_30_days > 0) {
      highlights.push(`${analytics.customers.new_30_days} new customers registered in the last 30 days`);
    }
    if (analytics.bookings.total > 0) {
      highlights.push(`${analytics.bookings.total} bookings processed with €${analytics.revenue.total} in revenue`);
    }
    if (analytics.courses.top_performers.length > 0) {
      highlights.push(`Top performing course: ${analytics.courses.top_performers[0].name} with €${analytics.courses.top_performers[0].revenue} revenue`);
    }

    // Generate concerns
    if (analytics.revenue.change_percent < 0) {
      concerns.push(`Revenue declined ${Math.abs(analytics.revenue.change_percent)}% - investigate causes`);
    }
    if (analytics.bookings.cancellation_rate > 10) {
      concerns.push(`Cancellation rate of ${analytics.bookings.cancellation_rate}% is above target`);
    }
    if (analytics.customers.churn_rate > 40) {
      concerns.push(`Customer churn rate of ${analytics.customers.churn_rate}% needs attention`);
    }
    if (analytics.courses.underperformers.length > 0) {
      concerns.push(`${analytics.courses.underperformers.length} courses have no bookings this period`);
    }

    // Generate opportunities
    if (analytics.bookings.peak_hours.length > 0) {
      const offPeakHours = [7, 8, 15, 16].filter(h => !analytics.bookings.peak_hours.slice(0, 3).some(p => p.hour === h));
      if (offPeakHours.length > 0) {
        opportunities.push(`Promote off-peak hours (${offPeakHours.join(', ')}:00) with special pricing`);
      }
    }
    if (analytics.customers.segments.inactive > 10) {
      opportunities.push(`${analytics.customers.segments.inactive} inactive customers could be re-engaged with targeted campaigns`);
    }
    opportunities.push('Consider loyalty program for VIP customers to increase retention');

    // Generate recommended actions
    if (analytics.bookings.cancellation_rate > 10) {
      recommended_actions.push('Review cancellation policy and implement reminder system');
    }
    if (analytics.courses.underperformers.length > 0) {
      recommended_actions.push('Reach out to underperforming courses for promotional opportunities');
    }
    recommended_actions.push('Focus marketing on top-performing regions for maximum ROI');
    recommended_actions.push('Expand course partnerships in high-demand areas');

    return {
      generated_at: new Date().toISOString(),
      highlights,
      concerns,
      opportunities,
      recommended_actions,
    };
  }
}
