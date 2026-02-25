import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { TablesInsert } from '@/integrations/supabase/types';

export interface FunnelStage {
  id: string;
  label: string;
  position: number;
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
  loading: boolean;
  addFunnel: (data: { name: string; stages: { label: string; count: number }[] }) => Promise<void>;
  deleteFunnel: (id: string) => Promise<void>;
  getFunnel: (id: string) => Funnel | undefined;
  addStage: (funnelId: string, label: string) => Promise<void>;
  deleteStage: (funnelId: string, stageId: string) => Promise<void>;
  renameStage: (funnelId: string, stageId: string, newLabel: string) => Promise<void>;
  moveStage: (funnelId: string, stageId: string, direction: 'left' | 'right') => Promise<void>;
  renameFunnel: (funnelId: string, newName: string) => Promise<void>;
}

const FunnelContext = createContext<FunnelContextType | null>(null);

export function FunnelProvider({ children }: { children: ReactNode }) {
  const [funnels, setFunnels] = useState<Funnel[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchFunnels = useCallback(async () => {
    try {
      const { data: funnelsData, error: fErr } = await supabase
        .from('funnels')
        .select('*')
        .order('created_at', { ascending: true });

      if (fErr) throw fErr;
      if (!funnelsData || funnelsData.length === 0) {
        setFunnels([]);
        return;
      }

      const funnelIds = funnelsData.map((f) => f.id);

      const [{ data: stagesData, error: sErr }, { data: countsData }] = await Promise.all([
        supabase
          .from('funnel_stages')
          .select('*')
          .in('funnel_id', funnelIds)
          .order('position', { ascending: true }),
        // Count contacts per stage from contact_funnel_stages
        supabase
          .from('contact_funnel_stages')
          .select('stage_id')
          .in('funnel_id', funnelIds),
      ]);

      if (sErr) throw sErr;

      // Build a count map: stage_id → number of contacts
      const countMap: Record<string, number> = {};
      for (const row of countsData ?? []) {
        countMap[row.stage_id] = (countMap[row.stage_id] ?? 0) + 1;
      }

      const mapped: Funnel[] = funnelsData.map((f) => ({
        id: f.id,
        name: f.name,
        expanded: true,
        stages: (stagesData || [])
          .filter((s) => s.funnel_id === f.id)
          .map((s) => ({ id: s.id, label: s.label, position: s.position, count: countMap[s.id] ?? 0 })),
      }));

      setFunnels(mapped);
    } catch {
      toast({ title: 'Erro ao carregar funis', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchFunnels();
  }, [fetchFunnels]);

  const addFunnel = async (data: { name: string; stages: { label: string; count: number }[] }) => {
    // company_id is set automatically by DB trigger
    const { data: newFunnel, error } = await supabase
      .from('funnels')
      .insert({ name: data.name } as TablesInsert<'funnels'>)
      .select()
      .single();

    if (error || !newFunnel) {
      toast({ title: 'Erro ao criar funil', variant: 'destructive' });
      return;
    }

    if (data.stages.length > 0) {
      const stagesToInsert = data.stages.map((s, i) => ({
        funnel_id: newFunnel.id,
        label: s.label,
        position: i,
      }));

      const { error: sErr } = await supabase.from('funnel_stages').insert(stagesToInsert as TablesInsert<'funnel_stages'>[]);
      if (sErr) {
        toast({ title: 'Erro ao criar etapas', variant: 'destructive' });
      }
    }

    await fetchFunnels();
  };

  const deleteFunnel = async (id: string) => {
    const { error } = await supabase.from('funnels').delete().eq('id', id);
    if (error) {
      toast({ title: 'Erro ao excluir funil', variant: 'destructive' });
      return;
    }
    await fetchFunnels();
  };

  const getFunnel = (id: string) => funnels.find((f) => f.id === id);

  const renameFunnel = async (funnelId: string, newName: string) => {
    const { error } = await supabase.from('funnels').update({ name: newName }).eq('id', funnelId);
    if (error) {
      toast({ title: 'Erro ao renomear funil', variant: 'destructive' });
      return;
    }
    await fetchFunnels();
  };

  const addStage = async (funnelId: string, label: string) => {
    const funnel = funnels.find((f) => f.id === funnelId);
    const nextPos = funnel ? Math.max(0, ...funnel.stages.map((s) => s.position)) + 1 : 0;

    // company_id is set automatically by DB trigger
    const { error } = await supabase
      .from('funnel_stages')
      .insert({ funnel_id: funnelId, label, position: nextPos } as TablesInsert<'funnel_stages'>);

    if (error) {
      toast({ title: 'Erro ao adicionar etapa', variant: 'destructive' });
      return;
    }
    await fetchFunnels();
  };

  const deleteStage = async (funnelId: string, stageId: string) => {
    const { error } = await supabase.from('funnel_stages').delete().eq('id', stageId);
    if (error) {
      toast({ title: 'Erro ao excluir etapa', variant: 'destructive' });
      return;
    }
    await fetchFunnels();
  };

  const renameStage = async (funnelId: string, stageId: string, newLabel: string) => {
    const { error } = await supabase.from('funnel_stages').update({ label: newLabel }).eq('id', stageId);
    if (error) {
      toast({ title: 'Erro ao renomear etapa', variant: 'destructive' });
      return;
    }
    await fetchFunnels();
  };

  const moveStage = async (funnelId: string, stageId: string, direction: 'left' | 'right') => {
    const funnel = funnels.find((f) => f.id === funnelId);
    if (!funnel) return;

    const sorted = [...funnel.stages].sort((a, b) => a.position - b.position);
    const idx = sorted.findIndex((s) => s.id === stageId);
    const targetIdx = direction === 'left' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= sorted.length) return;

    const updates = [
      { id: sorted[idx].id, position: sorted[targetIdx].position },
      { id: sorted[targetIdx].id, position: sorted[idx].position },
    ];

    for (const u of updates) {
      await supabase.from('funnel_stages').update({ position: u.position }).eq('id', u.id);
    }

    await fetchFunnels();
  };

  return (
    <FunnelContext.Provider
      value={{ funnels, loading, addFunnel, deleteFunnel, getFunnel, addStage, deleteStage, renameStage, moveStage, renameFunnel }}
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
