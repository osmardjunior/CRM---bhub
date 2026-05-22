import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface ContactTag {
  tag_id: string;
  tag_name: string;
  tag_color: string;
}

export function useContactTags(contactId: string | undefined) {
  return useQuery({
    queryKey: ['contact-tags', contactId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contact_tags')
        .select('tag_id, tags(name, color)')
        .eq('contact_id', contactId!);

      if (error) throw error;

      return (data ?? []).map((row) => {
        const tag = row.tags as { name: string; color: string } | null;
        return {
          tag_id: row.tag_id,
          tag_name: tag?.name ?? '',
          tag_color: tag?.color ?? '#6366f1',
        };
      }) as ContactTag[];
    },
    enabled: !!contactId,
  });
}

export function useAddContactTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ contactId, tagId }: { contactId: string; tagId: string }) => {
      const { error } = await supabase
        .from('contact_tags')
        .insert({ contact_id: contactId, tag_id: tagId });
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['contact-tags', vars.contactId] });
      qc.invalidateQueries({ queryKey: ['contacts'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useRemoveContactTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ contactId, tagId }: { contactId: string; tagId: string }) => {
      const { error } = await supabase
        .from('contact_tags')
        .delete()
        .eq('contact_id', contactId)
        .eq('tag_id', tagId);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['contact-tags', vars.contactId] });
      qc.invalidateQueries({ queryKey: ['contacts'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
