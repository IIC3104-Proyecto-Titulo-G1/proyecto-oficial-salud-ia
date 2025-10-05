import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import Index from "./pages/Index";
import Login from "./pages/Login";
import RecuperarPassword from "./pages/RecuperarPassword";
import ActualizarPassword from "./pages/ActualizarPassword";
import Perfil from "./pages/Perfil";
import Dashboard from "./pages/Dashboard";
import NuevoCaso from "./pages/NuevoCaso";
import VerCaso from "./pages/VerCaso";
import ComunicacionPaciente from "./pages/ComunicacionPaciente";
import AdminUsuarios from "./pages/AdminUsuarios";
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
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/login" element={<Login />} />
          <Route path="/recuperar-password" element={<RecuperarPassword />} />
          <Route path="/actualizar-password" element={<ActualizarPassword />} />
          <Route path="/perfil" element={<Perfil />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/caso/nuevo" element={<NuevoCaso />} />
            <Route path="/caso/:id" element={<VerCaso />} />
            <Route path="/caso/:id/comunicacion" element={<ComunicacionPaciente />} />
            <Route path="/admin" element={<AdminUsuarios />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
