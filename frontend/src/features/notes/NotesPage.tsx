import { useState, useMemo } from 'react';
import {
  StickyNote,
  Plus,
  Trash2,
  Edit3,
  Search,
  Download,
  Upload,
  Calendar,
  BookOpen,
  Check,
  X,
} from 'lucide-react';
import { useNotesStore } from '@/stores';
import { EmptyState, ConfirmDialog, Badge } from '@/components/ui';
import { formatDate } from '@/lib/utils';
import { toast } from 'sonner';
import type { Note } from '@/types';

export default function NotesPage() {
  const { notes, addNote, updateNote, deleteNote, exportNotes, importNotes } = useNotesStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [noteToDelete, setNoteToDelete] = useState<string | null>(null);

  const filteredNotes = useMemo(() => {
    if (!searchQuery.trim()) return notes;
    const q = searchQuery.toLowerCase();
    return notes.filter(
      (n) => n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q)
    );
  }, [notes, searchQuery]);

  const handleStartCreate = () => {
    const newN = addNote({
      title: 'Untitled Note',
      content: '',
      treeId: null,
      nodeId: null,
      treeName: null,
      nodeName: null,
    });
    setSelectedNote(newN);
    setEditTitle(newN.title);
    setEditContent(newN.content);
    setIsEditing(true);
  };

  const handleSelectNote = (n: Note) => {
    setSelectedNote(n);
    setEditTitle(n.title);
    setEditContent(n.content);
    setIsEditing(false);
  };

  const handleSaveEdit = () => {
    if (!selectedNote) return;
    updateNote(selectedNote.id, {
      title: editTitle.trim() || 'Untitled Note',
      content: editContent,
    });
    setSelectedNote((prev) =>
      prev ? { ...prev, title: editTitle.trim() || 'Untitled Note', content: editContent } : null
    );
    setIsEditing(false);
    toast.success('Note updated');
  };

  const handleExport = () => {
    const json = exportNotes();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `skilltree-notes-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Notes exported as JSON');
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const count = importNotes(content);
      if (count > 0) {
        toast.success(`Imported ${count} notes`);
      } else {
        toast.error('Could not parse notes or no new notes found');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-text-primary">My Notes & Bookmarks</h2>
          <p className="text-sm text-text-secondary mt-1">
            Personal thoughts and reflections captured during concept study
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="btn-secondary text-xs cursor-pointer">
            <Upload className="h-3.5 w-3.5" /> Import
            <input type="file" accept=".json" onChange={handleImport} className="hidden" />
          </label>
          <button onClick={handleExport} className="btn-secondary text-xs" disabled={notes.length === 0}>
            <Download className="h-3.5 w-3.5" /> Export
          </button>
          <button onClick={handleStartCreate} className="btn-primary text-xs">
            <Plus className="h-3.5 w-3.5" /> New Note
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[500px]">
        {/* Notes List Column */}
        <div className="lg:col-span-5 space-y-3">
          <div className="relative">
            <Search className="h-4 w-4 absolute left-3 top-3 text-text-muted" />
            <input
              type="text"
              placeholder="Search in notes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input-field pl-9 text-sm"
            />
          </div>

          <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
            {filteredNotes.length > 0 ? (
              filteredNotes.map((note) => (
                <div
                  key={note.id}
                  onClick={() => handleSelectNote(note)}
                  className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                    selectedNote?.id === note.id
                      ? 'border-accent-purple bg-accent-purple/10'
                      : 'border-dark-elevated bg-dark-card hover:border-accent-purple/30'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <h4 className="font-semibold text-sm text-text-primary truncate">{note.title}</h4>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setNoteToDelete(note.id);
                      }}
                      className="p-1 rounded text-text-muted hover:text-danger"
                      aria-label="Delete note"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <p className="text-xs text-text-secondary line-clamp-2 mb-2">{note.content || 'No content'}</p>
                  <div className="flex items-center justify-between text-[11px] text-text-muted">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {formatDate(note.updatedAt)}
                    </span>
                    {note.nodeName && (
                      <Badge variant="purple" className="text-[10px]">
                        {note.nodeName}
                      </Badge>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-12 text-text-muted text-sm">
                {searchQuery ? 'No notes matching query' : 'No notes created yet'}
              </div>
            )}
          </div>
        </div>

        {/* Note Reader / Editor Column */}
        <div className="lg:col-span-7">
          {selectedNote ? (
            <div className="card h-full flex flex-col">
              <div className="flex items-center justify-between pb-4 mb-4 border-b border-dark-elevated">
                {isEditing ? (
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="input-field font-semibold text-lg"
                    placeholder="Note title..."
                  />
                ) : (
                  <div>
                    <h3 className="text-lg font-bold text-text-primary">{selectedNote.title}</h3>
                    <div className="flex items-center gap-3 text-xs text-text-muted mt-1">
                      <span>Last updated: {formatDate(selectedNote.updatedAt)}</span>
                      {selectedNote.treeName && <span>Tree: {selectedNote.treeName}</span>}
                      {selectedNote.nodeName && <span>Concept: {selectedNote.nodeName}</span>}
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  {isEditing ? (
                    <>
                      <button onClick={handleSaveEdit} className="btn-primary text-xs py-1.5">
                        <Check className="h-3.5 w-3.5" /> Save
                      </button>
                      <button
                        onClick={() => {
                          setEditTitle(selectedNote.title);
                          setEditContent(selectedNote.content);
                          setIsEditing(false);
                        }}
                        className="btn-ghost text-xs py-1.5"
                      >
                        <X className="h-3.5 w-3.5" /> Cancel
                      </button>
                    </>
                  ) : (
                    <button onClick={() => setIsEditing(true)} className="btn-secondary text-xs py-1.5">
                      <Edit3 className="h-3.5 w-3.5" /> Edit
                    </button>
                  )}
                </div>
              </div>

              <div className="flex-1">
                {isEditing ? (
                  <textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    className="input-field h-full min-h-[350px] resize-none font-mono text-sm"
                    placeholder="Write your study notes here..."
                  />
                ) : (
                  <div className="text-sm text-text-secondary whitespace-pre-wrap leading-relaxed">
                    {selectedNote.content ? (
                      selectedNote.content
                    ) : (
                      <p className="text-text-muted italic">Click Edit to add content to this note...</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="card h-full flex flex-col items-center justify-center py-20 text-center">
              <StickyNote className="h-12 w-12 text-text-muted mb-3" />
              <h3 className="text-base font-semibold text-text-primary">Select or Create a Note</h3>
              <p className="text-xs text-text-secondary mt-1 max-w-xs">
                Capture key formulas, algorithmic insights, or study reminders.
              </p>
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={!!noteToDelete}
        onClose={() => setNoteToDelete(null)}
        onConfirm={() => {
          if (noteToDelete) {
            deleteNote(noteToDelete);
            if (selectedNote?.id === noteToDelete) setSelectedNote(null);
            setNoteToDelete(null);
            toast.success('Note deleted');
          }
        }}
        title="Delete Note?"
        message="Are you sure you want to delete this note? This action cannot be undone."
        confirmLabel="Delete"
        variant="danger"
      />
    </div>
  );
}
