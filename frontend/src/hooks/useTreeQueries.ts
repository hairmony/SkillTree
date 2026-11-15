import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { treesApi } from '@/api';
import type { CreateTreeRequest } from '@/types/api';

export const treeKeys = {
  all: ['trees'] as const,
  lists: () => [...treeKeys.all, 'list'] as const,
  list: () => [...treeKeys.lists()] as const,
  details: () => [...treeKeys.all, 'detail'] as const,
  detail: (id: string) => [...treeKeys.details(), id] as const,
  status: (id: string) => [...treeKeys.all, 'status', id] as const,
};

export function useTreeList() {
  return useQuery({
    queryKey: treeKeys.list(),
    queryFn: treesApi.list,
    staleTime: 30_000,
  });
}

export function useTree(treeId: string | undefined) {
  return useQuery({
    queryKey: treeKeys.detail(treeId!),
    queryFn: () => treesApi.get(treeId!),
    enabled: !!treeId,
    staleTime: 10_000,
  });
}

export function useTreeStatus(treeId: string | undefined, enabled: boolean = false) {
  return useQuery({
    queryKey: treeKeys.status(treeId!),
    queryFn: () => treesApi.status(treeId!),
    enabled: !!treeId && enabled,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (data?.state === 'running') return 2000;
      return false;
    },
  });
}

export function useCreateTree() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (req: CreateTreeRequest) => treesApi.create(req),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: treeKeys.lists() });
    },
  });
}

export function useDeleteTree() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (treeId: string) => treesApi.delete(treeId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: treeKeys.lists() });
    },
  });
}

export function useResetTree() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (treeId: string) => treesApi.reset(treeId),
    onSuccess: (_, treeId) => {
      queryClient.invalidateQueries({ queryKey: treeKeys.detail(treeId) });
    },
  });
}

export function useMarkMastered() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ treeId, nodeId }: { treeId: string; nodeId: string }) =>
      treesApi.markMastered(treeId, nodeId),
    onSuccess: (data, { treeId }) => {
      queryClient.setQueryData(treeKeys.detail(treeId), data);
    },
  });
}
