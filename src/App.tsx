import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import AppLayout from "./components/AppLayout";
import Login from "./pages/Login";
import Inbox from "./pages/Inbox";
import Contatos from "./pages/Contatos";
import Pipeline from "./pages/Pipeline";
import Tarefas from "./pages/Tarefas";
import Configuracoes from "./pages/Configuracoes";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Navigate to="/inbox" replace />} />
            <Route path="/login" element={<Login />} />
            <Route path="/inbox" element={<ProtectedRoute><AppLayout><Inbox /></AppLayout></ProtectedRoute>} />
            <Route path="/contatos" element={<ProtectedRoute><AppLayout><Contatos /></AppLayout></ProtectedRoute>} />
            <Route path="/pipeline" element={<ProtectedRoute><AppLayout><Pipeline /></AppLayout></ProtectedRoute>} />
            <Route path="/tarefas" element={<ProtectedRoute><AppLayout><Tarefas /></AppLayout></ProtectedRoute>} />
            <Route path="/configuracoes" element={<ProtectedRoute><AppLayout><Configuracoes /></AppLayout></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
