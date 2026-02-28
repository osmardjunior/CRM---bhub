import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
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
  department_id: string | null;
  project_id: string | null;
  stages: FunnelStage[];
  expanded: boolean;
}

interface FunnelContextType {
  funnels: Funnel[];
  loading: boolean;
  addFunnel: (data: { name: string; stages: { label: string; count: number }[]; department_id?: string | null; project_id?: string | null }) => Promise<void>;
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
        department_id: (f as any).department_id ?? null,
        project_id: (f as any).project_id ?? null,
        expanded: true,
        stages: (stagesData || [])
          .filter((s) => s.funnel_id === f.id)
          .map((s) => ({ id: s.id, label: s.label, position: s.position, count: countMap[s.id] ?? 0 })),
      }));

      setFunnels(mapped);
    } catch {
      toast.error('Erro ao carregar funis');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchFunnels();
  }, [fetchFunnels]);

  const addFunnel = async (data: { name: string; stages: { label: string; count: number }[]; department_id?: string | null; project_id?: string | null }) => {
    // company_id is set automatically by DB trigger
    const { data: newFunnel, error } = await supabase
      .from('funnels')
      .insert({ name: data.name, department_id: data.department_id || null, project_id: data.project_id || null } as TablesInsert<'funnels'>)
      .select()
      .single();

    if (error || !newFunnel) {
      toast.error('Erro ao criar funil');
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
        toast.error('Erro ao criar etapas');
      }
    }

    await fetchFunnels();
  };

  const deleteFunnel = async (id: string) => {
    const { error } = await supabase.from('funnels').delete().eq('id', id);
    if (error) {
      toast.error('Erro ao excluir funil');
      return;
    }
    await fetchFunnels();
  };

  const getFunnel = (id: string) => funnels.find((f) => f.id === id);

  const renameFunnel = async (funnelId: string, newName: string) => {
    const { error } = await supabase.from('funnels').update({ name: newName }).eq('id', funnelId);
    if (error) {
      toast.error('Erro ao renomear funil');
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
      toast.error('Erro ao adicionar etapa');
      return;
    }
    await fetchFunnels();
  };

  const deleteStage = async (funnelId: string, stageId: string) => {
    const { error } = await supabase.from('funnel_stages').delete().eq('id', stageId);
    if (error) {
      toast.error('Erro ao excluir etapa');
      return;
    }
    await fetchFunnels();
  };

  const renameStage = async (funnelId: string, stageId: string, newLabel: string) => {
    const { error } = await supabase.from('funnel_stages').update({ label: newLabel }).eq('id', stageId);
    if (error) {
      toast.error('Erro ao renomear etapa');
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

    const { error } = await supabase.rpc('swap_funnel_stage_positions', {
      p_stage_id_a: sorted[idx].id,
      p_position_a: sorted[targetIdx].position,
      p_stage_id_b: sorted[targetIdx].id,
      p_position_b: sorted[idx].position,
    } as any);

    if (error) {
      toast.error('Erro ao mover etapa');
      return;
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
