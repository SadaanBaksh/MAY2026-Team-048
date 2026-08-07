import React from 'react';
// @ts-ignore
import renderer, { act } from 'react-test-renderer';

import { useDashboardSearch, type DashboardSearchResult } from '@/hooks/useDashboardSearch';
import type { AppUser, Ticket } from '@/types';

const mockResident: AppUser = {
  userId: 'res_1',
  name: 'Alice Johnson',
  email: 'alice@example.com',
  phone: '1234567890',
  role: 'resident',
  avatarColor: '#123456',
  createdAt: '2026-01-01T00:00:00Z',
  accountStatus: 'active',
  apartmentId: 'apt_1',
};

const mockStaff: AppUser = {
  userId: 'staff_1',
  name: 'Bob Smith',
  email: 'bob@example.com',
  phone: '0987654321',
  role: 'maintenance_staff',
  avatarColor: '#654321',
  createdAt: '2026-01-01T00:00:00Z',
  accountStatus: 'active',
  specialization: 'Plumbing Specialist',
  activeJobs: 2,
  rating: 4.8,
};

const mockEmployee: AppUser = {
  userId: 'emp_1',
  name: 'Charlie Davis',
  email: 'charlie@example.com',
  phone: '5551234567',
  role: 'facility_employee',
  avatarColor: '#ABCDEF',
  createdAt: '2026-01-01T00:00:00Z',
  accountStatus: 'active',
  title: 'Senior Coordinator',
};

const mockManager: AppUser = {
  userId: 'mgr_1',
  name: 'Diana Prince',
  email: 'diana@example.com',
  phone: '5559876543',
  role: 'facility_manager',
  avatarColor: '#FEDCBA',
  createdAt: '2026-01-01T00:00:00Z',
  accountStatus: 'active',
  title: 'Operations Manager',
};

const mockTickets: Ticket[] = [
  {
    ticketId: 'tkt_1',
    residentId: 'res_1',
    workerId: 'staff_1',
    categoryId: 'cat_plumbing',
    imageUrl: null,
    mediaType: null,
    residentNote: 'Water pipe leaking in kitchen',
    voiceNoteUrl: null,
    voiceNoteDurationSec: null,
    aiDescription: 'High priority plumbing leak issue',
    aiConfidence: 0.95,
    priority: 'High',
    status: 'In_Progress',
    costResponsibility: 'Society',
    dateOfRequest: '2026-02-01T10:00:00Z',
    dateOfResolution: null,
    resolutionRemarks: null,
    resolutionProofUrl: null,
    residentRating: null,
    residentFeedback: null,
    isOverdue: false,
    title: 'Kitchen Sink Water Leak',
  },
  {
    ticketId: 'tkt_2',
    residentId: 'res_2',
    workerId: null,
    categoryId: 'cat_electrical',
    imageUrl: null,
    mediaType: null,
    residentNote: 'Power outage in bedroom',
    voiceNoteUrl: null,
    voiceNoteDurationSec: null,
    aiDescription: 'Electrical short circuit reported',
    aiConfidence: 0.88,
    priority: 'Critical',
    status: 'Pending',
    costResponsibility: 'Pending Review',
    dateOfRequest: '2026-02-02T10:00:00Z',
    dateOfResolution: null,
    resolutionRemarks: null,
    resolutionProofUrl: null,
    residentRating: null,
    residentFeedback: null,
    isOverdue: true,
    title: 'Bedroom Power Trip',
  },
];

const mockUsers: AppUser[] = [mockResident, mockStaff, mockEmployee, mockManager];

interface HookTesterProps {
  query: string;
  tickets: Ticket[];
  users: AppUser[];
  currentUser: AppUser | null;
  onResult: (res: DashboardSearchResult) => void;
}

function HookTester(props: HookTesterProps) {
  const result = useDashboardSearch(props.query, props.tickets, props.users, props.currentUser);
  props.onResult(result);
  return null;
}

function testHook(query: string, tickets: Ticket[], users: AppUser[], currentUser: AppUser | null) {
  let result!: DashboardSearchResult;
  act(() => {
    renderer.create(
      React.createElement(HookTester, {
        query,
        tickets,
        users,
        currentUser,
        onResult: (res: DashboardSearchResult) => {
          result = res;
        },
      }),
    );
  });
  return result;
}

describe('useDashboardSearch', () => {
  it('returns empty results for empty query', () => {
    const res = testHook('', mockTickets, mockUsers, mockResident);
    expect(res.totalMatches).toBe(0);
    expect(res.matchingComplaints).toHaveLength(0);
  });

  it('restricts customer search to their own complaints', () => {
    const res1 = testHook('power', mockTickets, mockUsers, mockResident);
    expect(res1.matchingComplaints).toHaveLength(0);

    const res2 = testHook('leak', mockTickets, mockUsers, mockResident);
    expect(res2.matchingComplaints).toHaveLength(1);
    expect(res2.matchingCustomers).toHaveLength(0);
    expect(res2.matchingStaff).toHaveLength(0);
  });

  it('allows staff to search their assigned complaints', () => {
    const res = testHook('kitchen', mockTickets, mockUsers, mockStaff);
    expect(res.matchingComplaints).toHaveLength(1);
    expect(res.matchingCustomers).toHaveLength(0);
  });

  it('allows employee to search all complaints, customers, and staff', () => {
    const complaintSearch = testHook('kitchen', mockTickets, mockUsers, mockEmployee);
    expect(complaintSearch.matchingComplaints).toHaveLength(1);

    const customerSearch = testHook('Alice', mockTickets, mockUsers, mockEmployee);
    expect(customerSearch.matchingCustomers).toHaveLength(1);

    const staffSearch = testHook('Plumbing', mockTickets, mockUsers, mockEmployee);
    expect(staffSearch.matchingStaff).toHaveLength(1);
    expect(staffSearch.matchingEmployees).toHaveLength(0);
  });

  it('allows manager to search complaints, customers, staff, and employees', () => {
    const empSearch = testHook('Charlie', mockTickets, mockUsers, mockManager);
    expect(empSearch.matchingEmployees).toHaveLength(1);
    expect(empSearch.matchingEmployees[0].name).toBe('Charlie Davis');
  });
});
