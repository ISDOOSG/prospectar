import { useEffect, useState } from "react";
import { User, Lock, Mail, Loader2 } from "lucide-react";
import { signInWithPassword, signUp, getSession, ApiError } from "@/lib/api-client";
import { toast } from "sonner";

export default function AnimatedAuthForm() {
  const [isActive, setIsActive] = useState(false);
  const [loading, setLoading] = useState(false);

  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  const [signupName, setSignupName] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");

  useEffect(() => {
    getSession().then((s) => {
      if (s) window.location.href = "/";
    });
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await signInWithPassword(loginEmail, loginPassword);
    } catch {
      toast.error("E-mail ou senha incorretos");
      setLoading(false);
      return;
    }
    setLoading(false);
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await signUp(signupEmail, signupPassword, signupName.trim() || undefined);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Nao foi possivel criar a conta";
      toast.error(msg);
      setLoading(false);
      return;
    }
    toast.success("Conta criada! Voce ja esta dentro.");
    setLoading(false);
  };

  return (
    <div className="auth-anim-root">
      <style>{`
        .auth-anim-root { font-family: 'Inter', system-ui, sans-serif; width: 100%; display: flex; justify-content: center; }
        .aa-container { position: relative; width: 850px; max-width: 100%; height: 580px; background: hsl(var(--card)); border-radius: 24px; box-shadow: 0 16px 48px rgba(2, 22, 42, 0.12); overflow: hidden; color: hsl(var(--foreground)); }
        .aa-container h1 { font-size: 32px; font-weight: 700; letter-spacing: -0.02em; margin: -10px 0; color: hsl(var(--text-primary)); }
        .aa-container p { font-size: 14px; margin: 14px 0; color: hsl(var(--text-secondary)); }
        .aa-form-box { position: absolute; right: 0; width: 50%; height: 100%; background: hsl(var(--card)); display: flex; align-items: center; text-align: center; padding: 40px; z-index: 1; transition: 0.6s ease-in-out 1.2s, visibility 0s 1s; }
        .aa-container.active .aa-form-box { right: 50%; }
        .aa-form-box.register { visibility: hidden; }
        .aa-container.active .aa-form-box.register { visibility: visible; }
        .aa-form-inner { width: 100%; }
        .aa-input-box { position: relative; margin: 22px 0; }
        .aa-input-box input { width: 100%; padding: 13px 50px 13px 20px; background: hsl(var(--bg-surface-2)); border-radius: 10px; border: 1px solid transparent; outline: none; font-size: 15px; color: hsl(var(--text-primary)); font-weight: 500; transition: border-color 0.2s, background 0.2s; }
        .aa-input-box input:focus { border-color: hsl(var(--accent-primary)); background: hsl(var(--bg-elevated)); }
        .aa-input-box input::placeholder { color: hsl(var(--text-tertiary)); font-weight: 400; }
        .aa-input-box .aa-icon { position: absolute; right: 18px; top: 50%; transform: translateY(-50%); width: 18px; height: 18px; color: hsl(var(--text-tertiary)); pointer-events: none; }
        .aa-forgot { margin: -8px 0 18px; }
        .aa-forgot a { font-size: 13.5px; color: hsl(var(--text-secondary)); text-decoration: none; }
        .aa-forgot a:hover { color: hsl(var(--accent-primary)); }
        .aa-btn { width: 100%; height: 48px; background: hsl(var(--accent-primary)); border-radius: 10px; box-shadow: 0 4px 16px rgba(99, 102, 241, 0.25); border: none; cursor: pointer; font-size: 15px; color: hsl(var(--accent-foreground)); font-weight: 600; transition: filter 0.2s, transform 0.1s; display: inline-flex; align-items: center; justify-content: center; gap: 8px; }
        .aa-btn:hover:not(:disabled) { filter: brightness(1.08); }
        .aa-btn:active:not(:disabled) { transform: scale(0.98); }
        .aa-btn:disabled { opacity: 0.6; cursor: not-allowed; }
        .aa-toggle-box { position: absolute; width: 100%; height: 100%; }
        .aa-toggle-box::before { content: ''; position: absolute; left: -250%; width: 300%; height: 100%; background: linear-gradient(135deg, hsl(var(--bg-darkest)) 0%, hsl(var(--accent-primary)) 100%); border-radius: 150px; z-index: 2; transition: 1.8s ease-in-out; }
        .aa-container.active .aa-toggle-box::before { left: 50%; }
        .aa-toggle-panel { position: absolute; width: 50%; height: 100%; color: hsl(var(--text-on-dark)); display: flex; flex-direction: column; justify-content: center; align-items: center; z-index: 2; transition: 0.6s ease-in-out; padding: 40px; text-align: center; }
        .aa-toggle-panel h1 { color: #fff; }
        .aa-toggle-panel p { color: rgba(255, 255, 255, 0.85); margin-bottom: 20px; }
        .aa-toggle-panel.toggle-left { left: 0; transition-delay: 1.2s; }
        .aa-container.active .aa-toggle-panel.toggle-left { left: -50%; transition-delay: 0.6s; }
        .aa-toggle-panel.toggle-right { right: -50%; transition-delay: 0.6s; }
        .aa-container.active .aa-toggle-panel.toggle-right { right: 0; transition-delay: 1.2s; }
        .aa-toggle-panel .aa-btn-ghost { width: 160px; height: 46px; background: transparent; border: 2px solid rgba(255, 255, 255, 0.9); box-shadow: none; color: #fff; border-radius: 10px; font-size: 15px; font-weight: 600; cursor: pointer; transition: background 0.2s, transform 0.1s; }
        .aa-toggle-panel .aa-btn-ghost:hover { background: rgba(255, 255, 255, 0.12); }
        .aa-toggle-panel .aa-btn-ghost:active { transform: scale(0.97); }
        @media screen and (max-width: 768px) {
          .aa-container { height: calc(100vh - 60px); min-height: 620px; border-radius: 20px; }
          .aa-form-box { bottom: 0; right: 0; width: 100%; height: 70%; padding: 30px 24px; }
          .aa-container.active .aa-form-box { right: 0; bottom: 30%; }
          .aa-toggle-box::before { left: 0; top: -270%; width: 100%; height: 300%; border-radius: 20vw; }
          .aa-container.active .aa-toggle-box::before { left: 0; top: 70%; }
          .aa-container.active .aa-toggle-panel.toggle-left { left: 0; top: -30%; }
          .aa-toggle-panel { width: 100%; height: 30%; padding: 20px; }
          .aa-toggle-panel.toggle-left { top: 0; }
          .aa-toggle-panel.toggle-right { right: 0; bottom: -30%; }
          .aa-container.active .aa-toggle-panel.toggle-right { bottom: 0; }
          .aa-toggle-panel h1 { font-size: 26px; }
        }
      `}</style>

      <div className={`aa-container ${isActive ? "active" : ""}`}>
        <div className="aa-form-box login">
          <form onSubmit={handleLogin} className="aa-form-inner">
            <h1>Login</h1>
            <div className="aa-input-box">
              <input type="email" placeholder="E-mail" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} required autoComplete="email" />
              <Mail className="aa-icon" />
            </div>
            <div className="aa-input-box">
              <input type="password" placeholder="Senha" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} required autoComplete="current-password" />
              <Lock className="aa-icon" />
            </div>
            <div className="aa-forgot"><a href="#">Esqueceu a senha?</a></div>
            <button type="submit" className="aa-btn" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Entrar
            </button>
          </form>
        </div>

        <div className="aa-form-box register">
          <form onSubmit={handleSignup} className="aa-form-inner">
            <h1>Cadastro</h1>
            <div className="aa-input-box">
              <input type="text" placeholder="Nome" value={signupName} onChange={(e) => setSignupName(e.target.value)} autoComplete="name" />
              <User className="aa-icon" />
            </div>
            <div className="aa-input-box">
              <input type="email" placeholder="E-mail" value={signupEmail} onChange={(e) => setSignupEmail(e.target.value)} required autoComplete="email" />
              <Mail className="aa-icon" />
            </div>
            <div className="aa-input-box">
              <input type="password" placeholder="Senha (min. 8 caracteres)" value={signupPassword} onChange={(e) => setSignupPassword(e.target.value)} required minLength={8} autoComplete="new-password" />
              <Lock className="aa-icon" />
            </div>
            <button type="submit" className="aa-btn" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Cadastrar
            </button>
          </form>
        </div>

        <div className="aa-toggle-box">
          <div className="aa-toggle-panel toggle-left">
            <h1>Ola, bem-vindo!</h1>
            <p>Ainda nao tem uma conta?</p>
            <button type="button" className="aa-btn-ghost" onClick={() => setIsActive(true)}>Cadastrar</button>
          </div>
          <div className="aa-toggle-panel toggle-right">
            <h1>Bem-vindo de volta!</h1>
            <p>Ja tem uma conta?</p>
            <button type="button" className="aa-btn-ghost" onClick={() => setIsActive(false)}>Entrar</button>
          </div>
        </div>
      </div>
    </div>
  );
}
