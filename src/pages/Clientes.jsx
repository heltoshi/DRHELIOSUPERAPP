import React from "react";
import { useNavigate } from "react-router-dom";
import {
  Patients, Logs, HRV, Responses, PROMs, maturacaoVisitas,
  subscribe, criarAcessoPaciente, gerarSenha, trocarSenhaPaciente,
} from "../lib/data";
import { Card, Badge, Button, Field, Empty, Modal } from "../components/ui";
import { MODULOS } from "./PacientesUnificados";
import ExportarPeriodo from "../components/ExportarPeriodo";

const hoje = () => new Date().toISOString().slice(0, 10);
const fdata = (s) => (s ? `${String(s).slice(8, 10)}/${String(s).slice(5, 7)}/${String(s).slice(0, 4)}` : "—");

const VAZIO = {
  patient_id: "", name: "", email: "", phone: "", dob: "", gender: "Masculino",
  diagnosis: "", diagnosis_detail: "", region: "", laterality: "", notes: "",
  protocol_start: "", sport: "", team: "", coach: "", weight: "", height: "",
  modules: ["atleta360", "orthoflow", "maturacao"],
};

/**
 * MÓDULO CLIENTES — o cadastro único do super app.
 * Um cliente = uma ficha, editável aqui; os três módulos são ligados/desligados
 * na mesma ficha. O acesso (login e senha) é criado e gerenciado aqui também.
 */
export default function Clientes() {
  const [, force] = React.useState(0);
  React.useEffect(() => subscribe(() => force((n) => n + 1)), []);
  const navigate = useNavigate();

  const [busca, setBusca] = React.useState("");
  const [form, setForm] = React.useState(null);   // ficha em edição (null = lista)
  const [acesso, setAcesso] = React.useState(null); // cliente para gerenciar acesso
  const [contagem, setContagem] = React.useState({});
  const [aviso, setAviso] = React.useState("");
  const [exportar, setExportar] = React.useState(null);

  const todos = Patients.list();

  React.useEffect(() => {
    let vivo = true;
    (async () => {
      const out = {};
      for (const p of todos) {
        const mat = await maturacaoVisitas.list(p.id).catch(() => []);
        out[p.id] = {
          treino: Logs.list(p.id).length,
          vfc: HRV.list(p.id).length,
          quest: Responses.list({ patient_id: p.id }).length,
          prom: PROMs.list(p.id).length,
          mat: (mat || []).length,
        };
      }
      if (vivo) setContagem(out);
    })();
    return () => { vivo = false; };
  }, [todos.length]);

  const lista = todos.filter((p) =>
    !busca || (p.name + " " + (p.email || "") + " " + (p.diagnosis || ""))
      .toLowerCase().includes(busca.toLowerCase()));

  const salvar = async () => {
    setAviso("");
    if (!form.name.trim()) return setAviso("O nome é obrigatório.");
    const mods = (form.modules || []).length ? form.modules : ["orthoflow"];
    if (form.id) {
      await Patients.update(form.id, { ...form, modules: mods });
    } else {
      await Patients.create({ ...form, modules: mods, protocol_start: form.protocol_start || hoje() });
    }
    setForm(null);
    force((n) => n + 1);
  };

  const alternarModulo = async (p, mod) => {
    const atual = p.modules || [];
    const novos = atual.includes(mod) ? atual.filter((x) => x !== mod) : [...atual, mod];
    if (!novos.length) return;
    await Patients.update(p.id, { modules: novos });
    force((n) => n + 1);
  };

  const apagar = async (p) => {
    if (!window.confirm(`Apagar a ficha de ${p.name}? Os registros de treino, questionários e maturação também saem.`)) return;
    await Patients.remove(p.id);
    force((n) => n + 1);
  };

  // ------------------------------------------------------------- edição
  if (form) {
    const set = (k) => (e) => setForm((x) => ({ ...x, [k]: e.target.value }));
    const temMod = (k) => (form.modules || []).includes(k);
    const alternar = (k) => setForm((x) => {
      const m = x.modules || [];
      return { ...x, modules: m.includes(k) ? m.filter((y) => y !== k) : [...m, k] };
    });
    return (
      <div className="content">
        <button className="link-back" onClick={() => { setForm(null); setAviso(""); }}>← voltar aos clientes</button>
        <div className="topbar" style={{ marginBottom: 8 }}>
          <div>
            <h1 style={{ fontSize: 20 }}>{form.id ? "Editar cliente" : "Novo cliente"}</h1>
            <p>{form.id ? `Ficha ${form.patient_id}` : "A ficha serve aos três módulos"}</p>
          </div>
        </div>

        <Card>
          <p className="sec-title">Identificação</p>
          <div className="form-grid">
            <Field label="Nome completo *"><input value={form.name} onChange={set("name")} /></Field>
            <Field label="E-mail (login do cliente)"><input type="email" value={form.email} onChange={set("email")} /></Field>
            <Field label="WhatsApp"><input value={form.phone} onChange={set("phone")} /></Field>
            <Field label="Data de nascimento"><input type="date" value={form.dob || ""} onChange={set("dob")} /></Field>
            <Field label="Sexo">
              <select value={form.gender} onChange={set("gender")}>
                <option>Masculino</option><option>Feminino</option>
              </select>
            </Field>
          </div>
        </Card>

        <Card>
          <p className="sec-title">Módulos liberados</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {MODULOS.map((m) => (
              <label key={m.id} style={{
                display: "flex", alignItems: "center", gap: 10, padding: "10px 12px",
                border: `1px solid ${temMod(m.id) ? m.cor : "#e8eef5"}`, borderRadius: 11,
                background: temMod(m.id) ? `${m.cor}0d` : "#fff", cursor: "pointer",
              }}>
                <input type="checkbox" checked={temMod(m.id)} onChange={() => alternar(m.id)}
                  style={{ width: 18, height: 18, accentColor: m.cor }} />
                <span style={{ flex: 1 }}>
                  <b style={{ fontSize: 13, color: "#0f172a" }}>{m.nome}</b>
                  <span style={{ display: "block", fontSize: 11, color: "#94a3b8" }}>
                    {m.id === "atleta360" ? "Treino, PSE, VFC e questionários esportivos"
                      : m.id === "orthoflow" ? "Os 17 questionários de função e reabilitação"
                        : "Antropometria, PHV e predição de estatura adulta"}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </Card>

        <Card>
          <p className="sec-title">Clínico</p>
          <div className="form-grid">
            <Field label="Diagnóstico"><input value={form.diagnosis || ""} onChange={set("diagnosis")} /></Field>
            <Field label="Região"><input value={form.region || ""} onChange={set("region")} placeholder="joelho, ombro…" /></Field>
            <Field label="Lateralidade">
              <select value={form.laterality || ""} onChange={set("laterality")}>
                <option value="">—</option><option>direito</option><option>esquerdo</option><option>bilateral</option>
              </select>
            </Field>
            <Field label="Início do protocolo"><input type="date" value={form.protocol_start || ""} onChange={set("protocol_start")} /></Field>
            <Field label="Estatura (cm)"><input type="number" step="0.1" value={form.height || ""} onChange={set("height")} /></Field>
            <Field label="Peso (kg)"><input type="number" step="0.1" value={form.weight || ""} onChange={set("weight")} /></Field>
          </div>
          {temMod("atleta360") && (
            <div className="form-grid" style={{ marginTop: 10 }}>
              <Field label="Esporte"><input value={form.sport || ""} onChange={set("sport")} /></Field>
              <Field label="Equipe"><input value={form.team || ""} onChange={set("team")} /></Field>
              <Field label="Treinador"><input value={form.coach || ""} onChange={set("coach")} /></Field>
            </div>
          )}
          <div style={{ marginTop: 10 }}>
            <Field label="Observações"><textarea value={form.notes || ""} onChange={set("notes")} rows={2} /></Field>
          </div>
        </Card>

        {aviso && <div className="alert-box alert-red">{aviso}</div>}
        <div style={{ display: "flex", gap: 8 }}>
          <Button variant="outline" onClick={() => { setForm(null); setAviso(""); }} style={{ flex: 1 }}>Cancelar</Button>
          <Button variant="primary" onClick={salvar} style={{ flex: 2 }}>{form.id ? "Salvar alterações" : "Criar cliente"}</Button>
        </div>
      </div>
    );
  }

  // ------------------------------------------------------------- lista
  return (
    <div className="content">
      <div className="topbar">
        <div>
          <button className="link-back" onClick={() => navigate("/modulos")}>← módulos</button>
          <h1>Clientes</h1>
          <p>{todos.length} cadastros · ficha única para os três módulos</p>
        </div>
        <Button variant="primary" onClick={() => setForm({ ...VAZIO })}>＋ Novo cliente</Button>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por nome, e-mail ou diagnóstico"
          style={{ flex: 1 }} />
      </div>

      {lista.length === 0 && <Card><Empty title="Nenhum cliente encontrado" hint="Crie o primeiro com o botão Novo cliente." /></Card>}

      <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
        {lista.map((p) => {
          const c = contagem[p.id] || {};
          const total = (c.treino || 0) + (c.prom || 0) + (c.mat || 0) + (c.quest || 0) + (c.vfc || 0);
          return (
            <div key={p.id} className="cli-card">
              <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
                <div className="cli-avatar" style={{ background: p.user_id ? "#0e7490" : "#cbd5e1" }}>
                  {p.name.split(" ").map((x) => x[0]).slice(0, 2).join("")}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
                    <b style={{ fontSize: 13.5, color: "#0f172a" }}>{p.name}</b>
                    <span className="cli-code">{p.code}</span>
                    {p.user_id
                      ? <span className="cli-tag ok">acesso ativo</span>
                      : <span className="cli-tag off">sem acesso</span>}
                  </div>
                  <p style={{ fontSize: 11, color: "#94a3b8", margin: "2px 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {p.email || "sem e-mail"} · {p.diagnosis || "sem diagnóstico"} · {total} registros
                  </p>
                </div>
              </div>

              <div style={{ display: "flex", gap: 5, marginTop: 10, flexWrap: "wrap" }}>
                {MODULOS.map((m) => {
                  const on = (p.modules || []).includes(m.id);
                  return (
                    <button key={m.id} onClick={() => alternarModulo(p, m.id)}
                      title={on ? `Desligar ${m.nome}` : `Ligar ${m.nome}`}
                      style={{
                        border: `1px solid ${on ? m.cor : "#e2e8f0"}`, background: on ? m.cor : "#fff",
                        color: on ? "#fff" : "#94a3b8", fontSize: 10, fontWeight: 700,
                        padding: "4px 9px", borderRadius: 20, cursor: "pointer", fontFamily: "inherit",
                      }}>
                      {on ? "✓ " : ""}{m.nome}
                    </button>
                  );
                })}
              </div>

              <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
                <Button size="sm" variant="outline" onClick={() => setForm({ ...VAZIO, ...p, modules: p.modules || [] })}>Editar</Button>
                <Button size="sm" variant="outline" onClick={() => setAcesso(p)}>{p.user_id ? "Senha" : "Criar acesso"}</Button>
                <Button size="sm" variant="outline" onClick={() => navigate(`/clientes/${p.id}`)}>Ficha</Button>
                <Button size="sm" variant="teal" onClick={() => navigate(`/clientes/${p.id}/laudo`)}>Laudo</Button>
                <Button size="sm" variant="outline" onClick={() => setExportar(p)}>⬇ Exportar</Button>
                <button className="cli-del" onClick={() => apagar(p)} title="Apagar ficha">✕</button>
              </div>
            </div>
          );
        })}
      </div>

      {exportar && <ExportarPeriodo paciente={exportar} onClose={() => setExportar(null)} />}
      {acesso && <ModalAcesso patient={acesso} onClose={(msg) => { setAcesso(null); if (msg) setAviso(msg); force((n) => n + 1); }} />}
    </div>
  );
}

/* ---------------------------------------------------------------- acesso */
function ModalAcesso({ patient, onClose }) {
  const [senha, setSenha] = React.useState(gerarSenha());
  const [email, setEmail] = React.useState(patient.email || "");
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState("");
  const [pronto, setPronto] = React.useState(null);
  const [copiado, setCopiado] = React.useState(false);
  const jaTem = !!patient.user_id;

  const executar = async () => {
    setErr(""); setBusy(true);
    let r;
    if (jaTem) {
      r = await trocarSenhaPaciente(patient.code || patient.id, senha);
    } else {
      r = await criarAcessoPaciente(patient.id, { email, senha });
    }
    setBusy(false);
    if (r?.error) return setErr(r.error);
    setPronto({ email: jaTem ? patient.email : email, senha });
  };

  const copiar = async () => {
    const txt = `Dr. Hélio — acesso ao seu acompanhamento\n\nE-mail: ${pronto.email}\nSenha: ${pronto.senha}\n\nEntre em "Paciente" e escolha o módulo.`;
    try { await navigator.clipboard.writeText(txt); setCopiado(true); } catch { setCopiado(false); }
  };

  return (
    <Modal open onClose={() => onClose(pronto ? "Senha atualizada." : "")}
      title={`${jaTem ? "Trocar senha" : "Criar acesso"} — ${patient.name}`}
      footer={<Button variant="outline" onClick={() => onClose(pronto ? "Senha atualizada." : "")}>Fechar</Button>}>
      {pronto ? (
        <>
          <div className="alert-box alert-green">✓ {jaTem ? "Senha trocada" : "Acesso criado"} para {pronto.email}</div>
          <div style={{ background: "#0b2545", borderRadius: 12, padding: 16, textAlign: "center", margin: "12px 0" }}>
            <p style={{ fontSize: 10, color: "#7dd3fc", letterSpacing: ".1em", textTransform: "uppercase", margin: 0 }}>senha</p>
            <p style={{ fontSize: 24, fontWeight: 800, letterSpacing: 3, color: "#fff", margin: "4px 0 0", fontFamily: "ui-monospace,monospace" }}>{pronto.senha}</p>
          </div>
          <p style={{ fontSize: 11.5, color: "#94a3b8" }}>Aparece só agora. Anote ou envie ao cliente.</p>
          <Button variant="teal" onClick={copiar} style={{ width: "100%" }}>{copiado ? "✓ Copiado" : "Copiar mensagem"}</Button>
        </>
      ) : (
        <>
          <p style={{ fontSize: 12.5, color: "#64748b", background: "#f8fafc", padding: "9px 11px", borderRadius: 9 }}>
            {jaTem
              ? "O cliente já tem login. Definir uma senha nova revoga a anterior."
              : "O app não tem cadastro público: você cria o acesso e envia a senha."}
          </p>
          {!jaTem && (
            <Field label="E-mail do cliente"><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
          )}
          <Field label="Senha" hint="Sem caracteres ambíguos, para ditar por telefone.">
            <div style={{ display: "flex", gap: 7 }}>
              <input value={senha} onChange={(e) => setSenha(e.target.value)} style={{ fontFamily: "ui-monospace,monospace" }} />
              <Button variant="outline" size="sm" onClick={() => setSenha(gerarSenha())}>↻</Button>
            </div>
          </Field>
          {err && <div className="alert-box alert-red">{err}</div>}
          <Button variant="primary" onClick={executar} disabled={busy} style={{ width: "100%", marginTop: 8 }}>
            {busy ? "Salvando…" : jaTem ? "Trocar senha" : "Criar acesso"}
          </Button>
        </>
      )}
    </Modal>
  );
}
