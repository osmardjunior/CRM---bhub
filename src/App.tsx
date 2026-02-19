import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import AppLayout from "./components/AppLayout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Inbox from "./pages/Inbox";
import ChatsOverview from "./pages/ChatsOverview";
import Contatos from "./pages/Contatos";
import Pipeline from "./pages/Pipeline";
import FunnelKanban from "./pages/FunnelKanban";
import Tarefas from "./pages/Tarefas";
import Configuracoes from "./pages/Configuracoes";
import Integracoes from "./pages/Integracoes";
import Tags from "./pages/Tags";
import MeuPerfil from "./pages/MeuPerfil";
import NotFound from "./pages/NotFound";
import Relatorios from "./pages/Relatorios";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Navigate to="/chats" replace />} />
            <Route path="/login" element={<Login />} />
            <Route path="/chats" element={<ProtectedRoute><AppLayout><ChatsOverview /></AppLayout></ProtectedRoute>} />
            <Route path="/dashboard" element={<ProtectedRoute><AppLayout><Dashboard /></AppLayout></ProtectedRoute>} />
            <Route path="/inbox" element={<ProtectedRoute><AppLayout><Inbox /></AppLayout></ProtectedRoute>} />
            <Route path="/contatos" element={<ProtectedRoute><AppLayout><Contatos /></AppLayout></ProtectedRoute>} />
            <Route path="/pipeline" element={<ProtectedRoute><AppLayout><Pipeline /></AppLayout></ProtectedRoute>} />
            <Route path="/pipeline/:id" element={<ProtectedRoute><AppLayout><FunnelKanban /></AppLayout></ProtectedRoute>} />
            <Route path="/tarefas" element={<ProtectedRoute><AppLayout><Tarefas /></AppLayout></ProtectedRoute>} />
            <Route path="/integracoes" element={<ProtectedRoute><AppLayout><Integracoes /></AppLayout></ProtectedRoute>} />
            <Route path="/tags" element={<ProtectedRoute><AppLayout><Tags /></AppLayout></ProtectedRoute>} />
            <Route path="/relatorios" element={<ProtectedRoute><AppLayout><Relatorios /></AppLayout></ProtectedRoute>} />
            <Route path="/configuracoes" element={<ProtectedRoute><AppLayout><Configuracoes /></AppLayout></ProtectedRoute>} />
            <Route path="/perfil" element={<ProtectedRoute><AppLayout><MeuPerfil /></AppLayout></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
