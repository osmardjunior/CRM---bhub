import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface ChatbotFlow {
  id: string;
  company_id: string;
  name: string;
  is_active: boolean;
  business_hours: Record<string, any>;
  offline_message: string;
  ai_instructions: string;
  timeout_minutes: number;
  created_at: string;
  updated_at: string;
}

export interface ChatbotNode {
  id: string;
  flow_id: string;
  company_id: string;
  position: number;
  node_type: 'message' | 'menu' | 'collect_data' | 'ai_response' | 'transfer' | 'condition' | 'apply_tag' | 'move_to_funnel' | 'delegate' | 'delay' | 'close_chat' | 'webhook' | 'smart_router';
  config: Record<string, any>;
  created_at: string;
}

export function useChatbotFlows() {
  const { companyId } = useAuth();
  const queryClient = useQueryClient();

  const flowsQuery = useQuery({
    queryKey: ['chatbot-flows', companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('chatbot_flows')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as ChatbotFlow[];
    },
    enabled: !!companyId,
  });

  const createFlow = useMutation({
    mutationFn: async (name: string) => {
      const { data, error } = await supabase
        .from('chatbot_flows')
        .insert([{ name }] as any)
        .select()
        .single();
      if (error) throw error;
      return data as ChatbotFlow;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chatbot-flows'] });
      toast.success('Fluxo criado com sucesso!');
    },
    onError: (e: Error) => toast.error(`Erro ao criar fluxo: ${e.message}`),
  });

  const updateFlow = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<ChatbotFlow> & { id: string }) => {
      const { error } = await supabase.from('chatbot_flows').update(updates).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['chatbot-flows'] }),
    onError: (e: Error) => toast.error(`Erro ao atualizar fluxo: ${e.message}`),
  });

  const deleteFlow = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('chatbot_flows').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chatbot-flows'] });
      toast.success('Fluxo excluído');
    },
    onError: (e: Error) => toast.error(`Erro ao excluir: ${e.message}`),
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      if (is_active) {
        // Deactivate all first, then activate this one
        await supabase.from('chatbot_flows').update({ is_active: false }).eq('company_id', companyId!);
      }
      const { error } = await supabase.from('chatbot_flows').update({ is_active }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['chatbot-flows'] }),
    onError: (e: Error) => toast.error(`Erro ao alterar status: ${e.message}`),
  });

  return { flows: flowsQuery.data ?? [], isLoading: flowsQuery.isLoading, createFlow, updateFlow, deleteFlow, toggleActive };
}

export function useChatbotNodes(flowId: string | null) {
  const queryClient = useQueryClient();
  const { companyId } = useAuth();

  const nodesQuery = useQuery({
    queryKey: ['chatbot-nodes', flowId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('chatbot_nodes')
        .select('*')
        .eq('flow_id', flowId!)
        .order('position', { ascending: true });
      if (error) throw error;
      return data as ChatbotNode[];
    },
    enabled: !!flowId,
  });

  const addNode = useMutation({
    mutationFn: async ({ flow_id, position, node_type, config }: { flow_id: string; position: number; node_type: ChatbotNode['node_type']; config: Record<string, any> }) => {
      // Shift positions of nodes at or after this position
      const { data: existing } = await supabase
        .from('chatbot_nodes')
        .select('id, position')
        .eq('flow_id', flow_id)
        .gte('position', position)
        .order('position', { ascending: false });

      if (existing && existing.length > 0) {
        for (const node of existing) {
          await supabase.from('chatbot_nodes').update({ position: node.position + 1 }).eq('id', node.id);
        }
      }

      const { data, error } = await supabase
        .from('chatbot_nodes')
        .insert([{ flow_id, position, node_type, config, company_id: companyId }] as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chatbot-nodes'] });
      toast.success('Etapa adicionada!');
    },
    onError: (e: Error) => toast.error(`Erro ao adicionar etapa: ${e.message}`),
  });

  const updateNode = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<ChatbotNode> & { id: string }) => {
      const { error } = await supabase.from('chatbot_nodes').update(updates as any).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['chatbot-nodes'] }),
    onError: (e: Error) => toast.error(`Erro ao atualizar etapa: ${e.message}`),
  });

  const deleteNode = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('chatbot_nodes').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chatbot-nodes'] });
      toast.success('Etapa removida');
    },
    onError: (e: Error) => toast.error(`Erro ao remover etapa: ${e.message}`),
  });

  const reorderNodes = useMutation({
    mutationFn: async (orderedIds: string[]) => {
      await Promise.all(
        orderedIds.map((id, i) =>
          supabase.from('chatbot_nodes').update({ position: i }).eq('id', id)
        )
      );
    },
    onMutate: async (orderedIds) => {
      await queryClient.cancelQueries({ queryKey: ['chatbot-nodes', flowId] });
      const previous = queryClient.getQueryData(['chatbot-nodes', flowId]);
      queryClient.setQueryData(['chatbot-nodes', flowId], (old: ChatbotNode[] | undefined) => {
        if (!old) return old;
        return orderedIds.map((id, i) => {
          const node = old.find(n => n.id === id)!;
          return { ...node, position: i };
        });
      });
      return { previous };
    },
    onError: (_: Error, __: string[], context: { previous?: unknown } | undefined) => {
      if (context?.previous) {
        queryClient.setQueryData(['chatbot-nodes', flowId], context.previous);
      }
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['chatbot-nodes', flowId] }),
  });

  // Salva posição X/Y no campo config sem perder o config existente
  const updateNodePosition = useCallback(
    (id: string, x: number, y: number) => {
      const node = nodesQuery.data?.find(n => n.id === id);
      if (!node) return;
      updateNode.mutate({ id, config: { ...node.config, _canvas_x: x, _canvas_y: y } });
    },
    [nodesQuery.data, updateNode],
  );

  return { nodes: nodesQuery.data ?? [], isLoading: nodesQuery.isLoading, addNode, updateNode, updateNodePosition, deleteNode, reorderNodes };
}
