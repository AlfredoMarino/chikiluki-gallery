import { create } from "zustand";

interface UIState {
  sidebarOpen: boolean;
  lightboxOpen: boolean;
  lightboxPhotoId: string | null;
  toggleSidebar: () => void;
  openLightbox: (photoId: string) => void;
  closeLightbox: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: false,
  lightboxOpen: false,
  lightboxPhotoId: null,

  toggleSidebar: () =>
    set((state) => ({ sidebarOpen: !state.sidebarOpen })),

  openLightbox: (photoId) =>
    set({ lightboxOpen: true, lightboxPhotoId: photoId }),

  closeLightbox: () =>
    set({ lightboxOpen: false, lightboxPhotoId: null }),
}));
