import {
  createPublicComment,
  createPublicService,
  fetchPublicServices,
  fetchSimilaritySuggestions,
  reviewSimilaritySuggestion,
  updatePublicService,
} from '@/api/client';
import { usePublicServiceStore } from '@/store/publicServiceStore';
import type { PublicService, PublicSimilaritySuggestion } from '@/types';

jest.mock('@/api/client', () => ({
  createPublicComment: jest.fn(),
  createPublicService: jest.fn(),
  fetchPublicComments: jest.fn(),
  fetchPublicService: jest.fn(),
  fetchPublicServices: jest.fn(),
  fetchSimilaritySuggestions: jest.fn(),
  reviewSimilaritySuggestion: jest.fn(),
  updatePublicService: jest.fn(),
}));

const mockFetchServices = fetchPublicServices as jest.MockedFunction<typeof fetchPublicServices>;
const mockCreateService = createPublicService as jest.MockedFunction<typeof createPublicService>;
const mockUpdateService = updatePublicService as jest.MockedFunction<typeof updatePublicService>;
const mockCreateComment = createPublicComment as jest.MockedFunction<typeof createPublicComment>;
const mockFetchSuggestions = fetchSimilaritySuggestions as jest.MockedFunction<
  typeof fetchSimilaritySuggestions
>;
const mockReviewSuggestion = reviewSimilaritySuggestion as jest.MockedFunction<
  typeof reviewSimilaritySuggestion
>;

function service(overrides: Partial<PublicService> = {}): PublicService {
  return {
    id: 'public-1',
    createdById: 'resident-1',
    creatorName: 'Resident',
    creatorBuilding: 'Tower A',
    workerId: null,
    categoryId: 'cat_electrical',
    title: 'Street light broken',
    description: 'The light is off.',
    location: 'Below Tower A',
    aiSummary: '',
    priority: 'Medium',
    status: 'Pending',
    createdAt: '2026-08-07T00:00:00Z',
    updatedAt: '2026-08-07T00:00:00Z',
    resolvedAt: null,
    resolutionRemarks: null,
    resolutionProofUrl: null,
    mergedIntoId: null,
    reports: [],
    commentCount: 0,
    ...overrides,
  };
}

describe('usePublicServiceStore', () => {
  beforeEach(() => {
    usePublicServiceStore.setState({ services: [], comments: {}, suggestions: [], loading: false });
    jest.clearAllMocks();
  });

  it('refreshes the society-wide public feed', async () => {
    mockFetchServices.mockResolvedValue([service()]);
    await usePublicServiceStore.getState().refreshServices('token');
    expect(mockFetchServices).toHaveBeenCalledWith('token');
    expect(usePublicServiceStore.getState().services).toHaveLength(1);
  });

  it('adds a newly submitted service to the feed', async () => {
    mockCreateService.mockResolvedValue(service());
    await usePublicServiceStore.getState().submitService('token', {
      title: 'Street light broken',
      description: 'The light is off.',
      location: 'Below Tower A',
      category_id: 'cat_electrical',
      priority: 'Medium',
    });
    expect(usePublicServiceStore.getState().services[0].id).toBe('public-1');
  });

  it('updates assignment and status in place', async () => {
    usePublicServiceStore.setState({ services: [service()] });
    mockUpdateService.mockResolvedValue(service({ workerId: 'worker-1', status: 'Assigned' }));
    await usePublicServiceStore
      .getState()
      .updateService('token', 'public-1', { worker_id: 'worker-1' });
    expect(usePublicServiceStore.getState().services[0]).toMatchObject({
      workerId: 'worker-1',
      status: 'Assigned',
    });
  });

  it('appends a public comment and updates the displayed count', async () => {
    usePublicServiceStore.setState({ services: [service()] });
    mockCreateComment.mockResolvedValue({
      id: 'comment-1',
      serviceId: 'public-1',
      userId: 'resident-1',
      authorName: 'Resident',
      authorRole: 'resident',
      message: 'Also affecting us',
      postedAt: '2026-08-07T01:00:00Z',
    });
    await usePublicServiceStore.getState().addComment('token', 'public-1', 'Also affecting us');
    expect(usePublicServiceStore.getState().comments['public-1']).toHaveLength(1);
    expect(usePublicServiceStore.getState().services[0].commentCount).toBe(1);
  });

  it('removes an employee-reviewed merge suggestion from the popup queue', async () => {
    const suggestion = {
      id: 'suggestion-1',
      serviceA: service(),
      serviceB: service({ id: 'public-2' }),
      score: 0.91,
      rationale: 'same issue',
      modelName: 'gemini',
      status: 'Pending',
      reviewedById: null,
      reviewedAt: null,
      mergedServiceId: null,
      createdAt: '2026-08-07T01:00:00Z',
    } as PublicSimilaritySuggestion;
    mockFetchSuggestions.mockResolvedValue([suggestion]);
    await usePublicServiceStore.getState().refreshSuggestions('token');
    mockReviewSuggestion.mockResolvedValue({ ...suggestion, status: 'Declined' });
    await usePublicServiceStore.getState().reviewSuggestion('token', suggestion.id, false);
    expect(usePublicServiceStore.getState().suggestions).toHaveLength(0);
  });
});
