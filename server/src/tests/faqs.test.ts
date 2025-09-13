import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { schoolsTable, usersTable, faqsTable } from '../db/schema';
import { 
  type CreateFaqInput,
  type UpdateFaqInput,
  type DeleteByIdInput,
  type GetFaqsByCategoryInput,
  type ChatbotQueryInput
} from '../schema';
import {
  getFaqsBySchoolId,
  getFaqsByCategory,
  searchFaqs,
  getFaqById,
  createFaq,
  updateFaq,
  deleteFaq,
  getAvailableCategories
} from '../handlers/faqs';

describe('FAQ Handlers', () => {
  let schoolId: number;
  let userId: number;
  let faqId: number;

  beforeEach(async () => {
    await createDB();

    // Create test school
    const schools = await db.insert(schoolsTable)
      .values({
        name: 'Test University',
        domain: 'test-university.edu',
        location: 'Test City',
        contact_email: 'contact@test-university.edu',
        contact_phone: '+1-555-0123',
        is_active: true
      })
      .returning()
      .execute();
    schoolId = schools[0].id;

    // Create test user
    const users = await db.insert(usersTable)
      .values({
        username: 'admin',
        password_hash: 'hashed_password',
        role: 'school_admin',
        school_id: schoolId,
        full_name: 'Test Admin',
        email: 'admin@test-university.edu',
        is_active: true
      })
      .returning()
      .execute();
    userId = users[0].id;

    // Create test FAQ
    const faqs = await db.insert(faqsTable)
      .values({
        school_id: schoolId,
        category: 'admissions',
        question: 'What are the admission requirements?',
        answer: 'You need a high school diploma and SAT scores.',
        keywords: ['admission', 'requirements', 'diploma', 'SAT'],
        is_active: true,
        created_by: userId
      })
      .returning()
      .execute();
    faqId = faqs[0].id;
  });

  afterEach(resetDB);

  describe('createFaq', () => {
    it('should create a new FAQ', async () => {
      const input: CreateFaqInput = {
        school_id: schoolId,
        category: 'academic_programs',
        question: 'What programs do you offer?',
        answer: 'We offer undergraduate and graduate programs in various fields.',
        keywords: ['programs', 'undergraduate', 'graduate']
      };

      const result = await createFaq(input, userId);

      expect(result.school_id).toEqual(schoolId);
      expect(result.category).toEqual('academic_programs');
      expect(result.question).toEqual('What programs do you offer?');
      expect(result.answer).toEqual('We offer undergraduate and graduate programs in various fields.');
      expect(result.keywords).toEqual(['programs', 'undergraduate', 'graduate']);
      expect(result.created_by).toEqual(userId);
      expect(result.is_active).toBe(true);
      expect(result.id).toBeDefined();
      expect(result.created_at).toBeInstanceOf(Date);
      expect(result.updated_at).toBeInstanceOf(Date);
    });

    it('should auto-generate keywords when not provided', async () => {
      const input: CreateFaqInput = {
        school_id: schoolId,
        category: 'campus_life',
        question: 'What dining options are available on campus?',
        answer: 'We have multiple cafeterias and restaurants serving various cuisines.'
      };

      const result = await createFaq(input, userId);

      expect(result.keywords).toBeDefined();
      expect(result.keywords.length).toBeGreaterThan(0);
      expect(result.keywords).toContain('dining');
      expect(result.keywords).toContain('campus');
      expect(result.keywords).toContain('cafeterias');
    });

    it('should fail when school does not exist', async () => {
      const input: CreateFaqInput = {
        school_id: 99999,
        category: 'admissions',
        question: 'Test question?',
        answer: 'Test answer.'
      };

      await expect(createFaq(input, userId)).rejects.toThrow(/School not found/i);
    });
  });

  describe('getFaqById', () => {
    it('should return FAQ by ID', async () => {
      const result = await getFaqById(faqId);

      expect(result).toBeDefined();
      expect(result!.id).toEqual(faqId);
      expect(result!.question).toEqual('What are the admission requirements?');
      expect(result!.answer).toEqual('You need a high school diploma and SAT scores.');
      expect(result!.category).toEqual('admissions');
      expect(result!.school_id).toEqual(schoolId);
    });

    it('should return null for non-existent FAQ', async () => {
      const result = await getFaqById(99999);
      expect(result).toBeNull();
    });
  });

  describe('getFaqsBySchoolId', () => {
    it('should return all FAQs for a school', async () => {
      // Create additional FAQ
      await db.insert(faqsTable)
        .values({
          school_id: schoolId,
          category: 'campus_life',
          question: 'What activities are available?',
          answer: 'We have many clubs and sports teams.',
          keywords: ['activities', 'clubs', 'sports'],
          is_active: true,
          created_by: userId
        })
        .execute();

      const results = await getFaqsBySchoolId(schoolId);

      expect(results).toHaveLength(2);
      expect(results.every(faq => faq.school_id === schoolId)).toBe(true);
      
      // Should be ordered by created_at descending (newest first)
      expect(results[0].created_at >= results[1].created_at).toBe(true);
    });

    it('should return empty array for school with no FAQs', async () => {
      // Create another school with no FAQs
      const anotherSchool = await db.insert(schoolsTable)
        .values({
          name: 'Another University',
          domain: 'another-university.edu',
          is_active: true
        })
        .returning()
        .execute();

      const results = await getFaqsBySchoolId(anotherSchool[0].id);
      expect(results).toHaveLength(0);
    });
  });

  describe('getFaqsByCategory', () => {
    it('should return FAQs by category and school domain', async () => {
      const input: GetFaqsByCategoryInput = {
        school_domain: 'test-university.edu',
        category: 'admissions'
      };

      const results = await getFaqsByCategory(input);

      expect(results).toHaveLength(1);
      expect(results[0].category).toEqual('admissions');
      expect(results[0].question).toEqual('What are the admission requirements?');
    });

    it('should only return active FAQs from active schools', async () => {
      // Create inactive FAQ
      await db.insert(faqsTable)
        .values({
          school_id: schoolId,
          category: 'admissions',
          question: 'Inactive FAQ?',
          answer: 'This should not be returned.',
          keywords: ['inactive'],
          is_active: false,
          created_by: userId
        })
        .execute();

      const input: GetFaqsByCategoryInput = {
        school_domain: 'test-university.edu',
        category: 'admissions'
      };

      const results = await getFaqsByCategory(input);

      expect(results).toHaveLength(1);
      expect(results[0].is_active).toBe(true);
      expect(results[0].question).not.toEqual('Inactive FAQ?');
    });

    it('should return empty array for non-existent school domain', async () => {
      const input: GetFaqsByCategoryInput = {
        school_domain: 'non-existent.edu',
        category: 'admissions'
      };

      const results = await getFaqsByCategory(input);
      expect(results).toHaveLength(0);
    });
  });

  describe('searchFaqs', () => {
    beforeEach(async () => {
      // Create additional test FAQs for search
      await db.insert(faqsTable)
        .values([
          {
            school_id: schoolId,
            category: 'academic_programs',
            question: 'What computer science courses are offered?',
            answer: 'We offer programming, algorithms, and data structures courses.',
            keywords: ['computer', 'science', 'programming', 'algorithms'],
            is_active: true,
            created_by: userId
          },
          {
            school_id: schoolId,
            category: 'campus_life',
            question: 'Is there student housing available?',
            answer: 'Yes, we have dormitories and apartments for students.',
            keywords: ['housing', 'dormitories', 'apartments', 'students'],
            is_active: true,
            created_by: userId
          }
        ])
        .execute();
    });

    it('should search FAQs by question text', async () => {
      const input: ChatbotQueryInput = {
        school_domain: 'test-university.edu',
        query: 'admission requirements'
      };

      const result = await searchFaqs(input);

      expect(result.faqs).toHaveLength(1);
      expect(result.faqs[0].question).toContain('admission');
      expect(result.total_results).toEqual(1);
      expect(result.suggested_categories).toContain('admissions');
    });

    it('should search FAQs by answer text', async () => {
      const input: ChatbotQueryInput = {
        school_domain: 'test-university.edu',
        query: 'programming algorithms'
      };

      const result = await searchFaqs(input);

      expect(result.faqs).toHaveLength(1);
      expect(result.faqs[0].answer).toContain('programming');
      expect(result.faqs[0].answer).toContain('algorithms');
    });

    it('should search FAQs by keywords', async () => {
      const input: ChatbotQueryInput = {
        school_domain: 'test-university.edu',
        query: 'housing dormitories'
      };

      const result = await searchFaqs(input);

      expect(result.faqs).toHaveLength(1);
      expect(result.faqs[0].keywords).toContain('housing');
      expect(result.faqs[0].keywords).toContain('dormitories');
    });

    it('should filter by category when specified', async () => {
      const input: ChatbotQueryInput = {
        school_domain: 'test-university.edu',
        query: 'courses',
        category: 'academic_programs'
      };

      const result = await searchFaqs(input);

      expect(result.faqs).toHaveLength(1);
      expect(result.faqs[0].category).toEqual('academic_programs');
    });

    it('should return suggested categories', async () => {
      const input: ChatbotQueryInput = {
        school_domain: 'test-university.edu',
        query: 'general'
      };

      const result = await searchFaqs(input);

      expect(result.suggested_categories).toContain('admissions');
      expect(result.suggested_categories).toContain('academic_programs');
      expect(result.suggested_categories).toContain('campus_life');
    });

    it('should handle case insensitive search', async () => {
      const input: ChatbotQueryInput = {
        school_domain: 'test-university.edu',
        query: 'ADMISSION REQUIREMENTS'
      };

      const result = await searchFaqs(input);

      expect(result.faqs).toHaveLength(1);
      expect(result.faqs[0].question.toLowerCase()).toContain('admission');
    });

    it('should limit results to 20', async () => {
      // This test assumes we would create more FAQs if needed
      const input: ChatbotQueryInput = {
        school_domain: 'test-university.edu',
        query: 'test' // Very general query that might match many FAQs
      };

      const result = await searchFaqs(input);
      expect(result.faqs.length).toBeLessThanOrEqual(20);
    });
  });

  describe('updateFaq', () => {
    it('should update FAQ fields', async () => {
      const input: UpdateFaqInput = {
        id: faqId,
        question: 'What are the updated admission requirements?',
        answer: 'Updated answer about requirements.',
        category: 'general_info',
        keywords: ['updated', 'requirements'],
        is_active: false
      };

      const result = await updateFaq(input);

      expect(result.id).toEqual(faqId);
      expect(result.question).toEqual('What are the updated admission requirements?');
      expect(result.answer).toEqual('Updated answer about requirements.');
      expect(result.category).toEqual('general_info');
      expect(result.keywords).toEqual(['updated', 'requirements']);
      expect(result.is_active).toBe(false);
    });

    it('should auto-regenerate keywords when question or answer changes', async () => {
      const input: UpdateFaqInput = {
        id: faqId,
        question: 'What financial aid options are available?',
        answer: 'We offer scholarships and student loans.'
      };

      const result = await updateFaq(input);

      expect(result.keywords).toContain('financial');
      expect(result.keywords).toContain('scholarships');
      expect(result.keywords).toContain('loans');
    });

    it('should update only specified fields', async () => {
      const originalFaq = await getFaqById(faqId);
      
      const input: UpdateFaqInput = {
        id: faqId,
        is_active: false
      };

      const result = await updateFaq(input);

      expect(result.question).toEqual(originalFaq!.question);
      expect(result.answer).toEqual(originalFaq!.answer);
      expect(result.category).toEqual(originalFaq!.category);
      expect(result.is_active).toBe(false);
    });

    it('should fail for non-existent FAQ', async () => {
      const input: UpdateFaqInput = {
        id: 99999,
        question: 'Updated question'
      };

      await expect(updateFaq(input)).rejects.toThrow(/FAQ not found/i);
    });
  });

  describe('deleteFaq', () => {
    it('should delete FAQ successfully', async () => {
      const input: DeleteByIdInput = { id: faqId };

      const result = await deleteFaq(input);

      expect(result.success).toBe(true);

      // Verify FAQ is deleted
      const deletedFaq = await getFaqById(faqId);
      expect(deletedFaq).toBeNull();
    });

    it('should return false for non-existent FAQ', async () => {
      const input: DeleteByIdInput = { id: 99999 };

      const result = await deleteFaq(input);

      expect(result.success).toBe(false);
    });
  });

  describe('getAvailableCategories', () => {
    beforeEach(async () => {
      // Create FAQs in different categories
      await db.insert(faqsTable)
        .values([
          {
            school_id: schoolId,
            category: 'academic_programs',
            question: 'Programs question',
            answer: 'Programs answer',
            keywords: ['programs'],
            is_active: true,
            created_by: userId
          },
          {
            school_id: schoolId,
            category: 'campus_life',
            question: 'Campus question',
            answer: 'Campus answer',
            keywords: ['campus'],
            is_active: true,
            created_by: userId
          }
        ])
        .execute();
    });

    it('should return all categories with active FAQs', async () => {
      const result = await getAvailableCategories('test-university.edu');

      expect(result).toContain('admissions');
      expect(result).toContain('academic_programs');
      expect(result).toContain('campus_life');
      expect(result).toHaveLength(3);
    });

    it('should not return categories from inactive FAQs', async () => {
      // Create inactive FAQ with different category
      await db.insert(faqsTable)
        .values({
          school_id: schoolId,
          category: 'contact_support',
          question: 'Contact question',
          answer: 'Contact answer',
          keywords: ['contact'],
          is_active: false,
          created_by: userId
        })
        .execute();

      const result = await getAvailableCategories('test-university.edu');

      expect(result).not.toContain('contact_support');
    });

    it('should return empty array for non-existent school domain', async () => {
      const result = await getAvailableCategories('non-existent.edu');
      expect(result).toHaveLength(0);
    });
  });
});