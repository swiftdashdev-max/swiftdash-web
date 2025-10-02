import type {LucideIcon} from 'lucide-react';
import type React from 'react';

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon | React.ComponentType<{className?: string}>;
  active?: boolean;
};

export type User = {
  id: string;
  name: string;
  email: string;
  avatar: string;
};

export type Driver = User & {
  licenseUrl: string;
  vehicle: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  deliveryHistory: Delivery[];
  performance: number;
  online: boolean;
};

export type Delivery = {
  id: string;
  customerName: string;
  pickupAddress: string;
  dropoffAddress: string;
  status: string;
  scheduledTime: Date;
  price: number;
  driver?: Driver;
};

export type Ticket = {
  id: string;
  subject: string;
  customer: User;
  status: 'Open' | 'In Progress' | 'Closed';
  priority: 'Low' | 'Medium' | 'High';
  lastUpdate: Date;
};

export type Report = {
  id: string;
  title: string;
  description: string;
  type: 'Revenue' | 'Volume' | 'Performance' | 'KPI';
};

export type Invoice = {
  id: string;
  month: string;
  amount: number;
  status: 'Paid' | 'Pending' | 'Overdue';
  downloadUrl: string;
};

export type TeamMember = User & {
  role: 'Owner' | 'Manager' | 'Dispatcher';
};
