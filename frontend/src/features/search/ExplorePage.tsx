import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  ExternalLink,
  Loader2,
  Video,
  FileText,
  GraduationCap,
  Globe,
  BookOpen,
  Filter,
} from 'lucide-react';
import { useTreeList } from '@/hooks/useTreeQueries';
import { useSearch } from '@/hooks/useContentQueries';
import { Badge, EmptyState, ErrorMessage } from '@/components/ui';
import { debounce } from '@/lib/utils';
import type { SearchResult } from '@/types';

const sourceTypeIcons: Record<string, React.ElementType> = {
  video: Video,
  paper: FileText,
  wikipedia: GraduationCap,
  wikibooks: BookOpen,
  web: Globe,
  text: FileText,
};

function SearchResultCard({ result }: { result: SearchResult }) {
  const Icon = sourceTypeIcons[result.source_type] || Globe;

  return (
    <div className="card-hover">
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-xl bg-dark-primary border border-dark-elevated flex items-center justify-center shrink-0">
          <Icon className="h-5 w-5 text-accent-cyan" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Badge
              variant={
                result.source_type === 'video'
                  ? 'danger'
                  : result.source_type === 'paper'
                  ? 'purple'
                  : 'cyan'
              }
              className="text-[10px]"
            >
              {result.source_type}
            </Badge>
            <span className="text-xs text-text-muted">
              Cosine Similarity: {Math.round(result.score * 100)}%
            </span>
          </div>

          <h4 className="font-semibold text-text-primary text-sm mb-1 truncate">
            {result.title || result.source}
          </h4>

          <p className="text-xs text-text-secondary leading-relaxed line-clamp-3 mb-2">
            {result.text}
          </p>

          {result.url && (
            <a
              href={
                result.source_type === 'video' && result.start_seconds
                  ? `${result.url}&t=${Math.floor(result.start_seconds)}s`
                  : result.url
              }
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-accent-cyan hover:underline"
            >
              View original source <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ExplorePage() {
  const navigate = useNavigate();
  const { data: trees, isLoading: treesLoading } = useTreeList();

  const [selectedTreeId, setSelectedTreeId] = useState<string>('');
  const [queryInput, setQueryInput] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');

  // Default to first tree when loaded
  useEffect(() => {
    if (trees && trees.length > 0 && !selectedTreeId) {
      setSelectedTreeId(trees[0].id);
    }
  }, [trees, selectedTreeId]);

  const updateDebouncedQuery = useMemo(
    () => debounce((q: string) => setDebouncedQuery(q), 400),
    []
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQueryInput(e.target.value);
    updateDebouncedQuery(e.target.value);
  };

  const {
    data: searchResults,
    isLoading: searchLoading,
    error: searchError,
  } = useSearch(selectedTreeId || undefined, debouncedQuery);

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl mx-auto">
      <div>
        <h2 className="text-xl font-bold text-text-primary">Semantic Search & Knowledge Discovery</h2>
        <p className="text-sm text-text-secondary mt-1">
          Perform cosine-similarity vector queries across all retrieved RAG chunks in the embedding space
        </p>
      </div>

      {/* Search Header Controls */}
      <div className="card space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="sm:col-span-1">
            <label className="block text-xs font-medium text-text-secondary mb-1">
              Select Skill Tree Target
            </label>
            <select
              value={selectedTreeId}
              onChange={(e) => setSelectedTreeId(e.target.value)}
              className="input-field text-sm"
              disabled={treesLoading}
            >
              {trees?.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-text-secondary mb-1">
              Natural Language Semantic Query
            </label>
            <div className="relative">
              <Search className="h-4 w-4 absolute left-3 top-3 text-text-muted" />
              <input
                type="text"
                value={queryInput}
                onChange={handleInputChange}
                placeholder="e.g., How do eigenvalues relate to matrix transformation?"
                className="input-field pl-9 text-sm"
              />
              {searchLoading && (
                <Loader2 className="h-4 w-4 absolute right-3 top-3 text-accent-purple animate-spin" />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Results Area */}
      {searchError && (
        <ErrorMessage message={(searchError as Error).message} />
      )}

      {debouncedQuery.length < 2 ? (
        <div className="text-center py-16 text-text-muted">
          <Search className="h-12 w-12 mx-auto mb-3 opacity-40" />
          <p className="text-sm font-medium">Enter at least 2 characters to search chunks</p>
          <p className="text-xs text-text-muted mt-1">
            Queries are embedded via <code>mxbai-embed-large</code> and scored against indexed SQLite embeddings.
          </p>
        </div>
      ) : searchLoading ? (
        <div className="text-center py-16">
          <Loader2 className="h-8 w-8 text-accent-purple animate-spin mx-auto mb-3" />
          <p className="text-sm text-text-secondary">Searching vector store...</p>
        </div>
      ) : searchResults && searchResults.length > 0 ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-text-muted">
            <span>Found {searchResults.length} relevant passages</span>
            <span>Target: {selectedTreeId}</span>
          </div>
          {searchResults.map((result) => (
            <SearchResultCard key={result.id} result={result} />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={Search}
          title="No passages found"
          description={`No vector embeddings matched "${debouncedQuery}" in "${selectedTreeId}". Try different conceptual terms.`}
        />
      )}
    </div>
  );
}
