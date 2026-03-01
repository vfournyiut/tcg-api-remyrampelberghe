// Integration tests setup - no mocks, use real database
// This file should be imported by integration tests that need real database access

import { prisma } from '../src/database';
import { afterAll } from 'vitest';

// Close Prisma connection after all tests
afterAll(async () => {
    await prisma.$disconnect();
});

export { prisma };
