"use client";

import { create } from "zustand";

type NavigationState = {
  optimisticPath: string | null;
  pendingRoute: string | null;
  searchOpen: boolean;
  setPendingRoute: (href: string) => void;
  clearPendingRoute: () => void;
  setSearchOpen: (open: boolean) => void;
};

export const useNavigationStore = create<NavigationState>((set) => ({
  optimisticPath: null,
  pendingRoute: null,
  searchOpen: false,
  setPendingRoute: (href) =>
    set({
      optimisticPath: href,
      pendingRoute: href,
    }),
  clearPendingRoute: () =>
    set({
      optimisticPath: null,
      pendingRoute: null,
    }),
  setSearchOpen: (open) => set({ searchOpen: open }),
}));
