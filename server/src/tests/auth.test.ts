import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, schoolsTable } from '../db/schema';
import { type LoginInput } from '../schema';
import { login, verifyAuth } from '../handlers/auth';
import { eq } from 'drizzle-orm';

describe('auth handlers', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  describe('login', () => {
    const testSchoolData = {
      name: 'Test University',
      domain: 'test-university.edu',
      location: 'Test City',
      contact_email: 'contact@test-university.edu',
      contact_phone: '555-0123'
    };

    const testPassword = 'testpassword123';
    let testPasswordHash: string;
    let testSchoolId: number;
    let testUserId: number;

    beforeEach(async () => {
      // Create test school first
      const schools = await db.insert(schoolsTable)
        .values(testSchoolData)
        .returning()
        .execute();
      testSchoolId = schools[0].id;

      // Hash password for test user
      testPasswordHash = await Bun.password.hash(testPassword);

      // Create test user
      const users = await db.insert(usersTable)
        .values({
          username: 'testuser',
          password_hash: testPasswordHash,
          role: 'school_admin',
          school_id: testSchoolId,
          full_name: 'Test User',
          email: 'test@example.com',
          is_active: true
        })
        .returning()
        .execute();
      testUserId = users[0].id;
    });

    const validLoginInput: LoginInput = {
      username: 'testuser',
      password: 'testpassword123'
    };

    it('should authenticate user with valid credentials', async () => {
      const result = await login(validLoginInput);

      expect(result.id).toEqual(testUserId);
      expect(result.username).toEqual('testuser');
      expect(result.role).toEqual('school_admin');
      expect(result.school_id).toEqual(testSchoolId);
      expect(result.full_name).toEqual('Test User');
      expect(result.email).toEqual('test@example.com');
      
      // Should not return password hash
      expect((result as any).password_hash).toBeUndefined();
    });

    it('should reject invalid username', async () => {
      const invalidInput: LoginInput = {
        username: 'nonexistent',
        password: 'testpassword123'
      };

      await expect(login(invalidInput)).rejects.toThrow(/invalid username or password/i);
    });

    it('should reject invalid password', async () => {
      const invalidInput: LoginInput = {
        username: 'testuser',
        password: 'wrongpassword'
      };

      await expect(login(invalidInput)).rejects.toThrow(/invalid username or password/i);
    });

    it('should reject disabled user account', async () => {
      // Disable the user account
      await db.update(usersTable)
        .set({ is_active: false })
        .where(eq(usersTable.id, testUserId))
        .execute();

      await expect(login(validLoginInput)).rejects.toThrow(/user account is disabled/i);
    });

    it('should authenticate super admin user', async () => {
      // Create super admin user (no school_id)
      const superAdminHash = await Bun.password.hash('adminpass123');
      const admins = await db.insert(usersTable)
        .values({
          username: 'superadmin',
          password_hash: superAdminHash,
          role: 'super_admin',
          school_id: null,
          full_name: 'Super Admin',
          email: 'admin@system.com',
          is_active: true
        })
        .returning()
        .execute();

      const adminLogin: LoginInput = {
        username: 'superadmin',
        password: 'adminpass123'
      };

      const result = await login(adminLogin);

      expect(result.id).toEqual(admins[0].id);
      expect(result.role).toEqual('super_admin');
      expect(result.school_id).toBeNull();
      expect(result.full_name).toEqual('Super Admin');
    });
  });

  describe('verifyAuth', () => {
    let testSchoolId: number;
    let testUserId: number;

    beforeEach(async () => {
      // Create test school
      const schools = await db.insert(schoolsTable)
        .values({
          name: 'Test University',
          domain: 'test-university.edu',
          location: 'Test City',
          contact_email: 'contact@test-university.edu',
          contact_phone: '555-0123'
        })
        .returning()
        .execute();
      testSchoolId = schools[0].id;

      // Create test user
      const users = await db.insert(usersTable)
        .values({
          username: 'testuser',
          password_hash: await Bun.password.hash('testpass'),
          role: 'school_admin',
          school_id: testSchoolId,
          full_name: 'Test User',
          email: 'test@example.com',
          is_active: true
        })
        .returning()
        .execute();
      testUserId = users[0].id;
    });

    it('should verify valid user token', async () => {
      const token = `user_${testUserId}`;
      const result = await verifyAuth(token);

      expect(result).not.toBeNull();
      expect(result!.id).toEqual(testUserId);
      expect(result!.username).toEqual('testuser');
      expect(result!.role).toEqual('school_admin');
      expect(result!.school_id).toEqual(testSchoolId);
      expect(result!.full_name).toEqual('Test User');
      expect(result!.email).toEqual('test@example.com');
    });

    it('should return null for empty token', async () => {
      const result = await verifyAuth('');
      expect(result).toBeNull();
    });

    it('should return null for invalid token format', async () => {
      const result = await verifyAuth('invalid-token-format');
      expect(result).toBeNull();
    });

    it('should return null for non-existent user ID', async () => {
      const token = 'user_99999';
      const result = await verifyAuth(token);
      expect(result).toBeNull();
    });

    it('should return null for non-numeric user ID', async () => {
      const token = 'user_abc';
      const result = await verifyAuth(token);
      expect(result).toBeNull();
    });

    it('should return null for disabled user', async () => {
      // Disable the user account
      await db.update(usersTable)
        .set({ is_active: false })
        .where(eq(usersTable.id, testUserId))
        .execute();

      const token = `user_${testUserId}`;
      const result = await verifyAuth(token);
      expect(result).toBeNull();
    });

    it('should verify super admin token', async () => {
      // Create super admin user
      const admins = await db.insert(usersTable)
        .values({
          username: 'superadmin',
          password_hash: await Bun.password.hash('adminpass'),
          role: 'super_admin',
          school_id: null,
          full_name: 'Super Admin',
          email: 'admin@system.com',
          is_active: true
        })
        .returning()
        .execute();

      const token = `user_${admins[0].id}`;
      const result = await verifyAuth(token);

      expect(result).not.toBeNull();
      expect(result!.role).toEqual('super_admin');
      expect(result!.school_id).toBeNull();
      expect(result!.full_name).toEqual('Super Admin');
    });
  });
});