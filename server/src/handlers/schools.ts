import { db } from '../db';
import { schoolsTable, usersTable, faqsTable } from '../db/schema';
import { type CreateSchoolInput, type UpdateSchoolInput, type DeleteByIdInput, type School } from '../schema';
import { eq } from 'drizzle-orm';

// Get all schools (Super Admin only)
export async function getSchools(): Promise<School[]> {
  try {
    const results = await db.select()
      .from(schoolsTable)
      .execute();

    return results;
  } catch (error) {
    console.error('Failed to fetch schools:', error);
    throw error;
  }
}

// Get school by ID
export async function getSchoolById(id: number): Promise<School | null> {
  try {
    const results = await db.select()
      .from(schoolsTable)
      .where(eq(schoolsTable.id, id))
      .execute();

    return results[0] || null;
  } catch (error) {
    console.error('Failed to fetch school by ID:', error);
    throw error;
  }
}

// Get school by domain (for chatbot integration)
export async function getSchoolByDomain(domain: string): Promise<School | null> {
  try {
    const results = await db.select()
      .from(schoolsTable)
      .where(eq(schoolsTable.domain, domain))
      .execute();

    return results[0] || null;
  } catch (error) {
    console.error('Failed to fetch school by domain:', error);
    throw error;
  }
}

// Create new school (Super Admin only)
export async function createSchool(input: CreateSchoolInput): Promise<School> {
  try {
    const result = await db.insert(schoolsTable)
      .values({
        name: input.name,
        domain: input.domain,
        location: input.location || null,
        contact_email: input.contact_email || null,
        contact_phone: input.contact_phone || null
      })
      .returning()
      .execute();

    return result[0];
  } catch (error) {
    console.error('School creation failed:', error);
    throw error;
  }
}

// Update school (Super Admin only)
export async function updateSchool(input: UpdateSchoolInput): Promise<School> {
  try {
    // Build update object with only provided fields
    const updateData: any = { updated_at: new Date() };
    
    if (input.name !== undefined) updateData.name = input.name;
    if (input.domain !== undefined) updateData.domain = input.domain;
    if (input.location !== undefined) updateData.location = input.location;
    if (input.contact_email !== undefined) updateData.contact_email = input.contact_email;
    if (input.contact_phone !== undefined) updateData.contact_phone = input.contact_phone;
    if (input.is_active !== undefined) updateData.is_active = input.is_active;

    const result = await db.update(schoolsTable)
      .set(updateData)
      .where(eq(schoolsTable.id, input.id))
      .returning()
      .execute();

    if (result.length === 0) {
      throw new Error(`School with id ${input.id} not found`);
    }

    return result[0];
  } catch (error) {
    console.error('School update failed:', error);
    throw error;
  }
}

// Delete school (Super Admin only)
export async function deleteSchool(input: DeleteByIdInput): Promise<{ success: boolean }> {
  try {
    // Delete related FAQs first
    await db.delete(faqsTable)
      .where(eq(faqsTable.school_id, input.id))
      .execute();

    // Delete related users
    await db.delete(usersTable)
      .where(eq(usersTable.school_id, input.id))
      .execute();

    // Delete the school
    const result = await db.delete(schoolsTable)
      .where(eq(schoolsTable.id, input.id))
      .returning()
      .execute();

    return { success: result.length > 0 };
  } catch (error) {
    console.error('School deletion failed:', error);
    throw error;
  }
}