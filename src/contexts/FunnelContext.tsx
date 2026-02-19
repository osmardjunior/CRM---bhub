import { createContext, useContext, useState, ReactNode } from 'react';

export interface FunnelStage {
  label: string;
  count: number;
}

export interface Funnel {
  id: string;
  name: string;
  stages: FunnelStage[];
  expanded: boolean;
}

interface FunnelContextType {
  funnels: Funnel[];
  addFunnel: (data: Omit<Funnel, 'id' | 'expanded'>) => void;
  deleteFunnel: (id: string) => void;
  getFunnel: (id: string) => Funnel | undefined;
}

const FunnelContext = createContext<FunnelContextType | null>(null);

export function FunnelProvider({ children }: { children: ReactNode }) {
  const [funnels, setFunnels] = useState<Funnel[]>([]);

  const addFunnel = (data: Omit<Funnel, 'id' | 'expanded'>) => {
    const newFunnel: Funnel = {
      id: String(Date.now()),
      expanded: true,
      ...data,
    };
    setFunnels((prev) => [...prev, newFunnel]);
  };

  const deleteFunnel = (id: string) => {
    setFunnels((prev) => prev.filter((f) => f.id !== id));
  };

  const getFunnel = (id: string) => funnels.find((f) => f.id === id);

  return (
    <FunnelContext.Provider value={{ funnels, addFunnel, deleteFunnel, getFunnel }}>
      {children}
    </FunnelContext.Provider>
  );
}

export function useFunnels() {
  const ctx = useContext(FunnelContext);
  if (!ctx) throw new Error('useFunnels must be used inside FunnelProvider');
  return ctx;
}
