import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { LockKeyhole, Mail } from "lucide-react";
import { useAuth } from "../lib/auth";
import { ActionButton } from "../components/ui";
export function LoginPage() {
  const { user, login } = useAuth(),
    navigate = useNavigate();
  const [email, setEmail] = useState("admin@flubox.com.br"),
    [password, setPassword] = useState("Admin@123"),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  if (user) return <Navigate to="/dashboard" replace />;
  return (
    <div className="auth-page">
      <div className="auth-brand">
        <span className="brand-mark">F</span>
        <h1>Flubox</h1>
        <p>
          Catálogo, pedidos, pagamentos e expedição em uma central operacional.
        </p>
      </div>
      <form
        className="auth-card"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          try {
            await login(email, password);
            navigate("/dashboard");
          } catch (e) {
            setError(e instanceof Error ? e.message : "Falha ao entrar");
          } finally {
            setBusy(false);
          }
        }}
      >
        <h2>Acessar a plataforma</h2>
        <p>Entre com sua conta de administrador, colaborador ou lojista.</p>
        <label>
          E-mail
          <div className="field-icon">
            <Mail />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
        </label>
        <label>
          Senha
          <div className="field-icon">
            <LockKeyhole />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
        </label>
        {error && <div className="form-error">{error}</div>}
        <ActionButton tone="primary" type="submit" width="100%" isDisabled={busy} isLoading={busy} aria-label="Entrar">
          {busy ? "Entrando…" : "Entrar"}
        </ActionButton>
        <button
          type="button"
          className="link-button"
          onClick={() => navigate("/forgot-password")}
        >
          Esqueci minha senha
        </button>
      </form>
    </div>
  );
}
