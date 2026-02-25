import { useState, useEffect, type ComponentType } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useSidebarStats } from '@/hooks/useSidebarStats';
import GlobalSearchCommand from '@/components/GlobalSearchCommand';
import {
  MessageSquare,
  Users,
  Kanban,
  Settings,
  Menu,
  X,
  Bell,
  Search,
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
  Archive,
  Puzzle,
  Headphones,
} from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useCompany } from '@/hooks/useCompany';

interface AppLayoutProps {
  children: React.ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { profile, role, signOut } = useAuth();
  const { data: stats } = useSidebarStats();
  const { data: company } = useCompany();

  const userName = profile?.name || 'Usuário';
  const userInitials = userName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const companyName = company?.name ?? 'Minha Empresa';

  // Keyboard shortcut for search
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, []);

  type NavItem = { to: string; label: string; icon: ComponentType<{ size?: number; className?: string }>; badge?: number; roles?: string[] };
  type NavGroup = { label: string | null; items: NavItem[] };

  const allNavGroups: NavGroup[] = [
    {
      label: 'Atendimento',
      items: [
        { to: '/inbox', label: 'Inbox', icon: MessageSquare, badge: stats?.openConversations },
        { to: '/chats', label: 'Chats Geral', icon: Kanban, roles: ['admin', 'supervisor'] },
        { to: '/contatos', label: 'Contatos', icon: Users },
        { to: '/tags', label: 'Tags', icon: Tag, roles: ['admin', 'supervisor'] },
        { to: '/respostas-rapidas', label: 'Respostas Rápidas', icon: Zap },
      ],
    },
    {
      label: 'Automação',
      items: [
        { to: '/chatbot', label: 'Diálogos / Chatbot', icon: Bot, roles: ['admin', 'supervisor'] },
        { to: '/campanhas', label: 'Campanhas', icon: Megaphone, roles: ['admin', 'supervisor'] },
        { to: '/pipeline', label: 'Funil', icon: Filter },
      ],
    },
    {
      label: 'Dados',
      items: [
        { to: '/relatorios', label: 'Relatórios', icon: BarChart3, roles: ['admin', 'supervisor'] },
        { to: '/nps', label: 'NPS', icon: Star, roles: ['admin', 'supervisor'] },
        { to: '/arquivos', label: 'Arquivos', icon: Archive, roles: ['admin', 'supervisor'] },
      ],
    },
    {
      label: 'Sistema',
      items: [
        { to: '/integracoes', label: 'Celulares WhatsApp', icon: Smartphone, roles: ['admin'] },
        { to: '/modulos', label: 'Módulos', icon: Puzzle, roles: ['admin'] },
        { to: '/configuracoes', label: 'Configurações', icon: Settings, roles: ['admin'] },
        { to: '/suporte', label: 'Suporte', icon: Headphones },
      ],
    },
  ];

  // Filter nav items by current user role (no role = agent)
  const currentRole = role ?? 'agent';
  const navGroups = allNavGroups
    .map(g => ({
      ...g,
      items: g.items.filter(item => !item.roles || item.roles.includes(currentRole)),
    }))
    .filter(g => g.items.length > 0);

  // Flat list for header title lookup
  const navItems = navGroups.flatMap(g => g.items);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-foreground/20 backdrop-blur-sm lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 flex flex-col bg-sidebar text-sidebar-foreground transition-all duration-200 lg:static lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} ${collapsed ? 'w-16' : 'w-64'}`}>
        <div className="flex h-16 items-center gap-2 border-b border-sidebar-border px-4">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground font-bold text-sm">AI</div>
          {!collapsed && <span className="text-lg font-semibold text-sidebar-accent-foreground whitespace-nowrap">All In CRM</span>}
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
            {/* Global search trigger */}
            <div className="relative hidden md:block">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar... (⌘K)"
                className="w-64 pl-9 bg-secondary border-0 focus-visible:ring-1 cursor-pointer"
                readOnly
                onClick={() => setSearchOpen(true)}
              />
            </div>

            {/* Company name */}
            <Button variant="outline" size="sm" className="hidden sm:flex gap-2">
              <Building2 size={14} />
              <span className="max-w-[120px] truncate">{companyName}</span>
            </Button>

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
                <DropdownMenuItem onClick={() => navigate('/configuracoes')}>
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

      <GlobalSearchCommand open={searchOpen} onOpenChange={setSearchOpen} />
    </div>
  );
}
