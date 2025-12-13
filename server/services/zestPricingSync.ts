import { db } from "../db";
import { zestPricingData, golfCourses, courseProviderLinks, teeTimeProviders } from "@shared/schema";
import type { ZestPricingJson } from "@shared/schema";
import { eq, and, ilike } from "drizzle-orm";
import { getZestGolfService, ZestTeeTimeResponse, ZestProduct } from "./zestGolf";

interface SyncResult {
  success: boolean;
  courseName: string;
  courseId: string;
  zestFacilityId: number;
  averageCommissionPercent?: number;
  greenFeeCount?: number;
  extraProductCount?: number;
  error?: string;
}

interface PricingSyncSummary {
  totalCourses: number;
  successCount: number;
  errorCount: number;
  results: SyncResult[];
}

function calculateCommissionPercent(netRate: number, publicRate: number): number {
  if (publicRate <= 0) return 0;
  return ((publicRate - netRate) / publicRate) * 100;
}

export async function syncZestPricingForCourse(
  courseId: string,
  zestFacilityId: number,
  courseName: string
): Promise<SyncResult> {
  try {
    const zestService = getZestGolfService();
    
    const bookingDate = new Date();
    bookingDate.setDate(bookingDate.getDate() + 7);
    
    const teeTimeData: ZestTeeTimeResponse = await zestService.getTeeTimes(
      zestFacilityId,
      bookingDate,
      2,
      18
    );

    if (!teeTimeData.teeTimeV3 || teeTimeData.teeTimeV3.length === 0) {
      return {
        success: false,
        courseName,
        courseId,
        zestFacilityId,
        error: "No tee times available for sample pricing",
      };
    }

    const sampleTeeTime = teeTimeData.teeTimeV3[0];
    
    const greenFeePricing: ZestPricingJson["greenFeePricing"] = [];
    if (sampleTeeTime.pricing) {
      for (const pricing of sampleTeeTime.pricing) {
        const players = parseInt(pricing.players) || 1;
        const netRate = pricing.netRate?.amount || 0;
        const publicRate = pricing.publicRate?.amount || pricing.price?.amount || 0;
        
        greenFeePricing.push({
          players,
          price: pricing.price,
          netRate: pricing.netRate || { amount: 0, currency: "EUR" },
          publicRate: pricing.publicRate || pricing.price,
          commissionPercent: calculateCommissionPercent(netRate, publicRate),
        });
      }
    }

    const extraProducts: ZestPricingJson["extraProducts"] = [];
    const seenMids = new Set<number>();
    
    for (const teeTime of teeTimeData.teeTimeV3.slice(0, 5)) {
      if (teeTime.extraProducts) {
        for (const product of teeTime.extraProducts) {
          if (!seenMids.has(product.mid)) {
            seenMids.add(product.mid);
            
            const netRate = product.netRate?.amount || 0;
            const publicRate = product.publicRate?.amount || product.price?.amount || 0;
            
            extraProducts.push({
              mid: product.mid,
              name: product.name,
              category: product.category,
              holes: 18,
              price: product.price || { amount: 0, currency: "EUR" },
              netRate: product.netRate || { amount: 0, currency: "EUR" },
              publicRate: product.publicRate || product.price || { amount: 0, currency: "EUR" },
              commissionPercent: calculateCommissionPercent(netRate, publicRate),
            });
          }
        }
      }
    }

    let totalCommission = 0;
    let commissionCount = 0;
    
    for (const gf of greenFeePricing) {
      if (gf.commissionPercent > 0) {
        totalCommission += gf.commissionPercent;
        commissionCount++;
      }
    }
    
    for (const ep of extraProducts) {
      if (ep.commissionPercent > 0) {
        totalCommission += ep.commissionPercent;
        commissionCount++;
      }
    }
    
    const averageCommissionPercent = commissionCount > 0 
      ? Math.round((totalCommission / commissionCount) * 100) / 100 
      : 0;

    const pricingJson: ZestPricingJson = {
      facilityName: courseName,
      facilityId: zestFacilityId,
      syncDate: new Date().toISOString(),
      greenFeePricing,
      extraProducts,
      cancellationPolicy: teeTimeData.facilityCancellationPolicyRange,
    };

    const existingPricing = await db.select()
      .from(zestPricingData)
      .where(eq(zestPricingData.courseId, courseId))
      .limit(1);

    if (existingPricing.length > 0) {
      await db.update(zestPricingData)
        .set({
          pricingJson: pricingJson as any,
          averageCommissionPercent,
          lastSyncedAt: new Date(),
          syncStatus: "success",
          syncError: null,
          updatedAt: new Date(),
        })
        .where(eq(zestPricingData.courseId, courseId));
    } else {
      await db.insert(zestPricingData).values({
        courseId,
        zestFacilityId,
        pricingJson: pricingJson as any,
        averageCommissionPercent,
        syncStatus: "success",
      });
    }

    await db.update(golfCourses)
      .set({ kickbackPercent: averageCommissionPercent })
      .where(eq(golfCourses.id, courseId));

    return {
      success: true,
      courseName,
      courseId,
      zestFacilityId,
      averageCommissionPercent,
      greenFeeCount: greenFeePricing.length,
      extraProductCount: extraProducts.length,
    };

  } catch (error) {
    console.error(`Error syncing Zest pricing for ${courseName}:`, error);
    
    const existingPricing = await db.select()
      .from(zestPricingData)
      .where(eq(zestPricingData.courseId, courseId))
      .limit(1);

    if (existingPricing.length > 0) {
      await db.update(zestPricingData)
        .set({
          syncStatus: "error",
          syncError: String(error),
          updatedAt: new Date(),
        })
        .where(eq(zestPricingData.courseId, courseId));
    }

    return {
      success: false,
      courseName,
      courseId,
      zestFacilityId,
      error: String(error),
    };
  }
}

export async function syncAllZestPricing(): Promise<PricingSyncSummary> {
  const zestProvider = await db.select()
    .from(teeTimeProviders)
    .where(ilike(teeTimeProviders.name, "%zest%"))
    .limit(1);

  if (zestProvider.length === 0) {
    return {
      totalCourses: 0,
      successCount: 0,
      errorCount: 0,
      results: [],
    };
  }

  const zestCourses = await db.select({
    courseId: golfCourses.id,
    courseName: golfCourses.name,
    providerCode: courseProviderLinks.providerCourseCode,
  })
    .from(courseProviderLinks)
    .innerJoin(golfCourses, eq(courseProviderLinks.courseId, golfCourses.id))
    .where(eq(courseProviderLinks.providerId, zestProvider[0].id));

  const results: SyncResult[] = [];

  for (const course of zestCourses) {
    if (!course.providerCode) continue;
    
    const facilityIdMatch = course.providerCode.match(/zest:(\d+)/);
    if (!facilityIdMatch) continue;
    
    const zestFacilityId = parseInt(facilityIdMatch[1]);
    
    const result = await syncZestPricingForCourse(
      course.courseId,
      zestFacilityId,
      course.courseName
    );
    
    results.push(result);
    
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  return {
    totalCourses: results.length,
    successCount: results.filter(r => r.success).length,
    errorCount: results.filter(r => !r.success).length,
    results,
  };
}

export async function getZestPricingData(courseId: string): Promise<ZestPricingJson | null> {
  const pricing = await db.select()
    .from(zestPricingData)
    .where(eq(zestPricingData.courseId, courseId))
    .limit(1);

  if (pricing.length === 0) return null;
  
  return pricing[0].pricingJson as unknown as ZestPricingJson;
}

export async function getAllZestPricingData(): Promise<Array<{
  courseId: string;
  courseName: string;
  zestFacilityId: number;
  pricingJson: ZestPricingJson;
  averageCommissionPercent: number | null;
  lastSyncedAt: Date | null;
  syncStatus: string;
}>> {
  const allPricing = await db.select({
    courseId: zestPricingData.courseId,
    courseName: golfCourses.name,
    zestFacilityId: zestPricingData.zestFacilityId,
    pricingJson: zestPricingData.pricingJson,
    averageCommissionPercent: zestPricingData.averageCommissionPercent,
    lastSyncedAt: zestPricingData.lastSyncedAt,
    syncStatus: zestPricingData.syncStatus,
  })
    .from(zestPricingData)
    .innerJoin(golfCourses, eq(zestPricingData.courseId, golfCourses.id));

  return allPricing.map(p => ({
    ...p,
    pricingJson: p.pricingJson as unknown as ZestPricingJson,
  }));
}
