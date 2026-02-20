import { create } from 'zustand';

interface ChatFilters {
  search: string;
  tags: string[];
  tagMode: 'all' | 'any' | 'none';
  responsibleIds: string[];
  funnelId: string | null;
  stageId: string | null;
  status: string | null;
  sortBy: 'recent' | 'unread' | 'alphabetical';
  showUnread: boolean;
  showArchived: boolean;
  showBroadcasts: boolean;
  showFavorites: boolean;
  showScheduled: boolean;
}

const defaultFilters: ChatFilters = {
  search: '',
  tags: [],
  tagMode: 'any',
  responsibleIds: [],
  funnelId: null,
  stageId: null,
  status: 'open',
  sortBy: 'recent',
  showUnread: false,
  showArchived: false,
  showBroadcasts: false,
  showFavorites: false,
  showScheduled: false,
};

interface ChatStore {
  activeChatId: string | null;
  setActiveChatId: (id: string | null) => void;

  filters: ChatFilters;
  setFilter: <K extends keyof ChatFilters>(key: K, value: ChatFilters[K]) => void;
  resetFilters: () => void;

  isRightPanelOpen: boolean;
  toggleRightPanel: () => void;
  setRightPanelOpen: (open: boolean) => void;

  activeHistoryTab: string;
  setActiveHistoryTab: (tab: string) => void;

  isAIDrawerOpen: boolean;
  setAIDrawerOpen: (open: boolean) => void;

  soundEnabled: boolean;
  toggleSound: () => void;
}

export const useChatStore = create<ChatStore>((set) => ({
  activeChatId: null,
  setActiveChatId: (id) => set({ activeChatId: id }),

  filters: { ...defaultFilters },
  setFilter: (key, value) =>
    set((state) => ({
      filters: { ...state.filters, [key]: value },
    })),
  resetFilters: () => set({ filters: { ...defaultFilters } }),

  isRightPanelOpen: true,
  toggleRightPanel: () => set((s) => ({ isRightPanelOpen: !s.isRightPanelOpen })),
  setRightPanelOpen: (open) => set({ isRightPanelOpen: open }),

  activeHistoryTab: 'atendimento',
  setActiveHistoryTab: (tab) => set({ activeHistoryTab: tab }),

  isAIDrawerOpen: false,
  setAIDrawerOpen: (open) => set({ isAIDrawerOpen: open }),

  soundEnabled: typeof window !== 'undefined' ? localStorage.getItem('sound_enabled') !== 'false' : true,
  toggleSound: () =>
    set((s) => {
      const next = !s.soundEnabled;
      localStorage.setItem('sound_enabled', String(next));
      return { soundEnabled: next };
    }),
}));
