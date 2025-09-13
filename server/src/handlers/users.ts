import { db } from '../db';
import { usersTable, schoolsTable } from '../db/schema';
import { type CreateUserInput, type UpdateUserInput, type DeleteByIdInput, type User } from '../schema';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';

// Get all users (Super Admin only)
export async function getUsers(): Promise<User[]> {
  try {
    const results = await db.select()
      .from(usersTable)
      .execute();

    return results;
  } catch (error) {
    console.error('Failed to get users:', error);
    throw error;
  }
}

// Get users by school ID (Super Admin and School Admin for their school)
export async function getUsersBySchoolId(schoolId: number): Promise<User[]> {
  try {
    const results = await db.select()
      .from(usersTable)
      .where(eq(usersTable.school_id, schoolId))
      .execute();

    return results;
  } catch (error) {
    console.error('Failed to get users by school ID:', error);
    throw error;
  }
}

// Get user by ID
export async function getUserById(id: number): Promise<User | null> {
  try {
    const results = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, id))
      .execute();

    return results.length > 0 ? results[0] : null;
  } catch (error) {
    console.error('Failed to get user by ID:', error);
    throw error;
  }
}

// Create new user (Super Admin only)
export async function createUser(input: CreateUserInput): Promise<User> {
  try {
    // Verify school exists if school_id is provided
    if (input.school_id) {
      const school = await db.select()
        .from(schoolsTable)
        .where(eq(schoolsTable.id, input.school_id))
        .execute();
      
      if (school.length === 0) {
        throw new Error('School not found');
      }
    }

    // Hash password
    const salt = crypto.randomBytes(16).toString('hex');
    const password_hash = crypto.pbkdf2Sync(input.password, salt, 1000, 64, 'sha512').toString('hex') + ':' + salt;

    const result = await db.insert(usersTable)
      .values({
        username: input.username,
        password_hash,
        role: input.role,
        school_id: input.school_id || null,
        full_name: input.full_name,
        email: input.email
      })
      .returning()
      .execute();

    return result[0];
  } catch (error) {
    console.error('User creation failed:', error);
    throw error;
  }
}

// Update user (Super Admin only)
export async function updateUser(input: UpdateUserInput): Promise<User> {
  try {
    // Verify user exists
    const existingUser = await getUserById(input.id);
    if (!existingUser) {
      throw new Error('User not found');
    }

    // Verify school exists if school_id is being updated
    if (input.school_id !== undefined) {
      if (input.school_id !== null) {
        const school = await db.select()
          .from(schoolsTable)
          .where(eq(schoolsTable.id, input.school_id))
          .execute();
        
        if (school.length === 0) {
          throw new Error('School not found');
        }
      }
    }

    // Prepare update values
    const updateValues: any = {
      updated_at: new Date()
    };

    if (input.username !== undefined) {
      updateValues.username = input.username;
    }
    
    if (input.password !== undefined) {
      const salt = crypto.randomBytes(16).toString('hex');
      updateValues.password_hash = crypto.pbkdf2Sync(input.password, salt, 1000, 64, 'sha512').toString('hex') + ':' + salt;
    }
    
    if (input.role !== undefined) {
      updateValues.role = input.role;
    }
    
    if (input.school_id !== undefined) {
      updateValues.school_id = input.school_id;
    }
    
    if (input.full_name !== undefined) {
      updateValues.full_name = input.full_name;
    }
    
    if (input.email !== undefined) {
      updateValues.email = input.email;
    }
    
    if (input.is_active !== undefined) {
      updateValues.is_active = input.is_active;
    }

    const result = await db.update(usersTable)
      .set(updateValues)
      .where(eq(usersTable.id, input.id))
      .returning()
      .execute();

    return result[0];
  } catch (error) {
    console.error('User update failed:', error);
    throw error;
  }
}

// Delete user (Super Admin only)
export async function deleteUser(input: DeleteByIdInput): Promise<{ success: boolean }> {
  try {
    // Verify user exists
    const existingUser = await getUserById(input.id);
    if (!existingUser) {
      throw new Error('User not found');
    }

    await db.delete(usersTable)
      .where(eq(usersTable.id, input.id))
      .execute();

    return { success: true };
  } catch (error) {
    console.error('User deletion failed:', error);
    throw error;
  }
}