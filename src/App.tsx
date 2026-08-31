import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate, useLocation } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppLayout } from "@/components/AppLayout";
import { useIsOnboarded } from "@/hooks/useSettings";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { WaitingForAdminSetup } from "@/components/WaitingForAdminSetup";
import { Loader2 } from "lucide-react";
import DashboardPage from "./pages/DashboardPage";
import SearchPage from "./pages/SearchPage";
import ListsPage from "./pages/ListsPage";
import ListDetailPage from "./pages/ListDetailPage";
import ContactDetailPage from "./pages/ContactDetailPage";
import PipelinePage from "./pages/PipelinePage";
import AnalyticsPage from "./pages/AnalyticsPage";
import ImportPage from "./pages/ImportPage";
import ExportPage from "./pages/ExportPage";
import SettingsPage from "./pages/SettingsPage";
import OnboardingPage from "./pages/OnboardingPage";
import AuthPage from "./pages/AuthPage";
import ComporPage from "./pages/mensagens/ComporPage";
import EnviadosPage from "./pages/mensagens/EnviadosPage";
import InboxPage from "./pages/mensagens/InboxPage";
import FilaPage from "./pages/mensagens/FilaPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!session) return <Navigate to="/auth" replace />;
  return <>{children}</>;
}

function RequireOnboarding({ children }: { children: React.ReactNode }) {
  const { isOnboarded, isLoading } = useIsOnboarded();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (isOnboarded && location.pathname === "/setup") return <Navigate to="/" replace />;
  if (!isOnboarded && location.pathname !== "/setup") return <Navigate to="/setup" replace />;

  return <>{children}</>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/auth" element={<AuthPage />} />
            <Route path="/*" element={
              <RequireAuth>
                <RequireOnboarding>
                  <Routes>
                    <Route path="/setup" element={<OnboardingPage />} />
                    <Route element={<AppLayout />}>
                      <Route path="/" element={<DashboardPage />} />
                      <Route path="/search" element={<SearchPage />} />
                      <Route path="/lists" element={<ListsPage />} />
                      <Route path="/lists/:listId" element={<ListDetailPage />} />
                      <Route path="/lists/:listId/contacts/:contactId" element={<ContactDetailPage />} />
                      <Route path="/pipeline" element={<PipelinePage />} />
                      <Route path="/mensagens/compor" element={<ComporPage />} />
                      <Route path="/mensagens/enviados" element={<EnviadosPage />} />
                      <Route path="/mensagens/inbox" element={<InboxPage />} />
                      <Route path="/mensagens/fila" element={<FilaPage />} />
                      <Route path="/abordagem" element={<Navigate to="/mensagens/compor" replace />} />
                      <Route path="/analytics" element={<AnalyticsPage />} />
                      <Route path="/import" element={<ImportPage />} />
                      <Route path="/export" element={<ExportPage />} />
                      <Route path="/settings" element={<SettingsPage />} />
                    </Route>
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </RequireOnboarding>
              </RequireAuth>
            } />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
