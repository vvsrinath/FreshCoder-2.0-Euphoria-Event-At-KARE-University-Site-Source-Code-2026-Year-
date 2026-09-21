import React from 'react';
import {
  ActivityIcon,
  ClipboardListIcon,
  DatabaseIcon,
  FileBarChart2Icon,
  LayoutDashboardIcon,
  PencilLineIcon,
  ScrollTextIcon,
  ShieldAlertIcon } from
'lucide-react';
import type { NavItem } from '../../components/PortalLayout';

export const staffNav: NavItem[] = [
{ to: '/staff', label: 'Dashboard', icon: <LayoutDashboardIcon className="h-4 w-4" /> },
{ to: '/staff/tests', label: 'Tests', icon: <ClipboardListIcon className="h-4 w-4" /> },
{ to: '/staff/questions', label: 'Questions', icon: <DatabaseIcon className="h-4 w-4" /> },
{ to: '/staff/live', label: 'Live Monitoring', icon: <ActivityIcon className="h-4 w-4" /> },
{ to: '/staff/edit-requests', label: 'Edit Requests', icon: <PencilLineIcon className="h-4 w-4" /> },
{ to: '/staff/results', label: 'Results', icon: <FileBarChart2Icon className="h-4 w-4" /> },
{ to: '/staff/security', label: 'Security Events', icon: <ShieldAlertIcon className="h-4 w-4" /> },
{ to: '/staff/audit', label: 'Audit Logs', icon: <ScrollTextIcon className="h-4 w-4" /> }];