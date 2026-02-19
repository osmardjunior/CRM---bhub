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
  addStage: (funnelId: string, label: string) => void;
  deleteStage: (funnelId: string, stageIndex: number) => void;
  renameStage: (funnelId: string, stageIndex: number, newLabel: string) => void;
  moveStage: (funnelId: string, stageIndex: number, direction: 'left' | 'right') => void;
  renameFunnel: (funnelId: string, newName: string) => void;
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

  const renameFunnel = (funnelId: string, newName: string) => {
    setFunnels((prev) =>
      prev.map((f) => (f.id === funnelId ? { ...f, name: newName } : f))
    );
  };

  const addStage = (funnelId: string, label: string) => {
    setFunnels((prev) =>
      prev.map((f) =>
        f.id === funnelId
          ? { ...f, stages: [...f.stages, { label, count: 0 }] }
          : f
      )
    );
  };

  const deleteStage = (funnelId: string, stageIndex: number) => {
    setFunnels((prev) =>
      prev.map((f) =>
        f.id === funnelId
          ? { ...f, stages: f.stages.filter((_, i) => i !== stageIndex) }
          : f
      )
    );
  };

  const renameStage = (funnelId: string, stageIndex: number, newLabel: string) => {
    setFunnels((prev) =>
      prev.map((f) =>
        f.id === funnelId
          ? {
              ...f,
              stages: f.stages.map((s, i) =>
                i === stageIndex ? { ...s, label: newLabel } : s
              ),
            }
          : f
      )
    );
  };

  const moveStage = (funnelId: string, stageIndex: number, direction: 'left' | 'right') => {
    setFunnels((prev) =>
      prev.map((f) => {
        if (f.id !== funnelId) return f;
        const stages = [...f.stages];
        const targetIndex = direction === 'left' ? stageIndex - 1 : stageIndex + 1;
        if (targetIndex < 0 || targetIndex >= stages.length) return f;
        [stages[stageIndex], stages[targetIndex]] = [stages[targetIndex], stages[stageIndex]];
        return { ...f, stages };
      })
    );
  };

  return (
    <FunnelContext.Provider
      value={{ funnels, addFunnel, deleteFunnel, getFunnel, addStage, deleteStage, renameStage, moveStage, renameFunnel }}
    >
      {children}
    </FunnelContext.Provider>
  );
}

export function useFunnels() {
  const ctx = useContext(FunnelContext);
  if (!ctx) throw new Error('useFunnels must be used inside FunnelProvider');
  return ctx;
}
