import { z } from 'zod';

// User roles enum
export const userRoleSchema = z.enum(['super_admin', 'school_admin']);
export type UserRole = z.infer<typeof userRoleSchema>;

// FAQ categories enum
export const faqCategorySchema = z.enum([
  'admissions',
  'academic_programs',
  'campus_life',
  'contact_support',
  'general_info'
]);
export type FaqCategory = z.infer<typeof faqCategorySchema>;

// School schema
export const schoolSchema = z.object({
  id: z.number(),
  name: z.string(),
  domain: z.string(), // Used for chatbot integration
  location: z.string().nullable(),
  contact_email: z.string().email().nullable(),
  contact_phone: z.string().nullable(),
  is_active: z.boolean(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type School = z.infer<typeof schoolSchema>;

// User schema
export const userSchema = z.object({
  id: z.number(),
  username: z.string(),
  password_hash: z.string(),
  role: userRoleSchema,
  school_id: z.number().nullable(), // null for super_admin
  full_name: z.string(),
  email: z.string().email(),
  is_active: z.boolean(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type User = z.infer<typeof userSchema>;

// FAQ schema
export const faqSchema = z.object({
  id: z.number(),
  school_id: z.number(),
  category: faqCategorySchema,
  question: z.string(),
  answer: z.string(),
  keywords: z.array(z.string()), // For search functionality
  is_active: z.boolean(),
  created_by: z.number(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type Faq = z.infer<typeof faqSchema>;

// Input schemas for creating entities
export const createSchoolInputSchema = z.object({
  name: z.string().min(1),
  domain: z.string().min(1),
  location: z.string().nullable().optional(),
  contact_email: z.string().email().nullable().optional(),
  contact_phone: z.string().nullable().optional()
});

export type CreateSchoolInput = z.infer<typeof createSchoolInputSchema>;

export const createUserInputSchema = z.object({
  username: z.string().min(3),
  password: z.string().min(6),
  role: userRoleSchema,
  school_id: z.number().nullable().optional(),
  full_name: z.string().min(1),
  email: z.string().email()
});

export type CreateUserInput = z.infer<typeof createUserInputSchema>;

export const createFaqInputSchema = z.object({
  school_id: z.number(),
  category: faqCategorySchema,
  question: z.string().min(1),
  answer: z.string().min(1),
  keywords: z.array(z.string()).optional()
});

export type CreateFaqInput = z.infer<typeof createFaqInputSchema>;

// Update schemas
export const updateSchoolInputSchema = z.object({
  id: z.number(),
  name: z.string().min(1).optional(),
  domain: z.string().min(1).optional(),
  location: z.string().nullable().optional(),
  contact_email: z.string().email().nullable().optional(),
  contact_phone: z.string().nullable().optional(),
  is_active: z.boolean().optional()
});

export type UpdateSchoolInput = z.infer<typeof updateSchoolInputSchema>;

export const updateUserInputSchema = z.object({
  id: z.number(),
  username: z.string().min(3).optional(),
  password: z.string().min(6).optional(),
  role: userRoleSchema.optional(),
  school_id: z.number().nullable().optional(),
  full_name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  is_active: z.boolean().optional()
});

export type UpdateUserInput = z.infer<typeof updateUserInputSchema>;

export const updateFaqInputSchema = z.object({
  id: z.number(),
  category: faqCategorySchema.optional(),
  question: z.string().min(1).optional(),
  answer: z.string().min(1).optional(),
  keywords: z.array(z.string()).optional(),
  is_active: z.boolean().optional()
});

export type UpdateFaqInput = z.infer<typeof updateFaqInputSchema>;

// Authentication schema
export const loginInputSchema = z.object({
  username: z.string(),
  password: z.string()
});

export type LoginInput = z.infer<typeof loginInputSchema>;

export const authUserSchema = z.object({
  id: z.number(),
  username: z.string(),
  role: userRoleSchema,
  school_id: z.number().nullable(),
  full_name: z.string(),
  email: z.string().email()
});

export type AuthUser = z.infer<typeof authUserSchema>;

// Chatbot query schemas
export const chatbotQueryInputSchema = z.object({
  school_domain: z.string(),
  query: z.string(),
  category: faqCategorySchema.optional()
});

export type ChatbotQueryInput = z.infer<typeof chatbotQueryInputSchema>;

export const chatbotResponseSchema = z.object({
  faqs: z.array(faqSchema),
  suggested_categories: z.array(faqCategorySchema),
  total_results: z.number()
});

export type ChatbotResponse = z.infer<typeof chatbotResponseSchema>;

// Get FAQs by category schema
export const getFaqsByCategoryInputSchema = z.object({
  school_domain: z.string(),
  category: faqCategorySchema
});

export type GetFaqsByCategoryInput = z.infer<typeof getFaqsByCategoryInputSchema>;

// Delete schemas
export const deleteByIdInputSchema = z.object({
  id: z.number()
});

export type DeleteByIdInput = z.infer<typeof deleteByIdInputSchema>;