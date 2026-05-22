import { useState, useEffect, type ComponentType } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useSidebarStats } from '@/hooks/useSidebarStats';
import { usePermissions } from '@/hooks/usePermissions';
import { useNotificationSound } from '@/hooks/useNotificationSound';
import ConnectionStatusIndicator from '@/components/shared/ConnectionStatusIndicator';
import {
  MessageSquare,
  Users,
  Kanban,
  Settings,
  Menu,
  X,
  Bell,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Building2,
  LogOut,
  User,
  Tag,
  BarChart3,
  Filter,
  Zap,
  Bot,
  Megaphone,
  Smartphone,
  Star,
  Puzzle,
  Headphones,
  FolderOpen,
  Sun,
  Moon,
  LayoutDashboard,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useCompany } from '@/hooks/useCompany';
import { useProjectContext } from '@/contexts/ProjectContext';
import { useMyProjects } from '@/hooks/useProjects';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { usePresenceHeartbeat } from '@/hooks/usePresenceHeartbeat';

interface AppLayoutProps {
  children: React.ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { profile, role, signOut } = useAuth();
  const { data: stats } = useSidebarStats();
  const { data: company } = useCompany();
  const { theme, toggleTheme } = useTheme();
  const { projectId, selectProject } = useProjectContext();
  const { data: myProjects = [] } = useMyProjects();
  usePresenceHeartbeat();
  const permissions = usePermissions();
  const { enabled: soundEnabled, toggle: toggleSound } = useNotificationSound();


  // Auto-select project for non-admin users when they have projects but none selected
  useEffect(() => {
    if (role !== 'admin' && !projectId && myProjects.length > 0) {
      selectProject(myProjects[0].id);
    }
  }, [role, projectId, myProjects, selectProject]);

  const userName = profile?.name || 'Usuário';
  const userInitials = userName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const companyName = company?.name ?? 'Minha Empresa';


  type NavItem = { to: string; label: string; icon: ComponentType<{ size?: number; className?: string }>; badge?: number; roles?: string[]; permissionAny?: string[] };
  type NavGroup = { label: string | null; items: NavItem[] };

  // permissionAny: visible if user has ANY of the listed permissions.
  // Items with no permissionAny are visible to all authenticated users.
  const allNavGroups: NavGroup[] = [
    {
      label: 'Atendimento',
      items: [
        { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { to: '/inbox', label: 'Inbox', icon: MessageSquare, badge: stats?.openConversations },
        { to: '/contatos', label: 'Contatos', icon: Users },
        { to: '/tags', label: 'Tags', icon: Tag, permissionAny: ['tags_view', 'tags_assign', 'tags_remove', 'tags_create'] },
        { to: '/respostas-rapidas', label: 'Respostas Rápidas', icon: Zap },
      ],
    },
    {
      label: 'Automação',
      items: [
        { to: '/chatbot', label: 'Diálogos / Chatbot', icon: Bot, roles: ['admin', 'supervisor'] },
        { to: '/campanhas', label: 'Campanhas', icon: Megaphone, permissionAny: ['campaigns_view', 'campaigns_create', 'campaigns_pause', 'campaigns_resume'] },
        { to: '/pipeline', label: 'Funil', icon: Filter, permissionAny: ['funnels_view', 'funnels_create', 'funnels_edit', 'funnels_move_chats'] },
      ],
    },
    {
      label: 'Dados',
      items: [
        { to: '/relatorios', label: 'Relatórios', icon: BarChart3, permissionAny: ['reports_access_view', 'reports_chats_view', 'reports_chats_graphs', 'reports_messages_view', 'reports_notes_view', 'reports_users_view', 'reports_chatbot_view', 'reports_dialogs_view'] },
        { to: '/nps', label: 'NPS', icon: Star, permissionAny: ['nps_view', 'nps_create', 'nps_edit', 'nps_manual'] },
      ],
    },
    {
      label: 'Sistema',
      items: [
        { to: '/integracoes', label: 'Celulares WhatsApp', icon: Smartphone, permissionAny: ['phones_view', 'phones_link'] },
        { to: '/modulos', label: 'Módulos', icon: Puzzle, roles: ['admin'] },
        { to: '/usuarios', label: 'Usuários', icon: Users, permissionAny: ['users_view', 'users_create', 'users_assign'] },
        { to: '/suporte', label: 'Suporte', icon: Headphones },
      ],
    },
  ];

  // Filter nav items by role + granular permissions
  const currentRole = role ?? 'agent';
  const navGroups = allNavGroups
    .map(g => ({
      ...g,
      items: g.items.filter(item => {
        if (item.roles && !item.roles.includes(currentRole)) return false;
        if (item.permissionAny && !item.permissionAny.some(k => permissions.can(k))) return false;
        return true;
      }),
    }))
    .filter(g => g.items.length > 0);

  // Flat list for header title lookup
  const navItems = navGroups.flatMap(g => g.items);

  return (
    <div className="flex h-screen h-[100dvh] w-full overflow-hidden bg-background">
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-foreground/20 backdrop-blur-sm lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 flex flex-col bg-sidebar text-sidebar-foreground transition-all duration-200 lg:static lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} ${collapsed ? 'w-16' : 'w-64'}`}>
        <div className="flex h-16 items-center gap-2 border-b border-sidebar-border px-4">
          {collapsed ? (
            <button onClick={() => navigate('/dashboard')} className="flex h-8 w-8 shrink-0 items-center justify-center">
              <img src="/logo-white.png" alt="ALL·IN" className="h-6 w-auto object-contain" />
            </button>
          ) : (
            <button onClick={() => navigate('/dashboard')} className="flex items-center">
              <img src="/logo-white.png" alt="ALL·IN" className="h-7 w-auto object-contain" />
            </button>
          )}
          <button onClick={() => setSidebarOpen(false)} className="ml-auto text-sidebar-muted hover:text-sidebar-foreground lg:hidden"><X size={20} /></button>
        </div>

        <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-3">
          {navGroups.map((group, gi) => (
            <div key={gi}>
              {group.label && !collapsed && (
                <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-wider text-sidebar-muted/70">
                  {group.label}
                </p>
              )}
              <div className="space-y-0.5">
                {group.items.map(item => {
                  const isActive = location.pathname === item.to;
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      onClick={() => setSidebarOpen(false)}
                      title={collapsed ? item.label : undefined}
                      className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${isActive ? 'bg-sidebar-accent text-sidebar-accent-foreground' : 'text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground'} ${collapsed ? 'justify-center px-0' : ''}`}
                    >
                      <item.icon size={17} className="shrink-0" />
                      {!collapsed && <span>{item.label}</span>}
                      {!collapsed && (item as { badge?: number }).badge ? (
                        <Badge className="ml-auto bg-sidebar-primary text-sidebar-primary-foreground text-xs px-1.5 py-0 min-w-[20px] justify-center">{(item as { badge?: number }).badge}</Badge>
                      ) : null}
                    </NavLink>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="hidden lg:flex justify-center border-t border-sidebar-border py-2">
          <button onClick={() => setCollapsed(!collapsed)} className="rounded-md p-1.5 text-sidebar-muted hover:text-sidebar-foreground hover:bg-sidebar-accent/60 transition-colors">
            {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>

        <div className="border-t border-sidebar-border p-3">
          <div className={`flex items-center gap-3 ${collapsed ? 'justify-center' : ''}`}>
            <Avatar className="h-8 w-8 shrink-0"><AvatarFallback>{userInitials}</AvatarFallback></Avatar>
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-sidebar-accent-foreground truncate">{userName}</p>
                <p className="text-xs text-sidebar-muted truncate capitalize">{role || 'agent'}</p>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-16 items-center gap-4 border-b border-border bg-card px-4 lg:px-6">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setSidebarOpen(true)}><Menu size={20} /></Button>
          <h1 className="text-lg font-semibold text-foreground">
            {navItems.find(i => i.to === location.pathname)?.label || 'Dashboard'}
          </h1>

          <div className="ml-auto flex items-center gap-3">
            {/* Project selector */}
            <div className="hidden sm:flex items-center gap-1.5">
              <Building2 size={14} className="text-muted-foreground shrink-0" />
              {myProjects.length > 1 ? (
                <Select value={projectId || '_all'} onValueChange={v => selectProject(v === '_all' ? '' : v)}>
                  <SelectTrigger className="h-8 w-[170px] border-0 bg-secondary text-sm focus:ring-1">
                    <SelectValue placeholder="Todos os projetos" />
                  </SelectTrigger>
                  <SelectContent>
                    {currentRole === 'admin' && <SelectItem value="_all">Todos os projetos</SelectItem>}
                    {myProjects.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <span className="text-sm text-muted-foreground truncate max-w-[140px]">
                  {myProjects[0]?.name ?? companyName}
                </span>
              )}
            </div>

            {/* Sound toggle */}
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleSound}
              title={soundEnabled ? 'Desativar som de notificação' : 'Ativar som de notificação'}
            >
              {soundEnabled ? <Volume2 size={17} /> : <VolumeX size={17} />}
            </Button>

            {/* Theme toggle */}
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              title={theme === 'dark' ? 'Mudar para modo claro' : 'Mudar para modo escuro'}
            >
              {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
            </Button>

            {/* Connection status + WhatsApp queue */}
            <ConnectionStatusIndicator />

            {/* Notifications */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="relative">
                  <Bell size={18} />
                  {(stats?.overdueTasks ?? 0) > 0 && <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-destructive" />}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-72">
                <DropdownMenuLabel className="text-xs font-semibold">Notificações</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {(stats?.overdueTasks ?? 0) > 0 ? (
                  <DropdownMenuItem onClick={() => navigate('/tarefas')} className="flex flex-col items-start gap-0.5 py-2.5">
                    <span className="text-sm font-medium text-destructive">🔴 {stats?.overdueTasks} tarefa(s) atrasada(s)</span>
                    <span className="text-xs text-muted-foreground">Clique para ver suas tarefas</span>
                  </DropdownMenuItem>
                ) : null}
                {(stats?.openConversations ?? 0) > 0 ? (
                  <DropdownMenuItem onClick={() => navigate('/inbox')} className="flex flex-col items-start gap-0.5 py-2.5">
                    <span className="text-sm font-medium">💬 {stats?.openConversations} conversa(s) aberta(s)</span>
                    <span className="text-xs text-muted-foreground">Clique para ver o inbox</span>
                  </DropdownMenuItem>
                ) : null}
                {(stats?.overdueTasks ?? 0) === 0 && (stats?.openConversations ?? 0) === 0 && (
                  <div className="px-3 py-4 text-center text-xs text-muted-foreground">Tudo em dia! 🎉</div>
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* User menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-2 hidden sm:flex">
                  <Avatar className="h-7 w-7"><AvatarFallback className="text-xs">{userInitials}</AvatarFallback></Avatar>
                  <span className="text-sm font-medium">{userName}</span>
                  <ChevronDown size={14} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel>
                  <p className="text-sm font-medium">{userName}</p>
                  <p className="text-xs text-muted-foreground capitalize">{role || 'agent'}</p>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate('/perfil')}>
                  <User size={14} className="mr-2" /> Meu Perfil
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/usuarios')}>
                  <Settings size={14} className="mr-2" /> Configurações
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-destructive" onClick={() => signOut()}>
                  <LogOut size={14} className="mr-2" /> Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 lg:p-6">{children}</main>
      </div>

    </div>
  );
}
