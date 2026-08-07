import { useMemo } from 'react';

import { CATEGORIES } from '@/data/categories';
import { APARTMENTS } from '@/data/seed';
import type {
  AppUser,
  FacilityEmployee,
  MaintenanceStaff,
  Resident,
  Ticket,
  UserRole,
} from '@/types';

export type SearchEntityTab = 'all' | 'complaints' | 'customers' | 'staff' | 'employees';

export interface DashboardSearchResult {
  matchingComplaints: Ticket[];
  matchingCustomers: Resident[];
  matchingStaff: MaintenanceStaff[];
  matchingEmployees: FacilityEmployee[];
  totalMatches: number;
  availableTabs: SearchEntityTab[];
}

export function useDashboardSearch(
  query: string,
  tickets: Ticket[],
  users: AppUser[],
  currentUser: AppUser | null,
): DashboardSearchResult {
  return useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!currentUser || !q) {
      const tabs: SearchEntityTab[] = ['complaints'];
      if (currentUser?.role === 'facility_employee' || currentUser?.role === 'facility_manager') {
        tabs.push('customers', 'staff');
      }
      if (currentUser?.role === 'facility_manager') {
        tabs.push('employees');
      }
      return {
        matchingComplaints: [],
        matchingCustomers: [],
        matchingStaff: [],
        matchingEmployees: [],
        totalMatches: 0,
        availableTabs: ['all', ...tabs],
      };
    }

    const role: UserRole = currentUser.role;

    // Helper functions for complaint matching
    const getResident = (residentId: string) =>
      users.find((u): u is Resident => u.userId === residentId && u.role === 'resident');

    const getWorker = (workerId: string | null) =>
      workerId
        ? users.find((u): u is MaintenanceStaff => u.userId === workerId && u.role === 'maintenance_staff')
        : null;

    const getApartmentInfo = (apartmentId?: string | null) => {
      if (!apartmentId) return '';
      const apt = APARTMENTS.find((a) => a.apartmentId === apartmentId);
      return apt ? `${apt.unitNumber} ${apt.building}`.toLowerCase() : '';
    };

    // 1. Filter Complaints based on user role scope
    let scopedTickets = tickets;
    if (role === 'resident') {
      scopedTickets = tickets.filter((t) => t.residentId === currentUser.userId);
    } else if (role === 'maintenance_staff') {
      scopedTickets = tickets.filter((t) => t.workerId === currentUser.userId);
    }

    const matchingComplaints = scopedTickets.filter((ticket) => {
      const category = CATEGORIES.find((c) => c.categoryId === ticket.categoryId);
      const resident = getResident(ticket.residentId);
      const worker = getWorker(ticket.workerId);
      const aptText = resident ? getApartmentInfo(resident.apartmentId) : '';

      const categoryMatch =
        category?.categoryName.toLowerCase().includes(q) ||
        category?.keywords.some((k) => k.toLowerCase().includes(q));

      const titleMatch = ticket.title.toLowerCase().includes(q);
      const idMatch = ticket.ticketId.toLowerCase().includes(q);
      const statusMatch =
        ticket.status.toLowerCase().includes(q) ||
        ticket.status.replace('_', ' ').toLowerCase().includes(q);
      const priorityMatch = ticket.priority.toLowerCase().includes(q);
      const noteMatch = (ticket.residentNote || '').toLowerCase().includes(q);
      const aiMatch = (ticket.aiDescription || '').toLowerCase().includes(q);
      const residentNameMatch = resident?.name.toLowerCase().includes(q) ?? false;
      const workerNameMatch = worker?.name.toLowerCase().includes(q) ?? false;
      const aptMatch = aptText.includes(q);

      return (
        titleMatch ||
        idMatch ||
        categoryMatch ||
        statusMatch ||
        priorityMatch ||
        noteMatch ||
        aiMatch ||
        residentNameMatch ||
        workerNameMatch ||
        aptMatch
      );
    });

    // 2. Filter Customers (Residents) — accessible to facility_employee & facility_manager
    let matchingCustomers: Resident[] = [];
    if (role === 'facility_employee' || role === 'facility_manager') {
      matchingCustomers = users.filter((u): u is Resident => {
        if (u.role !== 'resident') return false;
        const aptText = getApartmentInfo(u.apartmentId);
        return (
          u.name.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          u.phone.toLowerCase().includes(q) ||
          aptText.includes(q)
        );
      });
    }

    // 3. Filter Staff (MaintenanceStaff) — accessible to facility_employee & facility_manager
    let matchingStaff: MaintenanceStaff[] = [];
    if (role === 'facility_employee' || role === 'facility_manager') {
      matchingStaff = users.filter((u): u is MaintenanceStaff => {
        if (u.role !== 'maintenance_staff') return false;
        return (
          u.name.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          u.phone.toLowerCase().includes(q) ||
          u.specialization.toLowerCase().includes(q)
        );
      });
    }

    // 4. Filter Employees (FacilityEmployee) — accessible to facility_manager
    let matchingEmployees: FacilityEmployee[] = [];
    if (role === 'facility_manager') {
      matchingEmployees = users.filter((u): u is FacilityEmployee => {
        if (u.role !== 'facility_employee') return false;
        return (
          u.name.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          u.phone.toLowerCase().includes(q) ||
          u.title.toLowerCase().includes(q)
        );
      });
    }

    const availableTabs: SearchEntityTab[] = ['all', 'complaints'];
    if (role === 'facility_employee' || role === 'facility_manager') {
      availableTabs.push('customers', 'staff');
    }
    if (role === 'facility_manager') {
      availableTabs.push('employees');
    }

    const totalMatches =
      matchingComplaints.length +
      matchingCustomers.length +
      matchingStaff.length +
      matchingEmployees.length;

    return {
      matchingComplaints,
      matchingCustomers,
      matchingStaff,
      matchingEmployees,
      totalMatches,
      availableTabs,
    };
  }, [query, tickets, users, currentUser]);
}
