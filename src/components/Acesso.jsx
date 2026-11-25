import React from "react";
import { criarAcessoPaciente, gerarSenha } from "../lib/data";
import { Button, Modal, Field } from "./ui";

/**
 * Acesso do paciente: só a clínica cria. Gera a senha aqui e mostra para o
 * médico copiar e enviar ao paciente (WhatsApp/e-mail). Não há cadastro público.
 */
export function BotaoAcesso({ patient }) {
  const [open, setOpen] = React.useState(false);
  const [email, setEmail] = React.useState(patient?.email || "");
  const [senha, setSenha] = React.useState("");
  const [criado, setCriado] = React.useState(null);
  const [err, setErr] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [copiado, setCopiado] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setEmail(patient?.email || "");
      setSenha(gerarSenha());
      setCriado(null); setErr(""); setCopiado(false);
    }
  }, [open]);

  const criar = async () => {
    setErr(""); setBusy(true);
    const r = await criarAcessoPaciente(patient.id, { email, senha });
    setBusy(false);
    if (r.error) return setErr(r.error);
    setCriado(r);
  };

  const copiar = async () => {
    const txt = `Dr. Hélio — acesso ao seu acompanhamento\n\nSite: ${window.location.origin + window.location.pathname}\nE-mail: ${criado.email}\nSenha: ${criado.senha}\n\nEntre com a aba "Paciente". No primeiro acesso, troque a senha no Perfil.`;
    try { await navigator.clipboard.writeText(txt); setCopiado(true); } catch { setCopiado(false); }
  };

  const jaTem = !!patient?.user_id;

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        {jaTem ? "Acesso ✓" : "Criar acesso"}
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title={`Acesso — ${patient?.name || ""}`}
        footer={<Button variant="outline" onClick={() => setOpen(false)}>Fechar</Button>}>
        {!criado ? (
          <>
            <p style={{ fontSize: 12.5, color: "#64748b", background: "#f8fafc", padding: "9px 11px", borderRadius: 9 }}>
              O app não tem cadastro público. Você cria o acesso e envia a senha ao paciente.
              {jaTem && " Esta ficha já tem acesso vinculado — criar de novo dará erro; peça redefinição."}
            </p>
            <Field label="E-mail do paciente" hint="É o login dele. Use o mesmo da ficha.">
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </Field>
            <Field label="Senha gerada" hint="Sem caracteres ambíguos (0/O, 1/l) para ditar por telefone.">
              <div style={{ display: "flex", gap: 7 }}>
                <input value={senha} onChange={(e) => setSenha(e.target.value)} style={{ fontFamily: "ui-monospace,monospace", letterSpacing: 1 }} />
                <Button variant="outline" size="sm" onClick={() => setSenha(gerarSenha())}>↻</Button>
              </div>
            </Field>
            {err && <div className="alert-box alert-red">{err}</div>}
            <Button variant="primary" onClick={criar} disabled={busy || !email} style={{ width: "100%", marginTop: 8 }}>
              {busy ? "Criando…" : "Criar acesso do paciente"}
            </Button>
          </>
        ) : (
          <>
            <div className="alert-box alert-green">Acesso criado e vinculado à ficha.</div>
            <div style={{ background: "#0b2136", color: "#e2e8f0", borderRadius: 11, padding: 14, margin: "10px 0", fontFamily: "ui-monospace,monospace", fontSize: 13, lineHeight: 1.7 }}>
              <div style={{ color: "#8ba3ba", fontSize: 11, fontFamily: "system-ui" }}>SITE</div>
              <div style={{ wordBreak: "break-all" }}>{window.location.origin + window.location.pathname}</div>
              <div style={{ color: "#8ba3ba", fontSize: 11, fontFamily: "system-ui", marginTop: 8 }}>E-MAIL</div>
              <div>{criado.email}</div>
              <div style={{ color: "#8ba3ba", fontSize: 11, fontFamily: "system-ui", marginTop: 8 }}>SENHA</div>
              <div style={{ fontSize: 19, fontWeight: 700, letterSpacing: 2 }}>{criado.senha}</div>
            </div>
            <Button variant="primary" onClick={copiar} style={{ width: "100%" }}>
              {copiado ? "Texto copiado ✓" : "Copiar mensagem para enviar"}
            </Button>
            <p style={{ fontSize: 11.5, color: "#94a3b8", marginTop: 9 }}>
              A senha aparece só aqui. Se perder, gere outra redefinindo na ficha.
            </p>
          </>
        )}
      </Modal>
    </>
  );
}
