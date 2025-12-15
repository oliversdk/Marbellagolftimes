import { db } from "../db";
import { zestPricingData, golfCourses, courseProviderLinks, teeTimeProviders, courseOnboarding, courseContacts } from "@shared/schema";
import type { ZestPricingJson } from "@shared/schema";
import { eq, and, ilike } from "drizzle-orm";
import { getZestGolfService, ZestTeeTimeResponse, ZestProduct, ZestFacilityDetails, ZestContact } from "./zestGolf";

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

// Calculate commission percent based on selling price (price) and net rate
// Commission = (price - netRate) / price * 100
// This matches what Zest Portal shows as "Sales Commission"
function calculateCommissionPercent(netRate: number, sellingPrice: number): number {
  if (sellingPrice <= 0) return 0;
  return ((sellingPrice - netRate) / sellingPrice) * 100;
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
        const sellingPrice = pricing.price?.amount || 0; // This is what we sell at (Selling Rate)
        
        greenFeePricing.push({
          players,
          price: pricing.price,
          netRate: pricing.netRate || { amount: 0, currency: "EUR" },
          publicRate: pricing.publicRate || pricing.price,
          commissionPercent: calculateCommissionPercent(netRate, sellingPrice),
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
            const sellingPrice = product.price?.amount || 0; // This is what we sell at (Selling Rate)
            
            extraProducts.push({
              mid: product.mid,
              name: product.name,
              category: product.category,
              holes: 18,
              price: product.price || { amount: 0, currency: "EUR" },
              netRate: product.netRate || { amount: 0, currency: "EUR" },
              publicRate: product.publicRate || product.price || { amount: 0, currency: "EUR" },
              commissionPercent: calculateCommissionPercent(netRate, sellingPrice),
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

interface ZestContactInfo {
  role: string;
  name: string | null;
  email: string | null;
  phone: string | null;
}

interface ContactSyncResult {
  success: boolean;
  courseName: string;
  courseId: string;
  zestFacilityId: number;
  contactPerson?: string;
  contactEmail?: string;
  contactPhone?: string;
  contacts?: ZestContactInfo[];
  error?: string;
}

interface ContactSyncSummary {
  totalCourses: number;
  successCount: number;
  errorCount: number;
  results: ContactSyncResult[];
}

function extractContactName(contact: ZestContact | undefined): string | null {
  if (!contact) return null;
  if (contact.name) return contact.name;
  if (contact.firstName || contact.lastName) {
    return [contact.firstName, contact.lastName].filter(Boolean).join(" ");
  }
  return null;
}

async function upsertZestContact(
  courseId: string,
  role: string,
  name: string | null,
  email: string | null,
  phone: string | null
): Promise<void> {
  if (!name && !email && !phone) return;

  const existingContact = await db.select()
    .from(courseContacts)
    .where(and(
      eq(courseContacts.courseId, courseId),
      eq(courseContacts.role, role)
    ))
    .limit(1);

  if (existingContact.length > 0) {
    await db.update(courseContacts)
      .set({
        name: name || existingContact[0].name,
        email: email || existingContact[0].email,
        phone: phone || existingContact[0].phone,
      })
      .where(eq(courseContacts.id, existingContact[0].id));
  } else if (name) {
    await db.insert(courseContacts).values({
      courseId,
      role,
      name,
      email,
      phone,
      isPrimary: role === "Zest Primary" ? "true" : "false",
      notes: "Synced from Zest Golf",
    });
  }
}

export async function syncZestContactForCourse(
  courseId: string,
  zestFacilityId: number,
  courseName: string
): Promise<ContactSyncResult> {
  try {
    const zestService = getZestGolfService();
    
    const facilityDetails: ZestFacilityDetails = await zestService.getFacilityDetails(zestFacilityId);
    
    // Debug logging to see what Zest API returns - log ALL fields
    console.log(`[Zest Contact Sync] Facility ${zestFacilityId} (${courseName}) FULL API response:`, JSON.stringify(facilityDetails, null, 2));
    
    const contacts: ZestContactInfo[] = [];
    
    // Extract Primary Contact
    const primaryName = extractContactName(facilityDetails.primaryContact);
    const primaryEmail = facilityDetails.primaryContact?.email || null;
    const primaryPhone = facilityDetails.primaryContact?.phoneNumber || null;
    if (primaryName || primaryEmail || primaryPhone) {
      contacts.push({ role: "Zest Primary", name: primaryName, email: primaryEmail, phone: primaryPhone });
      await upsertZestContact(courseId, "Zest Primary", primaryName, primaryEmail, primaryPhone);
    }
    
    // Extract Billing Contact
    const billingName = extractContactName(facilityDetails.billingContact);
    const billingEmail = facilityDetails.billingContact?.email || null;
    const billingPhone = facilityDetails.billingContact?.phoneNumber || null;
    if (billingName || billingEmail || billingPhone) {
      contacts.push({ role: "Zest Billing", name: billingName, email: billingEmail, phone: billingPhone });
      await upsertZestContact(courseId, "Zest Billing", billingName, billingEmail, billingPhone);
    }
    
    // Extract Reservations Contact
    const reservationsName = extractContactName(facilityDetails.reservationsContact);
    const reservationsEmail = facilityDetails.reservationsContact?.email || null;
    const reservationsPhone = facilityDetails.reservationsContact?.phoneNumber || null;
    if (reservationsName || reservationsEmail || reservationsPhone) {
      contacts.push({ role: "Zest Reservations", name: reservationsName, email: reservationsEmail, phone: reservationsPhone });
      await upsertZestContact(courseId, "Zest Reservations", reservationsName, reservationsEmail, reservationsPhone);
    }

    // Fall back to facility-level contact info if no contacts found
    if (contacts.length === 0 && (facilityDetails.email || facilityDetails.phoneNumber)) {
      contacts.push({ 
        role: "Zest Facility", 
        name: null, 
        email: facilityDetails.email || null, 
        phone: facilityDetails.phoneNumber || null 
      });
    }

    if (contacts.length === 0) {
      return {
        success: false,
        courseName,
        courseId,
        zestFacilityId,
        error: "No contact information available from Zest",
      };
    }

    // Use primary contact (or first available) for courseOnboarding
    const mainContact = contacts.find(c => c.role === "Zest Primary") || contacts[0];
    const contactPerson = mainContact.name;
    const contactEmail = mainContact.email;
    const contactPhone = mainContact.phone;

    const existingOnboarding = await db.select()
      .from(courseOnboarding)
      .where(eq(courseOnboarding.courseId, courseId))
      .limit(1);

    if (existingOnboarding.length > 0) {
      await db.update(courseOnboarding)
        .set({
          contactPerson: contactPerson || existingOnboarding[0].contactPerson,
          contactEmail: contactEmail || existingOnboarding[0].contactEmail,
          contactPhone: contactPhone || existingOnboarding[0].contactPhone,
          updatedAt: new Date(),
        })
        .where(eq(courseOnboarding.courseId, courseId));
    } else {
      await db.insert(courseOnboarding).values({
        courseId,
        stage: "NOT_CONTACTED",
        contactPerson,
        contactEmail,
        contactPhone,
      });
    }

    return {
      success: true,
      courseName,
      courseId,
      zestFacilityId,
      contactPerson: contactPerson || undefined,
      contactEmail: contactEmail || undefined,
      contactPhone: contactPhone || undefined,
      contacts,
    };

  } catch (error) {
    console.error(`Error syncing Zest contact for ${courseName}:`, error);
    return {
      success: false,
      courseName,
      courseId,
      zestFacilityId,
      error: String(error),
    };
  }
}

export async function syncAllZestContacts(): Promise<ContactSyncSummary> {
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

  const results: ContactSyncResult[] = [];

  for (const course of zestCourses) {
    if (!course.providerCode) continue;
    
    const facilityIdMatch = course.providerCode.match(/zest:(\d+)/);
    if (!facilityIdMatch) continue;
    
    const zestFacilityId = parseInt(facilityIdMatch[1]);
    
    const result = await syncZestContactForCourse(
      course.courseId,
      zestFacilityId,
      course.courseName
    );
    
    results.push(result);
    
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  return {
    totalCourses: results.length,
    successCount: results.filter(r => r.success).length,
    errorCount: results.filter(r => !r.success).length,
    results,
  };
}
