import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, schoolsTable } from '../db/schema';
import { type CreateUserInput, type UpdateUserInput, type DeleteByIdInput } from '../schema';
import { 
  getUsers, 
  getUsersBySchoolId, 
  getUserById, 
  createUser, 
  updateUser, 
  deleteUser 
} from '../handlers/users';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';

// Test data
const testSchool = {
  name: 'Test University',
  domain: 'test.edu',
  location: 'Test City',
  contact_email: 'contact@test.edu',
  contact_phone: '123-456-7890'
};

const testUserInput: CreateUserInput = {
  username: 'testuser',
  password: 'testpass123',
  role: 'school_admin',
  school_id: 1,
  full_name: 'Test User',
  email: 'test@example.com'
};

const superAdminInput: CreateUserInput = {
  username: 'superadmin',
  password: 'adminpass123',
  role: 'super_admin',
  school_id: null,
  full_name: 'Super Admin',
  email: 'admin@system.com'
};

describe('User Handlers', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  describe('createUser', () => {
    it('should create a school admin user', async () => {
      // Create prerequisite school
      const school = await db.insert(schoolsTable)
        .values(testSchool)
        .returning()
        .execute();

      const userInput = { ...testUserInput, school_id: school[0].id };
      const result = await createUser(userInput);

      expect(result.username).toEqual('testuser');
      expect(result.role).toEqual('school_admin');
      expect(result.school_id).toEqual(school[0].id);
      expect(result.full_name).toEqual('Test User');
      expect(result.email).toEqual('test@example.com');
      expect(result.is_active).toBe(true);
      expect(result.id).toBeDefined();
      expect(result.created_at).toBeInstanceOf(Date);
      expect(result.updated_at).toBeInstanceOf(Date);

      // Verify password is hashed
      expect(result.password_hash).not.toEqual('testpass123');
      const [hashedPassword, salt] = result.password_hash.split(':');
      const expectedHash = crypto.pbkdf2Sync('testpass123', salt, 1000, 64, 'sha512').toString('hex');
      expect(hashedPassword).toEqual(expectedHash);
    });

    it('should create a super admin user', async () => {
      const result = await createUser(superAdminInput);

      expect(result.username).toEqual('superadmin');
      expect(result.role).toEqual('super_admin');
      expect(result.school_id).toBeNull();
      expect(result.full_name).toEqual('Super Admin');
      expect(result.email).toEqual('admin@system.com');
    });

    it('should save user to database', async () => {
      // Create prerequisite school
      const school = await db.insert(schoolsTable)
        .values(testSchool)
        .returning()
        .execute();

      const userInput = { ...testUserInput, school_id: school[0].id };
      const result = await createUser(userInput);

      const users = await db.select()
        .from(usersTable)
        .where(eq(usersTable.id, result.id))
        .execute();

      expect(users).toHaveLength(1);
      expect(users[0].username).toEqual('testuser');
      expect(users[0].email).toEqual('test@example.com');
    });

    it('should throw error for non-existent school', async () => {
      const userInput = { ...testUserInput, school_id: 999 };
      
      await expect(createUser(userInput)).rejects.toThrow(/school not found/i);
    });
  });

  describe('getUsers', () => {
    it('should return all users', async () => {
      // Create prerequisite school
      const school = await db.insert(schoolsTable)
        .values(testSchool)
        .returning()
        .execute();

      // Create test users
      const userInput = { ...testUserInput, school_id: school[0].id };
      await createUser(userInput);
      await createUser(superAdminInput);

      const result = await getUsers();

      expect(result).toHaveLength(2);
      expect(result.some(u => u.username === 'testuser')).toBe(true);
      expect(result.some(u => u.username === 'superadmin')).toBe(true);
    });

    it('should return empty array when no users exist', async () => {
      const result = await getUsers();
      expect(result).toHaveLength(0);
    });
  });

  describe('getUsersBySchoolId', () => {
    it('should return users for specific school', async () => {
      // Create prerequisite schools
      const school1 = await db.insert(schoolsTable)
        .values(testSchool)
        .returning()
        .execute();

      const school2 = await db.insert(schoolsTable)
        .values({ ...testSchool, name: 'School 2', domain: 'school2.edu' })
        .returning()
        .execute();

      // Create users for different schools
      const user1Input = { ...testUserInput, school_id: school1[0].id };
      const user2Input = { ...testUserInput, username: 'user2', school_id: school2[0].id, email: 'user2@example.com' };
      
      await createUser(user1Input);
      await createUser(user2Input);
      await createUser(superAdminInput); // Super admin with null school_id

      const result = await getUsersBySchoolId(school1[0].id);

      expect(result).toHaveLength(1);
      expect(result[0].username).toEqual('testuser');
      expect(result[0].school_id).toEqual(school1[0].id);
    });

    it('should return empty array for school with no users', async () => {
      const school = await db.insert(schoolsTable)
        .values(testSchool)
        .returning()
        .execute();

      const result = await getUsersBySchoolId(school[0].id);
      expect(result).toHaveLength(0);
    });
  });

  describe('getUserById', () => {
    it('should return user by ID', async () => {
      // Create prerequisite school
      const school = await db.insert(schoolsTable)
        .values(testSchool)
        .returning()
        .execute();

      const userInput = { ...testUserInput, school_id: school[0].id };
      const createdUser = await createUser(userInput);

      const result = await getUserById(createdUser.id);

      expect(result).not.toBeNull();
      expect(result!.id).toEqual(createdUser.id);
      expect(result!.username).toEqual('testuser');
      expect(result!.email).toEqual('test@example.com');
    });

    it('should return null for non-existent user', async () => {
      const result = await getUserById(999);
      expect(result).toBeNull();
    });
  });

  describe('updateUser', () => {
    it('should update user fields', async () => {
      // Create prerequisite school
      const school = await db.insert(schoolsTable)
        .values(testSchool)
        .returning()
        .execute();

      const userInput = { ...testUserInput, school_id: school[0].id };
      const createdUser = await createUser(userInput);

      const updateInput: UpdateUserInput = {
        id: createdUser.id,
        username: 'updateduser',
        full_name: 'Updated User',
        email: 'updated@example.com',
        is_active: false
      };

      const result = await updateUser(updateInput);

      expect(result.id).toEqual(createdUser.id);
      expect(result.username).toEqual('updateduser');
      expect(result.full_name).toEqual('Updated User');
      expect(result.email).toEqual('updated@example.com');
      expect(result.is_active).toBe(false);
      expect(result.updated_at.getTime()).toBeGreaterThan(createdUser.updated_at.getTime());
    });

    it('should update password and hash it', async () => {
      const createdUser = await createUser(superAdminInput);

      const updateInput: UpdateUserInput = {
        id: createdUser.id,
        password: 'newpassword123'
      };

      const result = await updateUser(updateInput);

      // Verify new password is hashed and different from original
      expect(result.password_hash).not.toEqual(createdUser.password_hash);
      expect(result.password_hash).not.toEqual('newpassword123');
      
      const [hashedPassword, salt] = result.password_hash.split(':');
      const expectedHash = crypto.pbkdf2Sync('newpassword123', salt, 1000, 64, 'sha512').toString('hex');
      expect(hashedPassword).toEqual(expectedHash);
    });

    it('should update school association', async () => {
      // Create two schools
      const school1 = await db.insert(schoolsTable)
        .values(testSchool)
        .returning()
        .execute();

      const school2 = await db.insert(schoolsTable)
        .values({ ...testSchool, name: 'School 2', domain: 'school2.edu' })
        .returning()
        .execute();

      const userInput = { ...testUserInput, school_id: school1[0].id };
      const createdUser = await createUser(userInput);

      const updateInput: UpdateUserInput = {
        id: createdUser.id,
        school_id: school2[0].id
      };

      const result = await updateUser(updateInput);

      expect(result.school_id).toEqual(school2[0].id);
    });

    it('should throw error for non-existent user', async () => {
      const updateInput: UpdateUserInput = {
        id: 999,
        username: 'nonexistent'
      };

      await expect(updateUser(updateInput)).rejects.toThrow(/user not found/i);
    });

    it('should throw error for non-existent school', async () => {
      const createdUser = await createUser(superAdminInput);

      const updateInput: UpdateUserInput = {
        id: createdUser.id,
        school_id: 999
      };

      await expect(updateUser(updateInput)).rejects.toThrow(/school not found/i);
    });
  });

  describe('deleteUser', () => {
    it('should delete user successfully', async () => {
      const createdUser = await createUser(superAdminInput);

      const deleteInput: DeleteByIdInput = {
        id: createdUser.id
      };

      const result = await deleteUser(deleteInput);

      expect(result.success).toBe(true);

      // Verify user is deleted from database
      const deletedUser = await getUserById(createdUser.id);
      expect(deletedUser).toBeNull();
    });

    it('should throw error for non-existent user', async () => {
      const deleteInput: DeleteByIdInput = {
        id: 999
      };

      await expect(deleteUser(deleteInput)).rejects.toThrow(/user not found/i);
    });
  });
});