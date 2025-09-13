import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { schoolsTable, usersTable, faqsTable } from '../db/schema';
import { type CreateSchoolInput, type UpdateSchoolInput, type DeleteByIdInput } from '../schema';
import { 
  getSchools, 
  getSchoolById, 
  getSchoolByDomain, 
  createSchool, 
  updateSchool, 
  deleteSchool 
} from '../handlers/schools';
import { eq } from 'drizzle-orm';

// Test inputs
const testSchoolInput: CreateSchoolInput = {
  name: 'Test University',
  domain: 'test-university.edu',
  location: 'Test City, TC',
  contact_email: 'contact@test-university.edu',
  contact_phone: '+1-555-0123'
};

const minimalSchoolInput: CreateSchoolInput = {
  name: 'Minimal School',
  domain: 'minimal.edu'
};

describe('School Handlers', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  describe('createSchool', () => {
    it('should create a school with all fields', async () => {
      const result = await createSchool(testSchoolInput);

      expect(result.name).toEqual('Test University');
      expect(result.domain).toEqual('test-university.edu');
      expect(result.location).toEqual('Test City, TC');
      expect(result.contact_email).toEqual('contact@test-university.edu');
      expect(result.contact_phone).toEqual('+1-555-0123');
      expect(result.is_active).toBe(true);
      expect(result.id).toBeDefined();
      expect(result.created_at).toBeInstanceOf(Date);
      expect(result.updated_at).toBeInstanceOf(Date);
    });

    it('should create a school with only required fields', async () => {
      const result = await createSchool(minimalSchoolInput);

      expect(result.name).toEqual('Minimal School');
      expect(result.domain).toEqual('minimal.edu');
      expect(result.location).toBeNull();
      expect(result.contact_email).toBeNull();
      expect(result.contact_phone).toBeNull();
      expect(result.is_active).toBe(true);
      expect(result.id).toBeDefined();
      expect(result.created_at).toBeInstanceOf(Date);
      expect(result.updated_at).toBeInstanceOf(Date);
    });

    it('should save school to database', async () => {
      const result = await createSchool(testSchoolInput);

      const schools = await db.select()
        .from(schoolsTable)
        .where(eq(schoolsTable.id, result.id))
        .execute();

      expect(schools).toHaveLength(1);
      expect(schools[0].name).toEqual('Test University');
      expect(schools[0].domain).toEqual('test-university.edu');
      expect(schools[0].location).toEqual('Test City, TC');
      expect(schools[0].contact_email).toEqual('contact@test-university.edu');
      expect(schools[0].contact_phone).toEqual('+1-555-0123');
      expect(schools[0].is_active).toBe(true);
    });

    it('should throw error for duplicate domain', async () => {
      await createSchool(testSchoolInput);
      
      expect(createSchool({
        name: 'Another School',
        domain: 'test-university.edu'
      })).rejects.toThrow(/duplicate key value/i);
    });
  });

  describe('getSchools', () => {
    it('should return empty array when no schools exist', async () => {
      const schools = await getSchools();
      expect(schools).toEqual([]);
    });

    it('should return all schools', async () => {
      const school1 = await createSchool(testSchoolInput);
      const school2 = await createSchool(minimalSchoolInput);

      const schools = await getSchools();
      
      expect(schools).toHaveLength(2);
      expect(schools.map(s => s.id).sort()).toEqual([school1.id, school2.id].sort());
      expect(schools.find(s => s.name === 'Test University')).toBeDefined();
      expect(schools.find(s => s.name === 'Minimal School')).toBeDefined();
    });

    it('should return schools with all fields', async () => {
      await createSchool(testSchoolInput);

      const schools = await getSchools();
      const school = schools[0];
      
      expect(school.id).toBeDefined();
      expect(school.name).toBeDefined();
      expect(school.domain).toBeDefined();
      expect(school.is_active).toBeDefined();
      expect(school.created_at).toBeInstanceOf(Date);
      expect(school.updated_at).toBeInstanceOf(Date);
    });
  });

  describe('getSchoolById', () => {
    it('should return null for non-existent school', async () => {
      const school = await getSchoolById(999);
      expect(school).toBeNull();
    });

    it('should return school by ID', async () => {
      const created = await createSchool(testSchoolInput);
      const school = await getSchoolById(created.id);

      expect(school).not.toBeNull();
      expect(school!.id).toEqual(created.id);
      expect(school!.name).toEqual('Test University');
      expect(school!.domain).toEqual('test-university.edu');
      expect(school!.location).toEqual('Test City, TC');
      expect(school!.contact_email).toEqual('contact@test-university.edu');
      expect(school!.contact_phone).toEqual('+1-555-0123');
    });
  });

  describe('getSchoolByDomain', () => {
    it('should return null for non-existent domain', async () => {
      const school = await getSchoolByDomain('nonexistent.edu');
      expect(school).toBeNull();
    });

    it('should return school by domain', async () => {
      const created = await createSchool(testSchoolInput);
      const school = await getSchoolByDomain('test-university.edu');

      expect(school).not.toBeNull();
      expect(school!.id).toEqual(created.id);
      expect(school!.name).toEqual('Test University');
      expect(school!.domain).toEqual('test-university.edu');
      expect(school!.location).toEqual('Test City, TC');
    });

    it('should be case-sensitive', async () => {
      await createSchool(testSchoolInput);
      const school = await getSchoolByDomain('TEST-UNIVERSITY.EDU');
      expect(school).toBeNull();
    });
  });

  describe('updateSchool', () => {
    let createdSchool: any;

    beforeEach(async () => {
      createdSchool = await createSchool(testSchoolInput);
    });

    it('should update school name', async () => {
      const updateInput: UpdateSchoolInput = {
        id: createdSchool.id,
        name: 'Updated University Name'
      };

      const result = await updateSchool(updateInput);

      expect(result.id).toEqual(createdSchool.id);
      expect(result.name).toEqual('Updated University Name');
      expect(result.domain).toEqual(createdSchool.domain); // Unchanged
      expect(result.location).toEqual(createdSchool.location); // Unchanged
      expect(result.updated_at).not.toEqual(createdSchool.updated_at);
    });

    it('should update multiple fields', async () => {
      const updateInput: UpdateSchoolInput = {
        id: createdSchool.id,
        name: 'New Name',
        domain: 'new-domain.edu',
        location: 'New Location',
        contact_email: 'new@email.com',
        contact_phone: '+1-999-9999',
        is_active: false
      };

      const result = await updateSchool(updateInput);

      expect(result.name).toEqual('New Name');
      expect(result.domain).toEqual('new-domain.edu');
      expect(result.location).toEqual('New Location');
      expect(result.contact_email).toEqual('new@email.com');
      expect(result.contact_phone).toEqual('+1-999-9999');
      expect(result.is_active).toBe(false);
    });

    it('should set nullable fields to null', async () => {
      const updateInput: UpdateSchoolInput = {
        id: createdSchool.id,
        location: null,
        contact_email: null,
        contact_phone: null
      };

      const result = await updateSchool(updateInput);

      expect(result.location).toBeNull();
      expect(result.contact_email).toBeNull();
      expect(result.contact_phone).toBeNull();
    });

    it('should throw error for non-existent school', async () => {
      const updateInput: UpdateSchoolInput = {
        id: 999,
        name: 'Should Fail'
      };

      expect(updateSchool(updateInput)).rejects.toThrow(/not found/i);
    });

    it('should update school in database', async () => {
      const updateInput: UpdateSchoolInput = {
        id: createdSchool.id,
        name: 'Database Updated Name'
      };

      await updateSchool(updateInput);

      const schools = await db.select()
        .from(schoolsTable)
        .where(eq(schoolsTable.id, createdSchool.id))
        .execute();

      expect(schools[0].name).toEqual('Database Updated Name');
    });
  });

  describe('deleteSchool', () => {
    let testSchool: any;

    beforeEach(async () => {
      testSchool = await createSchool(testSchoolInput);
    });

    it('should delete school', async () => {
      const deleteInput: DeleteByIdInput = { id: testSchool.id };
      const result = await deleteSchool(deleteInput);

      expect(result.success).toBe(true);

      // Verify school is deleted from database
      const schools = await db.select()
        .from(schoolsTable)
        .where(eq(schoolsTable.id, testSchool.id))
        .execute();

      expect(schools).toHaveLength(0);
    });

    it('should return false for non-existent school', async () => {
      const deleteInput: DeleteByIdInput = { id: 999 };
      const result = await deleteSchool(deleteInput);

      expect(result.success).toBe(false);
    });

    it('should cascade delete related users and FAQs', async () => {
      // Create user associated with school
      const userResult = await db.insert(usersTable)
        .values({
          username: 'testuser',
          password_hash: 'hashed_password',
          role: 'school_admin',
          school_id: testSchool.id,
          full_name: 'Test User',
          email: 'test@example.com'
        })
        .returning()
        .execute();

      const userId = userResult[0].id;

      // Create FAQ associated with school
      await db.insert(faqsTable)
        .values({
          school_id: testSchool.id,
          category: 'general_info',
          question: 'Test question?',
          answer: 'Test answer.',
          keywords: ['test'],
          created_by: userId
        })
        .execute();

      // Delete school
      const deleteInput: DeleteByIdInput = { id: testSchool.id };
      const result = await deleteSchool(deleteInput);

      expect(result.success).toBe(true);

      // Verify school is deleted
      const schools = await db.select()
        .from(schoolsTable)
        .where(eq(schoolsTable.id, testSchool.id))
        .execute();
      expect(schools).toHaveLength(0);

      // Verify related users are deleted
      const users = await db.select()
        .from(usersTable)
        .where(eq(usersTable.school_id, testSchool.id))
        .execute();
      expect(users).toHaveLength(0);

      // Verify related FAQs are deleted
      const faqs = await db.select()
        .from(faqsTable)
        .where(eq(faqsTable.school_id, testSchool.id))
        .execute();
      expect(faqs).toHaveLength(0);
    });
  });
});