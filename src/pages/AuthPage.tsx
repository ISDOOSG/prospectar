import { Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import AnimatedAuthForm from "@/components/AnimatedAuthForm";
import { useAuth } from "@/contexts/AuthContext";

export default function AuthPage() {
  const { session, loading } = useAuth();

  // Enquanto resolve a sessão (refresh com token salvo), evita piscar o form.
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Já autenticado: sai do /auth e deixa o roteamento (RequireOnboarding) decidir
  // entre /setup e o dashboard. Sem isto o usuário loga mas fica preso no formulário.
  if (session) return <Navigate to="/" replace />;

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-base p-4 relative overflow-hidden">
      {/* Subtle indigo glow background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] rounded-full bg-accent/10 blur-[120px]" />
        <div className="absolute bottom-0 right-0 w-[400px] h-[400px] rounded-full bg-accent-light/10 blur-[100px]" />
      </div>
      <div className="relative z-10 w-full flex justify-center">
        <AnimatedAuthForm />
      </div>
    </div>
  );
}
