import type { Role } from '../types';

/**
 * DEVELOPMENT / DEMO seed accounts only.
 * Production credentials are provisioned through the Developer bootstrap
 * endpoint and must never be committed to source control.
 *
 * Data lives in seedUsers.json; this file only re-exports it with types.
 */
import seedData from './seedUsers.json';

export interface SeedUser {
  id: string;
  role: Role;
  name: string;
  email: string;
  password: string;
  active: boolean;
}

export const seedUsers: SeedUser[] = seedData.users as unknown as SeedUser[];

export const demoCredentials = seedData.demoCredentials;