import apiClient from './client';
import type {
  Quiz,
  QuizSubmitRequest,
  QuizSubmitResponse,
  QuizResults,
  QuizHistoryItem,
} from '@/types/api';

export const quizzesApi = {
  /** Generate a new quiz for a node */
  create: async (
    treeId: string,
    nodeId: string,
    numQuestions: number = 5
  ): Promise<Quiz> => {
    const { data } = await apiClient.post<Quiz>(
      `/trees/${treeId}/nodes/${nodeId}/quiz`,
      null,
      { params: { num_questions: numQuestions } }
    );
    return data;
  },

  /** Submit quiz answers */
  submit: async (quizId: number, answers: Record<number, string>): Promise<QuizSubmitResponse> => {
    const { data } = await apiClient.post<QuizSubmitResponse>(
      `/quizzes/${quizId}/submit`,
      { answers } as QuizSubmitRequest
    );
    return data;
  },

  /** Get latest quiz results for a node */
  getResults: async (treeId: string, nodeId: string): Promise<QuizResults> => {
    const { data } = await apiClient.get<QuizResults>(
      `/trees/${treeId}/nodes/${nodeId}/quiz/results`
    );
    return data;
  },

  /** Get quiz history for a tree */
  getHistory: async (treeId: string): Promise<QuizHistoryItem[]> => {
    const { data } = await apiClient.get<QuizHistoryItem[]>(
      `/trees/${treeId}/quizzes`
    );
    return data;
  },
};
