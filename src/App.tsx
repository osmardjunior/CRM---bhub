import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Suspense, lazy, type ReactNode } from "react";
import { AuthProvider } from "./contexts/AuthContext";
import { FunnelProvider } from "./contexts/FunnelContext";
import { ProjectProvider } from "./contexts/ProjectContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import ProtectedRoute from "./components/ProtectedRoute";
import { ErrorBoundary } from "./components/shared/ErrorBoundary";
import AppLayout from "./components/AppLayout";
import { useAuth } from "./contexts/AuthContext";
import { usePermissions } from "./hooks/usePermissions";

// Critical path — load immediately
import Login from "./pages/Login";
import Cadastro from "./pages/Cadastro";
import Inbox from "./pages/Inbox";

// Lazy-loaded pages — split into separate chunks
const Dashboard       = lazy(() => import("./pages/Dashboard"));
const Contatos        = lazy(() => import("./pages/Contatos"));
const Pipeline        = lazy(() => import("./pages/Pipeline"));
const FunnelKanban    = lazy(() => import("./pages/FunnelKanban"));
const Configuracoes   = lazy(() => import("./pages/Configuracoes"));
const Integracoes     = lazy(() => import("./pages/Integracoes"));
const Tags            = lazy(() => import("./pages/Tags"));
const MeuPerfil       = lazy(() => import("./pages/MeuPerfil"));
const NotFound        = lazy(() => import("./pages/NotFound"));
const Relatorios      = lazy(() => import("./pages/Relatorios"));
const RespostasRapidas = lazy(() => import("./pages/RespostasRapidas"));
const Chatbot         = lazy(() => import("./pages/Chatbot"));
const Campanhas       = lazy(() => import("./pages/Campanhas"));
const NPS             = lazy(() => import("./pages/NPS"));
const Arquivos        = lazy(() => import("./pages/Arquivos"));
const Modulos         = lazy(() => import("./pages/Modulos"));
const Suporte         = lazy(() => import("./pages/Suporte"));
const Folders         = lazy(() => import("./pages/Folders"));
const FolderProjects  = lazy(() => import("./pages/FolderProjects"));
const FolderNumbers   = lazy(() => import("./pages/FolderNumbers"));

/**
 * Allows access if:
 * 1. User's role is in allowedRoles, OR
 * 2. User has ANY of the listed permissionKeys (granular custom_permissions)
 */
function RoleGuard({ allowedRoles, permissionKeys, children }: {
  allowedRoles?: string[];
  permissionKeys?: string[];
  children: ReactNode;
}) {
  const { role, loading } = useAuth();
  const permissions = usePermissions();
  if (loading) return null;
  const currentRole = role ?? 'agent';
  const hasRole = allowedRoles ? allowedRoles.includes(currentRole) : false;
  const hasPerm = permissionKeys ? permissionKeys.some(k => permissions.can(k)) : false;
  if (!hasRole && !hasPerm) return <Navigate to="/inbox" replace />;
  return <>{children}</>;
}

/** Admin → /dashboard, others → /inbox */
function RootRedirect() {
  const { role, loading } = useAuth();
  if (loading) return null;
  return <Navigate to="/dashboard" replace />;
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,          // 30s para queries genéricas
      gcTime: 5 * 60_000,         // 5min cache retention
      retry: 1,
      refetchOnWindowFocus: true, // refetch ao voltar para a aba (era false)
      refetchOnReconnect: true,   // refetch ao reconectar internet
    },
  },
});

const PageLoader = () => (
  <div className="flex flex-1 items-center justify-center h-full">
    <div className="h-5 w-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
  </div>
);

const App = () => (
  <ErrorBoundary>
  <ThemeProvider>
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner position="top-right" />
      <BrowserRouter>
        <AuthProvider>
          <ProjectProvider>
          <FunnelProvider>
          <ProjectProvider>
            <Suspense fallback={<PageLoader />}>
              <Routes>
                <Route path="/" element={<ProtectedRoute><RootRedirect /></ProtectedRoute>} />
                <Route path="/login" element={<Login />} />
                <Route path="/cadastro" element={<Cadastro />} />

                {/* All roles */}
                <Route path="/inbox" element={<ProtectedRoute><AppLayout><Inbox /></AppLayout></ProtectedRoute>} />
                <Route path="/contatos" element={<ProtectedRoute><AppLayout><Contatos /></AppLayout></ProtectedRoute>} />
                <Route path="/pipeline" element={<ProtectedRoute><AppLayout><Pipeline /></AppLayout></ProtectedRoute>} />
                <Route path="/pipeline/:id" element={<ProtectedRoute><AppLayout><FunnelKanban /></AppLayout></ProtectedRoute>} />
                <Route path="/respostas-rapidas" element={<ProtectedRoute><AppLayout><RespostasRapidas /></AppLayout></ProtectedRoute>} />
                <Route path="/folders" element={<ProtectedRoute><RoleGuard allowedRoles={['admin']}><AppLayout><Folders /></AppLayout></RoleGuard></ProtectedRoute>} />
                <Route path="/folders/:departmentId" element={<ProtectedRoute><RoleGuard allowedRoles={['admin']}><AppLayout><FolderProjects /></AppLayout></RoleGuard></ProtectedRoute>} />
                <Route path="/folders/:departmentId/:projectId" element={<ProtectedRoute><RoleGuard allowedRoles={['admin']}><AppLayout><FolderNumbers /></AppLayout></RoleGuard></ProtectedRoute>} />
                <Route path="/suporte" element={<ProtectedRoute><AppLayout><Suporte /></AppLayout></ProtectedRoute>} />
                <Route path="/perfil" element={<ProtectedRoute><AppLayout><MeuPerfil /></AppLayout></ProtectedRoute>} />

                {/* Dashboard — all roles */}
                <Route path="/dashboard" element={<ProtectedRoute><AppLayout><Dashboard /></AppLayout></ProtectedRoute>} />

                {/* Role + Permission guarded pages */}
                <Route path="/tags" element={<ProtectedRoute><RoleGuard allowedRoles={['admin','supervisor']} permissionKeys={['tags_view','tags_assign','tags_remove','tags_create']}><AppLayout><Tags /></AppLayout></RoleGuard></ProtectedRoute>} />
                <Route path="/chatbot" element={<ProtectedRoute><RoleGuard allowedRoles={['admin','supervisor']}><AppLayout><Chatbot /></AppLayout></RoleGuard></ProtectedRoute>} />
                <Route path="/campanhas" element={<ProtectedRoute><RoleGuard allowedRoles={['admin','supervisor']} permissionKeys={['campaigns_view','campaigns_create','campaigns_pause','campaigns_resume']}><AppLayout><Campanhas /></AppLayout></RoleGuard></ProtectedRoute>} />
                <Route path="/relatorios" element={<ProtectedRoute><RoleGuard allowedRoles={['admin','supervisor']} permissionKeys={['reports_access_view','reports_chats_view','reports_chats_graphs','reports_messages_view','reports_notes_view','reports_users_view','reports_chatbot_view','reports_dialogs_view']}><AppLayout><Relatorios /></AppLayout></RoleGuard></ProtectedRoute>} />
                <Route path="/nps" element={<ProtectedRoute><RoleGuard allowedRoles={['admin','supervisor']} permissionKeys={['nps_view','nps_create','nps_edit','nps_manual']}><AppLayout><NPS /></AppLayout></RoleGuard></ProtectedRoute>} />
                <Route path="/arquivos" element={<ProtectedRoute><RoleGuard allowedRoles={['admin','supervisor']} permissionKeys={['files_send','files_caption','files_tags','files_delete']}><AppLayout><Arquivos /></AppLayout></RoleGuard></ProtectedRoute>} />

                {/* Admin only (+ permission override) */}
                <Route path="/integracoes" element={<ProtectedRoute><RoleGuard allowedRoles={['admin']} permissionKeys={['phones_view','phones_link']}><AppLayout><Integracoes /></AppLayout></RoleGuard></ProtectedRoute>} />
                <Route path="/modulos" element={<ProtectedRoute><RoleGuard allowedRoles={['admin']}><AppLayout><Modulos /></AppLayout></RoleGuard></ProtectedRoute>} />
                <Route path="/usuarios" element={<ProtectedRoute><RoleGuard allowedRoles={['admin']} permissionKeys={['users_view','users_create','users_assign']}><AppLayout><Configuracoes /></AppLayout></RoleGuard></ProtectedRoute>} />

                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </ProjectProvider>
          </FunnelProvider>
          </ProjectProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
  </ThemeProvider>
  </ErrorBoundary>
);

export default App;
