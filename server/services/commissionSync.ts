import { db } from "../db";
import { golfCourses, courseOnboarding } from "@shared/schema";
import { eq } from "drizzle-orm";

export async function syncCommissionForCourse(
  courseId: string,
  commissionPercent: number
): Promise<void> {
  await db.update(golfCourses)
    .set({ kickbackPercent: commissionPercent })
    .where(eq(golfCourses.id, courseId));

  const existing = await db.select()
    .from(courseOnboarding)
    .where(eq(courseOnboarding.courseId, courseId))
    .limit(1);

  if (existing.length > 0) {
    await db.update(courseOnboarding)
      .set({ agreedCommission: commissionPercent, updatedAt: new Date() })
      .where(eq(courseOnboarding.courseId, courseId));
  } else {
    await db.insert(courseOnboarding).values({
      courseId,
      stage: "NOT_CONTACTED",
      agreedCommission: commissionPercent,
    });
  }
  
  console.log(`[CommissionSync] Synced ${commissionPercent}% for course ${courseId}`);
}
