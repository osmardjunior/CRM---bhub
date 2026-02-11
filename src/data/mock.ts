export type ConversationStatus = 'aberta' | 'pendente' | 'resolvida';
export type ContactStatus = 'online' | 'ausente' | 'offline';
export type PipelineStage = 'lead' | 'qualificado' | 'proposta' | 'fechado' | 'perdido';
export type TaskPriority = 'alta' | 'media' | 'baixa';
export type TaskStatus = 'pendente' | 'em_progresso' | 'concluida';

export interface Conversation {
  id: string;
  contactName: string;
  contactAvatar: string;
  lastMessage: string;
  timestamp: string;
  unread: number;
  status: ConversationStatus;
  channel: 'whatsapp' | 'email' | 'chat';
  assignedTo: string;
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
  createdAt: string;
}

export interface PipelineDeal {
  id: string;
  title: string;
  contactName: string;
  value: number;
  stage: PipelineStage;
  probability: number;
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

export const conversations: Conversation[] = [
  { id: '1', contactName: 'Maria Lima', contactAvatar: avatars[0], lastMessage: 'Olá, preciso de ajuda com meu pedido #4521', timestamp: '2 min', unread: 3, status: 'aberta', channel: 'whatsapp', assignedTo: 'Ana Silva' },
  { id: '2', contactName: 'André Santos', contactAvatar: avatars[1], lastMessage: 'Vocês têm plano empresarial?', timestamp: '15 min', unread: 1, status: 'aberta', channel: 'chat', assignedTo: 'Carlos Rocha' },
  { id: '3', contactName: 'Carla Ribeiro', contactAvatar: avatars[2], lastMessage: 'Obrigada pelo suporte!', timestamp: '1h', unread: 0, status: 'resolvida', channel: 'email', assignedTo: 'Ana Silva' },
  { id: '4', contactName: 'João Pereira', contactAvatar: avatars[3], lastMessage: 'Ainda aguardando retorno sobre a proposta', timestamp: '3h', unread: 2, status: 'pendente', channel: 'whatsapp', assignedTo: 'Felipe Moura' },
  { id: '5', contactName: 'Fernanda Martins', contactAvatar: avatars[4], lastMessage: 'Quero cancelar minha assinatura', timestamp: '5h', unread: 0, status: 'aberta', channel: 'chat', assignedTo: 'Ana Silva' },
  { id: '6', contactName: 'Lucas Borges', contactAvatar: avatars[5], lastMessage: 'Como faço para integrar com meu sistema?', timestamp: '1d', unread: 0, status: 'pendente', channel: 'email', assignedTo: 'Carlos Rocha' },
];

export const contacts: Contact[] = [
  { id: '1', name: 'Maria Lima', email: 'maria@empresa.com', phone: '(11) 99999-1234', company: 'TechBR Ltda', status: 'online', avatar: avatars[0], tags: ['VIP', 'Enterprise'], createdAt: '2024-01-15' },
  { id: '2', name: 'André Santos', email: 'andre@startup.io', phone: '(21) 98888-5678', company: 'StartupIO', status: 'ausente', avatar: avatars[1], tags: ['Lead'], createdAt: '2024-02-20' },
  { id: '3', name: 'Carla Ribeiro', email: 'carla@design.com', phone: '(31) 97777-9012', company: 'DesignCo', status: 'offline', avatar: avatars[2], tags: ['Cliente'], createdAt: '2024-03-10' },
  { id: '4', name: 'João Pereira', email: 'joao@corp.com.br', phone: '(41) 96666-3456', company: 'CorpBrasil', status: 'online', avatar: avatars[3], tags: ['Enterprise', 'Prioritário'], createdAt: '2024-04-05' },
  { id: '5', name: 'Fernanda Martins', email: 'fernanda@loja.com', phone: '(51) 95555-7890', company: 'LojaOnline', status: 'offline', avatar: avatars[4], tags: ['Cliente'], createdAt: '2024-05-12' },
  { id: '6', name: 'Lucas Borges', email: 'lucas@dev.com', phone: '(61) 94444-2345', company: 'DevSolutions', status: 'ausente', avatar: avatars[5], tags: ['Lead', 'Desenvolvedor'], createdAt: '2024-06-01' },
];

export const pipelineDeals: PipelineDeal[] = [
  { id: '1', title: 'Plano Enterprise TechBR', contactName: 'Maria Lima', value: 24000, stage: 'proposta', probability: 70, createdAt: '2024-08-01' },
  { id: '2', title: 'Licença StartupIO', contactName: 'André Santos', value: 4800, stage: 'lead', probability: 20, createdAt: '2024-09-15' },
  { id: '3', title: 'Projeto DesignCo', contactName: 'Carla Ribeiro', value: 12000, stage: 'fechado', probability: 100, createdAt: '2024-07-10' },
  { id: '4', title: 'Expansão CorpBrasil', contactName: 'João Pereira', value: 48000, stage: 'qualificado', probability: 45, createdAt: '2024-10-01' },
  { id: '5', title: 'Migração LojaOnline', contactName: 'Fernanda Martins', value: 8000, stage: 'perdido', probability: 0, createdAt: '2024-06-20' },
  { id: '6', title: 'Integração DevSolutions', contactName: 'Lucas Borges', value: 16000, stage: 'proposta', probability: 60, createdAt: '2024-11-01' },
];

export const tasks: Task[] = [
  { id: '1', title: 'Responder proposta TechBR', description: 'Enviar detalhamento técnico da proposta', priority: 'alta', status: 'pendente', dueDate: '2025-02-12', assignedTo: 'Ana Silva', contactName: 'Maria Lima' },
  { id: '2', title: 'Follow-up StartupIO', description: 'Agendar reunião de demonstração', priority: 'media', status: 'em_progresso', dueDate: '2025-02-14', assignedTo: 'Carlos Rocha', contactName: 'André Santos' },
  { id: '3', title: 'Onboarding DesignCo', description: 'Configurar conta e treinamento inicial', priority: 'media', status: 'concluida', dueDate: '2025-02-10', assignedTo: 'Ana Silva', contactName: 'Carla Ribeiro' },
  { id: '4', title: 'Enviar contrato CorpBrasil', description: 'Preparar e enviar contrato de expansão', priority: 'alta', status: 'pendente', dueDate: '2025-02-13', assignedTo: 'Felipe Moura', contactName: 'João Pereira' },
  { id: '5', title: 'Atualizar documentação API', description: 'Revisar docs da API v2', priority: 'baixa', status: 'pendente', dueDate: '2025-02-20', assignedTo: 'Carlos Rocha' },
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
