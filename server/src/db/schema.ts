import { serial, text, pgTable, timestamp, boolean, integer, pgEnum, json } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Enums
export const userRoleEnum = pgEnum('user_role', ['super_admin', 'school_admin']);
export const faqCategoryEnum = pgEnum('faq_category', [
  'admissions',
  'academic_programs',
  'campus_life',
  'contact_support',
  'general_info'
]);

// Schools table
export const schoolsTable = pgTable('schools', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  domain: text('domain').notNull().unique(), // Unique domain for chatbot integration
  location: text('location'),
  contact_email: text('contact_email'),
  contact_phone: text('contact_phone'),
  is_active: boolean('is_active').notNull().default(true),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});

// Users table
export const usersTable = pgTable('users', {
  id: serial('id').primaryKey(),
  username: text('username').notNull().unique(),
  password_hash: text('password_hash').notNull(),
  role: userRoleEnum('role').notNull(),
  school_id: integer('school_id'), // References schools.id, nullable for super_admin
  full_name: text('full_name').notNull(),
  email: text('email').notNull(),
  is_active: boolean('is_active').notNull().default(true),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});

// FAQs table
export const faqsTable = pgTable('faqs', {
  id: serial('id').primaryKey(),
  school_id: integer('school_id').notNull(), // References schools.id
  category: faqCategoryEnum('category').notNull(),
  question: text('question').notNull(),
  answer: text('answer').notNull(),
  keywords: json('keywords').$type<string[]>().notNull().default([]), // JSON array for search keywords
  is_active: boolean('is_active').notNull().default(true),
  created_by: integer('created_by').notNull(), // References users.id
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});

// Relations
export const schoolsRelations = relations(schoolsTable, ({ many }) => ({
  users: many(usersTable),
  faqs: many(faqsTable),
}));

export const usersRelations = relations(usersTable, ({ one, many }) => ({
  school: one(schoolsTable, {
    fields: [usersTable.school_id],
    references: [schoolsTable.id],
  }),
  createdFaqs: many(faqsTable),
}));

export const faqsRelations = relations(faqsTable, ({ one }) => ({
  school: one(schoolsTable, {
    fields: [faqsTable.school_id],
    references: [schoolsTable.id],
  }),
  createdBy: one(usersTable, {
    fields: [faqsTable.created_by],
    references: [usersTable.id],
  }),
}));

// TypeScript types for the table schemas
export type School = typeof schoolsTable.$inferSelect;
export type NewSchool = typeof schoolsTable.$inferInsert;

export type User = typeof usersTable.$inferSelect;
export type NewUser = typeof usersTable.$inferInsert;

export type Faq = typeof faqsTable.$inferSelect;
export type NewFaq = typeof faqsTable.$inferInsert;

// Export all tables and relations for proper query building
export const tables = {
  schools: schoolsTable,
  users: usersTable,
  faqs: faqsTable,
};

export const tableRelations = {
  schoolsRelations,
  usersRelations,
  faqsRelations,
};