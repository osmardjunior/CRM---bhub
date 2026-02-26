import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Suspense, lazy, type ReactNode } from "react";
import { AuthProvider } from "./contexts/AuthContext";
import { FunnelProvider } from "./contexts/FunnelContext";
import ProtectedRoute from "./components/ProtectedRoute";
import { ErrorBoundary } from "./components/shared/ErrorBoundary";
import AppLayout from "./components/AppLayout";
import { useAuth } from "./contexts/AuthContext";

// Critical path — load immediately
import Login from "./pages/Login";
import Inbox from "./pages/Inbox";

// Lazy-loaded pages — split into separate chunks
const ChatsOverview   = lazy(() => import("./pages/ChatsOverview"));
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
const Negocios        = lazy(() => import("./pages/Negocios"));
const Folders         = lazy(() => import("./pages/Folders"));
const FolderProjects  = lazy(() => import("./pages/FolderProjects"));
const FolderNumbers   = lazy(() => import("./pages/FolderNumbers"));

/** Redirects to /inbox if user's role is not in allowedRoles */
function RoleGuard({ allowedRoles, children }: { allowedRoles: string[]; children: ReactNode }) {
  const { role, loading } = useAuth();
  if (loading) return null;
  const currentRole = role ?? 'agent';
  if (!allowedRoles.includes(currentRole)) return <Navigate to="/inbox" replace />;
  return <>{children}</>;
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
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <FunnelProvider>
            <Suspense fallback={<PageLoader />}>
              <Routes>
                <Route path="/" element={<Navigate to="/inbox" replace />} />
                <Route path="/login" element={<Login />} />

                {/* All roles */}
                <Route path="/inbox" element={<ProtectedRoute><AppLayout><Inbox /></AppLayout></ProtectedRoute>} />
                <Route path="/contatos" element={<ProtectedRoute><AppLayout><Contatos /></AppLayout></ProtectedRoute>} />
                <Route path="/negocios" element={<ProtectedRoute><AppLayout><Negocios /></AppLayout></ProtectedRoute>} />
                <Route path="/pipeline" element={<ProtectedRoute><AppLayout><Pipeline /></AppLayout></ProtectedRoute>} />
                <Route path="/pipeline/:id" element={<ProtectedRoute><AppLayout><FunnelKanban /></AppLayout></ProtectedRoute>} />
                <Route path="/respostas-rapidas" element={<ProtectedRoute><AppLayout><RespostasRapidas /></AppLayout></ProtectedRoute>} />
                <Route path="/folders" element={<ProtectedRoute><AppLayout><Folders /></AppLayout></ProtectedRoute>} />
                <Route path="/folders/:departmentId" element={<ProtectedRoute><AppLayout><FolderProjects /></AppLayout></ProtectedRoute>} />
                <Route path="/folders/:departmentId/:projectId" element={<ProtectedRoute><AppLayout><FolderNumbers /></AppLayout></ProtectedRoute>} />
                <Route path="/suporte" element={<ProtectedRoute><AppLayout><Suporte /></AppLayout></ProtectedRoute>} />
                <Route path="/perfil" element={<ProtectedRoute><AppLayout><MeuPerfil /></AppLayout></ProtectedRoute>} />

                {/* Admin + Supervisor */}
                <Route path="/chats" element={<ProtectedRoute><RoleGuard allowedRoles={['admin','supervisor']}><AppLayout><ChatsOverview /></AppLayout></RoleGuard></ProtectedRoute>} />
                <Route path="/tags" element={<ProtectedRoute><RoleGuard allowedRoles={['admin','supervisor']}><AppLayout><Tags /></AppLayout></RoleGuard></ProtectedRoute>} />
                <Route path="/chatbot" element={<ProtectedRoute><RoleGuard allowedRoles={['admin','supervisor']}><AppLayout><Chatbot /></AppLayout></RoleGuard></ProtectedRoute>} />
                <Route path="/campanhas" element={<ProtectedRoute><RoleGuard allowedRoles={['admin','supervisor']}><AppLayout><Campanhas /></AppLayout></RoleGuard></ProtectedRoute>} />
                <Route path="/relatorios" element={<ProtectedRoute><RoleGuard allowedRoles={['admin','supervisor']}><AppLayout><Relatorios /></AppLayout></RoleGuard></ProtectedRoute>} />
                <Route path="/nps" element={<ProtectedRoute><RoleGuard allowedRoles={['admin','supervisor']}><AppLayout><NPS /></AppLayout></RoleGuard></ProtectedRoute>} />
                <Route path="/arquivos" element={<ProtectedRoute><RoleGuard allowedRoles={['admin','supervisor']}><AppLayout><Arquivos /></AppLayout></RoleGuard></ProtectedRoute>} />

                {/* Admin only */}
                <Route path="/integracoes" element={<ProtectedRoute><RoleGuard allowedRoles={['admin']}><AppLayout><Integracoes /></AppLayout></RoleGuard></ProtectedRoute>} />
                <Route path="/modulos" element={<ProtectedRoute><RoleGuard allowedRoles={['admin']}><AppLayout><Modulos /></AppLayout></RoleGuard></ProtectedRoute>} />
                <Route path="/configuracoes" element={<ProtectedRoute><RoleGuard allowedRoles={['admin']}><AppLayout><Configuracoes /></AppLayout></RoleGuard></ProtectedRoute>} />

                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </FunnelProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
