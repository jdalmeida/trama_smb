import { eq } from 'drizzle-orm';
import { getDb } from '@/src/db';
import { businesses, businessProfiles } from '@/src/db/schema';
import type { BusinessProfile } from '@/src/domain/business-profile';

/** Garante que o usuário (Clerk) tenha um negócio; cria se não existir. */
export async function getOrCreateBusiness(ownerUserId: string) {
  const db = getDb();
  const existing = await db
    .select()
    .from(businesses)
    .where(eq(businesses.ownerUserId, ownerUserId))
    .limit(1);
  if (existing.length > 0) return existing[0];

  const [created] = await db
    .insert(businesses)
    .values({ ownerUserId })
    .returning();
  return created;
}

/** Lê o Perfil do Negócio (linha de business_profiles) ou null. */
export async function getProfile(businessId: string) {
  const db = getDb();
  const rows = await db
    .select()
    .from(businessProfiles)
    .where(eq(businessProfiles.businessId, businessId))
    .limit(1);
  return rows[0] ?? null;
}

/** Cria ou atualiza o Perfil do Negócio (jsonb). */
export async function upsertProfile(
  businessId: string,
  profile: BusinessProfile,
  verified = false,
) {
  const db = getDb();
  const existing = await getProfile(businessId);
  if (existing) {
    const [updated] = await db
      .update(businessProfiles)
      .set({ profile, verified, updatedAt: new Date() })
      .where(eq(businessProfiles.id, existing.id))
      .returning();
    return updated;
  }
  const [created] = await db
    .insert(businessProfiles)
    .values({ businessId, profile, verified })
    .returning();
  return created;
}
