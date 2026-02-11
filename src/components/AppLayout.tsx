import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  MessageSquare,
  Users,
  Kanban,
  CheckSquare,
  Settings,
  Menu,
  X,
  Bell,
  Search,
  ChevronDown } from
'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { stats } from '@/data/mock';

interface AppLayoutProps {
  children: React.ReactNode;
}

const navItems = [
{ to: '/', label: 'Inbox', icon: MessageSquare, badge: stats.openConversations },
{ to: '/contatos', label: 'Contatos', icon: Users },
{ to: '/pipeline', label: 'Pipeline', icon: Kanban },
{ to: '/tarefas', label: 'Tarefas', icon: CheckSquare, badge: stats.overdueTasks },
{ to: '/configuracoes', label: 'Configurações', icon: Settings }];


export default function AppLayout({ children }: AppLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  const currentPage = navItems.find((i) => i.to === location.pathname);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      {/* Mobile overlay */}
      {sidebarOpen &&
      <div
        className="fixed inset-0 z-40 bg-foreground/20 backdrop-blur-sm lg:hidden"
        onClick={() => setSidebarOpen(false)} />

      }

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-sidebar text-sidebar-foreground transition-transform duration-200 lg:static lg:translate-x-0 ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`
        }>

        {/* Logo */}
        <div className="flex h-16 items-center gap-2 border-b border-sidebar-border px-5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground font-bold text-sm">
            CG
          </div>
          <span className="text-lg font-semibold text-sidebar-accent-foreground">All-In CRM
 </span>
          <button onClick={() => setSidebarOpen(false)}
          className="ml-auto text-sidebar-muted hover:text-sidebar-foreground lg:hidden">

            <X size={20} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 space-y-1 px-3 py-4">
          {navItems.map((item) => {
            const isActive = location.pathname === item.to;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive ?
                'bg-sidebar-accent text-sidebar-accent-foreground' :
                'text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground'}`
                }>

                <item.icon size={18} />
                <span>{item.label}</span>
                {item.badge ?
                <Badge className="ml-auto bg-sidebar-primary text-sidebar-primary-foreground text-xs px-1.5 py-0 min-w-[20px] justify-center">
                    {item.badge}
                  </Badge> :
                null}
              </NavLink>);

          })}
        </nav>

        {/* User footer */}
        <div className="border-t border-sidebar-border p-4">
          <div className="flex items-center gap-3">
            <Avatar className="h-8 w-8">
              <AvatarImage src="https://api.dicebear.com/7.x/initials/svg?seed=AS" />
              <AvatarFallback>AS</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-sidebar-accent-foreground truncate">Ana Silva</p>
              <p className="text-xs text-sidebar-muted truncate">ana@chatguru.com</p>
            </div>
            <ChevronDown size={14} className="text-sidebar-muted" />
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <header className="flex h-16 items-center gap-4 border-b border-border bg-card px-4 lg:px-6">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setSidebarOpen(true)}>

            <Menu size={20} />
          </Button>

          <h1 className="text-lg font-semibold text-foreground">
            {currentPage?.label || 'Dashboard'}
          </h1>

          <div className="ml-auto flex items-center gap-3">
            <div className="relative hidden md:block">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar..."
                className="w-64 pl-9 bg-secondary border-0 focus-visible:ring-1" />

            </div>
            <Button variant="ghost" size="icon" className="relative">
              <Bell size={18} />
              <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-destructive" />
            </Button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>);

}