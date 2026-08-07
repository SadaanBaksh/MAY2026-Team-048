import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/ui/Avatar';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { EmptyState } from '@/components/ui/EmptyState';
import { RatingStars } from '@/components/ui/RatingStars';
import { SearchBar } from '@/components/ui/SearchBar';
import { TicketCard } from '@/components/shared/TicketCard';
import { APARTMENTS } from '@/data/seed';
import { Radius, Spacing, Type } from '@/constants/theme';
import { useTheme, type ThemeColors } from '@/hooks/useTheme';
import {
  useDashboardSearch,
  type SearchEntityTab,
} from '@/hooks/useDashboardSearch';
import { useAuthStore } from '@/store/authStore';
import { useTicketStore } from '@/store/ticketStore';
import type {
  AppUser,
  FacilityEmployee,
  MaintenanceStaff,
  Resident,
  Ticket,
} from '@/types';

export interface DashboardSearchProps {
  query: string;
  onChangeQuery: (q: string) => void;
  placeholder?: string;
  onSelectTicket?: (ticketId: string) => void;
  onSelectUser?: (user: AppUser) => void;
  hideSearchBar?: boolean;
}

export function DashboardSearch({
  query,
  onChangeQuery,
  placeholder,
  onSelectTicket,
  onSelectUser,
  hideSearchBar = false,
}: DashboardSearchProps) {
  const { Colors } = useTheme();
  const styles = useMemo(() => getStyles(Colors), [Colors]);

  const currentUser = useAuthStore((s) => s.currentUser);
  const users = useAuthStore((s) => s.users);
  const tickets = useTicketStore((s) => s.tickets);

  const [activeTab, setActiveTab] = useState<SearchEntityTab>('all');

  const {
    matchingComplaints,
    matchingCustomers,
    matchingStaff,
    matchingEmployees,
    totalMatches,
    availableTabs,
  } = useDashboardSearch(query, tickets, users, currentUser);

  const defaultPlaceholder = useMemo(() => {
    if (placeholder) return placeholder;
    switch (currentUser?.role) {
      case 'resident':
        return 'Search your complaints by title, issue, category...';
      case 'maintenance_staff':
        return 'Search your assigned complaints by title, unit...';
      case 'facility_employee':
        return 'Search complaints, customers, staff members...';
      case 'facility_manager':
        return 'Search complaints, customers, staff, employees...';
      default:
        return 'Search...';
    }
  }, [currentUser, placeholder]);

  const residentApartment = (apartmentId?: string) => {
    if (!apartmentId) return '';
    const apt = APARTMENTS.find((a) => a.apartmentId === apartmentId);
    return apt ? `${apt.unitNumber}, ${apt.building}` : '';
  };

  const getComplaintSubtitle = (ticket: Ticket) => {
    if (currentUser?.role === 'resident') {
      const worker = users.find((u) => u.userId === ticket.workerId);
      return worker ? `Assigned to ${worker.name}` : 'Unassigned';
    }
    const resident = users.find((u) => u.userId === ticket.residentId);
    const apt = resident && resident.role === 'resident' ? residentApartment(resident.apartmentId) : '';
    return resident ? `${resident.name}${apt ? ` · ${apt}` : ''}` : 'Resident';
  };

  const handleTicketPress = (ticketId: string) => {
    if (onSelectTicket) {
      onSelectTicket(ticketId);
      return;
    }
    switch (currentUser?.role) {
      case 'resident':
        router.push(`/(resident)/complaint/${ticketId}`);
        break;
      case 'facility_employee':
        router.push(`/(employee)/complaint/${ticketId}`);
        break;
      case 'facility_manager':
        router.push(`/(manager)/complaint/${ticketId}`);
        break;
      case 'maintenance_staff':
        router.push(`/(maintenance)/job/${ticketId}`);
        break;
    }
  };

  const handleUserPress = (user: AppUser) => {
    if (onSelectUser) {
      onSelectUser(user);
      return;
    }
    if (user.role === 'maintenance_staff') {
      if (currentUser?.role === 'facility_employee') {
        router.push('/(employee)/(tabs)/workers');
      } else if (currentUser?.role === 'facility_manager') {
        router.push('/(manager)/(tabs)/performance');
      }
    } else if (user.role === 'facility_employee' && currentUser?.role === 'facility_manager') {
      router.push('/(manager)/(tabs)/requests');
    }
  };

  const isQueryActive = query.trim().length > 0;

  const showComplaints = activeTab === 'all' || activeTab === 'complaints';
  const showCustomers = activeTab === 'all' || activeTab === 'customers';
  const showStaff = activeTab === 'all' || activeTab === 'staff';
  const showEmployees = activeTab === 'all' || activeTab === 'employees';

  const formatTabLabel = (tab: SearchEntityTab) => {
    switch (tab) {
      case 'all':
        return `All (${totalMatches})`;
      case 'complaints':
        return `Complaints (${matchingComplaints.length})`;
      case 'customers':
        return `Customers (${matchingCustomers.length})`;
      case 'staff':
        return `Staff (${matchingStaff.length})`;
      case 'employees':
        return `Employees (${matchingEmployees.length})`;
    }
  };

  return (
    <View style={styles.container}>
      {!hideSearchBar && (
        <SearchBar
          value={query}
          onChangeText={onChangeQuery}
          placeholder={defaultPlaceholder}
        />
      )}

      {isQueryActive && (
        <>
          <View style={styles.resultsHeader}>
            <Text style={styles.resultsCount}>
              {totalMatches === 1 ? '1 result found' : `${totalMatches} results found`}
            </Text>
          </View>

      {availableTabs.length > 2 && (
        <View style={styles.tabRow}>
          {availableTabs.map((tab) => (
            <Chip
              key={tab}
              label={formatTabLabel(tab)}
              active={activeTab === tab}
              color={Colors.primary}
              onPress={() => setActiveTab(tab)}
            />
          ))}
        </View>
      )}

      {totalMatches === 0 ? (
        <EmptyState
          icon="search-outline"
          title="No results found"
          message={`No matches found for "${query}". Try searching with a different keyword.`}
        />
      ) : (
        <View style={styles.list}>
          {/* Complaints */}
          {showComplaints && matchingComplaints.length > 0 && (
            <View style={styles.sectionGroup}>
              {availableTabs.length > 2 && activeTab === 'all' && (
                <Text style={styles.groupTitle}>Complaints ({matchingComplaints.length})</Text>
              )}
              {matchingComplaints.map((ticket) => (
                <TicketCard
                  key={ticket.ticketId}
                  ticket={ticket}
                  subtitle={getComplaintSubtitle(ticket)}
                  onPress={() => handleTicketPress(ticket.ticketId)}
                />
              ))}
            </View>
          )}

          {/* Customers */}
          {showCustomers && matchingCustomers.length > 0 && (
            <View style={styles.sectionGroup}>
              {activeTab === 'all' && (
                <Text style={styles.groupTitle}>Customers / Residents ({matchingCustomers.length})</Text>
              )}
              {matchingCustomers.map((res: Resident) => (
                <Card key={res.userId} onPress={() => handleUserPress(res)} style={styles.userCard}>
                  <Avatar name={res.name} color={res.avatarColor} size={44} />
                  <View style={styles.userInfo}>
                    <Text style={styles.userName}>{res.name}</Text>
                    <Text style={styles.userMeta}>
                      Resident · {residentApartment(res.apartmentId) || 'Apartment Resident'}
                    </Text>
                    <Text style={styles.userContact}>{res.email} · {res.phone}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={Colors.inkTertiary} />
                </Card>
              ))}
            </View>
          )}

          {/* Maintenance Staff */}
          {showStaff && matchingStaff.length > 0 && (
            <View style={styles.sectionGroup}>
              {activeTab === 'all' && (
                <Text style={styles.groupTitle}>Maintenance Staff ({matchingStaff.length})</Text>
              )}
              {matchingStaff.map((staff: MaintenanceStaff) => (
                <Card key={staff.userId} onPress={() => handleUserPress(staff)} style={styles.userCard}>
                  <Avatar name={staff.name} color={staff.avatarColor} size={44} />
                  <View style={styles.userInfo}>
                    <View style={styles.nameBadgeRow}>
                      <Text style={styles.userName}>{staff.name}</Text>
                      <RatingStars value={Math.round(staff.rating)} readOnly size={12} />
                    </View>
                    <Text style={styles.userMeta}>
                      {staff.specialization} · {staff.activeJobs ?? 0} active jobs
                    </Text>
                    <Text style={styles.userContact}>{staff.email} · {staff.phone}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={Colors.inkTertiary} />
                </Card>
              ))}
            </View>
          )}

          {/* Facility Employees */}
          {showEmployees && matchingEmployees.length > 0 && (
            <View style={styles.sectionGroup}>
              {activeTab === 'all' && (
                <Text style={styles.groupTitle}>Facility Employees ({matchingEmployees.length})</Text>
              )}
              {matchingEmployees.map((emp: FacilityEmployee) => (
                <Card key={emp.userId} onPress={() => handleUserPress(emp)} style={styles.userCard}>
                  <Avatar name={emp.name} color={emp.avatarColor} size={44} />
                  <View style={styles.userInfo}>
                    <Text style={styles.userName}>{emp.name}</Text>
                    <Text style={styles.userMeta}>
                      {emp.title || 'Facility Employee'} · Status: {emp.accountStatus}
                    </Text>
                    <Text style={styles.userContact}>{emp.email} · {emp.phone}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={Colors.inkTertiary} />
                </Card>
              ))}
            </View>
          )}
        </View>
      )}
      </>
      )}
    </View>
  );
}

const getStyles = (Colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      gap: Spacing.sm,
    },
    resultsHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    resultsCount: {
      ...Type.captionBold,
      color: Colors.inkSecondary,
    },
    tabRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
    },
    list: {
      gap: Spacing.md,
    },
    sectionGroup: {
      gap: Spacing.xs,
    },
    groupTitle: {
      ...Type.subtitle,
      fontSize: 14,
      color: Colors.inkSecondary,
      marginBottom: 2,
    },
    userCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
    },
    userInfo: {
      flex: 1,
      gap: 2,
    },
    nameBadgeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.xs,
    },
    userName: {
      ...Type.bodyMedium,
      color: Colors.ink,
    },
    userMeta: {
      ...Type.caption,
      color: Colors.primary,
    },
    userContact: {
      ...Type.tiny,
      color: Colors.inkSecondary,
    },
  });
