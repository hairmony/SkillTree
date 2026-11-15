import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { Note } from '@/types/app';
import { generateId } from '@/lib/utils';

interface NotesState {
  notes: Note[];
  addNote: (note: Omit<Note, 'id' | 'createdAt' | 'updatedAt'>) => Note;
  updateNote: (id: string, updates: Partial<Pick<Note, 'title' | 'content'>>) => void;
  deleteNote: (id: string) => void;
  getNotesByTree: (treeId: string) => Note[];
  getNotesByNode: (treeId: string, nodeId: string) => Note[];
  searchNotes: (query: string) => Note[];
  exportNotes: () => string;
  importNotes: (json: string) => number;
}

export const useNotesStore = create<NotesState>()(
  persist(
    (set, get) => ({
      notes: [],

      addNote: (noteData) => {
        const now = new Date().toISOString();
        const note: Note = {
          ...noteData,
          id: generateId(),
          createdAt: now,
          updatedAt: now,
        };
        set((state) => ({ notes: [note, ...state.notes] }));
        return note;
      },

      updateNote: (id, updates) => {
        set((state) => ({
          notes: state.notes.map((n) =>
            n.id === id
              ? { ...n, ...updates, updatedAt: new Date().toISOString() }
              : n
          ),
        }));
      },

      deleteNote: (id) => {
        set((state) => ({ notes: state.notes.filter((n) => n.id !== id) }));
      },

      getNotesByTree: (treeId) => {
        return get().notes.filter((n) => n.treeId === treeId);
      },

      getNotesByNode: (treeId, nodeId) => {
        return get().notes.filter((n) => n.treeId === treeId && n.nodeId === nodeId);
      },

      searchNotes: (query) => {
        const q = query.toLowerCase();
        return get().notes.filter(
          (n) =>
            n.title.toLowerCase().includes(q) ||
            n.content.toLowerCase().includes(q)
        );
      },

      exportNotes: () => {
        return JSON.stringify(get().notes, null, 2);
      },

      importNotes: (json) => {
        try {
          const imported = JSON.parse(json) as Note[];
          if (!Array.isArray(imported)) return 0;
          const existingIds = new Set(get().notes.map((n) => n.id));
          const newNotes = imported.filter((n) => n.id && !existingIds.has(n.id));
          set((state) => ({ notes: [...newNotes, ...state.notes] }));
          return newNotes.length;
        } catch {
          return 0;
        }
      },
    }),
    {
      name: 'skilltree-notes-v1',
      storage: createJSONStorage(() => localStorage),
    }
  )
);
