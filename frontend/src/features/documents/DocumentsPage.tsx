import { useState, useMemo } from 'react';
import {
  FileText,
  Upload,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  FileCode,
  Info,
  Layers,
} from 'lucide-react';
import { useIngestText } from '@/hooks/useContentQueries';
import { useTreeList } from '@/hooks/useTreeQueries';
import { Badge, ConfirmDialog } from '@/components/ui';
import { toast } from 'sonner';

interface UploadedDoc {
  id: string;
  name: string;
  size: number;
  type: string;
  treeId: string;
  chunksAdded: number;
  status: 'pending' | 'processing' | 'ingested' | 'failed';
  error?: string;
  uploadedAt: string;
}

const STORAGE_KEY = 'skilltree-uploaded-documents-v1';

export default function DocumentsPage() {
  const { data: trees } = useTreeList();
  const ingestText = useIngestText();

  const [documents, setDocuments] = useState<UploadedDoc[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const [selectedTreeId, setSelectedTreeId] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [docToDelete, setDocToDelete] = useState<string | null>(null);

  const addDocument = (newDoc: UploadedDoc) => {
    setDocuments((prev) => {
      const next = [newDoc, ...prev];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  };

  const updateDocumentStatus = (id: string, updates: Partial<UploadedDoc>) => {
    setDocuments((prev) => {
      const next = prev.map((d) => (d.id === id ? { ...d, ...updates } : d));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  };

  const removeDocument = (id: string) => {
    setDocuments((prev) => {
      const next = prev.filter((d) => d.id !== id);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (!selectedTreeId) {
      toast.error('Please select a target skill tree first.');
      return;
    }

    const file = files[0];
    const allowedExtensions = ['.txt', '.md', '.json', '.csv', '.tsv'];
    const lowerName = file.name.toLowerCase();
    const isPDF = lowerName.endsWith('.pdf');

    if (isPDF) {
      toast.warning(
        'Direct binary PDF ingestion requires teammate backend endpoint POST /ingest/pdf. Please save as .txt or .md to ingest now.'
      );
      return;
    }

    const hasValidExt = allowedExtensions.some((ext) => lowerName.endsWith(ext));
    if (!hasValidExt) {
      toast.error('Supported formats: .txt, .md, .json, .csv, .tsv (Text documents)');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('File size exceeds 5MB limit.');
      return;
    }

    setIsProcessing(true);
    const docId = `${Date.now()}-${file.name}`;
    const newDoc: UploadedDoc = {
      id: docId,
      name: file.name,
      size: file.size,
      type: file.type || 'text/plain',
      treeId: selectedTreeId,
      chunksAdded: 0,
      status: 'processing',
      uploadedAt: new Date().toISOString(),
    };

    addDocument(newDoc);

    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      if (!text || !text.trim()) {
        toast.error('Uploaded file is empty.');
        updateDocumentStatus(docId, { status: 'failed', error: 'File contains no text' });
        setIsProcessing(false);
        return;
      }

      try {
        const response = await ingestText.mutateAsync({
          tree_id: selectedTreeId,
          source: file.name,
          text: text.trim(),
        });

        updateDocumentStatus(docId, {
          status: 'ingested',
          chunksAdded: response.chunks_added,
        });
        toast.success(`Successfully ingested ${response.chunks_added} chunks into "${selectedTreeId}"`);
      } catch (err) {
        const errMessage = (err as Error).message;
        updateDocumentStatus(docId, { status: 'failed', error: errMessage });
        toast.error(`Ingestion failed: ${errMessage}`);
      } finally {
        setIsProcessing(false);
      }
    };

    reader.onerror = () => {
      updateDocumentStatus(docId, { status: 'failed', error: 'File read error' });
      setIsProcessing(false);
      toast.error('Could not read file from disk.');
    };

    reader.readAsText(file);
    e.target.value = '';
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="text-xl font-bold text-text-primary">Document Management & Text Ingestion</h2>
        <p className="text-sm text-text-secondary mt-1">
          Ingest supplemental textbooks, research notes, and syllabus materials into the RAG vector store
        </p>
      </div>

      {/* Target Tree Selector & Upload Card */}
      <div className="card space-y-4">
        <h3 className="text-base font-semibold text-text-primary">Ingest Supplemental Text</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">
              Select Target Skill Tree *
            </label>
            <select
              value={selectedTreeId}
              onChange={(e) => setSelectedTreeId(e.target.value)}
              className="input-field text-sm"
            >
              <option value="">-- Choose a Skill Tree --</option>
              {trees?.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title} ({t.id})
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-end">
            <label
              className={`btn-primary w-full flex items-center justify-center gap-2 cursor-pointer ${
                !selectedTreeId || isProcessing ? 'opacity-50 pointer-events-none' : ''
              }`}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Ingesting & Embedding...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" /> Upload & Embed Document
                </>
              )}
              <input
                type="file"
                accept=".txt,.md,.json,.csv"
                onChange={handleFileUpload}
                disabled={!selectedTreeId || isProcessing}
                className="hidden"
              />
            </label>
          </div>
        </div>
        <p className="text-xs text-text-muted">
          Supported: <code>.txt</code>, <code>.md</code>, <code>.json</code>, <code>.csv</code> (Max 5MB). Text is parsed into 800-character overlapping chunks and embedded via <code>mxbai-embed-large</code> into SQLite.
        </p>
      </div>

      {/* Documents Table */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-text-primary">Ingested Documents Index</h3>
          <span className="text-xs text-text-muted">{documents.length} recorded</span>
        </div>

        {documents.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs text-text-muted uppercase border-b border-dark-elevated">
                <tr>
                  <th className="py-3 px-3">Document</th>
                  <th className="py-3 px-3">Size</th>
                  <th className="py-3 px-3">Target Tree</th>
                  <th className="py-3 px-3">Chunks</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-elevated">
                {documents.map((doc) => (
                  <tr key={doc.id} className="hover:bg-dark-primary/40">
                    <td className="py-3 px-3 flex items-center gap-2 font-medium text-text-primary">
                      <FileCode className="h-4 w-4 text-accent-cyan" />
                      <span className="truncate max-w-[200px]">{doc.name}</span>
                    </td>
                    <td className="py-3 px-3 text-text-secondary text-xs">
                      {formatFileSize(doc.size)}
                    </td>
                    <td className="py-3 px-3 text-text-secondary text-xs">{doc.treeId}</td>
                    <td className="py-3 px-3 text-text-primary font-semibold text-xs">
                      {doc.chunksAdded > 0 ? (
                        <span className="flex items-center gap-1">
                          <Layers className="h-3.5 w-3.5 text-accent-purple" />
                          {doc.chunksAdded}
                        </span>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="py-3 px-3">
                      {doc.status === 'ingested' && <Badge variant="success">Ingested</Badge>}
                      {doc.status === 'processing' && <Badge variant="purple">Processing</Badge>}
                      {doc.status === 'failed' && <Badge variant="danger">Failed</Badge>}
                    </td>
                    <td className="py-3 px-3 text-right">
                      <button
                        onClick={() => setDocToDelete(doc.id)}
                        className="p-1 rounded text-text-muted hover:text-danger"
                        aria-label="Remove document reference"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-xs text-text-muted text-center py-8">
            No local documents ingested yet. Upload text files above to feed your skill trees.
          </p>
        )}
      </div>

      {/* Backend Integration Requirements Box */}
      <div className="card bg-dark-secondary/60 border-dark-elevated">
        <div className="flex items-start gap-3">
          <Info className="h-5 w-5 text-accent-cyan shrink-0 mt-0.5" />
          <div className="text-xs text-text-secondary space-y-1.5">
            <p className="font-semibold text-text-primary">
              PDF Ingestion & Multimodal Backend Pipeline Contract
            </p>
            <p>
              The FastAPI backend accepts plain text payloads via{' '}
              <code className="text-accent-cyan">POST /ingest/text</code>. Multimodal searches (YouTube transcripts, OpenAlex PDF abstracts, Wikipedia, DuckDuckGo) are performed natively in{' '}
              <code className="text-accent-cyan">backend/sources.py</code> during tree creation. Direct binary PDF multipart upload is documented in{' '}
              <code className="text-accent-cyan">docs/BACKEND_INTEGRATION_REQUIREMENTS.md</code> for future teammate implementation.
            </p>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={!!docToDelete}
        onClose={() => setDocToDelete(null)}
        onConfirm={() => {
          if (docToDelete) {
            removeDocument(docToDelete);
            setDocToDelete(null);
            toast.success('Document reference removed');
          }
        }}
        title="Remove Document Reference?"
        message="This removes the document from your local tracking index. Chunks already embedded in SQLite will remain until tree reset."
        confirmLabel="Remove"
        variant="danger"
      />
    </div>
  );
}
