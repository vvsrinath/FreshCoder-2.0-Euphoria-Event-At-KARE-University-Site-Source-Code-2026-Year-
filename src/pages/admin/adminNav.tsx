import React from 'react';
import {
  CalendarRangeIcon,
  ClipboardListIcon,
  DatabaseIcon,
  FileBarChart2Icon,
  LayoutDashboardIcon,
  ScrollTextIcon,
  ShieldAlertIcon,
  UserCogIcon,
  UsersIcon } from
'lucide-react';
import type { NavItem } from '../../components/PortalLayout';

export const adminNav: NavItem[] = [
{ to: '/admin', label: 'Dashboard', icon: <LayoutDashboardIcon className="h-4 w-4" /> },
{ to: '/admin/students', label: 'Students', icon: <UsersIcon className="h-4 w-4" /> },
{ to: '/admin/staff', label: 'Staff', icon: <UserCogIcon className="h-4 w-4" /> },
{ to: '/admin/events', label: 'Events', icon: <CalendarRangeIcon className="h-4 w-4" /> },
{ to: '/staff/tests', label: 'Tests', icon: <ClipboardListIcon className="h-4 w-4" /> },
{ to: '/staff/questions', label: 'Question Bank', icon: <DatabaseIcon className="h-4 w-4" /> },
{ to: '/staff/results', label: 'Results', icon: <FileBarChart2Icon className="h-4 w-4" /> },
{ to: '/staff/security', label: 'Security Events', icon: <ShieldAlertIcon className="h-4 w-4" /> },
{ to: '/staff/audit', label: 'Audit Logs', icon: <ScrollTextIcon className="h-4 w-4" /> }];