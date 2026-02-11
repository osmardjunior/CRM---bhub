import { supabase } from '@/integrations/supabase/client';
import type { Tables, TablesInsert, TablesUpdate } from '@/integrations/supabase/types';

// ── Types ──────────────────────────────────────────────
export type Profile = Tables<'profiles'>;
export type Contact = Tables<'contacts'>;
export type ContactInsert = TablesInsert<'contacts'>;
export type ContactUpdate = TablesUpdate<'contacts'>;
export type Conversation = Tables<'conversations'>;
export type Message = Tables<'messages'>;

export type ConversationWithRelations = Conversation & {
  contact: Contact;
  assigned_user: Profile | null;
};

export type MessageWithSender = Message & {
  sender: Profile | null;
};

export type ConversationDetail = ConversationWithRelations & {
  messages: MessageWithSender[];
};

// ── Error helper ───────────────────────────────────────
const friendlyMessages: Record<string, string> = {
  '23505': 'Registro duplicado. Verifique os dados e tente novamente.',
  '23503': 'Referência inválida. O registro relacionado não existe.',
  '42501': 'Você não tem permissão para esta ação.',
  PGRST116: 'Registro não encontrado.',
};

export class ApiError extends Error {
  code: string;
  constructor(message: string, code: string) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
  }
}

function handleError(error: { message: string; code?: string; details?: string }): never {
  const code = error.code ?? 'UNKNOWN';
  const friendly =
    friendlyMessages[code] ??
    'Ocorreu um erro inesperado. Tente novamente mais tarde.';
  throw new ApiError(friendly, code);
}

// ── Profile ────────────────────────────────────────────
export async function getMyProfile(): Promise<Profile> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new ApiError('Usuário não autenticado.', 'AUTH');

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  if (error) handleError(error);
  if (!data) throw new ApiError('Perfil não encontrado.', 'NOT_FOUND');
  return data;
}

// ── Conversations ──────────────────────────────────────
export interface ConversationFilters {
  status?: Conversation['status'];
  channel?: Conversation['channel'];
  search?: string;
}

export async function listConversations(
  filters?: ConversationFilters,
): Promise<ConversationWithRelations[]> {
  let query = supabase
    .from('conversations')
    .select(`
      *,
      contact:contacts!conversations_contact_id_fkey(*),
      assigned_user:profiles!conversations_assigned_user_id_fkey(*)
    `)
    .order('last_message_at', { ascending: false });

  if (filters?.status) {
    query = query.eq('status', filters.status);
  }
  if (filters?.channel) {
    query = query.eq('channel', filters.channel);
  }

  const { data, error } = await query;
  if (error) handleError(error);

  let results = (data ?? []) as ConversationWithRelations[];

  // Client-side search on contact name / phone
  if (filters?.search) {
    const q = filters.search.toLowerCase();
    results = results.filter(
      (c) =>
        c.contact.name.toLowerCase().includes(q) ||
        (c.contact.phone ?? '').includes(q),
    );
  }

  return results;
}

export async function getConversation(
  conversationId: string,
): Promise<ConversationDetail> {
  const { data: conv, error: convErr } = await supabase
    .from('conversations')
    .select(`
      *,
      contact:contacts!conversations_contact_id_fkey(*),
      assigned_user:profiles!conversations_assigned_user_id_fkey(*)
    `)
    .eq('id', conversationId)
    .maybeSingle();

  if (convErr) handleError(convErr);
  if (!conv) throw new ApiError('Conversa não encontrada.', 'NOT_FOUND');

  const { data: msgs, error: msgErr } = await supabase
    .from('messages')
    .select(`
      *,
      sender:profiles!messages_sender_id_fkey(*)
    `)
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });

  if (msgErr) handleError(msgErr);

  return {
    ...(conv as ConversationWithRelations),
    messages: (msgs ?? []) as MessageWithSender[],
  };
}

export async function sendMessage(
  conversationId: string,
  body: string,
): Promise<Message> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new ApiError('Usuário não autenticado.', 'AUTH');

  // Get user's company_id
  const { data: profile } = await supabase
    .from('profiles')
    .select('company_id')
    .eq('id', user.id)
    .maybeSingle();

  if (!profile) throw new ApiError('Perfil não encontrado.', 'NOT_FOUND');

  const { data: msg, error: msgErr } = await supabase
    .from('messages')
    .insert({
      conversation_id: conversationId,
      company_id: profile.company_id,
      sender_type: 'agent',
      sender_id: user.id,
      body,
    })
    .select()
    .single();

  if (msgErr) handleError(msgErr);

  // Update last_message_at
  const { error: convErr } = await supabase
    .from('conversations')
    .update({ last_message_at: new Date().toISOString() })
    .eq('id', conversationId);

  if (convErr) console.error('Erro ao atualizar conversa:', convErr);

  return msg;
}

// ── Contacts ───────────────────────────────────────────
export interface ContactFilters {
  search?: string;
  tag?: string;
  source?: string;
}

export async function listContacts(
  filters?: ContactFilters,
): Promise<(Contact & { responsible: { id: string; name: string } | null })[]> {
  let query = supabase
    .from('contacts')
    .select('*, responsible:profiles!contacts_responsible_user_id_fkey(id, name)')
    .order('created_at', { ascending: false });

  if (filters?.source && filters.source !== 'all') {
    query = query.eq('source', filters.source);
  }

  const { data, error } = await query;
  if (error) handleError(error);

  let results = data ?? [];

  if (filters?.search) {
    const q = filters.search.toLowerCase();
    results = results.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.phone ?? '').includes(q),
    );
  }

  if (filters?.tag && filters.tag !== 'all') {
    results = results.filter((c) => {
      const tags = (c.tags as string[]) || [];
      return tags.includes(filters.tag!);
    });
  }

  return results as any;
}

export async function createContact(
  payload: Omit<ContactInsert, 'company_id'> & { company_id?: string },
): Promise<Contact> {
  // company_id auto-set by trigger if null
  const { data, error } = await supabase
    .from('contacts')
    .insert(payload as ContactInsert)
    .select()
    .single();

  if (error) handleError(error);
  return data;
}

export async function updateContact(
  contactId: string,
  payload: ContactUpdate,
): Promise<Contact> {
  const { data, error } = await supabase
    .from('contacts')
    .update(payload)
    .eq('id', contactId)
    .select()
    .single();

  if (error) handleError(error);
  return data;
}

// ── Team members ───────────────────────────────────────
export async function listTeamMembers(): Promise<Pick<Profile, 'id' | 'name' | 'email' | 'status'>[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, name, email, status')
    .order('name');

  if (error) handleError(error);
  return data ?? [];
}
