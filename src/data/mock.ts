export type ConversationStatus = 'aberta' | 'pendente' | 'resolvida';
export type ContactStatus = 'online' | 'ausente' | 'offline';
export type PipelineStage = 'novo_lead' | 'em_contato' | 'proposta' | 'fechamento' | 'ganho' | 'perdido';
export type TaskPriority = 'alta' | 'media' | 'baixa';
export type TaskStatus = 'pendente' | 'em_progresso' | 'concluida';
export type Channel = 'whatsapp' | 'instagram' | 'webchat';

export interface Conversation {
  id: string;
  contactName: string;
  contactAvatar: string;
  contactPhone: string;
  contactEmail: string;
  contactTags: string[];
  lastMessage: string;
  timestamp: string;
  unread: number;
  status: ConversationStatus;
  channel: Channel;
  assignedTo: string | null;
}

export interface Message {
  id: string;
  conversationId: string;
  content: string;
  timestamp: string;
  direction: 'incoming' | 'outgoing';
  senderName: string;
}

export interface TimelineEvent {
  id: string;
  type: 'message' | 'note' | 'status' | 'assign' | 'tag';
  description: string;
  timestamp: string;
  user?: string;
}

export interface Contact {
  id: string;
  name: string;
  email: string;
  phone: string;
  company: string;
  status: ContactStatus;
  avatar: string;
  tags: string[];
  origem: string;
  responsavel: string;
  observacoes: string;
  ultimoContato: string;
  createdAt: string;
}

export interface PipelineDeal {
  id: string;
  title: string;
  contactName: string;
  value: number;
  stage: PipelineStage;
  probability: number;
  assignedTo: string;
  notes: string;
  createdAt: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  priority: TaskPriority;
  status: TaskStatus;
  dueDate: string;
  assignedTo: string;
  contactName?: string;
}

const avatars = [
  'https://api.dicebear.com/7.x/initials/svg?seed=ML',
  'https://api.dicebear.com/7.x/initials/svg?seed=AS',
  'https://api.dicebear.com/7.x/initials/svg?seed=CR',
  'https://api.dicebear.com/7.x/initials/svg?seed=JP',
  'https://api.dicebear.com/7.x/initials/svg?seed=FM',
  'https://api.dicebear.com/7.x/initials/svg?seed=LB',
];

export const agents = ['Ana Silva', 'Carlos Rocha', 'Felipe Moura', 'Juliana Costa'];

export const quickReplies = [
  'Olá! Como posso ajudar você hoje?',
  'Agradecemos o seu contato! Vou verificar e retorno em instantes.',
  'Pode me informar o número do seu pedido, por favor?',
  'Estou transferindo você para o setor responsável.',
  'Seu problema foi resolvido? Posso ajudar em mais alguma coisa?',
  'Nosso horário de atendimento é de segunda a sexta, das 8h às 18h.',
  'Vou escalar esse caso para a equipe técnica. Em breve retornamos.',
  'Obrigado pela preferência! Tenha um ótimo dia! 😊',
];

export const conversations: Conversation[] = [
  { id: '1', contactName: 'Maria Lima', contactAvatar: avatars[0], contactPhone: '(11) 99999-1234', contactEmail: 'maria@empresa.com', contactTags: ['VIP', 'Enterprise'], lastMessage: 'Olá, preciso de ajuda com meu pedido #4521', timestamp: '2 min', unread: 3, status: 'aberta', channel: 'whatsapp', assignedTo: 'Ana Silva' },
  { id: '2', contactName: 'André Santos', contactAvatar: avatars[1], contactPhone: '(21) 98888-5678', contactEmail: 'andre@startup.io', contactTags: ['Lead'], lastMessage: 'Vocês têm plano empresarial?', timestamp: '15 min', unread: 1, status: 'aberta', channel: 'webchat', assignedTo: null },
  { id: '3', contactName: 'Carla Ribeiro', contactAvatar: avatars[2], contactPhone: '(31) 97777-9012', contactEmail: 'carla@design.com', contactTags: ['Cliente'], lastMessage: 'Obrigada pelo suporte!', timestamp: '1h', unread: 0, status: 'resolvida', channel: 'instagram', assignedTo: 'Ana Silva' },
  { id: '4', contactName: 'João Pereira', contactAvatar: avatars[3], contactPhone: '(41) 96666-3456', contactEmail: 'joao@corp.com.br', contactTags: ['Enterprise', 'Prioritário'], lastMessage: 'Ainda aguardando retorno sobre a proposta', timestamp: '3h', unread: 2, status: 'pendente', channel: 'whatsapp', assignedTo: 'Felipe Moura' },
  { id: '5', contactName: 'Fernanda Martins', contactAvatar: avatars[4], contactPhone: '(51) 95555-7890', contactEmail: 'fernanda@loja.com', contactTags: ['Cliente'], lastMessage: 'Quero cancelar minha assinatura', timestamp: '5h', unread: 0, status: 'aberta', channel: 'webchat', assignedTo: 'Ana Silva' },
  { id: '6', contactName: 'Lucas Borges', contactAvatar: avatars[5], contactPhone: '(61) 94444-2345', contactEmail: 'lucas@dev.com', contactTags: ['Lead', 'Desenvolvedor'], lastMessage: 'Como faço para integrar com meu sistema?', timestamp: '1d', unread: 0, status: 'pendente', channel: 'instagram', assignedTo: null },
];

export const messages: Message[] = [
  { id: 'm1', conversationId: '1', content: 'Olá, preciso de ajuda com meu pedido #4521', timestamp: '10:30', direction: 'incoming', senderName: 'Maria Lima' },
  { id: 'm2', conversationId: '1', content: 'Olá Maria! Claro, vou verificar o status do seu pedido agora mesmo.', timestamp: '10:31', direction: 'outgoing', senderName: 'Ana Silva' },
  { id: 'm3', conversationId: '1', content: 'O pedido #4521 está em processamento e deve ser enviado até amanhã.', timestamp: '10:32', direction: 'outgoing', senderName: 'Ana Silva' },
  { id: 'm4', conversationId: '1', content: 'Ah que bom! E vocês enviam por qual transportadora?', timestamp: '10:35', direction: 'incoming', senderName: 'Maria Lima' },
  { id: 'm5', conversationId: '1', content: 'Normalmente usamos a Jadlog ou Correios, dependendo da região. Vou confirmar qual será usada no seu caso.', timestamp: '10:36', direction: 'outgoing', senderName: 'Ana Silva' },
  { id: 'm6', conversationId: '1', content: 'Perfeito, obrigada! Outra dúvida: consigo alterar o endereço de entrega ainda?', timestamp: '10:40', direction: 'incoming', senderName: 'Maria Lima' },
  { id: 'm7', conversationId: '2', content: 'Boa tarde! Vocês têm plano empresarial?', timestamp: '09:15', direction: 'incoming', senderName: 'André Santos' },
  { id: 'm8', conversationId: '2', content: 'Estou buscando uma solução para minha equipe de 15 pessoas.', timestamp: '09:16', direction: 'incoming', senderName: 'André Santos' },
  { id: 'm9', conversationId: '4', content: 'Bom dia, gostaria de saber se houve avanço na proposta que enviamos.', timestamp: '07:00', direction: 'incoming', senderName: 'João Pereira' },
  { id: 'm10', conversationId: '4', content: 'Precisamos de uma resposta até sexta-feira para fecharmos com vocês.', timestamp: '07:02', direction: 'incoming', senderName: 'João Pereira' },
  { id: 'm11', conversationId: '5', content: 'Olá, gostaria de cancelar minha assinatura do plano Pro.', timestamp: '06:00', direction: 'incoming', senderName: 'Fernanda Martins' },
  { id: 'm12', conversationId: '5', content: 'Oi Fernanda, sentimos muito em saber disso. Posso saber o motivo?', timestamp: '06:15', direction: 'outgoing', senderName: 'Ana Silva' },
];

export const timelineEvents: Record<string, TimelineEvent[]> = {
  '1': [
    { id: 't1', type: 'assign', description: 'Conversa atribuída a Ana Silva', timestamp: '10:28', user: 'Sistema' },
    { id: 't2', type: 'message', description: 'Primeira mensagem recebida via WhatsApp', timestamp: '10:30', user: 'Maria Lima' },
    { id: 't3', type: 'tag', description: 'Tag "VIP" adicionada', timestamp: '10:31', user: 'Ana Silva' },
    { id: 't4', type: 'note', description: 'Cliente solicitou informação sobre pedido #4521', timestamp: '10:32', user: 'Ana Silva' },
    { id: 't5', type: 'status', description: 'Status alterado para "Aberta"', timestamp: '10:28', user: 'Sistema' },
  ],
  '2': [
    { id: 't6', type: 'message', description: 'Nova conversa iniciada via Webchat', timestamp: '09:15', user: 'André Santos' },
    { id: 't7', type: 'status', description: 'Aguardando atribuição de agente', timestamp: '09:15', user: 'Sistema' },
  ],
  '4': [
    { id: 't8', type: 'assign', description: 'Conversa atribuída a Felipe Moura', timestamp: '06:50', user: 'Sistema' },
    { id: 't9', type: 'message', description: 'Mensagem recebida via WhatsApp', timestamp: '07:00', user: 'João Pereira' },
    { id: 't10', type: 'note', description: 'Cliente aguarda resposta sobre proposta comercial', timestamp: '07:05', user: 'Felipe Moura' },
    { id: 't11', type: 'status', description: 'Status alterado para "Pendente"', timestamp: '07:05', user: 'Felipe Moura' },
  ],
};

export const origens = ['WhatsApp', 'Instagram', 'Webchat', 'Indicação', 'Google Ads', 'Facebook Ads'];

export const contacts: Contact[] = [
  { id: '1', name: 'Maria Lima', email: 'maria@empresa.com', phone: '(11) 99999-1234', company: 'TechBR Ltda', status: 'online', avatar: avatars[0], tags: ['VIP', 'Enterprise'], origem: 'WhatsApp', responsavel: 'Ana Silva', observacoes: 'Cliente premium, atendimento prioritário.', ultimoContato: '2025-02-10', createdAt: '2024-01-15' },
  { id: '2', name: 'André Santos', email: 'andre@startup.io', phone: '(21) 98888-5678', company: 'StartupIO', status: 'ausente', avatar: avatars[1], tags: ['Lead'], origem: 'Google Ads', responsavel: 'Carlos Rocha', observacoes: '', ultimoContato: '2025-02-08', createdAt: '2024-02-20' },
  { id: '3', name: 'Carla Ribeiro', email: 'carla@design.com', phone: '(31) 97777-9012', company: 'DesignCo', status: 'offline', avatar: avatars[2], tags: ['Cliente'], origem: 'Indicação', responsavel: 'Ana Silva', observacoes: 'Projeto de design finalizado.', ultimoContato: '2025-01-28', createdAt: '2024-03-10' },
  { id: '4', name: 'João Pereira', email: 'joao@corp.com.br', phone: '(41) 96666-3456', company: 'CorpBrasil', status: 'online', avatar: avatars[3], tags: ['Enterprise', 'Prioritário'], origem: 'WhatsApp', responsavel: 'Felipe Moura', observacoes: 'Aguardando proposta de expansão.', ultimoContato: '2025-02-11', createdAt: '2024-04-05' },
  { id: '5', name: 'Fernanda Martins', email: 'fernanda@loja.com', phone: '(51) 95555-7890', company: 'LojaOnline', status: 'offline', avatar: avatars[4], tags: ['Cliente'], origem: 'Instagram', responsavel: 'Ana Silva', observacoes: 'Solicitou cancelamento de assinatura.', ultimoContato: '2025-02-05', createdAt: '2024-05-12' },
  { id: '6', name: 'Lucas Borges', email: 'lucas@dev.com', phone: '(61) 94444-2345', company: 'DevSolutions', status: 'ausente', avatar: avatars[5], tags: ['Lead', 'Desenvolvedor'], origem: 'Webchat', responsavel: 'Carlos Rocha', observacoes: 'Interessado na integração API.', ultimoContato: '2025-02-01', createdAt: '2024-06-01' },
];

export const pipelineDeals: PipelineDeal[] = [
  { id: '1', title: 'Plano Enterprise TechBR', contactName: 'Maria Lima', value: 24000, stage: 'proposta', probability: 70, assignedTo: 'Ana Silva', notes: 'Aguardando aprovação do financeiro.', createdAt: '2024-08-01' },
  { id: '2', title: 'Licença StartupIO', contactName: 'André Santos', value: 4800, stage: 'novo_lead', probability: 20, assignedTo: 'Carlos Rocha', notes: 'Lead captado via Google Ads.', createdAt: '2024-09-15' },
  { id: '3', title: 'Projeto DesignCo', contactName: 'Carla Ribeiro', value: 12000, stage: 'ganho', probability: 100, assignedTo: 'Ana Silva', notes: 'Contrato assinado em janeiro.', createdAt: '2024-07-10' },
  { id: '4', title: 'Expansão CorpBrasil', contactName: 'João Pereira', value: 48000, stage: 'em_contato', probability: 45, assignedTo: 'Felipe Moura', notes: 'Reunião agendada para próxima semana.', createdAt: '2024-10-01' },
  { id: '5', title: 'Migração LojaOnline', contactName: 'Fernanda Martins', value: 8000, stage: 'perdido', probability: 0, assignedTo: 'Ana Silva', notes: 'Cliente optou por concorrente.', createdAt: '2024-06-20' },
  { id: '6', title: 'Integração DevSolutions', contactName: 'Lucas Borges', value: 16000, stage: 'proposta', probability: 60, assignedTo: 'Carlos Rocha', notes: 'Proposta enviada, aguardando retorno.', createdAt: '2024-11-01' },
  { id: '7', title: 'Suporte Premium TechBR', contactName: 'Maria Lima', value: 6000, stage: 'fechamento', probability: 90, assignedTo: 'Ana Silva', notes: 'Negociação final de valores.', createdAt: '2025-01-05' },
  { id: '8', title: 'Consultoria StartupIO', contactName: 'André Santos', value: 3200, stage: 'novo_lead', probability: 15, assignedTo: 'Carlos Rocha', notes: '', createdAt: '2025-01-20' },
];

export const tasks: Task[] = [
  { id: '1', title: 'Responder proposta TechBR', description: 'Enviar detalhamento técnico da proposta', priority: 'alta', status: 'pendente', dueDate: '2025-02-12', assignedTo: 'Ana Silva', contactName: 'Maria Lima' },
  { id: '2', title: 'Follow-up StartupIO', description: 'Agendar reunião de demonstração', priority: 'media', status: 'em_progresso', dueDate: '2025-02-14', assignedTo: 'Carlos Rocha', contactName: 'André Santos' },
  { id: '3', title: 'Onboarding DesignCo', description: 'Configurar conta e treinamento inicial', priority: 'media', status: 'concluida', dueDate: '2025-02-10', assignedTo: 'Ana Silva', contactName: 'Carla Ribeiro' },
  { id: '4', title: 'Enviar contrato CorpBrasil', description: 'Preparar e enviar contrato de expansão', priority: 'alta', status: 'pendente', dueDate: '2025-02-13', assignedTo: 'Felipe Moura', contactName: 'João Pereira' },
  { id: '5', title: 'Atualizar documentação API', description: 'Revisar docs da API v2', priority: 'baixa', status: 'pendente', dueDate: '2025-02-20', assignedTo: 'Carlos Rocha' },
  { id: '6', title: 'Ligar para Fernanda', description: 'Entender motivo do cancelamento', priority: 'alta', status: 'pendente', dueDate: '2025-02-11', assignedTo: 'Ana Silva', contactName: 'Fernanda Martins' },
  { id: '7', title: 'Preparar demo DevSolutions', description: 'Montar ambiente de demonstração da API', priority: 'media', status: 'em_progresso', dueDate: '2025-02-18', assignedTo: 'Carlos Rocha', contactName: 'Lucas Borges' },
  { id: '8', title: 'Revisar proposta Enterprise', description: 'Ajustar valores conforme feedback', priority: 'alta', status: 'concluida', dueDate: '2025-02-08', assignedTo: 'Ana Silva', contactName: 'Maria Lima' },
  { id: '9', title: 'Reunião de alinhamento', description: 'Reunião semanal da equipe comercial', priority: 'baixa', status: 'pendente', dueDate: '2025-02-15', assignedTo: 'Felipe Moura' },
];

export const teamMembers = ['Ana Silva', 'Carlos Rocha', 'Felipe Moura'];

export const stats = {
  totalConversations: 156,
  openConversations: 23,
  avgResponseTime: '4 min',
  satisfactionRate: 94,
  totalContacts: 1247,
  newContactsThisMonth: 38,
  totalDealsValue: 112800,
  closedDealsValue: 12000,
  pendingTasks: 12,
  overdueTasks: 3,
};
