import { getCategoryById } from '@/data/categories';
import { USERS } from '@/data/seed';
import type { Comment, Resident, Ticket } from '@/types';
import { formatFullDate, timeAgo } from '@/utils/date';

export interface ResidentAssistantContext {
  resident: Resident;
  tickets: Ticket[];
  comments: Comment[];
}

export interface ResidentAssistantReply {
  text: string;
  relatedTicketId?: string;
  suggestions: string[];
}

const DEFAULT_SUGGESTIONS = [
  'What is my latest status?',
  'Which complaint needs review?',
  'Who is assigned?',
];

function sortedTickets(tickets: Ticket[]): Ticket[] {
  return [...tickets].sort((a, b) => new Date(b.dateOfRequest).getTime() - new Date(a.dateOfRequest).getTime());
}

function workerName(ticket: Ticket): string {
  if (!ticket.workerId) return 'No technician has been assigned yet';
  return USERS.find((user) => user.userId === ticket.workerId)?.name ?? 'Assigned technician';
}

function categoryName(ticket: Ticket): string {
  return getCategoryById(ticket.categoryId).categoryName;
}

function ticketSummary(ticket: Ticket): string {
  const assignee = workerName(ticket);
  const assignment = ticket.workerId ? `Assigned professional: ${assignee}.` : `${assignee}.`;
  const cost =
    ticket.costResponsibility === 'Pending Review'
      ? 'Cost responsibility is pending facility review.'
      : `Cost responsibility: ${ticket.costResponsibility}.`;

  return [
    `${ticket.title} is currently ${ticket.status.replace('_', ' ')}.`,
    `Category: ${categoryName(ticket)}. Priority: ${ticket.priority}.`,
    assignment,
    cost,
    `Reported ${timeAgo(ticket.dateOfRequest)}.`,
  ].join(' ');
}

function latestCommentFor(ticket: Ticket, comments: Comment[]): Comment | undefined {
  return comments
    .filter((comment) => comment.ticketId === ticket.ticketId)
    .sort((a, b) => new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime())[0];
}

function findLikelyTicket(message: string, tickets: Ticket[]): Ticket | undefined {
  const lower = message.toLowerCase();
  const direct = tickets.find((ticket) => lower.includes(ticket.ticketId.toLowerCase()));
  if (direct) return direct;

  return tickets.find((ticket) => {
    const titleWords = ticket.title.toLowerCase().split(/\W+/).filter((word) => word.length > 3);
    return titleWords.some((word) => lower.includes(word));
  });
}

function emptyStateReply(firstName: string): ResidentAssistantReply {
  return {
    text: `You do not have any complaints logged yet, ${firstName}. You can report one with a photo or video, and Simplifix will help classify the issue before the facility team reviews it.`,
    suggestions: ['How do I report an issue?', 'What can you help with?'],
  };
}

export function answerResidentMessage(message: string, context: ResidentAssistantContext): ResidentAssistantReply {
  const clean = message.trim();
  const lower = clean.toLowerCase();
  const firstName = context.resident.name.split(' ')[0];
  const tickets = sortedTickets(context.tickets);
  const latest = findLikelyTicket(lower, tickets) ?? tickets[0];

  if (tickets.length === 0) {
    return emptyStateReply(firstName);
  }

  if (/\b(hi|hello|hey|namaste|help)\b/.test(lower)) {
    return {
      text: `Hi ${firstName}. I can help with complaint status, assigned professionals, pending reviews, cost responsibility, and quick summaries from your current service history.`,
      suggestions: DEFAULT_SUGGESTIONS,
    };
  }

  if (/\b(review|rate|rating|verify|resolved|attention)\b/.test(lower)) {
    const pendingReview = tickets.filter((ticket) => ticket.status === 'Resolved' && ticket.residentRating == null);
    if (pendingReview.length === 0) {
      return {
        text: 'Nothing needs your review right now. When a technician marks a complaint as resolved, I will point you to it so you can verify the fix and rate the work.',
        suggestions: ['Show active complaints', 'What is my latest status?'],
      };
    }

    const ticket = pendingReview[0];
    return {
      text: `${ticket.title} is ready for your review. Resolution note: ${ticket.resolutionRemarks ?? 'No resolution note was added yet.'}`,
      relatedTicketId: ticket.ticketId,
      suggestions: ['Who worked on it?', 'What was the description?', 'Show active complaints'],
    };
  }

  if (/\b(assign|assigned|technician|professional|worker|staff|name)\b/.test(lower)) {
    const assigned = tickets.filter((ticket) => ticket.workerId && ticket.status !== 'Closed');
    const ticket = latest.workerId ? latest : assigned[0];
    if (!ticket) {
      return {
        text: 'No active complaint has a technician assigned yet. The facility team assigns a professional after reviewing the category, priority, and cost responsibility.',
        suggestions: ['Show active complaints', 'What is my latest status?'],
      };
    }

    const worker = USERS.find((user) => user.userId === ticket.workerId);
    const roleText = worker?.role === 'maintenance_staff' ? worker.specialization : 'Maintenance';
    return {
      text: `${workerName(ticket)} is assigned to ${ticket.title}. Specialty: ${roleText}. Current status: ${ticket.status.replace('_', ' ')}.`,
      relatedTicketId: ticket.ticketId,
      suggestions: ['Any latest update?', 'What is the issue description?', 'Cost responsibility?'],
    };
  }

  if (/\b(comment|update|latest update|message)\b/.test(lower)) {
    const comment = latestCommentFor(latest, context.comments);
    if (!comment) {
      return {
        text: `There are no chat updates on ${latest.title} yet. The current service status is ${latest.status.replace('_', ' ')}.`,
        relatedTicketId: latest.ticketId,
        suggestions: ['Who is assigned?', 'What is the issue description?'],
      };
    }

    return {
      text: `Latest update on ${latest.title}: ${comment.authorName} wrote "${comment.message}" ${timeAgo(comment.postedAt)}.`,
      relatedTicketId: latest.ticketId,
      suggestions: ['Who is assigned?', 'What is my latest status?'],
    };
  }

  if (/\b(cost|pay|payment|charge|responsibility|owner|society)\b/.test(lower)) {
    return {
      text:
        latest.costResponsibility === 'Pending Review'
          ? `${latest.title} is still pending cost review. The facility team will confirm whether it is Owner, Resident, or Society responsibility.`
          : `${latest.title} is marked payable by: ${latest.costResponsibility}.`,
      relatedTicketId: latest.ticketId,
      suggestions: ['Who is assigned?', 'What is the current status?'],
    };
  }

  if (/\b(description|describe|summary|details|issue|problem)\b/.test(lower)) {
    return {
      text: `${latest.title}: ${latest.aiDescription} Resident note: ${latest.residentNote}`,
      relatedTicketId: latest.ticketId,
      suggestions: ['Who is assigned?', 'Cost responsibility?', 'Any latest update?'],
    };
  }

  if (/\b(active|open|pending|progress|ongoing)\b/.test(lower)) {
    const active = tickets.filter((ticket) => ticket.status !== 'Closed');
    if (active.length === 0) {
      return {
        text: 'You do not have any active complaints right now. Closed complaints stay in your history.',
        suggestions: ['Show history', 'How do I report an issue?'],
      };
    }

    const list = active
      .slice(0, 3)
      .map((ticket) => `${ticket.title}: ${ticket.status.replace('_', ' ')}`)
      .join('\n');

    return {
      text: `You have ${active.length} active complaint${active.length === 1 ? '' : 's'}:\n${list}`,
      relatedTicketId: active[0].ticketId,
      suggestions: ['Who is assigned?', 'Which complaint needs review?', 'Any latest update?'],
    };
  }

  if (/\b(history|closed|past|completed)\b/.test(lower)) {
    const closed = tickets.filter((ticket) => ticket.status === 'Closed');
    if (closed.length === 0) {
      return {
        text: 'You do not have closed complaints yet.',
        suggestions: ['Show active complaints', 'What is my latest status?'],
      };
    }

    const latestClosed = closed[0];
    return {
      text: `Your latest closed complaint was ${latestClosed.title}, resolved on ${
        latestClosed.dateOfResolution ? formatFullDate(latestClosed.dateOfResolution) : 'the recorded resolution date'
      }. Your rating: ${latestClosed.residentRating ?? 'not rated'}.`,
      relatedTicketId: latestClosed.ticketId,
      suggestions: ['Show active complaints', 'What can you help with?'],
    };
  }

  if (/\b(report|create|new complaint|new issue|submit|raise)\b/.test(lower)) {
    return {
      text: 'To report a new issue, use Report an Issue from the resident home screen. Add a photo or video, describe what you see, and Simplifix will suggest category, priority, and a clearer service description.',
      suggestions: ['What should I include?', 'Show active complaints'],
    };
  }

  if (/\b(include|photo|video|write|draft)\b/.test(lower)) {
    return {
      text: 'A good complaint includes the room or location, what changed, how long it has been happening, and any safety risk. Photos help with visible damage, while video is useful for noise, leakage flow, sparks, or lift movement.',
      suggestions: ['How do I report an issue?', 'Show active complaints'],
    };
  }

  return {
    text: ticketSummary(latest),
    relatedTicketId: latest.ticketId,
    suggestions: DEFAULT_SUGGESTIONS,
  };
}
