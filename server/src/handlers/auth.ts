import { db } from '../db';
import { usersTable } from '../db/schema';
import { type LoginInput, type AuthUser } from '../schema';
import { eq } from 'drizzle-orm';

// Authenticate user login
export async function login(input: LoginInput): Promise<AuthUser> {
  try {
    // Find user by username
    const users = await db.select()
      .from(usersTable)
      .where(eq(usersTable.username, input.username))
      .execute();

    if (users.length === 0) {
      throw new Error('Invalid username or password');
    }

    const user = users[0];

    // Check if user is active
    if (!user.is_active) {
      throw new Error('User account is disabled');
    }

    // Verify password using Bun's built-in password hashing
    const passwordMatches = await Bun.password.verify(input.password, user.password_hash);
    
    if (!passwordMatches) {
      throw new Error('Invalid username or password');
    }

    // Return authenticated user data (without password hash)
    return {
      id: user.id,
      username: user.username,
      role: user.role,
      school_id: user.school_id,
      full_name: user.full_name,
      email: user.email
    };
  } catch (error) {
    console.error('Login failed:', error);
    throw error;
  }
}

// Verify user session/token (for middleware)
export async function verifyAuth(token: string): Promise<AuthUser | null> {
  try {
    // For JWT verification, we would typically use jwt.verify()
    // This is a simplified implementation that extracts user ID from token
    // In a real implementation, you would:
    // 1. Verify JWT signature
    // 2. Check token expiration
    // 3. Extract user ID from token payload

    if (!token || token.length === 0) {
      return null;
    }

    // Simple token format: "user_<id>" for demonstration
    // In real implementation, this would be a JWT token
    if (!token.startsWith('user_')) {
      return null;
    }

    const userId = parseInt(token.replace('user_', ''), 10);
    if (isNaN(userId)) {
      return null;
    }

    // Fetch user from database
    const users = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .execute();

    if (users.length === 0) {
      return null;
    }

    const user = users[0];

    // Check if user is still active
    if (!user.is_active) {
      return null;
    }

    // Return user data for authenticated session
    return {
      id: user.id,
      username: user.username,
      role: user.role,
      school_id: user.school_id,
      full_name: user.full_name,
      email: user.email
    };
  } catch (error) {
    console.error('Auth verification failed:', error);
    return null;
  }
}