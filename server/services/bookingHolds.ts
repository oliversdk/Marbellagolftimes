import { db } from "../db";
import { bookingHolds } from "@shared/schema";
import { eq, and, lt } from "drizzle-orm";

export interface CreateHoldParams {
  sessionId: string;
  courseId: string;
  teeTime: Date;
  players: number;
  ttlMinutes?: number;
}

export async function createHold({
  sessionId,
  courseId,
  teeTime,
  players,
  ttlMinutes = 15
}: CreateHoldParams) {
  const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);
  
  const [hold] = await db.insert(bookingHolds).values({
    sessionId,
    courseId,
    teeTime,
    players,
    expiresAt,
  }).returning();
  
  console.log(`[BookingHolds] Created hold ${hold.id} for session ${sessionId}, course ${courseId}, expires at ${expiresAt.toISOString()}`);
  return hold;
}

export async function getHold(sessionId: string, courseId: string, teeTime: Date) {
  const now = new Date();
  
  const [hold] = await db.select()
    .from(bookingHolds)
    .where(
      and(
        eq(bookingHolds.sessionId, sessionId),
        eq(bookingHolds.courseId, courseId),
        eq(bookingHolds.teeTime, teeTime)
      )
    )
    .limit(1);
  
  if (!hold) {
    return null;
  }
  
  if (hold.expiresAt < now) {
    console.log(`[BookingHolds] Hold ${hold.id} has expired`);
    return null;
  }
  
  return hold;
}

export async function getHoldBySessionId(sessionId: string) {
  const now = new Date();
  
  const holds = await db.select()
    .from(bookingHolds)
    .where(eq(bookingHolds.sessionId, sessionId));
  
  const activeHolds = holds.filter(hold => hold.expiresAt >= now);
  return activeHolds;
}

export async function releaseHold(sessionId: string, courseId: string, teeTime: Date) {
  const result = await db.delete(bookingHolds)
    .where(
      and(
        eq(bookingHolds.sessionId, sessionId),
        eq(bookingHolds.courseId, courseId),
        eq(bookingHolds.teeTime, teeTime)
      )
    )
    .returning();
  
  if (result.length > 0) {
    console.log(`[BookingHolds] Released hold for session ${sessionId}, course ${courseId}`);
  }
  
  return result.length > 0;
}

export async function releaseHoldBySessionId(sessionId: string) {
  const result = await db.delete(bookingHolds)
    .where(eq(bookingHolds.sessionId, sessionId))
    .returning();
  
  if (result.length > 0) {
    console.log(`[BookingHolds] Released ${result.length} holds for session ${sessionId}`);
  }
  
  return result.length;
}

export async function cleanupExpiredHolds() {
  const now = new Date();
  
  const result = await db.delete(bookingHolds)
    .where(lt(bookingHolds.expiresAt, now))
    .returning();
  
  if (result.length > 0) {
    console.log(`[BookingHolds] Cleaned up ${result.length} expired holds`);
  }
  
  return result.length;
}

export async function updateHoldExpiry(sessionId: string, courseId: string, teeTime: Date, ttlMinutes: number = 15) {
  const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);
  
  const [updated] = await db.update(bookingHolds)
    .set({ expiresAt })
    .where(
      and(
        eq(bookingHolds.sessionId, sessionId),
        eq(bookingHolds.courseId, courseId),
        eq(bookingHolds.teeTime, teeTime)
      )
    )
    .returning();
  
  if (updated) {
    console.log(`[BookingHolds] Extended hold ${updated.id} expiry to ${expiresAt.toISOString()}`);
  }
  
  return updated;
}
