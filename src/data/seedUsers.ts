import type { Role } from '../types';

/**
 * DEVELOPMENT / DEMO seed accounts only.
 * Production credentials are provisioned through the Developer bootstrap
 * endpoint and must never be committed to source control.
 */
export interface SeedUser {
  id: string;
  role: Role;
  name: string;
  email: string;
  password: string;
  active: boolean;
}

export const seedUsers: SeedUser[] = [
{
  id: 'DEV001',
  role: 'DEVELOPER',
  name: 'Platform Developer',
  email: 'dev@klu.ac.in',
  password: 'dev@2026',
  active: true
},
{
  id: 'ADMIN001',
  role: 'SUPER_ADMIN',
  name: 'Dr. R. Sundaram',
  email: 'admin001@klu.ac.in',
  password: 'admin@2026',
  active: true
},
{
  id: 'STAFF001',
  role: 'STAFF',
  name: 'Prof. K. Meenakshi',
  email: 'staff001@klu.ac.in',
  password: 'staff@2026',
  active: true
},
{
  id: 'STAFF002',
  role: 'STAFF',
  name: 'Prof. A. Vignesh',
  email: 'staff002@klu.ac.in',
  password: 'staff@2026',
  active: true
},
{
  id: 'ST2026001',
  role: 'STUDENT',
  name: 'Arun Kumar',
  email: 'st2026001@klu.ac.in',
  password: 'student@2026',
  active: true
},
{
  id: 'ST2026002',
  role: 'STUDENT',
  name: 'Divya Lakshmi',
  email: 'st2026002@klu.ac.in',
  password: 'student@2026',
  active: true
},
{
  id: 'ST2026003',
  role: 'STUDENT',
  name: 'Mohammed Irfan',
  email: 'st2026003@klu.ac.in',
  password: 'student@2026',
  active: true
},
{
  id: 'ST2026004',
  role: 'STUDENT',
  name: 'Priya Ranjani',
  email: 'st2026004@klu.ac.in',
  password: 'student@2026',
  active: true
},
{
  id: 'ST2026005',
  role: 'STUDENT',
  name: 'Karthik Raja',
  email: 'st2026005@klu.ac.in',
  password: 'student@2026',
  active: true
}];


export const demoCredentials = [
{ label: 'Student', id: 'ST2026001', password: 'student@2026' },
{ label: 'Staff', id: 'STAFF001', password: 'staff@2026' },
{ label: 'Admin', id: 'ADMIN001', password: 'admin@2026' }];