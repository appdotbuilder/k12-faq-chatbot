import { db } from '../db';
import { faqsTable, schoolsTable } from '../db/schema';
import { 
    type CreateFaqInput, 
    type UpdateFaqInput, 
    type DeleteByIdInput, 
    type GetFaqsByCategoryInput,
    type ChatbotQueryInput,
    type ChatbotResponse,
    type Faq,
    type FaqCategory 
} from '../schema';
import { eq, and, like, ilike, desc, sql } from 'drizzle-orm';

// Helper function to extract keywords from text
function generateKeywords(question: string, answer: string): string[] {
  const text = `${question} ${answer}`.toLowerCase();
  const words = text.match(/\b\w{3,}\b/g) || [];
  return [...new Set(words)];
}

// Get all FAQs for a school (School Admin and Super Admin)
export async function getFaqsBySchoolId(schoolId: number): Promise<Faq[]> {
  try {
    const results = await db.select()
      .from(faqsTable)
      .where(eq(faqsTable.school_id, schoolId))
      .orderBy(desc(faqsTable.created_at))
      .execute();

    return results;
  } catch (error) {
    console.error('Failed to get FAQs by school ID:', error);
    throw error;
  }
}

// Get FAQs by category for chatbot (Public - no auth required)
export async function getFaqsByCategory(input: GetFaqsByCategoryInput): Promise<Faq[]> {
  try {
    const results = await db.select({
      id: faqsTable.id,
      school_id: faqsTable.school_id,
      category: faqsTable.category,
      question: faqsTable.question,
      answer: faqsTable.answer,
      keywords: faqsTable.keywords,
      is_active: faqsTable.is_active,
      created_by: faqsTable.created_by,
      created_at: faqsTable.created_at,
      updated_at: faqsTable.updated_at
    })
      .from(faqsTable)
      .innerJoin(schoolsTable, eq(faqsTable.school_id, schoolsTable.id))
      .where(and(
        eq(schoolsTable.domain, input.school_domain),
        eq(faqsTable.category, input.category),
        eq(faqsTable.is_active, true),
        eq(schoolsTable.is_active, true)
      ))
      .orderBy(desc(faqsTable.created_at))
      .execute();

    return results;
  } catch (error) {
    console.error('Failed to get FAQs by category:', error);
    throw error;
  }
}

// Search FAQs for chatbot with typo tolerance (Public - no auth required)
export async function searchFaqs(input: ChatbotQueryInput): Promise<ChatbotResponse> {
  try {
    const searchTerms = input.query.toLowerCase().split(/\s+/).filter(term => term.length > 2);
    
    let query = db.select({
      id: faqsTable.id,
      school_id: faqsTable.school_id,
      category: faqsTable.category,
      question: faqsTable.question,
      answer: faqsTable.answer,
      keywords: faqsTable.keywords,
      is_active: faqsTable.is_active,
      created_by: faqsTable.created_by,
      created_at: faqsTable.created_at,
      updated_at: faqsTable.updated_at
    })
      .from(faqsTable)
      .innerJoin(schoolsTable, eq(faqsTable.school_id, schoolsTable.id));

    const conditions = [
      eq(schoolsTable.domain, input.school_domain),
      eq(faqsTable.is_active, true),
      eq(schoolsTable.is_active, true)
    ];

    // Add category filter if specified
    if (input.category) {
      conditions.push(eq(faqsTable.category, input.category));
    }

    // Build search conditions for questions, answers, and keywords
    if (searchTerms.length > 0) {
      const searchConditions = searchTerms.map(term => 
        sql`(${faqsTable.question} ILIKE ${'%' + term + '%'} OR ${faqsTable.answer} ILIKE ${'%' + term + '%'} OR ${faqsTable.keywords}::text ILIKE ${'%' + term + '%'})`
      );
      
      // At least one search term should match
      if (searchConditions.length === 1) {
        conditions.push(searchConditions[0]);
      } else {
        conditions.push(sql`(${sql.join(searchConditions, sql` OR `)})`);
      }
    }

    const faqs = await query
      .where(and(...conditions))
      .orderBy(desc(faqsTable.created_at))
      .limit(20)
      .execute();

    // Get suggested categories - categories that have active FAQs for this school
    const categoriesResult = await db.select({
      category: faqsTable.category
    })
      .from(faqsTable)
      .innerJoin(schoolsTable, eq(faqsTable.school_id, schoolsTable.id))
      .where(and(
        eq(schoolsTable.domain, input.school_domain),
        eq(faqsTable.is_active, true),
        eq(schoolsTable.is_active, true)
      ))
      .groupBy(faqsTable.category)
      .execute();

    const suggested_categories = categoriesResult.map(result => result.category);

    return {
      faqs,
      suggested_categories,
      total_results: faqs.length
    };
  } catch (error) {
    console.error('Failed to search FAQs:', error);
    throw error;
  }
}

// Get FAQ by ID
export async function getFaqById(id: number): Promise<Faq | null> {
  try {
    const results = await db.select()
      .from(faqsTable)
      .where(eq(faqsTable.id, id))
      .execute();

    return results[0] || null;
  } catch (error) {
    console.error('Failed to get FAQ by ID:', error);
    throw error;
  }
}

// Create new FAQ (School Admin and Super Admin)
export async function createFaq(input: CreateFaqInput, createdBy: number): Promise<Faq> {
  try {
    // Verify school exists
    const school = await db.select()
      .from(schoolsTable)
      .where(eq(schoolsTable.id, input.school_id))
      .execute();

    if (school.length === 0) {
      throw new Error('School not found');
    }

    // Generate keywords if not provided
    const keywords = input.keywords && input.keywords.length > 0 
      ? input.keywords 
      : generateKeywords(input.question, input.answer);

    const results = await db.insert(faqsTable)
      .values({
        school_id: input.school_id,
        category: input.category,
        question: input.question,
        answer: input.answer,
        keywords,
        created_by: createdBy,
        is_active: true
      })
      .returning()
      .execute();

    return results[0];
  } catch (error) {
    console.error('FAQ creation failed:', error);
    throw error;
  }
}

// Update FAQ (School Admin and Super Admin)
export async function updateFaq(input: UpdateFaqInput): Promise<Faq> {
  try {
    // Get current FAQ to check if it exists
    const currentFaq = await getFaqById(input.id);
    if (!currentFaq) {
      throw new Error('FAQ not found');
    }

    // Prepare update values
    const updateValues: Partial<typeof faqsTable.$inferInsert> = {};

    if (input.category !== undefined) {
      updateValues.category = input.category;
    }
    if (input.question !== undefined) {
      updateValues.question = input.question;
    }
    if (input.answer !== undefined) {
      updateValues.answer = input.answer;
    }
    if (input.is_active !== undefined) {
      updateValues.is_active = input.is_active;
    }

    // Regenerate keywords if question or answer changed, or if keywords explicitly provided
    if (input.keywords !== undefined) {
      updateValues.keywords = input.keywords;
    } else if (input.question !== undefined || input.answer !== undefined) {
      const question = input.question || currentFaq.question;
      const answer = input.answer || currentFaq.answer;
      updateValues.keywords = generateKeywords(question, answer);
    }

    const results = await db.update(faqsTable)
      .set(updateValues)
      .where(eq(faqsTable.id, input.id))
      .returning()
      .execute();

    return results[0];
  } catch (error) {
    console.error('FAQ update failed:', error);
    throw error;
  }
}

// Delete FAQ (School Admin and Super Admin)
export async function deleteFaq(input: DeleteByIdInput): Promise<{ success: boolean }> {
  try {
    const results = await db.delete(faqsTable)
      .where(eq(faqsTable.id, input.id))
      .returning()
      .execute();

    return { success: results.length > 0 };
  } catch (error) {
    console.error('FAQ deletion failed:', error);
    throw error;
  }
}

// Get all available categories for a school (for chatbot menu)
export async function getAvailableCategories(schoolDomain: string): Promise<FaqCategory[]> {
  try {
    const results = await db.select({
      category: faqsTable.category
    })
      .from(faqsTable)
      .innerJoin(schoolsTable, eq(faqsTable.school_id, schoolsTable.id))
      .where(and(
        eq(schoolsTable.domain, schoolDomain),
        eq(faqsTable.is_active, true),
        eq(schoolsTable.is_active, true)
      ))
      .groupBy(faqsTable.category)
      .execute();

    return results.map(result => result.category);
  } catch (error) {
    console.error('Failed to get available categories:', error);
    throw error;
  }
}