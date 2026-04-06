import { create } from "zustand";

interface SelectionState {
  selectedIds: Set<string>;
  isSelecting: boolean;
  toggle: (id: string) => void;
  select: (id: string) => void;
  deselect: (id: string) => void;
  selectAll: (ids: string[]) => void;
  clear: () => void;
  startSelecting: () => void;
  stopSelecting: () => void;
}

export const useSelectionStore = create<SelectionState>((set) => ({
  selectedIds: new Set(),
  isSelecting: false,

  toggle: (id) =>
    set((state) => {
      const next = new Set(state.selectedIds);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return { selectedIds: next };
    }),

  select: (id) =>
    set((state) => {
      const next = new Set(state.selectedIds);
      next.add(id);
      return { selectedIds: next };
    }),

  deselect: (id) =>
    set((state) => {
      const next = new Set(state.selectedIds);
      next.delete(id);
      return { selectedIds: next };
    }),

  selectAll: (ids) =>
    set(() => ({
      selectedIds: new Set(ids),
    })),

  clear: () => set({ selectedIds: new Set(), isSelecting: false }),

  startSelecting: () => set({ isSelecting: true }),

  stopSelecting: () => set({ selectedIds: new Set(), isSelecting: false }),
}));
