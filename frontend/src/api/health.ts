import apiClient from './client';
import type { HealthResponse } from '@/types/api';

export const healthApi = {
  check: async (): Promise<HealthResponse> => {
    const { data } = await apiClient.get<HealthResponse>('/health');
    return data;
  },
};
