import { useState } from "react";
import { User, Lock, Mail, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { toast } from "sonner";

const GoogleIcon = ({ className = "" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
  </svg>
);

export default function AnimatedAuthForm() {
  const [isActive, setIsActive] = useState(false);
  const [loading, setLoading] = useState(false);

  // Login state
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  // Register state
  const [signupName, setSignupName] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: loginEmail,
      password: loginPassword,
    });
    if (error) toast.error(error.message);
    setLoading(false);
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email: signupEmail,
      password: signupPassword,
      options: {
        emailRedirectTo: window.location.origin,
        data: signupName ? { full_name: signupName } : undefined,
      },
    });
    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }
    // Auto-confirm está habilitado: se a sessão não vier no signUp, faz login direto.
    if (!data.session) {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: signupEmail,
        password: signupPassword,
      });
      if (signInError) {
        toast.error(signInError.message);
        setLoading(false);
        return;
      }
    }
    toast.success("Conta criada! Redirecionando…");
    // AuthPage observa a sessão e redireciona para "/" automaticamente.
    setLoading(false);
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      toast.error(result.error.message || "Erro ao entrar com Google");
      setLoading(false);
    }
  };

  return (
    <div className="auth-anim-root">
      <style>{`
        .auth-anim-root {
          font-family: 'Inter', system-ui, sans-serif;
          width: 100%;
          display: flex;
          justify-content: center;
        }

        .aa-container {
          position: relative;
          width: 850px;
          max-width: 100%;
          height: 580px;
          background: hsl(var(--card));
          border-radius: 24px;
          box-shadow: 0 16px 48px rgba(2, 22, 42, 0.12);
          overflow: hidden;
          color: hsl(var(--foreground));
        }

        .aa-container h1 {
          font-size: 32px;
          font-weight: 700;
          letter-spacing: -0.02em;
          margin: -10px 0;
          color: hsl(var(--text-primary));
        }

        .aa-container p {
          font-size: 14px;
          margin: 14px 0;
          color: hsl(var(--text-secondary));
        }

        .aa-form-box {
          position: absolute;
          right: 0;
          width: 50%;
          height: 100%;
          background: hsl(var(--card));
          display: flex;
          align-items: center;
          text-align: center;
          padding: 40px;
          z-index: 1;
          transition: 0.6s ease-in-out 1.2s, visibility 0s 1s;
        }

        .aa-container.active .aa-form-box {
          right: 50%;
        }

        .aa-form-box.register {
          visibility: hidden;
        }

        .aa-container.active .aa-form-box.register {
          visibility: visible;
        }

        .aa-form-inner {
          width: 100%;
        }

        .aa-input-box {
          position: relative;
          margin: 22px 0;
        }

        .aa-input-box input {
          width: 100%;
          padding: 13px 50px 13px 20px;
          background: hsl(var(--bg-surface-2));
          border-radius: 10px;
          border: 1px solid transparent;
          outline: none;
          font-size: 15px;
          color: hsl(var(--text-primary));
          font-weight: 500;
          transition: border-color 0.2s, background 0.2s;
        }

        .aa-input-box input:focus {
          border-color: hsl(var(--accent-primary));
          background: hsl(var(--bg-elevated));
        }

        .aa-input-box input::placeholder {
          color: hsl(var(--text-tertiary));
          font-weight: 400;
        }

        .aa-input-box .aa-icon {
          position: absolute;
          right: 18px;
          top: 50%;
          transform: translateY(-50%);
          width: 18px;
          height: 18px;
          color: hsl(var(--text-tertiary));
          pointer-events: none;
        }

        .aa-forgot {
          margin: -8px 0 18px;
        }

        .aa-forgot a {
          font-size: 13.5px;
          color: hsl(var(--text-secondary));
          text-decoration: none;
        }

        .aa-forgot a:hover {
          color: hsl(var(--accent-primary));
        }

        .aa-btn {
          width: 100%;
          height: 48px;
          background: hsl(var(--accent-primary));
          border-radius: 10px;
          box-shadow: 0 4px 16px rgba(99, 102, 241, 0.25);
          border: none;
          cursor: pointer;
          font-size: 15px;
          color: hsl(var(--accent-foreground));
          font-weight: 600;
          transition: filter 0.2s, transform 0.1s;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }

        .aa-btn:hover:not(:disabled) {
          filter: brightness(1.08);
        }

        .aa-btn:active:not(:disabled) {
          transform: scale(0.98);
        }

        .aa-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .aa-divider-text {
          font-size: 13px !important;
          color: hsl(var(--text-tertiary)) !important;
          margin: 14px 0 !important;
        }

        .aa-social {
          display: flex;
          justify-content: center;
          gap: 10px;
        }

        .aa-social button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 10px;
          width: 48px;
          height: 48px;
          border: 1.5px solid hsl(var(--border));
          border-radius: 10px;
          background: hsl(var(--bg-elevated));
          color: hsl(var(--text-primary));
          cursor: pointer;
          transition: border-color 0.2s, background 0.2s, transform 0.1s;
        }

        .aa-social button:hover:not(:disabled) {
          border-color: hsl(var(--accent-primary));
          background: hsl(var(--bg-surface-1));
        }

        .aa-social button:active:not(:disabled) {
          transform: scale(0.95);
        }

        .aa-social button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .aa-toggle-box {
          position: absolute;
          width: 100%;
          height: 100%;
        }

        .aa-toggle-box::before {
          content: '';
          position: absolute;
          left: -250%;
          width: 300%;
          height: 100%;
          background: linear-gradient(135deg, hsl(var(--bg-darkest)) 0%, hsl(var(--accent-primary)) 100%);
          border-radius: 150px;
          z-index: 2;
          transition: 1.8s ease-in-out;
        }

        .aa-container.active .aa-toggle-box::before {
          left: 50%;
        }

        .aa-toggle-panel {
          position: absolute;
          width: 50%;
          height: 100%;
          color: hsl(var(--text-on-dark));
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          z-index: 2;
          transition: 0.6s ease-in-out;
          padding: 40px;
          text-align: center;
        }

        .aa-toggle-panel h1 {
          color: #fff;
        }

        .aa-toggle-panel p {
          color: rgba(255, 255, 255, 0.85);
          margin-bottom: 20px;
        }

        .aa-toggle-panel.toggle-left {
          left: 0;
          transition-delay: 1.2s;
        }

        .aa-container.active .aa-toggle-panel.toggle-left {
          left: -50%;
          transition-delay: 0.6s;
        }

        .aa-toggle-panel.toggle-right {
          right: -50%;
          transition-delay: 0.6s;
        }

        .aa-container.active .aa-toggle-panel.toggle-right {
          right: 0;
          transition-delay: 1.2s;
        }

        .aa-toggle-panel .aa-btn-ghost {
          width: 160px;
          height: 46px;
          background: transparent;
          border: 2px solid rgba(255, 255, 255, 0.9);
          box-shadow: none;
          color: #fff;
          border-radius: 10px;
          font-size: 15px;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.2s, transform 0.1s;
        }

        .aa-toggle-panel .aa-btn-ghost:hover {
          background: rgba(255, 255, 255, 0.12);
        }

        .aa-toggle-panel .aa-btn-ghost:active {
          transform: scale(0.97);
        }

        @media screen and (max-width: 768px) {
          .aa-container {
            height: calc(100vh - 60px);
            min-height: 620px;
            border-radius: 20px;
          }

          .aa-form-box {
            bottom: 0;
            right: 0;
            width: 100%;
            height: 70%;
            padding: 30px 24px;
          }

          .aa-container.active .aa-form-box {
            right: 0;
            bottom: 30%;
          }

          .aa-toggle-box::before {
            left: 0;
            top: -270%;
            width: 100%;
            height: 300%;
            border-radius: 20vw;
          }

          .aa-container.active .aa-toggle-box::before {
            left: 0;
            top: 70%;
          }

          .aa-container.active .aa-toggle-panel.toggle-left {
            left: 0;
            top: -30%;
          }

          .aa-toggle-panel {
            width: 100%;
            height: 30%;
            padding: 20px;
          }

          .aa-toggle-panel.toggle-left {
            top: 0;
          }

          .aa-toggle-panel.toggle-right {
            right: 0;
            bottom: -30%;
          }

          .aa-container.active .aa-toggle-panel.toggle-right {
            bottom: 0;
          }

          .aa-toggle-panel h1 {
            font-size: 26px;
          }
        }
      `}</style>

      <div className={`aa-container ${isActive ? "active" : ""}`}>
        {/* Login Form */}
        <div className="aa-form-box login">
          <form onSubmit={handleLogin} className="aa-form-inner">
            <h1>Login</h1>
            <div className="aa-input-box">
              <input
                type="email"
                placeholder="E-mail"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                required
                autoComplete="email"
              />
              <Mail className="aa-icon" />
            </div>
            <div className="aa-input-box">
              <input
                type="password"
                placeholder="Senha"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
              <Lock className="aa-icon" />
            </div>
            <div className="aa-forgot">
              <a href="#">Esqueceu a senha?</a>
            </div>
            <button type="submit" className="aa-btn" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Entrar
            </button>
            <p className="aa-divider-text">ou entre com</p>
            <div className="aa-social">
              <button type="button" onClick={handleGoogleLogin} disabled={loading} title="Entrar com Google">
                <GoogleIcon className="w-5 h-5" />
              </button>
            </div>
          </form>
        </div>

        {/* Register Form */}
        <div className="aa-form-box register">
          <form onSubmit={handleSignup} className="aa-form-inner">
            <h1>Cadastro</h1>
            <div className="aa-input-box">
              <input
                type="text"
                placeholder="Nome"
                value={signupName}
                onChange={(e) => setSignupName(e.target.value)}
                autoComplete="name"
              />
              <User className="aa-icon" />
            </div>
            <div className="aa-input-box">
              <input
                type="email"
                placeholder="E-mail"
                value={signupEmail}
                onChange={(e) => setSignupEmail(e.target.value)}
                required
                autoComplete="email"
              />
              <Mail className="aa-icon" />
            </div>
            <div className="aa-input-box">
              <input
                type="password"
                placeholder="Senha (mín. 6 caracteres)"
                value={signupPassword}
                onChange={(e) => setSignupPassword(e.target.value)}
                required
                minLength={6}
                autoComplete="new-password"
              />
              <Lock className="aa-icon" />
            </div>
            <button type="submit" className="aa-btn" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Cadastrar
            </button>
            <p className="aa-divider-text">ou cadastre-se com</p>
            <div className="aa-social">
              <button type="button" onClick={handleGoogleLogin} disabled={loading} title="Cadastrar com Google">
                <GoogleIcon className="w-5 h-5" />
              </button>
            </div>
          </form>
        </div>

        {/* Toggle Box */}
        <div className="aa-toggle-box">
          <div className="aa-toggle-panel toggle-left">
            <h1>Olá, bem-vindo!</h1>
            <p>Ainda não tem uma conta?</p>
            <button type="button" className="aa-btn-ghost" onClick={() => setIsActive(true)}>
              Cadastrar
            </button>
          </div>
          <div className="aa-toggle-panel toggle-right">
            <h1>Bem-vindo de volta!</h1>
            <p>Já tem uma conta?</p>
            <button type="button" className="aa-btn-ghost" onClick={() => setIsActive(false)}>
              Entrar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
