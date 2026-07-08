import { CATEGORIES, CategoryMeta } from '@/data/categories';
import type { Priority } from '@/types';

const AREA_WORDS = ['kitchen', 'bathroom', 'balcony', 'living room', 'bedroom', 'entrance', 'corridor'];

const CRITICAL_WORDS = ['fire', 'gas smell', 'sparking', 'flooding', 'burst', 'stuck inside', 'smoke'];
const HIGH_WORDS = ['leak', 'no power', 'not working', 'urgent', 'sparking', 'no water'];

export interface AIAnalysisInput {
  note: string;
  hasVideo: boolean;
}

export interface AIAnalysisResult {
  categoryId: string;
  aiDescription: string;
  priority: Priority;
  confidence: number;
}

function pickCategory(note: string): CategoryMeta {
  const lower = note.toLowerCase();
  const match = CATEGORIES.find((cat) => cat.keywords.some((kw) => lower.includes(kw)));
  if (match) return match;
  const index = Math.floor(Math.random() * CATEGORIES.length);
  return CATEGORIES[index];
}

function pickArea(note: string): string {
  const lower = note.toLowerCase();
  const match = AREA_WORDS.find((area) => lower.includes(area));
  return match ?? AREA_WORDS[Math.floor(Math.random() * AREA_WORDS.length)];
}

function derivePriority(note: string, category: CategoryMeta): Priority {
  const lower = note.toLowerCase();
  if (CRITICAL_WORDS.some((w) => lower.includes(w))) return 'Critical';
  if (HIGH_WORDS.some((w) => lower.includes(w))) return 'High';
  return category.defaultPriority;
}

/** Simulates an async multimodal AI job (image/video -> description, category, priority). */
export function analyzeComplaint({ note, hasVideo }: AIAnalysisInput): Promise<AIAnalysisResult> {
  const category = pickCategory(note);
  const area = pickArea(note);
  const template = category.descriptionTemplates[Math.floor(Math.random() * category.descriptionTemplates.length)];
  const priority = derivePriority(note, category);
  const confidence = Math.round((0.8 + Math.random() * 0.17) * 100) / 100;

  const aiDescription = template.replace('{area}', area) + (hasVideo ? ' Video footage confirms the reported symptom.' : '');

  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({ categoryId: category.categoryId, aiDescription, priority, confidence });
    }, 1800 + Math.random() * 900);
  });
}
