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

// ── WhatsApp send helper (best-effort, never throws) ───
export async function sendViaWhatsApp(
  conversationId: string,
  body: string,
  mediaUrl?: string,
): Promise<void> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return;
    fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-whatsapp`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      },
      body: JSON.stringify({ conversation_id: conversationId, body, ...(mediaUrl ? { media_url: mediaUrl } : {}) }),
    }).catch(() => {
      // Best-effort: WhatsApp delivery failure is non-fatal
    });
  } catch {
    // Session fetch failed — non-fatal
  }
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
  name?: string;
  phone?: string;
  tag?: string;
  assigned_user_id?: string;
  sort?: 'recent' | 'oldest' | 'name';
  page?: number;
  limit?: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  totalPages: number;
}

export async function listConversations(
  filters?: ConversationFilters,
): Promise<ConversationWithRelations[]> {
  const limit = filters?.limit ?? 20;
  const page = filters?.page ?? 0;
  const from = page * limit;
  const to = from + limit - 1;

  let query = supabase
    .from('conversations')
    .select(`
      *,
      contact:contacts!conversations_contact_id_fkey(*),
      assigned_user:profiles!conversations_assigned_user_id_fkey(*)
    `)
    .order('last_message_at', { ascending: false })
    .range(from, to);

  if (filters?.status) {
    query = query.eq('status', filters.status);
  }
  if (filters?.channel) {
    query = query.eq('channel', filters.channel);
  }
  if (filters?.assigned_user_id) {
    query = query.eq('assigned_user_id', filters.assigned_user_id);
  }

  // Sort order
  if (filters?.sort === 'oldest') {
    query = query.order('last_message_at', { ascending: true });
  } else if (filters?.sort === 'name') {
    // Will sort client-side after fetch since it's a joined column
  }
  // default is already 'recent' (desc) set above

  // Apply name/phone filters at the DB level via contact_id subquery
  if (filters?.name || filters?.phone || filters?.search) {
    // We need to filter by contact fields — use a separate contacts query approach
    // Since Supabase doesn't support .ilike on joined columns directly in the main query,
    // we fetch contact IDs first, then filter conversations
    let contactQuery = supabase.from('contacts').select('id');
    
    if (filters?.name) {
      contactQuery = contactQuery.ilike('name', `%${filters.name}%`);
    }
    if (filters?.phone) {
      contactQuery = contactQuery.ilike('phone', `%${filters.phone}%`);
    }
    if (filters?.search) {
      contactQuery = contactQuery.or(`name.ilike.%${filters.search}%,phone.ilike.%${filters.search}%`);
    }
    
    const { data: matchingContacts } = await contactQuery;
    if (matchingContacts && matchingContacts.length > 0) {
      const contactIds = matchingContacts.map((c) => c.id);
      query = query.in('contact_id', contactIds);
    } else {
      // No contacts match — return empty
      return [];
    }
  }

  const { data, error } = await query;
  if (error) handleError(error);

  let results = (data ?? []) as ConversationWithRelations[];

  // Client-side filter for tags (JSON field, can't easily query in DB)
  if (filters?.tag) {
    results = results.filter((c) => {
      const tags = (c.contact.tags as string[]) || [];
      return tags.includes(filters.tag!);
    });
  }
  if (filters?.sort === 'name') {
    results.sort((a, b) => a.contact.name.localeCompare(b.contact.name));
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

  // Non-critical: update timestamp. Log in dev only.
  if (convErr && import.meta.env.DEV) {
    console.warn('[api] Erro ao atualizar last_message_at:', convErr);
  }

  // Try to send via WhatsApp API (best-effort, don't block)
  sendViaWhatsApp(conversationId, body);

  return msg;
}

// ── Contacts ───────────────────────────────────────────
export interface ContactFilters {
  search?: string;
  tag?: string;
  source?: string;
  page?: number;
  limit?: number;
}

export async function listContacts(
  filters?: ContactFilters,
): Promise<PaginatedResult<Contact & { responsible: { id: string; name: string } | null }>> {
  const limit = filters?.limit ?? 25;
  const page = filters?.page ?? 0;
  const from = page * limit;
  const to = from + limit - 1;

  let query = supabase
    .from('contacts')
    .select('*, responsible:profiles!contacts_responsible_user_id_fkey(id, name)', { count: 'exact' })
    .order('created_at', { ascending: false });

  if (filters?.source && filters.source !== 'all') {
    query = query.eq('source', filters.source);
  }

  if (filters?.search) {
    query = query.or(`name.ilike.%${filters.search}%,phone.ilike.%${filters.search}%`);
  }

  query = query.range(from, to);

  const { data, error, count } = await query;
  if (error) handleError(error);

  let results = data ?? [];

  if (filters?.tag && filters.tag !== 'all') {
    results = results.filter((c) => {
      const tags = (c.tags as string[]) || [];
      return tags.includes(filters.tag!);
    });
  }

  const total = count ?? 0;
  return {
    data: results as (Contact & { responsible: { id: string; name: string } | null })[],
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
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

// ── Conversation reads (unread logic) ──────────────────
export interface ConversationRead {
  conversation_id: string;
  last_read_at: string;
}

export async function getConversationReads(): Promise<ConversationRead[]> {
  const { data, error } = await supabase
    .from('conversation_reads')
    .select('conversation_id, last_read_at');

  if (error) handleError(error);
  return (data ?? []) as ConversationRead[];
}

export async function markConversationRead(conversationId: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new ApiError('Usuário não autenticado.', 'AUTH');

  const { data: profile } = await supabase
    .from('profiles')
    .select('company_id')
    .eq('id', user.id)
    .maybeSingle();

  if (!profile) throw new ApiError('Perfil não encontrado.', 'NOT_FOUND');

  const now = new Date().toISOString();

  const { error } = await supabase
    .from('conversation_reads')
    .upsert(
      [{ conversation_id: conversationId, user_id: user.id, last_read_at: now, company_id: profile.company_id }],
      { onConflict: 'conversation_id,user_id' },
    );

  if (error) handleError(error);
}

export async function getUnreadCounts(
  conversationIds: string[],
  reads: ConversationRead[],
): Promise<Record<string, number>> {
  if (conversationIds.length === 0) return {};

  const counts: Record<string, number> = {};
  const readMap: Record<string, string> = {};
  for (const r of reads) {
    readMap[r.conversation_id] = r.last_read_at;
  }

  for (const convId of conversationIds) {
    const lastRead = readMap[convId];
    let query = supabase
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('conversation_id', convId)
      .eq('sender_type', 'user');

    if (lastRead) {
      query = query.gt('created_at', lastRead);
    }

    const { count, error } = await query;
    if (!error) {
      counts[convId] = count ?? 0;
    }
  }

  return counts;
}

// ── Close conversation ────────────────────────────────
export async function closeConversation(
  conversationId: string,
  closeReason: string,
): Promise<void> {
  const { error } = await supabase
    .from('conversations')
    .update({
      status: 'closed' as TablesUpdate<'conversations'>['status'],
      close_reason: closeReason,
    })
    .eq('id', conversationId);

  if (error) handleError(error);
}

// ── Group detection helper ────────────────────────────
export function isGroupChat(phone: string | null | undefined, contact?: { is_group?: boolean | null }): boolean {
  if (contact?.is_group) return true;
  if (!phone) return false;
  if (phone.includes('@g.us')) return true;
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('120363')) return true;
  if (digits.length >= 18) return true;
  return false;
}

// ── Annotations ───────────────────────────────────────
export interface Annotation {
  id: string;
  conversation_id: string;
  author_id: string;
  body: string;
  created_at: string;
  author?: { name: string; avatar_url: string | null } | null;
}

export async function listAnnotations(conversationId: string): Promise<Annotation[]> {
  const { data, error } = await supabase
    .from('annotations')
    .select('*, author:profiles!annotations_author_id_fkey(name, avatar_url)')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });

  if (error) handleError(error);
  return (data ?? []) as unknown as Annotation[];
}

export async function createAnnotation(conversationId: string, body: string): Promise<Annotation> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new ApiError('Usuário não autenticado.', 'AUTH');

  // company_id is set automatically by the DB trigger
  const insertPayload = { conversation_id: conversationId, author_id: user.id, body } as TablesInsert<'annotations'>;

  const { data, error } = await supabase
    .from('annotations')
    .insert(insertPayload)
    .select('*, author:profiles!annotations_author_id_fkey(name, avatar_url)')
    .single();

  if (error) handleError(error);
  return data as unknown as Annotation;
}
