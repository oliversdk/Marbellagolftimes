import { IStorage } from "../storage";
import {
  MarketingChannel,
  MarketingCampaign,
  MarketingMetricsDaily,
  AdSpendRecord,
  MarketingGoal,
  BookingRequest,
} from "@shared/schema";

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

function getBookingPriceEuros(booking: BookingRequest): number {
  if (booking.totalAmountCents) {
    return booking.totalAmountCents / 100;
  }
  return booking.estimatedPrice || 0;
}

function mapUtmSourceToChannel(utmSource: string | null | undefined): string {
  if (!utmSource) return 'direct';
  const source = utmSource.toLowerCase();
  if (source.includes('google')) return 'google_ads';
  if (source.includes('facebook') || source.includes('fb')) return 'facebook_ads';
  if (source.includes('instagram') || source.includes('ig')) return 'instagram_ads';
  if (source.includes('email') || source.includes('newsletter')) return 'email';
  if (source.includes('affiliate')) return 'affiliate';
  if (source.includes('organic')) return 'organic_search';
  return 'other';
}

function normalizeChannelName(name: string): string {
  return name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
}

export interface MarketingAnalytics {
  period: { start: string; end: string };
  traffic: {
    total_sessions: number;
    total_users: number;
    new_users: number;
    returning_users: number;
    avg_session_duration: number;
    bounce_rate: number;
    by_channel: { channel: string; sessions: number; users: number; conversion_rate: number }[];
    by_day: { date: string; sessions: number; users: number }[];
  };
  acquisition: {
    channels_mix: { channel: string; percentage: number; sessions: number; revenue: number }[];
    top_campaigns: { id: string; name: string; channel: string; spend: number; revenue: number; roas: number; conversions: number }[];
    source_medium: { source: string; medium: string; sessions: number; conversions: number }[];
  };
  spend: {
    total_spend: number;
    by_channel: { channel: string; spend: number; percentage: number }[];
    by_day: { date: string; spend: number }[];
    budget_utilization: number;
  };
  roi: {
    overall_roas: number;
    cpa: number;
    ltv_cac_ratio: number;
    by_channel: { channel: string; spend: number; revenue: number; roas: number; cpa: number }[];
  };
  goals: {
    active: { id: string; name: string; target: number; current: number; progress_percent: number; status: string }[];
  };
  alerts: { type: string; severity: string; message: string }[];
}

interface ChannelSummary {
  channelId: string;
  channelName: string;
  sessions: number;
  users: number;
  newUsers: number;
  conversions: number;
  revenue: number;
  spend: number;
  bounceRate: number;
  avgSessionDuration: number;
}

interface CampaignPerformance {
  id: string;
  name: string;
  channelName: string;
  spend: number;
  revenue: number;
  conversions: number;
  roas: number;
  cpa: number;
}

export class MarketingAnalyticsService {
  constructor(private storage: IStorage) {}

  async getMarketingAnalytics(options?: { startDate?: Date; endDate?: Date }): Promise<MarketingAnalytics> {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    
    const startDate = options?.startDate || thirtyDaysAgo;
    const endDate = options?.endDate || now;

    const period = {
      start: formatDate(startDate),
      end: formatDate(endDate),
    };

    const [channels, campaigns, metrics, adSpend, goals, bookings] = await Promise.all([
      this.storage.getAllMarketingChannels(),
      this.storage.getAllMarketingCampaigns(),
      this.storage.getMarketingMetrics({ startDate, endDate }),
      this.storage.getAdSpendRecords({ startDate, endDate }),
      this.storage.getAllMarketingGoals(),
      this.storage.getAllBookings(),
    ]);

    const currentPeriodBookings = bookings.filter(b => 
      b.createdAt && new Date(b.createdAt) >= startDate && new Date(b.createdAt) <= endDate && b.status !== 'CANCELLED'
    );

    const channelMap = new Map(channels.map(c => [c.id, c]));
    const campaignMap = new Map(campaigns.map(c => [c.id, c]));

    const channelSummaries = await this.getChannelSummary(startDate, endDate, metrics, adSpend, currentPeriodBookings, channelMap);
    const campaignPerformances = await this.getCampaignPerformance(startDate, endDate, campaigns, metrics, adSpend, currentPeriodBookings, channelMap);

    const traffic = this.buildTrafficAnalytics(metrics, channelSummaries, channels);
    const acquisition = this.buildAcquisitionAnalytics(channelSummaries, campaignPerformances, currentPeriodBookings);
    const spend = this.buildSpendAnalytics(adSpend, channelSummaries, campaigns, channels);
    const roi = this.buildROIAnalytics(channelSummaries);
    const goalsAnalytics = this.buildGoalsAnalytics(goals);
    const alerts = await this.generateMarketingAlerts(channelSummaries, campaignPerformances, goals, spend.budget_utilization);

    return {
      period,
      traffic,
      acquisition,
      spend,
      roi,
      goals: goalsAnalytics,
      alerts,
    };
  }

  async getChannelSummary(
    dateFrom: Date,
    dateTo: Date,
    metrics: MarketingMetricsDaily[],
    adSpend: AdSpendRecord[],
    bookings: BookingRequest[],
    channelMap: Map<string, MarketingChannel>
  ): Promise<ChannelSummary[]> {
    const summaryMap = new Map<string, ChannelSummary>();

    for (const metric of metrics) {
      if (!metric.channelId) continue;
      const channel = channelMap.get(metric.channelId);
      if (!channel) continue;

      const existing = summaryMap.get(metric.channelId) || {
        channelId: metric.channelId,
        channelName: channel.displayName,
        sessions: 0,
        users: 0,
        newUsers: 0,
        conversions: 0,
        revenue: 0,
        spend: 0,
        bounceRate: 0,
        avgSessionDuration: 0,
      };

      existing.sessions += metric.sessions || 0;
      existing.users += metric.users || 0;
      existing.newUsers += metric.newUsers || 0;
      existing.conversions += metric.conversions || 0;
      existing.revenue += metric.conversionValue || 0;

      summaryMap.set(metric.channelId, existing);
    }

    for (const record of adSpend) {
      const existing = summaryMap.get(record.channelId);
      if (existing) {
        existing.spend += (record.amountCents || 0) / 100;
      }
    }

    const revenueByChannel = this.attributeRevenueByChannel(bookings, channelMap);
    for (const [channelId, revenue] of Array.from(revenueByChannel.entries())) {
      const existing = summaryMap.get(channelId);
      if (existing) {
        existing.revenue += revenue;
      } else {
        const channel = channelMap.get(channelId);
        if (channel) {
          summaryMap.set(channelId, {
            channelId,
            channelName: channel.displayName,
            sessions: 0,
            users: 0,
            newUsers: 0,
            conversions: 0,
            revenue,
            spend: 0,
            bounceRate: 0,
            avgSessionDuration: 0,
          });
        }
      }
    }

    return Array.from(summaryMap.values());
  }

  async getCampaignPerformance(
    dateFrom: Date,
    dateTo: Date,
    campaigns: MarketingCampaign[],
    metrics: MarketingMetricsDaily[],
    adSpend: AdSpendRecord[],
    bookings: BookingRequest[],
    channelMap: Map<string, MarketingChannel>
  ): Promise<CampaignPerformance[]> {
    const campaignStats = new Map<string, { spend: number; revenue: number; conversions: number }>();

    for (const campaign of campaigns) {
      campaignStats.set(campaign.id, { spend: 0, revenue: 0, conversions: 0 });
    }

    for (const metric of metrics) {
      if (!metric.campaignId) continue;
      const stats = campaignStats.get(metric.campaignId);
      if (stats) {
        stats.revenue += metric.conversionValue || 0;
        stats.conversions += metric.conversions || 0;
      }
    }

    for (const record of adSpend) {
      if (!record.campaignId) continue;
      const stats = campaignStats.get(record.campaignId);
      if (stats) {
        stats.spend += (record.amountCents || 0) / 100;
      }
    }

    for (const booking of bookings) {
      if (!booking.utmCampaign) continue;
      for (const campaign of campaigns) {
        if (campaign.name.toLowerCase().includes(booking.utmCampaign.toLowerCase()) ||
            campaign.externalId === booking.utmCampaign) {
          const stats = campaignStats.get(campaign.id);
          if (stats) {
            stats.revenue += getBookingPriceEuros(booking);
            stats.conversions += 1;
          }
          break;
        }
      }
    }

    return campaigns.map(campaign => {
      const stats = campaignStats.get(campaign.id) || { spend: 0, revenue: 0, conversions: 0 };
      const channel = channelMap.get(campaign.channelId);
      return {
        id: campaign.id,
        name: campaign.name,
        channelName: channel?.displayName || 'Unknown',
        spend: stats.spend,
        revenue: stats.revenue,
        conversions: stats.conversions,
        roas: this.calculateROAS(stats.revenue, stats.spend),
        cpa: stats.conversions > 0 ? stats.spend / stats.conversions : 0,
      };
    }).sort((a, b) => b.revenue - a.revenue);
  }

  calculateROAS(revenue: number, spend: number): number {
    if (spend === 0) return 0;
    return Math.round((revenue / spend) * 100) / 100;
  }

  async generateMarketingAlerts(
    channelSummaries: ChannelSummary[],
    campaignPerformances: CampaignPerformance[],
    goals: MarketingGoal[],
    budgetUtilization: number
  ): Promise<{ type: string; severity: string; message: string }[]> {
    const alerts: { type: string; severity: string; message: string }[] = [];

    for (const channel of channelSummaries) {
      if (channel.spend > 0) {
        const roas = this.calculateROAS(channel.revenue, channel.spend);
        if (roas < 1) {
          alerts.push({
            type: 'low_roas',
            severity: 'critical',
            message: `${channel.channelName} has ROAS of ${roas.toFixed(2)}x (below break-even)`,
          });
        } else if (roas < 2) {
          alerts.push({
            type: 'low_roas',
            severity: 'warning',
            message: `${channel.channelName} has ROAS of ${roas.toFixed(2)}x (below target of 2x)`,
          });
        }
      }
    }

    for (const campaign of campaignPerformances) {
      if (campaign.spend > 100 && campaign.conversions === 0) {
        alerts.push({
          type: 'no_conversions',
          severity: 'critical',
          message: `Campaign "${campaign.name}" spent €${campaign.spend.toFixed(0)} with no conversions`,
        });
      }
      if (campaign.cpa > 50 && campaign.conversions > 0) {
        alerts.push({
          type: 'high_cpa',
          severity: 'warning',
          message: `Campaign "${campaign.name}" has high CPA of €${campaign.cpa.toFixed(0)}`,
        });
      }
    }

    if (budgetUtilization < 50) {
      alerts.push({
        type: 'underspend',
        severity: 'info',
        message: `Budget utilization is only ${budgetUtilization.toFixed(0)}% - consider increasing ad spend`,
      });
    } else if (budgetUtilization > 95) {
      alerts.push({
        type: 'budget_exhausted',
        severity: 'warning',
        message: `Budget utilization at ${budgetUtilization.toFixed(0)}% - approaching limit`,
      });
    }

    const now = new Date();
    for (const goal of goals) {
      if (goal.status !== 'active') continue;
      const periodEnd = new Date(goal.periodEnd);
      const periodStart = new Date(goal.periodStart);
      const totalDays = (periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24);
      const elapsedDays = (now.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24);
      const expectedProgress = (elapsedDays / totalDays) * 100;
      const actualProgress = ((goal.currentValue || 0) / goal.targetValue) * 100;

      if (actualProgress < expectedProgress - 20) {
        alerts.push({
          type: 'goal_behind',
          severity: 'warning',
          message: `Goal "${goal.name}" is behind schedule (${actualProgress.toFixed(0)}% vs expected ${expectedProgress.toFixed(0)}%)`,
        });
      }
    }

    return alerts;
  }

  private attributeRevenueByChannel(
    bookings: BookingRequest[],
    channelMap: Map<string, MarketingChannel>
  ): Map<string, number> {
    const revenueMap = new Map<string, number>();
    
    const channelBySlug = new Map<string, string>();
    for (const [id, channel] of Array.from(channelMap.entries())) {
      const slug = normalizeChannelName(channel.name);
      channelBySlug.set(slug, id);
    }

    for (const booking of bookings) {
      const channelKey = mapUtmSourceToChannel(booking.utmSource);
      const channelId = channelBySlug.get(channelKey);
      if (channelId) {
        const current = revenueMap.get(channelId) || 0;
        revenueMap.set(channelId, current + getBookingPriceEuros(booking));
      }
    }

    return revenueMap;
  }

  private buildTrafficAnalytics(
    metrics: MarketingMetricsDaily[],
    channelSummaries: ChannelSummary[],
    channels: MarketingChannel[]
  ): MarketingAnalytics['traffic'] {
    let totalSessions = 0;
    let totalUsers = 0;
    let totalNewUsers = 0;
    let totalBounceRateSum = 0;
    let totalDurationSum = 0;
    let metricsCount = 0;

    const byDayMap = new Map<string, { sessions: number; users: number }>();

    for (const metric of metrics) {
      totalSessions += metric.sessions || 0;
      totalUsers += metric.users || 0;
      totalNewUsers += metric.newUsers || 0;
      if (metric.bounceRate) {
        totalBounceRateSum += metric.bounceRate;
        metricsCount++;
      }
      if (metric.avgSessionDuration) {
        totalDurationSum += metric.avgSessionDuration;
      }

      if (metric.date) {
        const dateStr = formatDate(new Date(metric.date));
        const existing = byDayMap.get(dateStr) || { sessions: 0, users: 0 };
        existing.sessions += metric.sessions || 0;
        existing.users += metric.users || 0;
        byDayMap.set(dateStr, existing);
      }
    }

    const totalConversions = channelSummaries.reduce((sum, c) => sum + c.conversions, 0);

    return {
      total_sessions: totalSessions,
      total_users: totalUsers,
      new_users: totalNewUsers,
      returning_users: totalUsers - totalNewUsers,
      avg_session_duration: metricsCount > 0 ? totalDurationSum / metricsCount : 0,
      bounce_rate: metricsCount > 0 ? totalBounceRateSum / metricsCount : 0,
      by_channel: channelSummaries.map(c => ({
        channel: c.channelName,
        sessions: c.sessions,
        users: c.users,
        conversion_rate: c.sessions > 0 ? (c.conversions / c.sessions) * 100 : 0,
      })),
      by_day: Array.from(byDayMap.entries())
        .map(([date, data]) => ({ date, sessions: data.sessions, users: data.users }))
        .sort((a, b) => a.date.localeCompare(b.date)),
    };
  }

  private buildAcquisitionAnalytics(
    channelSummaries: ChannelSummary[],
    campaignPerformances: CampaignPerformance[],
    bookings: BookingRequest[]
  ): MarketingAnalytics['acquisition'] {
    const totalSessions = channelSummaries.reduce((sum, c) => sum + c.sessions, 0);

    const sourceMediumMap = new Map<string, { sessions: number; conversions: number }>();
    for (const booking of bookings) {
      const source = booking.utmSource || 'direct';
      const medium = booking.utmMedium || 'none';
      const key = `${source}|${medium}`;
      const existing = sourceMediumMap.get(key) || { sessions: 0, conversions: 0 };
      existing.conversions += 1;
      sourceMediumMap.set(key, existing);
    }

    return {
      channels_mix: channelSummaries.map(c => ({
        channel: c.channelName,
        percentage: totalSessions > 0 ? (c.sessions / totalSessions) * 100 : 0,
        sessions: c.sessions,
        revenue: c.revenue,
      })).sort((a, b) => b.sessions - a.sessions),
      top_campaigns: campaignPerformances.slice(0, 10).map(c => ({
        id: c.id,
        name: c.name,
        channel: c.channelName,
        spend: c.spend,
        revenue: c.revenue,
        roas: c.roas,
        conversions: c.conversions,
      })),
      source_medium: Array.from(sourceMediumMap.entries()).map(([key, data]) => {
        const [source, medium] = key.split('|');
        return { source, medium, sessions: data.sessions, conversions: data.conversions };
      }).sort((a, b) => b.conversions - a.conversions),
    };
  }

  private buildSpendAnalytics(
    adSpend: AdSpendRecord[],
    channelSummaries: ChannelSummary[],
    campaigns: MarketingCampaign[],
    channels: MarketingChannel[]
  ): MarketingAnalytics['spend'] {
    const totalSpend = channelSummaries.reduce((sum, c) => sum + c.spend, 0);

    const byDayMap = new Map<string, number>();
    for (const record of adSpend) {
      if (record.date) {
        const dateStr = formatDate(new Date(record.date));
        const existing = byDayMap.get(dateStr) || 0;
        byDayMap.set(dateStr, existing + (record.amountCents || 0) / 100);
      }
    }

    const totalBudget = campaigns.reduce((sum, c) => sum + ((c.budgetCents || 0) / 100), 0);
    const budgetUtilization = totalBudget > 0 ? (totalSpend / totalBudget) * 100 : 0;

    return {
      total_spend: totalSpend,
      by_channel: channelSummaries.map(c => ({
        channel: c.channelName,
        spend: c.spend,
        percentage: totalSpend > 0 ? (c.spend / totalSpend) * 100 : 0,
      })).filter(c => c.spend > 0).sort((a, b) => b.spend - a.spend),
      by_day: Array.from(byDayMap.entries())
        .map(([date, spend]) => ({ date, spend }))
        .sort((a, b) => a.date.localeCompare(b.date)),
      budget_utilization: budgetUtilization,
    };
  }

  private buildROIAnalytics(channelSummaries: ChannelSummary[]): MarketingAnalytics['roi'] {
    const totalRevenue = channelSummaries.reduce((sum, c) => sum + c.revenue, 0);
    const totalSpend = channelSummaries.reduce((sum, c) => sum + c.spend, 0);
    const totalConversions = channelSummaries.reduce((sum, c) => sum + c.conversions, 0);

    const overallRoas = this.calculateROAS(totalRevenue, totalSpend);
    const cpa = totalConversions > 0 ? totalSpend / totalConversions : 0;
    const avgLtv = totalConversions > 0 ? totalRevenue / totalConversions : 0;
    const ltvCacRatio = cpa > 0 ? avgLtv / cpa : 0;

    return {
      overall_roas: overallRoas,
      cpa,
      ltv_cac_ratio: ltvCacRatio,
      by_channel: channelSummaries
        .filter(c => c.spend > 0)
        .map(c => ({
          channel: c.channelName,
          spend: c.spend,
          revenue: c.revenue,
          roas: this.calculateROAS(c.revenue, c.spend),
          cpa: c.conversions > 0 ? c.spend / c.conversions : 0,
        }))
        .sort((a, b) => b.roas - a.roas),
    };
  }

  private buildGoalsAnalytics(goals: MarketingGoal[]): MarketingAnalytics['goals'] {
    const now = new Date();
    const activeGoals = goals.filter(g => 
      g.status === 'active' && 
      new Date(g.periodEnd) >= now
    );

    return {
      active: activeGoals.map(g => ({
        id: g.id,
        name: g.name,
        target: g.targetValue,
        current: g.currentValue || 0,
        progress_percent: Math.min(((g.currentValue || 0) / g.targetValue) * 100, 100),
        status: g.status,
      })),
    };
  }
}
