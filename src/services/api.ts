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

export type ReplyToMessage = {
  id: string;
  body: string | null;
  sender_type: string;
  sender_name: string | null;
};

export type MessageWithSender = Message & {
  sender: Profile | null;
  reply_to?: ReplyToMessage | null;
};

export type IntegrationSummary = {
  id: string;
  device_name: string;
  phone_number: string | null;
  status: string;
  provider: string;
};

export type ConversationDetail = ConversationWithRelations & {
  messages: MessageWithSender[];
  integration: IntegrationSummary | null;
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
): Promise<{ delivered: boolean; messageId?: string; error?: string; reason?: string }> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return { delivered: false, reason: 'not_authenticated' };
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-whatsapp`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      },
      body: JSON.stringify({ conversation_id: conversationId, body, ...(mediaUrl ? { media_url: mediaUrl } : {}) }),
    }).catch(() => null);
    if (!res) return { delivered: false, reason: 'network_error' };
    const data = await res.json().catch(() => null);
    if (!res.ok) return { delivered: false, error: data?.error ?? `http_${res.status}` };
    return {
      delivered: data?.delivered === true,
      messageId: data?.message_id ?? undefined,
      error: data?.error ?? undefined,
      reason: data?.reason ?? undefined,
    };
  } catch (e: any) {
    return { delivered: false, error: e?.message ?? 'exception' };
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
  project_id?: string;
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
  if (filters?.project_id) {
    query = query.eq('project_id', filters.project_id);
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
      assigned_user:profiles!conversations_assigned_user_id_fkey(*),
      integration:integrations!conversations_integration_id_fkey(id,device_name,phone_number,status,provider)
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

  // Build a map of id → message for resolving reply_to context client-side
  const msgList = (msgs ?? []) as MessageWithSender[];
  const msgMap = new Map(msgList.map((m) => [m.id, m]));
  const messagesWithReply = msgList.map((m) => {
    if (m.reply_to_id) {
      const parent = msgMap.get(m.reply_to_id);
      if (parent) {
        return {
          ...m,
          reply_to: {
            id: parent.id!,
            body: parent.body ?? null,
            sender_type: parent.sender_type,
            sender_name: parent.sender_name ?? parent.sender?.name ?? null,
          },
        };
      }
    }
    return m;
  });

  return {
    ...(conv as ConversationWithRelations),
    messages: messagesWithReply,
    integration: (conv as any).integration ?? null,
  };
}

// Cache para perfil do usuário (reduz latência)
let cachedProfile: { id: string; company_id: string } | null = null;
let cachedProfileUserId: string | null = null;

export async function sendMessage(
  conversationId: string,
  body: string,
  replyToId?: string | null,
  opts?: { userId: string; companyId: string },
): Promise<Message> {
  // Use provided opts (from AuthContext) to skip 2 extra DB roundtrips
  let userId = opts?.userId;
  let companyId = opts?.companyId;

  if (!userId || !companyId) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new ApiError('Usuário não autenticado.', 'AUTH');
    userId = user.id;
    if (!companyId) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', userId)
        .maybeSingle();
      if (!profile) throw new ApiError('Perfil não encontrado.', 'NOT_FOUND');
      companyId = profile.company_id;
    }
  }

  const { data: msg, error: msgErr } = await supabase
    .from('messages')
    .insert({
      conversation_id: conversationId,
      company_id: companyId,
      sender_type: 'agent',
      sender_id: userId,
      body,
      ...(replyToId ? { reply_to_id: replyToId } : {}),
    })
    .select()
    .single();

  if (msgErr) handleError(msgErr);

  // Auto-move conversation from "new" (Aberto) → "open" (Em Atendimento)
  // when an agent sends the first reply. Only changes if still "new".
  await supabase
    .from('conversations')
    .update({ status: 'open' })
    .eq('id', conversationId)
    .eq('status', 'new');

  // last_message_at is now updated by DB trigger — no extra UPDATE needed.
  // WhatsApp delivery is handled by the caller (useSendMessage) to enable toast feedback.

  return msg!;
}

// ── Contacts ───────────────────────────────────────────
export interface ContactFilters {
  search?: string;
  /** Filter by tag UUID — uses contact_tags normalized table */
  tag_id?: string;
  source?: string;
  page?: number;
  limit?: number;
  /** When set, only contacts with a conversation assigned to this user_id are returned */
  assigned_user_id?: string;
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

  // Filter by tag (normalized contact_tags table) — before range() so count is correct
  if (filters?.tag_id && filters.tag_id !== 'all') {
    const { data: tagContacts } = await supabase
      .from('contact_tags')
      .select('contact_id')
      .eq('tag_id', filters.tag_id);
    const tagContactIds = (tagContacts ?? []).map((r: any) => r.contact_id).filter(Boolean);
    if (tagContactIds.length === 0) {
      return { data: [], total: 0, page, totalPages: 0 };
    }
    query = query.in('id', tagContactIds);
  }

  // Agents only see contacts with conversations assigned to them
  if (filters?.assigned_user_id) {
    const { data: convContacts } = await supabase
      .from('conversations')
      .select('contact_id')
      .eq('assigned_user_id', filters.assigned_user_id);
    const contactIds = Array.from(new Set((convContacts ?? []).map((c) => c.contact_id).filter(Boolean)));
    if (contactIds.length === 0) {
      return { data: [], total: 0, page, totalPages: 0 };
    }
    query = query.in('id', contactIds);
  }

  query = query.range(from, to);

  const { data, error, count } = await query;
  if (error) handleError(error);

  const total = count ?? 0;
  return {
    data: (data ?? []) as (Contact & { responsible: { id: string; name: string } | null })[],
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
}

/** Fetch ALL contacts matching the given filters (no pagination) — for CSV export. */
export async function exportAllContacts(
  filters?: Omit<ContactFilters, 'page' | 'limit'>,
): Promise<(Contact & { responsible: { id: string; name: string } | null })[]> {
  let query = supabase
    .from('contacts')
    .select('*, responsible:profiles!contacts_responsible_user_id_fkey(id, name)')
    .order('created_at', { ascending: false })
    .range(0, 9999); // up to 10 k contacts

  if (filters?.source && filters.source !== 'all') {
    query = query.eq('source', filters.source);
  }

  if (filters?.search) {
    query = query.or(`name.ilike.%${filters.search}%,phone.ilike.%${filters.search}%`);
  }

  if (filters?.tag_id && filters.tag_id !== 'all') {
    const { data: tagContacts } = await supabase
      .from('contact_tags')
      .select('contact_id')
      .eq('tag_id', filters.tag_id);
    const tagContactIds = (tagContacts ?? []).map((r: any) => r.contact_id).filter(Boolean);
    if (tagContactIds.length === 0) return [];
    query = query.in('id', tagContactIds);
  }

  if (filters?.assigned_user_id) {
    const { data: convContacts } = await supabase
      .from('conversations')
      .select('contact_id')
      .eq('assigned_user_id', filters.assigned_user_id);
    const contactIds = Array.from(
      new Set((convContacts ?? []).map((c) => c.contact_id).filter(Boolean)),
    );
    if (contactIds.length === 0) return [];
    query = query.in('id', contactIds);
  }

  const { data, error } = await query;
  if (error) handleError(error);
  return (data ?? []) as (Contact & { responsible: { id: string; name: string } | null })[];
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

export async function deleteContact(contactId: string): Promise<void> {
  const { error } = await supabase
    .from('contacts')
    .delete()
    .eq('id', contactId);

  if (error) handleError(error);
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

export async function markConversationRead(
  conversationId: string,
  opts?: { userId: string; companyId: string },
): Promise<void> {
  let userId = opts?.userId;
  let companyId = opts?.companyId;

  if (!userId || !companyId) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new ApiError('Usuário não autenticado.', 'AUTH');
    userId = user.id;
    if (!companyId) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', userId)
        .maybeSingle();
      if (!profile) throw new ApiError('Perfil não encontrado.', 'NOT_FOUND');
      companyId = profile.company_id;
    }
  }

  const { error } = await supabase
    .from('conversation_reads')
    .upsert(
      [{ conversation_id: conversationId, user_id: userId, last_read_at: new Date().toISOString(), company_id: companyId }],
      { onConflict: 'conversation_id,user_id' },
    );

  if (error) handleError(error);
}

export async function getUnreadCounts(
  conversationIds: string[],
  userId: string,
): Promise<Record<string, number>> {
  if (conversationIds.length === 0) return {};

  const { data, error } = await supabase.rpc('get_unread_counts', {
    p_user_id: userId,
    p_conversation_ids: conversationIds,
  });

  if (error) {
    console.warn('[api] get_unread_counts RPC failed:', error.message);
    return {};
  }

  const counts: Record<string, number> = {};
  for (const row of (data ?? []) as { conversation_id: string; unread_count: number }[]) {
    counts[row.conversation_id] = Number(row.unread_count);
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

// ── Message deletion (soft-delete) ────────────────────
export async function deleteMessage(messageId: string): Promise<void> {
  const { error } = await supabase
    .from('messages')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', messageId);
  if (error) handleError(error);
}

// ── Mark conversation as unread ────────────────────────
export async function markConversationUnread(conversationId: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new ApiError('Usuário não autenticado.', 'AUTH');
  // Deleting the read record makes it count as "never read" → unread badge appears
  const { error } = await supabase
    .from('conversation_reads')
    .delete()
    .eq('conversation_id', conversationId)
    .eq('user_id', user.id);
  if (error) handleError(error);
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
