import React from "react";
import { useNavigate } from "react-router-dom";
import { login, resetPassword, isCloud } from "../lib/data";
import { Button, Field } from "../components/ui";
import { Capa } from "../components/Capa";

export default function Login({ onLogin }) {
  const navigate = useNavigate();
  const [tab, setTab] = React.useState("equipe");  // equipe | paciente (sem cadastro público)
  const [email, setEmail] = React.useState("");
  const [pass, setPass] = React.useState("");
  const [err, setErr] = React.useState("");
  const [info, setInfo] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setErr(""); setInfo("");
    if (!email.trim()) return setErr("Informe o e-mail.");
    if (!pass) return setErr("Informe a senha.");

    setBusy(true);
    const res = await login(email.trim(), pass);
    setBusy(false);

    if (res.error) return setErr(res.error);
    onLogin(res.session);
    navigate(res.session.role === "admin" ? "/modulos" : "/portal", { replace: true });
  };

  const esqueci = async () => {
    setErr(""); setInfo("");
    if (!email.trim()) return setErr("Digite seu e-mail primeiro.");
    setBusy(true);
    const r = await resetPassword(email.trim());
    setBusy(false);
    if (r.error) return setErr(r.error);
    setInfo("Enviei um link de redefinição para o seu e-mail.");
  };

  return (
    <div className="login-wrap">
      <Capa />
      <div className="capa-form">
        <form className="login-card" onSubmit={submit}>
          {/* no celular a capa lateral não aparece: as logos sobem para cá */}
          <div className="marcas-mobile">
            <img src="./img/logo-dr-helio.png" alt="Dr. Hélio Okamura" className="dr" />
            <span className="div" />
            <img src="./img/logo-cemep.png" alt="CEMEP Care" className="cemep" />
          </div>

          <div style={{ marginBottom: 4 }}>
            <h1 style={{ fontSize: 21 }}>Acessar</h1>
            <p style={{ fontSize: 12.5, color: "#64748b", marginTop: 2 }}>
              Monitoramento esportivo e reabilitação
            </p>
          </div>

          <div className="login-tabs">
            <button type="button" className={tab === "equipe" ? "on" : ""} onClick={() => { setTab("equipe"); setErr(""); }}>Equipe</button>
            <button type="button" className={tab === "paciente" ? "on" : ""} onClick={() => { setTab("paciente"); setErr(""); setInfo(""); }}>Paciente</button>
          </div>

          {tab === "paciente" && (
            <p style={{ fontSize: 12.5, color: "#64748b", background: "#f8fafc", padding: "9px 11px", borderRadius: 9 }}>
              Use o e-mail e a senha que a clínica enviou para você.
            </p>
          )}

          {!isCloud() && (
            <div className="alert-box alert-amber" style={{ fontSize: 12 }}>Banco não configurado.</div>
          )}

          <Field label="E-mail">
            <input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seu@email.com" />
          </Field>

          <Field label="Senha">
            <input type="password" autoComplete="current-password" value={pass} onChange={(e) => setPass(e.target.value)} placeholder="••••••••" />
          </Field>

          {err && <div className="alert-box alert-red">{err}</div>}
          {info && <div className="alert-box alert-green">{info}</div>}

          <Button type="submit" variant="primary" disabled={busy} style={{ width: "100%", padding: "11px" }}>
            {busy ? "Entrando…" : "Entrar"}
          </Button>

          <button type="button" className="link-btn" onClick={esqueci} disabled={busy}>
            Esqueci minha senha
          </button>

          <p style={{ fontSize: 11, color: "#94a3b8", textAlign: "center", lineHeight: 1.5 }}>
            Dados de saúde: acesso individual e registro por usuário.
            <br />
            Ferramenta de acompanhamento — não substitui o prontuário oficial.
          </p>
        </form>
      </div>
    </div>
  );
}
