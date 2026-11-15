// ========== Tree Types ==========

export interface TreeSummary {
  id: string;
  title: string;
}

export interface TreeNode {
  id: string;
  title: string;
  description: string;
  objectives: string[];
  kind: 'core' | 'required' | 'optional';
  origin: string | null;
  depth: number;
  status: 'locked' | 'unlocked' | 'mastered';
  mastery: number;
}

export interface TreeEdge {
  parent_id: string;
  child_id: string;
}

export interface TreeDetail {
  nodes: TreeNode[];
  edges: TreeEdge[];
}

// ========== Tree Creation ==========

export interface CreateTreeRequest {
  topic: string;
  description?: string;
  text?: string;
  source?: string;
}

export interface CreateTreeResponse {
  tree_id: string;
}

export interface GenerateTreeRequest {
  tree_id: string;
  topic: string;
}

export interface TreeStatus {
  tree_id: string;
  topic?: string;
  state: 'running' | 'done' | 'failed';
  message: string;
  updated_at?: string;
}

// ========== Node Content ==========

export interface ContentSource {
  source: string;
  title: string;
  type: string;
  url: string | null;
}

export interface NodeContent {
  details: string;
  examples: string[];
  sources: ContentSource[];
}

// ========== Quiz Types ==========

export interface QuizOption {
  id: string;
  text: string;
}

export interface QuizQuestion {
  id: number;
  text: string;
  options: QuizOption[];
  difficulty: 'easy' | 'medium' | 'hard';
}

export interface Quiz {
  quiz_id: number;
  node_id: string;
  questions: QuizQuestion[];
}

export interface QuizSubmitRequest {
  answers: Record<number, string>;
}

export interface QuizResultQuestion {
  id: number;
  text: string;
  options: QuizOption[];
  correct: boolean;
  chosen: string;
  correct_option_id: string;
  explanation: string;
  concept: string;
}

export interface AddedNode {
  id: string;
  title: string;
  kind: 'required' | 'optional';
}

export interface QuizSubmitResponse {
  score: number;
  pass_score: number;
  passed: boolean;
  mastery: number;
  results: QuizResultQuestion[];
  added: AddedNode[];
  added_error: string | null;
  tree: TreeDetail;
}

export interface QuizResults {
  score: number;
  results: QuizResultQuestion[];
  added: AddedNode[];
}

export interface QuizHistoryItem {
  quiz_id: number;
  node_id: string;
  title: string;
  score: number;
  submitted_at: string;
  added_nodes: string[];
  missed_concepts: string[];
}

// ========== Ingestion ==========

export interface IngestTextRequest {
  tree_id?: string;
  topic?: string;
  source?: string;
  text: string;
  max_chars?: number;
}

export interface IngestTextResponse {
  chunks_added: number;
  tree_id: string;
}

// ========== Search ==========

export interface SearchResult {
  id: number;
  source: string;
  text: string;
  source_type: string;
  title: string | null;
  url: string | null;
  start_seconds: number | null;
  score: number;
}

// ========== Health ==========

export interface HealthResponse {
  ok: boolean;
}
