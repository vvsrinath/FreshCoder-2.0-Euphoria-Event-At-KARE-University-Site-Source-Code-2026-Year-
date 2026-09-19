import React from 'react';
import {
  BookOpenIcon,
  ClipboardListIcon,
  HelpCircleIcon,
  LayoutDashboardIcon,
  TrophyIcon,
  UserCheckIcon,
} from 'lucide-react';
import type { NavItem } from '../../components/PortalLayout';

export const studentNav: NavItem[] = [
  { to: '/student', label: 'Dashboard', icon: <LayoutDashboardIcon className="h-4 w-4" /> },
  { to: '/student/tests', label: 'My Tests', icon: <ClipboardListIcon className="h-4 w-4" /> },
  { to: '/student/instructions', label: 'Instructions', icon: <BookOpenIcon className="h-4 w-4" /> },
  { to: '/student/results', label: 'Results', icon: <TrophyIcon className="h-4 w-4" /> },
  { to: '/student/profile', label: 'Profile', icon: <UserCheckIcon className="h-4 w-4" /> },
  { to: '/student/support', label: 'Support', icon: <HelpCircleIcon className="h-4 w-4" /> },
];