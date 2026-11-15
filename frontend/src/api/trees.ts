import apiClient from './client';
import type {
  TreeSummary,
  TreeDetail,
  CreateTreeRequest,
  CreateTreeResponse,
  GenerateTreeRequest,
  TreeStatus,
} from '@/types/api';

export const treesApi = {
  /** List all trees */
  list: async (): Promise<TreeSummary[]> => {
    const { data } = await apiClient.get<TreeSummary[]>('/trees');
    return data;
  },

  /** Get a tree with nodes, edges, status, and mastery */
  get: async (treeId: string): Promise<TreeDetail> => {
    const { data } = await apiClient.get<TreeDetail>(`/trees/${treeId}`);
    return data;
  },

  /** Create a tree from a topic (runs in background) */
  create: async (req: CreateTreeRequest): Promise<CreateTreeResponse> => {
    const { data } = await apiClient.post<CreateTreeResponse>('/trees/create', req);
    return data;
  },

  /** Generate a tree from existing ingested text */
  generate: async (req: GenerateTreeRequest): Promise<TreeDetail> => {
    const { data } = await apiClient.post<TreeDetail>('/trees/generate', req);
    return data;
  },

  /** Get tree generation status */
  status: async (treeId: string): Promise<TreeStatus> => {
    const { data } = await apiClient.get<TreeStatus>(`/trees/${treeId}/status`);
    return data;
  },

  /** Reset tree progress */
  reset: async (treeId: string): Promise<TreeDetail> => {
    const { data } = await apiClient.post<TreeDetail>(`/trees/${treeId}/reset`);
    return data;
  },

  /** Delete a tree */
  delete: async (treeId: string): Promise<{ deleted: string }> => {
    const { data } = await apiClient.delete<{ deleted: string }>(`/trees/${treeId}`);
    return data;
  },

  /** Mark a node as mastered (skipped) */
  markMastered: async (treeId: string, nodeId: string): Promise<TreeDetail> => {
    const { data } = await apiClient.post<TreeDetail>(
      `/trees/${treeId}/nodes/${nodeId}/mastered`
    );
    return data;
  },
};
