import { useQuery, useMutation } from '@tanstack/react-query';
import { contentApi } from '@/api';
import type { IngestTextRequest } from '@/types/api';

export const contentKeys = {
  all: ['content'] as const,
  node: (treeId: string, nodeId: string) => [...contentKeys.all, treeId, nodeId] as const,
  search: (treeId: string, query: string) => [...contentKeys.all, 'search', treeId, query] as const,
};

export function useNodeContent(treeId: string | undefined, nodeId: string | undefined) {
  return useQuery({
    queryKey: contentKeys.node(treeId!, nodeId!),
    queryFn: () => contentApi.getNodeContent(treeId!, nodeId!),
    enabled: !!treeId && !!nodeId,
    staleTime: 5 * 60_000, // Content rarely changes
  });
}

export function useSearch(treeId: string | undefined, query: string) {
  return useQuery({
    queryKey: contentKeys.search(treeId!, query),
    queryFn: () => contentApi.search(treeId!, query),
    enabled: !!treeId && query.length >= 2,
    staleTime: 60_000,
  });
}

export function useIngestText() {
  return useMutation({
    mutationFn: (req: IngestTextRequest) => contentApi.ingestText(req),
  });
}
