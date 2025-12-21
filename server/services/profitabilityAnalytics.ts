import { IStorage } from "../storage";
import { BookingRequest, CourseRatePeriod, CourseAddOn, GolfCourse, courseRatePeriods, courseAddOns } from "@shared/schema";
import { db } from "../db";
import { eq } from "drizzle-orm";

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

export function getBookingPriceEuros(booking: BookingRequest): number {
  if (booking.totalAmountCents) {
    return booking.totalAmountCents / 100;
  }
  return booking.estimatedPrice || 0;
}

function normalizeAddOnType(type: string): string {
  const t = type.toLowerCase();
  if (t.includes('buggy')) return 'buggy';
  if (t.includes('club')) return 'clubs';
  if (t.includes('trolley')) return 'trolley';
  return 'other';
}

interface AddOnItem {
  id?: string;
  name?: string;
  type?: string;
  priceCents?: number;
  quantity?: number;
}

export interface ProfitabilityAnalytics {
  period: { start: string; end: string };
  summary: {
    total_revenue: number;
    total_cost: number;
    gross_profit: number;
    profit_margin_percent: number;
    total_transactions: number;
    loss_making_transactions: number;
  };
  by_product_type: {
    product_type: string;
    revenue: number;
    cost: number;
    profit: number;
    margin_percent: number;
    transaction_count: number;
    recommendation: string;
  }[];
  by_course: {
    course_id: string;
    course_name: string;
    revenue: number;
    cost: number;
    profit: number;
    margin_percent: number;
    booking_count: number;
    avg_profit_per_booking: number;
  }[];
  loss_making_transactions: {
    booking_id: string;
    course_name: string;
    date: string;
    revenue: number;
    cost: number;
    loss: number;
    reason: string;
  }[];
  recommendations: {
    focus_areas: string[];
    reduce_focus: string[];
    price_adjustments: { item: string; current_margin: number; suggested_action: string }[];
  };
  alerts: { type: string; severity: string; message: string }[];
}

interface BookingProfitability {
  bookingId: string;
  courseId: string;
  courseName: string;
  date: string;
  teeTimeRevenue: number;
  teeTimeCost: number;
  addOnRevenue: number;
  addOnCost: number;
  totalRevenue: number;
  totalCost: number;
  profit: number;
  addOnBreakdown: { type: string; revenue: number; cost: number }[];
}

interface ProductTypeStats {
  revenue: number;
  cost: number;
  count: number;
}

export class ProfitabilityAnalyticsService {
  constructor(private storage: IStorage) {}

  async getProfitabilityAnalytics(options?: { startDate?: Date; endDate?: Date }): Promise<ProfitabilityAnalytics> {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    
    const startDate = options?.startDate || thirtyDaysAgo;
    const endDate = options?.endDate || now;

    const period = {
      start: formatDate(startDate),
      end: formatDate(endDate),
    };

    const [bookings, courses, allRatePeriods, allAddOns] = await Promise.all([
      this.storage.getAllBookings(),
      this.storage.getAllCourses(),
      db.select().from(courseRatePeriods),
      db.select().from(courseAddOns),
    ]);

    const courseMap = new Map(courses.map(c => [c.id, c]));
    const ratePeriodsByCourse = this.groupBy(allRatePeriods, 'courseId');
    const addOnsByCourse = this.groupBy(allAddOns, 'courseId');

    const filteredBookings = bookings.filter(b => {
      if (!b.teeTime) return false;
      const bookingDate = new Date(b.teeTime);
      return bookingDate >= startDate && bookingDate <= endDate && b.status !== 'CANCELLED';
    });

    const bookingProfitabilities = await this.calculateBookingProfitabilities(
      filteredBookings,
      courseMap,
      ratePeriodsByCourse,
      addOnsByCourse
    );

    const summary = this.buildSummary(bookingProfitabilities);
    const byProductType = this.buildByProductType(bookingProfitabilities);
    const byCourse = this.buildByCourse(bookingProfitabilities);
    const lossTransactions = this.buildLossTransactions(bookingProfitabilities);
    const recommendations = this.buildRecommendations(byProductType, byCourse);
    const alerts = this.generateAlerts(summary, byProductType, lossTransactions);

    return {
      period,
      summary,
      by_product_type: byProductType,
      by_course: byCourse,
      loss_making_transactions: lossTransactions,
      recommendations,
      alerts,
    };
  }

  private groupBy<T>(items: T[], key: keyof T): Map<string, T[]> {
    const map = new Map<string, T[]>();
    for (const item of items) {
      const k = String(item[key]);
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(item);
    }
    return map;
  }

  private async calculateBookingProfitabilities(
    bookings: BookingRequest[],
    courseMap: Map<string, GolfCourse>,
    ratePeriodsByCourse: Map<string, CourseRatePeriod[]>,
    addOnsByCourse: Map<string, CourseAddOn[]>
  ): Promise<BookingProfitability[]> {
    const results: BookingProfitability[] = [];

    for (const booking of bookings) {
      const course = courseMap.get(booking.courseId);
      if (!course) continue;

      const teeTimeRevenue = getBookingPriceEuros(booking);
      const teeTimeCost = this.calculateTeeTimeCost(booking, ratePeriodsByCourse.get(booking.courseId) || [], course);
      
      const { addOnRevenue, addOnCost, addOnBreakdown } = this.calculateAddOnCosts(
        booking,
        addOnsByCourse.get(booking.courseId) || []
      );

      const totalRevenue = teeTimeRevenue + addOnRevenue;
      const totalCost = teeTimeCost + addOnCost;

      results.push({
        bookingId: booking.id,
        courseId: booking.courseId,
        courseName: course.name,
        date: booking.teeTime ? formatDate(new Date(booking.teeTime)) : '',
        teeTimeRevenue,
        teeTimeCost,
        addOnRevenue,
        addOnCost,
        totalRevenue,
        totalCost,
        profit: totalRevenue - totalCost,
        addOnBreakdown,
      });
    }

    return results;
  }

  private calculateTeeTimeCost(booking: BookingRequest, ratePeriods: CourseRatePeriod[], course: GolfCourse): number {
    const revenue = getBookingPriceEuros(booking);
    
    // Use course-level kickbackPercent as fallback if available
    const courseKickback = course.kickbackPercent || 0;
    const fallbackCost = courseKickback > 0 
      ? revenue * (1 - courseKickback / 100)
      : revenue * 0.80; // Default 20% margin if no data
    
    if (ratePeriods.length === 0) {
      return fallbackCost;
    }

    const bookingDate = booking.teeTime ? new Date(booking.teeTime) : new Date();
    const bookingMonth = bookingDate.getMonth() + 1;
    const bookingDay = bookingDate.getDate();
    const packageType = booking.packageType || 'GREEN_FEE_BUGGY';

    let matchedPeriod: CourseRatePeriod | undefined;
    
    for (const period of ratePeriods) {
      if (period.packageType && period.packageType.toLowerCase() !== packageType.toLowerCase()) {
        continue;
      }

      const dateInRange = this.isDateInRange(bookingMonth, bookingDay, period.startDate, period.endDate);
      if (dateInRange) {
        matchedPeriod = period;
        break;
      }
    }

    if (!matchedPeriod) {
      matchedPeriod = ratePeriods[0];
    }

    if (matchedPeriod) {
      // netRate is the cost per booking (already includes all players in the package)
      // For packages like "2 Greenfee + Buggy" the netRate is for 2 players
      // We do NOT multiply by player count as the rate is per-booking not per-player
      if (matchedPeriod.netRate) {
        return matchedPeriod.netRate;
      }
      
      // If we have kickbackPercent, calculate cost from it
      // kickback = (rack - net) / rack * 100, so net = rack * (1 - kickback/100)
      if (matchedPeriod.kickbackPercent && matchedPeriod.rackRate) {
        return matchedPeriod.rackRate * (1 - matchedPeriod.kickbackPercent / 100);
      }
    }

    // Fallback: use course-level kickback or default 20% margin
    return fallbackCost;
  }

  private isDateInRange(month: number, day: number, startDate: string, endDate: string): boolean {
    try {
      const parseMonthDay = (dateStr: string): { month: number; day: number } => {
        const parts = dateStr.split('-');
        if (parts.length === 2) {
          return { month: parseInt(parts[0], 10), day: parseInt(parts[1], 10) };
        }
        return { month: 1, day: 1 };
      };

      const start = parseMonthDay(startDate);
      const end = parseMonthDay(endDate);
      
      const dateValue = month * 100 + day;
      const startValue = start.month * 100 + start.day;
      const endValue = end.month * 100 + end.day;

      if (startValue <= endValue) {
        return dateValue >= startValue && dateValue <= endValue;
      } else {
        return dateValue >= startValue || dateValue <= endValue;
      }
    } catch {
      return false;
    }
  }

  private calculateAddOnCosts(
    booking: BookingRequest,
    courseAddOns: CourseAddOn[]
  ): { addOnRevenue: number; addOnCost: number; addOnBreakdown: { type: string; revenue: number; cost: number }[] } {
    let addOnRevenue = 0;
    let addOnCost = 0;
    const breakdown: { type: string; revenue: number; cost: number }[] = [];

    if (!booking.addOnsJson) {
      return { addOnRevenue, addOnCost, addOnBreakdown: breakdown };
    }

    const playerCount = booking.players || 1;

    try {
      const addOns: AddOnItem[] = JSON.parse(booking.addOnsJson);
      const addOnMap = new Map(courseAddOns.map(a => [a.id, a]));

      for (const addOn of addOns) {
        const quantity = addOn.quantity || 1;
        let revenue = 0;
        let cost = 0;
        let type = 'other';

        if (addOn.id && addOnMap.has(addOn.id)) {
          const courseAddOn = addOnMap.get(addOn.id)!;
          
          // Calculate multiplier: if perPlayer="true", multiply by player count
          const isPerPlayer = courseAddOn.perPlayer === "true";
          const multiplier = isPerPlayer ? quantity * playerCount : quantity;
          
          revenue = (courseAddOn.priceCents / 100) * multiplier;
          // Use costCents if available, otherwise estimate 70% of price as cost
          cost = courseAddOn.costCents 
            ? (courseAddOn.costCents / 100) * multiplier 
            : revenue * 0.70;
          type = normalizeAddOnType(courseAddOn.type);
        } else if (addOn.priceCents) {
          revenue = (addOn.priceCents / 100) * quantity;
          cost = revenue * 0.70;
          type = addOn.type ? normalizeAddOnType(addOn.type) : 'other';
        }

        addOnRevenue += revenue;
        addOnCost += cost;
        
        const existingBreakdown = breakdown.find(b => b.type === type);
        if (existingBreakdown) {
          existingBreakdown.revenue += revenue;
          existingBreakdown.cost += cost;
        } else {
          breakdown.push({ type, revenue, cost });
        }
      }
    } catch {
    }

    return { addOnRevenue, addOnCost, addOnBreakdown: breakdown };
  }

  private buildSummary(profitabilities: BookingProfitability[]): ProfitabilityAnalytics['summary'] {
    const totalRevenue = profitabilities.reduce((sum, p) => sum + p.totalRevenue, 0);
    const totalCost = profitabilities.reduce((sum, p) => sum + p.totalCost, 0);
    const grossProfit = totalRevenue - totalCost;
    const lossCount = profitabilities.filter(p => p.profit < 0).length;

    return {
      total_revenue: Math.round(totalRevenue * 100) / 100,
      total_cost: Math.round(totalCost * 100) / 100,
      gross_profit: Math.round(grossProfit * 100) / 100,
      profit_margin_percent: totalRevenue > 0 ? Math.round((grossProfit / totalRevenue) * 10000) / 100 : 0,
      total_transactions: profitabilities.length,
      loss_making_transactions: lossCount,
    };
  }

  private buildByProductType(profitabilities: BookingProfitability[]): ProfitabilityAnalytics['by_product_type'] {
    const stats = new Map<string, ProductTypeStats>();
    
    stats.set('tee_time', { revenue: 0, cost: 0, count: 0 });
    stats.set('buggy', { revenue: 0, cost: 0, count: 0 });
    stats.set('clubs', { revenue: 0, cost: 0, count: 0 });
    stats.set('trolley', { revenue: 0, cost: 0, count: 0 });
    stats.set('other', { revenue: 0, cost: 0, count: 0 });

    for (const p of profitabilities) {
      const teeTime = stats.get('tee_time')!;
      teeTime.revenue += p.teeTimeRevenue;
      teeTime.cost += p.teeTimeCost;
      teeTime.count += 1;

      for (const addOn of p.addOnBreakdown) {
        const existing = stats.get(addOn.type) || { revenue: 0, cost: 0, count: 0 };
        existing.revenue += addOn.revenue;
        existing.cost += addOn.cost;
        existing.count += 1;
        stats.set(addOn.type, existing);
      }
    }

    const result: ProfitabilityAnalytics['by_product_type'] = [];
    
    for (const [type, stat] of Array.from(stats.entries())) {
      if (stat.count === 0 && stat.revenue === 0) continue;
      
      const profit = stat.revenue - stat.cost;
      const margin = stat.revenue > 0 ? (profit / stat.revenue) * 100 : 0;
      
      let recommendation = '';
      if (margin >= 25) {
        recommendation = 'High performer - maintain or expand offerings';
      } else if (margin >= 15) {
        recommendation = 'Good margin - continue current strategy';
      } else if (margin >= 5) {
        recommendation = 'Consider price optimization or cost reduction';
      } else if (margin >= 0) {
        recommendation = 'Low margin - review pricing structure';
      } else {
        recommendation = 'Loss-making - urgent review needed';
      }

      result.push({
        product_type: type,
        revenue: Math.round(stat.revenue * 100) / 100,
        cost: Math.round(stat.cost * 100) / 100,
        profit: Math.round(profit * 100) / 100,
        margin_percent: Math.round(margin * 100) / 100,
        transaction_count: stat.count,
        recommendation,
      });
    }

    return result.sort((a, b) => b.profit - a.profit);
  }

  private buildByCourse(profitabilities: BookingProfitability[]): ProfitabilityAnalytics['by_course'] {
    const courseStats = new Map<string, {
      courseName: string;
      revenue: number;
      cost: number;
      bookingCount: number;
    }>();

    for (const p of profitabilities) {
      const existing = courseStats.get(p.courseId) || {
        courseName: p.courseName,
        revenue: 0,
        cost: 0,
        bookingCount: 0,
      };

      existing.revenue += p.totalRevenue;
      existing.cost += p.totalCost;
      existing.bookingCount += 1;
      courseStats.set(p.courseId, existing);
    }

    const result: ProfitabilityAnalytics['by_course'] = [];

    for (const [courseId, stat] of Array.from(courseStats.entries())) {
      const profit = stat.revenue - stat.cost;
      const margin = stat.revenue > 0 ? (profit / stat.revenue) * 100 : 0;
      const avgProfit = stat.bookingCount > 0 ? profit / stat.bookingCount : 0;

      result.push({
        course_id: courseId,
        course_name: stat.courseName,
        revenue: Math.round(stat.revenue * 100) / 100,
        cost: Math.round(stat.cost * 100) / 100,
        profit: Math.round(profit * 100) / 100,
        margin_percent: Math.round(margin * 100) / 100,
        booking_count: stat.bookingCount,
        avg_profit_per_booking: Math.round(avgProfit * 100) / 100,
      });
    }

    return result.sort((a, b) => b.profit - a.profit);
  }

  private buildLossTransactions(profitabilities: BookingProfitability[]): ProfitabilityAnalytics['loss_making_transactions'] {
    return profitabilities
      .filter(p => p.profit < 0)
      .map(p => {
        let reason = 'Unknown';
        if (p.teeTimeRevenue < p.teeTimeCost) {
          reason = 'Tee time sold below cost';
        } else if (p.addOnCost > p.addOnRevenue) {
          reason = 'Add-ons sold below cost';
        } else {
          reason = 'Combined revenue below total costs';
        }

        return {
          booking_id: p.bookingId,
          course_name: p.courseName,
          date: p.date,
          revenue: Math.round(p.totalRevenue * 100) / 100,
          cost: Math.round(p.totalCost * 100) / 100,
          loss: Math.round(Math.abs(p.profit) * 100) / 100,
          reason,
        };
      })
      .sort((a, b) => b.loss - a.loss);
  }

  private buildRecommendations(
    byProductType: ProfitabilityAnalytics['by_product_type'],
    byCourse: ProfitabilityAnalytics['by_course']
  ): ProfitabilityAnalytics['recommendations'] {
    const focusAreas: string[] = [];
    const reduceFocus: string[] = [];
    const priceAdjustments: { item: string; current_margin: number; suggested_action: string }[] = [];

    const sortedProducts = [...byProductType].sort((a, b) => b.margin_percent - a.margin_percent);
    
    for (const product of sortedProducts) {
      if (product.margin_percent >= 20 && product.transaction_count >= 5) {
        focusAreas.push(`${product.product_type} (${product.margin_percent.toFixed(1)}% margin)`);
      } else if (product.margin_percent < 5) {
        reduceFocus.push(`${product.product_type} (${product.margin_percent.toFixed(1)}% margin)`);
        
        if (product.margin_percent < 10) {
          priceAdjustments.push({
            item: product.product_type,
            current_margin: product.margin_percent,
            suggested_action: product.margin_percent < 0 
              ? 'Increase price by 15-20% or reduce supplier costs'
              : 'Consider 5-10% price increase',
          });
        }
      }
    }

    const topCourses = byCourse
      .filter(c => c.avg_profit_per_booking > 20)
      .slice(0, 3)
      .map(c => `${c.course_name} (€${c.avg_profit_per_booking.toFixed(0)}/booking avg)`);
    
    if (topCourses.length > 0) {
      focusAreas.push(`Prioritize partnerships: ${topCourses.join(', ')}`);
    }

    const lowMarginCourses = byCourse
      .filter(c => c.margin_percent < 10 && c.booking_count >= 3)
      .slice(0, 3);
    
    for (const course of lowMarginCourses) {
      priceAdjustments.push({
        item: course.course_name,
        current_margin: course.margin_percent,
        suggested_action: 'Renegotiate rates or adjust customer pricing',
      });
    }

    return {
      focus_areas: focusAreas.slice(0, 5),
      reduce_focus: reduceFocus.slice(0, 5),
      price_adjustments: priceAdjustments.slice(0, 10),
    };
  }

  private generateAlerts(
    summary: ProfitabilityAnalytics['summary'],
    byProductType: ProfitabilityAnalytics['by_product_type'],
    lossTransactions: ProfitabilityAnalytics['loss_making_transactions']
  ): ProfitabilityAnalytics['alerts'] {
    const alerts: ProfitabilityAnalytics['alerts'] = [];

    if (summary.profit_margin_percent < 10) {
      alerts.push({
        type: 'margin_warning',
        severity: summary.profit_margin_percent < 5 ? 'critical' : 'warning',
        message: `Overall profit margin is ${summary.profit_margin_percent.toFixed(1)}% - below healthy threshold of 15%`,
      });
    }

    const lossRatio = summary.total_transactions > 0 
      ? (summary.loss_making_transactions / summary.total_transactions) * 100 
      : 0;
    
    if (lossRatio > 5) {
      alerts.push({
        type: 'loss_ratio',
        severity: lossRatio > 10 ? 'critical' : 'warning',
        message: `${lossRatio.toFixed(1)}% of transactions are loss-making (${summary.loss_making_transactions} out of ${summary.total_transactions})`,
      });
    }

    for (const product of byProductType) {
      if (product.margin_percent < 0 && product.transaction_count >= 3) {
        alerts.push({
          type: 'negative_margin',
          severity: 'critical',
          message: `${product.product_type} has negative margin of ${product.margin_percent.toFixed(1)}% across ${product.transaction_count} transactions`,
        });
      }
    }

    const recentLargeLooses = lossTransactions.filter(t => t.loss > 50);
    if (recentLargeLooses.length > 0) {
      alerts.push({
        type: 'large_loss',
        severity: 'warning',
        message: `${recentLargeLooses.length} transactions with losses over €50 detected`,
      });
    }

    return alerts;
  }
}
