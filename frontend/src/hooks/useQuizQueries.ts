import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { quizzesApi } from '@/api';
import { treeKeys } from './useTreeQueries';

export const quizKeys = {
  all: ['quizzes'] as const,
  history: (treeId: string) => [...quizKeys.all, 'history', treeId] as const,
  results: (treeId: string, nodeId: string) => [...quizKeys.all, 'results', treeId, nodeId] as const,
};

export function useQuizHistory(treeId: string | undefined) {
  return useQuery({
    queryKey: quizKeys.history(treeId!),
    queryFn: () => quizzesApi.getHistory(treeId!),
    enabled: !!treeId,
    staleTime: 15_000,
  });
}

export function useQuizResults(treeId: string | undefined, nodeId: string | undefined) {
  return useQuery({
    queryKey: quizKeys.results(treeId!, nodeId!),
    queryFn: () => quizzesApi.getResults(treeId!, nodeId!),
    enabled: !!treeId && !!nodeId,
    retry: false,
  });
}

export function useCreateQuiz() {
  return useMutation({
    mutationFn: ({ treeId, nodeId, numQuestions }: { treeId: string; nodeId: string; numQuestions?: number }) =>
      quizzesApi.create(treeId, nodeId, numQuestions),
  });
}

export function useSubmitQuiz() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ quizId, answers }: { quizId: number; answers: Record<number, string> }) =>
      quizzesApi.submit(quizId, answers),
    onSuccess: (data) => {
      // The response includes the updated tree, so update the cache
      if (data.tree) {
        const treeId = data.results?.[0] ? undefined : undefined;
        // Invalidate all tree queries to pick up new nodes
        queryClient.invalidateQueries({ queryKey: treeKeys.all });
        queryClient.invalidateQueries({ queryKey: quizKeys.all });
      }
    },
  });
}
