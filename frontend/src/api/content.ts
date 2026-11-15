import apiClient from './client';
import type { NodeContent, SearchResult, IngestTextRequest, IngestTextResponse } from '@/types/api';

export const contentApi = {
  /** Get learning content for a node */
  getNodeContent: async (treeId: string, nodeId: string): Promise<NodeContent> => {
    const { data } = await apiClient.get<NodeContent>(
      `/trees/${treeId}/nodes/${nodeId}/content`
    );
    return data;
  },

  /** Search chunks within a tree */
  search: async (treeId: string, query: string, k: number = 3): Promise<SearchResult[]> => {
    const { data } = await apiClient.get<SearchResult[]>('/search', {
      params: { tree_id: treeId, q: query, k },
    });
    return data;
  },

  /** Ingest text into a tree */
  ingestText: async (req: IngestTextRequest): Promise<IngestTextResponse> => {
    const { data } = await apiClient.post<IngestTextResponse>('/ingest/text', req);
    return data;
  },
};
