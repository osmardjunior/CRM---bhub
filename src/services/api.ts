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
  project_id: string | null;
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
  replyToId?: string | null,
  dbMessageId?: string,
): Promise<{ delivered: boolean; messageId?: string; error?: string; reason?: string; detail?: string }> {
  try {
    const { data, error } = await supabase.functions.invoke('send-whatsapp', {
      body: {
        conversation_id: conversationId,
        body,
        ...(mediaUrl ? { media_url: mediaUrl } : {}),
        ...(replyToId ? { reply_to_id: replyToId } : {}),
        ...(dbMessageId ? { message_id: dbMessageId } : {}),
      },
    });
    if (error) {
      console.error('[sendViaWhatsApp] invoke error:', error);
      return { delivered: false, error: error.message ?? 'invoke_error' };
    }
    return {
      delivered: data?.delivered === true,
      messageId: data?.message_id ?? undefined,
      error: data?.error ?? undefined,
      reason: data?.reason ?? undefined,
      detail: data?.detail ?? undefined,
    };
  } catch (e: unknown) {
    console.error('[sendViaWhatsApp] exception:', e);
    return { delivered: false, error: e instanceof Error ? e.message : 'exception' };
  }
}

// ── Profile ────────────────────────────────────────────
export async function getMyProfile(): Promise<Profile> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new ApiError('Usuário não autenticado.', 'AUTH');

  const { data, error } = await supabase
    .from('profiles')
    .select('id, name, email, company_id, status, display_name, spy_mode, is_active')
    .eq('id', user.id)
    .maybeSingle();

  if (error) handleError(error);
  if (!data) throw new ApiError('Perfil não encontrado.', 'NOT_FOUND');
  return data;
}

// ── Conversations ──────────────────────────────────────
export interface ConversationFilters {
  status?: Conversation['status'];
  statusIn?: Conversation['status'][];
  channel?: Conversation['channel'];
  search?: string;
  name?: string;
  phone?: string;
  tag?: string;
  assigned_user_id?: string;
  integration_id?: string;
  project_id?: string;
  conversation_ids?: string[];
  funnel_id?: string;
  stage_id?: string;
  sort?: 'recent' | 'oldest' | 'name';
  /** When true, show ONLY archived conversations; when false/undefined, exclude archived */
  archived?: boolean;
  page?: number;
  limit?: number;
  /** When true, only return conversations with unread messages (DB-level filter via RPC) */
  has_unread?: boolean;
  /** Required when has_unread is true — the authenticated user's ID */
  has_unread_user_id?: string;
  /** Required when has_unread is true — the user's company ID */
  has_unread_company_id?: string;
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

  // ── has_unread: fetch IDs via paginated RPC, then load those conversations ──
  if (filters?.has_unread && filters.has_unread_user_id && filters.has_unread_company_id) {
    const { data: rows, error: rpcErr } = await supabase.rpc('get_unread_conversation_ids', {
      p_user_id: filters.has_unread_user_id,
      p_limit: limit,
      p_offset: from,
      p_company_id: filters.has_unread_company_id,
      p_project_id: filters.project_id ?? null,
      p_status_filter: filters.status ?? null,
      p_status_in: (!filters.status && filters.statusIn) ? filters.statusIn.join(',') : null,
      p_assigned_user_id: filters.assigned_user_id ?? null,
    } as Record<string, unknown>);

    if (rpcErr) {
      console.warn('[api] unread RPC failed:', rpcErr.message);
      return [];
    }
    const ids = (rows ?? []).map((r: { conversation_id: string }) => r.conversation_id);
    if (ids.length === 0) return [];

    // Build query with all remaining filters (channel, search, tag, etc.)
    let query = supabase
      .from('conversations')
      .select(`
        id, status, channel, last_message_at, last_message_preview, contact_id, assigned_user_id, department_id, project_id, integration_id, chatbot_active, archived_at, created_at, updated_at,
        contact:contacts!conversations_contact_id_fkey(id, name, phone, phone_e164, email, wa_identifier_raw, tags, is_group, source, responsible_user_id, avatar_url),
        assigned_user:profiles!conversations_assigned_user_id_fkey(id, name, email, display_name)
      `)
      .in('id', ids)
      .order('last_message_at', { ascending: false });

    // Apply additional filters that the RPC doesn't handle
    if (filters.status) {
      query = query.eq('status', filters.status);
    } else if (filters.statusIn?.length) {
      query = query.in('status', filters.statusIn);
    }
    if (filters.assigned_user_id && filters.assigned_user_id !== '__none__') {
      query = query.eq('assigned_user_id', filters.assigned_user_id);
    } else if (filters.assigned_user_id === '__none__') {
      query = query.is('assigned_user_id', null);
    }
    if (filters.channel) query = query.eq('channel', filters.channel);
    if (filters.integration_id) query = query.eq('integration_id', filters.integration_id);

    const { data, error } = await query;
    if (error) handleError(error);
    return (data ?? []) as ConversationWithRelations[];
  }

  let query = supabase
    .from('conversations')
    .select(`
      id, status, channel, last_message_at, last_message_preview, contact_id, assigned_user_id, department_id, project_id, integration_id, chatbot_active, archived_at, created_at, updated_at,
      contact:contacts!conversations_contact_id_fkey(id, name, phone, phone_e164, email, wa_identifier_raw, tags, is_group, source, responsible_user_id, avatar_url),
      assigned_user:profiles!conversations_assigned_user_id_fkey(id, name, email, display_name)
    `)
    .range(from, to);

  // Sort order — must be applied before other clauses
  if (filters?.sort === 'oldest') {
    query = query.order('last_message_at', { ascending: true });
  } else if (filters?.sort === 'name') {
    // Will sort client-side after fetch since it's a joined column
    query = query.order('last_message_at', { ascending: false });
  } else {
    // default: 'recent'
    query = query.order('last_message_at', { ascending: false });
  }

  if (filters?.status) {
    query = query.eq('status', filters.status);
  } else if (filters?.statusIn) {
    query = query.in('status', filters.statusIn);
  }
  if (filters?.channel) {
    query = query.eq('channel', filters.channel);
  }
  if (filters?.assigned_user_id) {
    if (filters.assigned_user_id === '__none__') {
      query = query.is('assigned_user_id', null);
    } else {
      query = query.eq('assigned_user_id', filters.assigned_user_id);
    }
  }
  if (filters?.integration_id) {
    query = query.eq('integration_id', filters.integration_id);
  }
  if (filters?.project_id) {
    query = query.eq('project_id', filters.project_id);
  }
  // Archived filter: by default exclude archived conversations
  if (filters?.archived) {
    query = query.not('archived_at', 'is', null);
  } else {
    query = query.is('archived_at', null);
  }
  if (filters?.conversation_ids && filters.conversation_ids.length > 0) {
    // '__none__' sentinel means "no results" (e.g. 0 unread conversations)
    if (filters.conversation_ids.length === 1 && filters.conversation_ids[0] === '__none__') {
      return [];
    }
    query = query.in('id', filters.conversation_ids);
  }

  // Funnel/stage filter: uses SECURITY DEFINER RPC to bypass RLS
  if (filters?.funnel_id) {
    const { data: funnelContacts } = await supabase.rpc('get_funnel_contact_ids', {
      p_funnel_id: filters.funnel_id,
      p_stage_id: filters.stage_id ?? null,
    });
    const funnelContactIds = (funnelContacts ?? []).map((r: { contact_id: string }) => r.contact_id);
    if (funnelContactIds.length === 0) return [];
    query = query.in('contact_id', funnelContactIds);
  }

  // Tag filter via normalized contact_tags table (replaces client-side filtering)
  if (filters?.tag) {
    const { data: tagRow } = await supabase
      .from('tags')
      .select('id')
      .eq('name', filters.tag)
      .maybeSingle();
    if (!tagRow) return [];
    const { data: taggedRows } = await supabase
      .from('contact_tags')
      .select('contact_id')
      .eq('tag_id', tagRow.id);
    const tagContactIds = (taggedRows ?? []).map((r) => r.contact_id).filter(Boolean);
    if (tagContactIds.length === 0) return [];
    query = query.in('contact_id', tagContactIds);
  }

  // Apply name/phone/search filters at the DB level
  if (filters?.name || filters?.phone || filters?.search) {
    let contactQuery = supabase.from('contacts').select('id');

    if (filters?.name) {
      contactQuery = contactQuery.ilike('name', `%${filters.name}%`);
    }
    if (filters?.phone) {
      contactQuery = contactQuery.ilike('phone', `%${filters.phone}%`);
    }
    if (filters?.search) {
      contactQuery = contactQuery.or(
        `name.ilike.%${filters.search}%,phone.ilike.%${filters.search}%,email.ilike.%${filters.search}%,phone_e164.ilike.%${filters.search}%`
      );
    }

    // Parallel search: contacts + messages at the same time
    const messageSearchPromise = (filters?.search && filters.search.length >= 3)
      ? supabase.from('messages').select('conversation_id').ilike('body', `%${filters.search}%`).limit(200)
      : Promise.resolve({ data: [] as { conversation_id: string }[] });

    const [{ data: matchingContacts }, { data: matchingMessages }] = await Promise.all([
      contactQuery,
      messageSearchPromise,
    ]);
    const contactIds = (matchingContacts ?? []).map((c) => c.id);
    const messageConvIds = [...new Set((matchingMessages ?? []).map((m) => m.conversation_id))];

    if (contactIds.length > 0 || messageConvIds.length > 0) {
      // Combine: conversations matching by contact OR by message content
      if (messageConvIds.length > 0 && contactIds.length > 0) {
        query = query.or(`contact_id.in.(${contactIds.join(',')}),id.in.(${messageConvIds.join(',')})`);
      } else if (contactIds.length > 0) {
        query = query.in('contact_id', contactIds);
      } else {
        query = query.in('id', messageConvIds);
      }
    } else {
      return [];
    }
  }

  const { data, error } = await query;
  if (error) handleError(error);

  let results = (data ?? []) as ConversationWithRelations[];
  if (filters?.sort === 'name') {
    results.sort((a, b) => (a.contact?.name ?? '').localeCompare(b.contact?.name ?? ''));
  }

  return results;
}

export async function getConversation(
  conversationId: string,
): Promise<ConversationDetail> {
  // Parallel fetch: conversation + messages (saves ~1 DB round-trip)
  const [{ data: conv, error: convErr }, { data: msgs, error: msgErr }] = await Promise.all([
    supabase
      .from('conversations')
      .select(`
        id, status, channel, last_message_at, last_message_preview, contact_id, assigned_user_id, department_id, project_id, integration_id, chatbot_active, archived_at, created_at, updated_at,
        contact:contacts!conversations_contact_id_fkey(id, name, phone, phone_e164, email, wa_identifier_raw, tags, is_group, source, responsible_user_id, avatar_url, created_at),
        assigned_user:profiles!conversations_assigned_user_id_fkey(id, name, email, display_name),
        integration:integrations!conversations_integration_id_fkey(id,device_name,phone_number,status,provider,project_id)
      `)
      .eq('id', conversationId)
      .maybeSingle(),
    supabase
      .from('messages')
      .select(`*, sender:profiles!messages_sender_id_fkey(id, name, email, display_name)`)
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .order('id', { ascending: true })
      .limit(300),
  ]);

  if (convErr) handleError(convErr);
  if (!conv) throw new ApiError('Conversa não encontrada.', 'NOT_FOUND');
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
    integration: (conv as unknown as { integration: IntegrationSummary | null }).integration ?? null,
  };
}

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

  // Fire-and-forget: auto-move + auto-assign without blocking the response.
  // These are cosmetic DB updates — not needed before returning the message.
  Promise.all([
    supabase.from('conversations').update({ status: 'open' as TablesUpdate<'conversations'>['status'] }).eq('id', conversationId).in('status', ['new']),
    supabase.from('conversations').update({ assigned_user_id: userId } as TablesUpdate<'conversations'>).eq('id', conversationId).is('assigned_user_id', null),
  ]).catch(() => {});

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
  /** When set, only contacts with a conversation in this project are returned */
  project_id?: string;
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
    .select('id, name, phone, phone_e164, email, tags, source, responsible_user_id, company_id, is_group, wa_identifier_raw, created_at, last_contact_at, responsible:profiles!contacts_responsible_user_id_fkey(id, name)', { count: 'exact' })
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
    const tagContactIds = (tagContacts ?? []).map((r) => r.contact_id).filter(Boolean);
    if (tagContactIds.length === 0) {
      return { data: [], total: 0, page, totalPages: 0 };
    }
    query = query.in('id', tagContactIds);
  }

  // Agents only see contacts with conversations in their project scope (and optionally assigned to them)
  if (filters?.assigned_user_id || filters?.project_id) {
    let convQuery = supabase.from('conversations').select('contact_id');
    if (filters.assigned_user_id) {
      convQuery = convQuery.eq('assigned_user_id', filters.assigned_user_id);
    }
    if (filters.project_id) {
      convQuery = convQuery.eq('project_id', filters.project_id);
    }
    const { data: convContacts } = await convQuery;
    const contactIds = Array.from(new Set((convContacts ?? []).map((c) => c.contact_id).filter(Boolean)));
    if (contactIds.length === 0) {
      return { data: [], total: 0, page, totalPages: 0 };
    }
    query = query.in('id', contactIds);
  }

  query = query.range(from, to);

  const { data, error, count } = await query;
  if (error) handleError(error);

  const contactRows = data ?? [];
  const total = count ?? 0;

  // Fetch tags from normalized contact_tags table for all returned contacts
  let contactTagsMap: Record<string, { name: string; color: string }[]> = {};
  if (contactRows.length > 0) {
    const contactIds = contactRows.map(c => c.id);
    const { data: ctData } = await supabase
      .from('contact_tags')
      .select('contact_id, tags:tag_id(name, color)')
      .in('contact_id', contactIds);
    for (const row of (ctData ?? []) as { contact_id: string; tags: { name: string; color: string } | null }[]) {
      const cid = row.contact_id;
      if (!contactTagsMap[cid]) contactTagsMap[cid] = [];
      if (row.tags) contactTagsMap[cid].push({ name: row.tags.name, color: row.tags.color });
    }
  }

  // Enrich contacts with fetched tags
  const enriched = contactRows.map(c => ({
    ...c,
    _tags: contactTagsMap[c.id] || [],
  }));

  return {
    data: enriched as unknown as (Contact & { responsible: { id: string; name: string } | null })[],
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
    .select('id, name, phone, phone_e164, email, tags, source, responsible_user_id, company_id, is_group, wa_identifier_raw, created_at, last_contact_at, responsible:profiles!contacts_responsible_user_id_fkey(id, name)')
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
    const tagContactIds = (tagContacts ?? []).map((r) => r.contact_id).filter(Boolean);
    if (tagContactIds.length === 0) return [];
    query = query.in('id', tagContactIds);
  }

  if (filters?.assigned_user_id || filters?.project_id) {
    let convQuery = supabase.from('conversations').select('contact_id');
    if (filters.assigned_user_id) {
      convQuery = convQuery.eq('assigned_user_id', filters.assigned_user_id);
    }
    if (filters.project_id) {
      convQuery = convQuery.eq('project_id', filters.project_id);
    }
    const { data: convContacts } = await convQuery;
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
  // Close all active conversations before deleting to avoid constraint violation
  // (idx_conv_unique_active_contact_integration)
  const { error: convError } = await supabase
    .from('conversations')
    .update({ status: 'closed' })
    .eq('contact_id', contactId)
    .not('status', 'in', '("closed","resolved")');

  if (convError) handleError(convError);

  const { error } = await supabase
    .from('contacts')
    .delete()
    .eq('id', contactId);

  if (error) handleError(error);
}

// ── Team members ───────────────────────────────────────
export async function listTeamMembers(): Promise<Pick<Profile, 'id' | 'name' | 'email' | 'status'>[]> {
  const { getAreaUserIds } = await import('@/lib/areaFilter');
  const areaUserIds = await getAreaUserIds();
  let query = supabase
    .from('profiles')
    .select('id, name, email, status')
    .order('name');
  if (areaUserIds) query = query.in('id', areaUserIds);
  const { data, error } = await query;

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
  companyId: string,
  spyMode = false,
): Promise<Record<string, number>> {
  if (conversationIds.length === 0 || !companyId) return {};

  // Use get_unread_counts RPC — returns actual per-conversation counts.
  // Falls back to get_unread_conversation_ids (binary 1/0) if the RPC fails.
  const { data, error } = await supabase.rpc('get_unread_counts', {
    p_user_id: userId,
    p_conversation_ids: conversationIds,
    p_spy_mode: spyMode,
  });

  if (!error && Array.isArray(data) && data.length > 0) {
    const counts: Record<string, number> = {};
    for (const row of data as { conversation_id: string; unread_count: number }[]) {
      if (row.conversation_id && row.unread_count > 0) {
        counts[row.conversation_id] = Number(row.unread_count);
      }
    }
    return counts;
  }

  // Fallback: get_unread_conversation_ids (binary presence)
  if (error) {
    console.warn('[api] get_unread_counts RPC failed, trying fallback:', error.message);
  }
  const { data: fallbackData, error: fbErr } = await supabase.rpc('get_unread_conversation_ids', {
    p_company_id: companyId,
    p_user_id: userId,
  });
  if (fbErr) {
    console.warn('[api] get_unread_conversation_ids RPC also failed:', fbErr.message);
    return {};
  }

  const raw = fallbackData ?? [];
  const ids: string[] = Array.isArray(raw)
    ? raw.map((r: any) => (typeof r === 'string' ? r : r.conversation_id)).filter(Boolean)
    : [];
  const unreadSet = new Set(ids);
  const counts: Record<string, number> = {};
  for (const id of conversationIds) {
    if (unreadSet.has(id)) counts[id] = 1;
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
export async function deleteMessage(messageId: string, deletedByUserId?: string): Promise<void> {
  const { error } = await supabase
    .from('messages')
    .update({ deleted_at: new Date().toISOString(), deleted_by: deletedByUserId ?? null })
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

export async function updateAnnotation(annotationId: string, body: string): Promise<void> {
  const { error } = await supabase
    .from('annotations')
    .update({ body })
    .eq('id', annotationId);
  if (error) handleError(error);
}

export async function deleteAnnotation(annotationId: string): Promise<void> {
  const { error } = await supabase
    .from('annotations')
    .delete()
    .eq('id', annotationId);
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
