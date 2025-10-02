import type {NavItem, User, Driver, Delivery, Ticket, Report, Invoice, TeamMember} from './types';
import {
  LayoutDashboard,
  Users,
  MessageSquare,
  BarChartBig,
  Building2,
  FileText,
  UserCheck,
  Truck,
  FileCog,
} from 'lucide-react';
import {SwiftdashLogo} from '@/components/icons';

export const adminNavItems: NavItem[] = [
  {href: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard},
  {href: '/admin/drivers', label: 'Driver Verification', icon: UserCheck},
  {href: '/admin/crm', label: 'CRM', icon: MessageSquare},
  {href: '/admin/reports', label: 'Reports', icon: BarChartBig},
  {href: '/delivery-status-tool', label: 'AI Status Tool', icon: FileCog},
];

export const businessNavItems: NavItem[] = [
  {href: '/business/dashboard', label: 'Dashboard', icon: LayoutDashboard},
  {href: '/business/deliveries/new', label: 'New Delivery', icon: Truck},
  {href: '/business/reports', label: 'Reports & Invoicing', icon: FileText},
  {href: '/business/team', label: 'Team Management', icon: Users},
];

export const mockUser: User = {
  id: 'user-1',
  name: 'Admin User',
  email: 'admin@swiftdash.com',
  avatar: '1',
};

export const mockDrivers: Driver[] = [
  {
    id: 'driver-1',
    name: 'John Doe',
    email: 'john.doe@example.com',
    avatar: '2',
    licenseUrl: 'https://picsum.photos/seed/license1/600/400',
    vehicle: 'Toyota Prius',
    status: 'Approved',
    deliveryHistory: [],
    performance: 98,
    online: true,
  },
  {
    id: 'driver-2',
    name: 'Jane Smith',
    email: 'jane.smith@example.com',
    avatar: '3',
    licenseUrl: 'https://picsum.photos/seed/license2/600/400',
    vehicle: 'Ford Transit',
    status: 'Pending',
    deliveryHistory: [],
    performance: 0,
    online: false,
  },
  {
    id: 'driver-3',
    name: 'Carlos Rivera',
    email: 'carlos.r@example.com',
    avatar: '4',
    licenseUrl: 'https://picsum.photos/seed/license3/600/400',
    vehicle: 'Honda Civic',
    status: 'Approved',
    deliveryHistory: [],
    performance: 92,
    online: true,
  },
  {
    id: 'driver-4',
    name: 'Aisha Khan',
    email: 'aisha.k@example.com',
    avatar: '5',
    licenseUrl: 'https://picsum.photos/seed/license4/600/400',
    vehicle: 'Nissan Rogue',
    status: 'Rejected',
    deliveryHistory: [],
    performance: 0,
    online: false,
  },
];

export const mockDeliveries: Delivery[] = [
  {
    id: 'DEL-001',
    customerName: 'Global Tech Inc.',
    pickupAddress: '123 Tech Park',
    dropoffAddress: '456 Innovation Dr',
    status: 'In Transit',
    scheduledTime: new Date(Date.now() + 1 * 60 * 60 * 1000),
    price: 45.5,
    driver: mockDrivers[0],
  },
  {
    id: 'DEL-002',
    customerName: 'Creative Solutions',
    pickupAddress: '789 Art Ave',
    dropoffAddress: '101 Design Blvd',
    status: 'Delivered',
    scheduledTime: new Date(Date.now() - 2 * 60 * 60 * 1000),
    price: 32.0,
    driver: mockDrivers[2],
  },
  {
    id: 'DEL-003',
    customerName: 'HealthFirst Pharma',
    pickupAddress: '213 Cure Rd',
    dropoffAddress: '543 Wellness Way',
    status: 'Pending Pickup',
    scheduledTime: new Date(Date.now() + 4 * 60 * 60 * 1000),
    price: 78.9,
    driver: undefined,
  },
  {
    id: 'DEL-004',
    customerName: 'Quick Eats',
    pickupAddress: '111 Gourmet St',
    dropoffAddress: '222 Foodie Ln',
    status: 'Delayed',
    scheduledTime: new Date(Date.now() - 30 * 60 * 1000),
    price: 25.0,
    driver: mockDrivers[0],
  },
];

export const mockTickets: Ticket[] = [
  {
    id: 'TKT-001',
    subject: 'Late Delivery Complaint',
    customer: {id: 'cust-1', name: 'Alice Martin', email: 'alice@gti.com', avatar: '6'},
    status: 'In Progress',
    priority: 'High',
    lastUpdate: new Date(Date.now() - 1 * 60 * 60 * 1000),
  },
  {
    id: 'TKT-002',
    subject: 'Question about invoicing',
    customer: {id: 'cust-2', name: 'Bob Johnson', email: 'bob@cs.com', avatar: '7'},
    status: 'Open',
    priority: 'Medium',
    lastUpdate: new Date(Date.now() - 3 * 60 * 60 * 1000),
  },
  {
    id: 'TKT-003',
    subject: 'Driver feedback',
    customer: {id: 'cust-3', name: 'Charlie Brown', email: 'charlie@hf.com', avatar: '8'},
    status: 'Closed',
    priority: 'Low',
    lastUpdate: new Date(Date.now() - 24 * 60 * 60 * 1000),
  },
];

export const mockRevenueData = [
  {month: 'Jan', revenue: 4000},
  {month: 'Feb', revenue: 3000},
  {month: 'Mar', revenue: 5000},
  {month: 'Apr', revenue: 4500},
  {month: 'May', revenue: 6000},
  {month: 'Jun', revenue: 5500},
];

export const mockInvoices: Invoice[] = [
  {
    id: 'INV-05-2024',
    month: 'May 2024',
    amount: 4350.75,
    status: 'Paid',
    downloadUrl: '#',
  },
  {
    id: 'INV-04-2024',
    month: 'April 2024',
    amount: 3980.5,
    status: 'Paid',
    downloadUrl: '#',
  },
  {
    id: 'INV-03-2024',
    month: 'March 2024',
    amount: 5120.0,
    status: 'Paid',
    downloadUrl: '#',
  },
];

export const mockTeam: TeamMember[] = [
  {
    id: 'team-1',
    name: 'Sarah Chen (You)',
    email: 'sarah.chen@business.com',
    avatar: '9',
    role: 'Owner',
  },
  {id: 'team-2', name: 'David Lee', email: 'david.lee@business.com', avatar: '10', role: 'Manager'},
  {
    id: 'team-3',
    name: 'Maria Garcia',
    email: 'maria.garcia@business.com',
    avatar: '11',
    role: 'Dispatcher',
  },
];
