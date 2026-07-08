import { hoursSince } from '@/utils/date';
import type { Ticket } from '@/types';

const PENDING_SLA_HOURS = 24;
const IN_PROGRESS_SLA_HOURS = 72;

export function isTicketOverdue(ticket: Ticket): boolean {
  if (ticket.status === 'Resolved' || ticket.status === 'Closed') return false;
  if (ticket.status === 'Pending' || ticket.status === 'Assigned') {
    return hoursSince(ticket.dateOfRequest) > PENDING_SLA_HOURS;
  }
  if (ticket.status === 'In_Progress') {
    return hoursSince(ticket.dateOfRequest) > IN_PROGRESS_SLA_HOURS;
  }
  return false;
}
