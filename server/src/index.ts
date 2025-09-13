import { initTRPC } from '@trpc/server';
import { createHTTPServer } from '@trpc/server/adapters/standalone';
import 'dotenv/config';
import cors from 'cors';
import superjson from 'superjson';
import { z } from 'zod';

// Import schemas
import {
  loginInputSchema,
  createSchoolInputSchema,
  updateSchoolInputSchema,
  deleteByIdInputSchema,
  createUserInputSchema,
  updateUserInputSchema,
  createFaqInputSchema,
  updateFaqInputSchema,
  getFaqsByCategoryInputSchema,
  chatbotQueryInputSchema
} from './schema';

// Import handlers
// Authentication handlers
import { login, verifyAuth } from './handlers/auth';

// School management handlers
import { 
  getSchools, 
  getSchoolById, 
  getSchoolByDomain, 
  createSchool, 
  updateSchool, 
  deleteSchool 
} from './handlers/schools';

// User management handlers
import { 
  getUsers, 
  getUsersBySchoolId, 
  getUserById, 
  createUser, 
  updateUser, 
  deleteUser 
} from './handlers/users';

// FAQ management handlers
import {
  getFaqsBySchoolId,
  getFaqsByCategory,
  searchFaqs,
  getFaqById,
  createFaq,
  updateFaq,
  deleteFaq,
  getAvailableCategories
} from './handlers/faqs';

const t = initTRPC.create({
  transformer: superjson,
});

const publicProcedure = t.procedure;
const router = t.router;

// Main application router
const appRouter = router({
  // Health check
  healthcheck: publicProcedure.query(() => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }),

  // Authentication routes
  auth: router({
    login: publicProcedure
      .input(loginInputSchema)
      .mutation(({ input }) => login(input)),
  }),

  // School management routes (Super Admin only)
  schools: router({
    getAll: publicProcedure
      .query(() => getSchools()),
    
    getById: publicProcedure
      .input(deleteByIdInputSchema) // Reuse schema for ID input
      .query(({ input }) => getSchoolById(input.id)),
    
    getByDomain: publicProcedure
      .input(z.object({ domain: z.string() }))
      .query(({ input }) => getSchoolByDomain(input.domain)),
    
    create: publicProcedure
      .input(createSchoolInputSchema)
      .mutation(({ input }) => createSchool(input)),
    
    update: publicProcedure
      .input(updateSchoolInputSchema)
      .mutation(({ input }) => updateSchool(input)),
    
    delete: publicProcedure
      .input(deleteByIdInputSchema)
      .mutation(({ input }) => deleteSchool(input)),
  }),

  // User management routes
  users: router({
    getAll: publicProcedure
      .query(() => getUsers()),
    
    getBySchoolId: publicProcedure
      .input(deleteByIdInputSchema) // Reuse schema for ID input
      .query(({ input }) => getUsersBySchoolId(input.id)),
    
    getById: publicProcedure
      .input(deleteByIdInputSchema)
      .query(({ input }) => getUserById(input.id)),
    
    create: publicProcedure
      .input(createUserInputSchema)
      .mutation(({ input }) => createUser(input)),
    
    update: publicProcedure
      .input(updateUserInputSchema)
      .mutation(({ input }) => updateUser(input)),
    
    delete: publicProcedure
      .input(deleteByIdInputSchema)
      .mutation(({ input }) => deleteUser(input)),
  }),

  // FAQ management routes
  faqs: router({
    getBySchoolId: publicProcedure
      .input(deleteByIdInputSchema) // Reuse schema for ID input
      .query(({ input }) => getFaqsBySchoolId(input.id)),
    
    getById: publicProcedure
      .input(deleteByIdInputSchema)
      .query(({ input }) => getFaqById(input.id)),
    
    create: publicProcedure
      .input(createFaqInputSchema)
      .mutation(({ input }) => createFaq(input, 1)), // TODO: Get user ID from auth context
    
    update: publicProcedure
      .input(updateFaqInputSchema)
      .mutation(({ input }) => updateFaq(input)),
    
    delete: publicProcedure
      .input(deleteByIdInputSchema)
      .mutation(({ input }) => deleteFaq(input)),
  }),

  // Chatbot public routes (no authentication required)
  chatbot: router({
    search: publicProcedure
      .input(chatbotQueryInputSchema)
      .query(({ input }) => searchFaqs(input)),
    
    getByCategory: publicProcedure
      .input(getFaqsByCategoryInputSchema)
      .query(({ input }) => getFaqsByCategory(input)),
    
    getCategories: publicProcedure
      .input(z.object({ domain: z.string() }))
      .query(({ input }) => getAvailableCategories(input.domain)),
  }),
});

export type AppRouter = typeof appRouter;

async function start() {
  const port = process.env['SERVER_PORT'] || 2022;
  const server = createHTTPServer({
    middleware: (req, res, next) => {
      cors()(req, res, next);
    },
    router: appRouter,
    createContext() {
      return {};
    },
  });
  server.listen(port);
  console.log(`K-12 FAQ Chatbot TRPC server listening at port: ${port}`);
}

start();