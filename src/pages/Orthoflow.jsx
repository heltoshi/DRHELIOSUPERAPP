import React from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { Patients, PROMs, protocolWeek, state, subscribe, exportBackup } from "../lib/data";
import { QUESTIONNAIRES, computeScore, MCID_MAP, interpretChange } from "../lib/instrumentos";
import { Card, CardTitle, Badge, Button, Field, Modal, Empty, Bar, Avatar } from "../components/ui";
import { SeverityBars } from "../components/charts";
import { CartaoInstrumento } from "../components/PromCards";

const fmtD = (iso) => {
  if (!iso) return "—";
  const [y, m, d] = String(iso).slice(0, 10).split("-");
  return `${d}/${m}/${y.slice(2)}`;
};

// ------------------------------------------------------------------ cadastro
function PacienteForm({ open, onClose, initial }) {
  const [f, setF] = React.useState({});
  const [err, setErr] = React.useState("");

  React.useEffect(() => {
    if (open) { setF(initial ? { ...initial } : { status: "ativo", modules: ["orthoflow"] }); setErr(""); }
  }, [open, initial]);

  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));

  const salvar = async () => {
    if (!f.name?.trim()) return setErr("O nome é obrigatório.");
    const payload = { ...f };
    if (!payload.modules?.length) payload.modules = ["orthoflow"];
    try {
      if (initial?.id) await Patients.update(initial.id, payload);
      else await Patients.create(payload);
      onClose();
    } catch (e) {
      setErr(e.message);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={initial ? "Editar paciente" : "Novo paciente"} wide
      footer={<><Button variant="outline" onClick={onClose}>Cancelar</Button><Button variant="primary" onClick={salvar}>Salvar</Button></>}>
      <div className="form-grid">
        <div className="span-2"><Field label="Nome completo *"><input value={f.name || ""} onChange={set("name")} /></Field></div>
        <Field label="Data de nascimento"><input type="date" value={f.dob || ""} onChange={set("dob")} /></Field>
        <Field label="E-mail" hint="É por ele que o paciente entra no app"><input type="email" value={f.email || ""} onChange={set("email")} /></Field>
        <Field label="WhatsApp"><input value={f.phone || ""} onChange={set("phone")} /></Field>
        <Field label="Diagnóstico"><input value={f.diagnosis || ""} onChange={set("diagnosis")} placeholder="Ex.: Lesão do LCA" /></Field>
        <Field label="Região afetada"><input value={f.region || ""} onChange={set("region")} placeholder="Ex.: Joelho direito" /></Field>
        <Field label="Início do protocolo"><input type="date" value={f.protocol_start || ""} onChange={set("protocol_start")} /></Field>
        <div className="span-2">
          <Field label="Módulos" hint="Marque os que o paciente participa">
            <div style={{ display: "flex", gap: 14, paddingTop: 4 }}>
              {[["orthoflow", "OrthoFlow (PROMs)"], ["atleta360", "Atleta 360 (treino)"]].map(([id, label]) => (
                <label key={id} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer" }}>
                  <input type="checkbox" style={{ width: 16, height: 16 }}
                    checked={(f.modules || []).includes(id)}
                    onChange={(e) => setF((x) => {
                      const s = new Set(x.modules || []);
                      e.target.checked ? s.add(id) : s.delete(id);
                      return { ...x, modules: [...s] };
                    })} />
                  {label}
                </label>
              ))}
            </div>
          </Field>
        </div>
        <div className="span-2"><Field label="Observações"><textarea value={f.notes || ""} onChange={set("notes")} /></Field></div>
        {err && <div className="span-2 alert-box alert-red">{err}</div>}
      </div>
    </Modal>
  );
}

// ------------------------------------------------------------- lista/lista
export default function OrthoFlow({ detalhe }) {
  const [, force] = React.useState(0);
  React.useEffect(() => subscribe(() => force((n) => n + 1)), []);

  return detalhe ? <FichaPaciente /> : <ListaOrthoFlow />;
}

function ListaOrthoFlow() {
  const [busca, setBusca] = React.useState("");
  const [novo, setNovo] = React.useState(false);
  const pacientes = Patients.list().filter((p) => p.modules.includes("orthoflow"));

  const lista = pacientes.filter((p) =>
    !busca || (p.name + " " + (p.diagnosis || "")).toLowerCase().includes(busca.toLowerCase()));

  const adesao = (p) => {
    const s = PROMs.list(p.id);
    return s.length;
  };

  return (
    <>
      <div className="topbar">
        <div>
          <h1>OrthoFlow</h1>
          <p>{pacientes.length} {pacientes.length === 1 ? "paciente" : "pacientes"} em acompanhamento · {PROMs.list().length} {PROMs.list().length === 1 ? "coleta" : "coletas"} de PROM</p>
        </div>
        <Button variant="primary" size="sm" onClick={() => setNovo(true)}>+ Paciente</Button>
      </div>
      <div className="content">
        <div style={{ display: "flex", gap: 9 }}>
          <input placeholder="Buscar por nome ou diagnóstico…" value={busca} onChange={(e) => setBusca(e.target.value)} style={{ flex: 1 }} />
        </div>

        {lista.length === 0 ? (
          <Card><Empty title="Nenhum paciente no OrthoFlow" hint="Cadastre o primeiro paciente para iniciar o protocolo." /></Card>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
            {lista.map((p) => {
              const semana = protocolWeek(p.protocol_start);
              const coletas = adesao(p);
              return (
                <Link key={p.id} to={`/orthoflow/paciente/${p.id}`} className="row-link" style={{ padding: "13px 15px" }}>
                  <Avatar name={p.name} size={42} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                      <b style={{ fontSize: 14 }}>{p.name}</b>
                      <Badge tone="gray">{p.code}</Badge>
                      {p.modules.includes("atleta360") && <Badge tone="teal">360</Badge>}
                    </div>
                    <p style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>
                      {p.diagnosis || "sem diagnóstico"}
                      {p.region && ` · ${p.region}`}
                      {` · ${coletas} ${coletas === 1 ? "coleta" : "coletas"}`}
                    </p>
                  </div>
                  <div style={{ textAlign: "right", minWidth: 62 }}>
                    <p style={{ fontSize: 11, color: "#94a3b8" }}>Semana</p>
                    <p style={{ fontSize: 15, fontWeight: 700 }}>{semana ?? "—"}</p>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
      <PacienteForm open={novo} onClose={() => setNovo(false)} />
    </>
  );
}

// ------------------------------------------------------------- ficha
function FichaPaciente() {
  const { id } = useParams();
  const navigate = useNavigate();
  const p = Patients.get(id);
  const [novoProm, setNovoProm] = React.useState(false);
  const [editando, setEditando] = React.useState(false);

  if (!p) return <div className="content"><Card><Empty title="Paciente não encontrado" /></Card></div>;

  const sub = PROMs.list(p.id);
  const semana = protocolWeek(p.protocol_start);

  // última coleta de cada instrumento
  // As coletas antigas do Orthopulse vêm com o código em maiúsculas ("KOOS")
  // e os instrumentos do app usam id minúsculo ("koos"). Casa sem caixa e
  // tratando hífen/underscore, guardando a chave real da coleta.
  const norm = (x) => String(x || "").toLowerCase().replace(/[-_\s]/g, "");
  const porInstrumento = {};
  sub.forEach((s) => {
    const k = norm(s.questionnaire);
    if (!porInstrumento[k]) porInstrumento[k] = [];
    porInstrumento[k].push(s);
  });
  const acharInstrumento = (chave) => QUESTIONNAIRES.find((q) => norm(q.id) === chave || norm(q.shortName) === chave || norm(q.name) === chave) || null;

  const barras = Object.entries(porInstrumento)
    .map(([qid, arr]) => {
      const inst = acharInstrumento(qid);
      const ult = arr[0];
      if (!inst || ult?.total_score == null) return null;
      const max = inst.maxScore || 100;
      const pct = Math.round((Number(ult.total_score) / max) * 100);
      return {
        label: inst.shortName || inst.name || qid,
        value: Number(ult.total_score),
        pct,
        color: pct >= 66 ? "#dc2626" : pct >= 33 ? "#f59e0b" : "#059669",
      };
    })
    .filter(Boolean);

  return (
    <>
      <div className="topbar">
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <button className="icon-btn" onClick={() => navigate("/orthoflow")} style={{ fontSize: 17 }}>←</button>
          <div>
            <h1 style={{ display: "flex", gap: 8, alignItems: "center" }}>
              {p.name} <Badge tone="gray">{p.code}</Badge>
              {p.modules.includes("atleta360") && <Badge tone="teal">Atleta 360</Badge>}
            </h1>
            <p>{p.diagnosis || "sem diagnóstico"}{p.region ? ` · ${p.region}` : ""}{semana ? ` · semana ${semana} do protocolo` : ""}</p>
          </div>
        </div>
        <div style={{ display: "flex", gap: 7 }}>
          <Button variant="outline" size="sm" onClick={() => setEditando(true)}>Editar</Button>
          <Button variant="primary" size="sm" onClick={() => setNovoProm(true)}>+ Aplicar PROM</Button>
        </div>
      </div>

      <div className="content">
        <div className="grid grid-4">
          <Card><p className="stat-label">Coletas</p><p className="stat-value">{sub.length}</p><p className="stat-sub">{Object.keys(porInstrumento).length} instrumentos</p></Card>
          <Card><p className="stat-label">Início do protocolo</p><p className="stat-value" style={{ fontSize: 17 }}>{fmtD(p.protocol_start)}</p><p className="stat-sub">{semana ? `semana ${semana}` : "não iniciado"}</p></Card>
          <Card><p className="stat-label">Última coleta</p><p className="stat-value" style={{ fontSize: 17 }}>{sub[0] ? fmtD(sub[0].submitted_at) : "—"}</p></Card>
          <Card><p className="stat-label">Módulos</p><p className="stat-value" style={{ fontSize: 16 }}>{(p.modules || []).map((m) => m === "atleta360" ? "360" : "Ortho").join(" · ")}</p></Card>
        </div>

        {p.modules.includes("atleta360") && (
          <div className="alert-box alert-green" style={{ fontSize: 12.5 }}>
            Este paciente também está no Atleta 360 — os dados de treino e VFC ficam na mesma ficha.
            {" "}<Link to={`/360/pacientes/${p.id}`} style={{ fontWeight: 700 }}>Abrir no Atleta 360 →</Link>
          </div>
        )}

        <Card>
          <CardTitle sub="Último escore por instrumento — quanto mais baixo, melhor na maioria">Evolução por instrumento</CardTitle>
          {barras.length === 0 ? (
            <Empty title="Nenhuma coleta ainda" hint="Aplique o primeiro PROM para iniciar o acompanhamento."
              action={<Button variant="teal" size="sm" onClick={() => setNovoProm(true)} style={{ marginTop: 12 }}>+ Aplicar PROM</Button>} />
          ) : (
            <SeverityBars items={barras} />
          )}
        </Card>

        {/* VALORES ISOLADOS POR INSTRUMENTO */}
        {Object.keys(porInstrumento).length > 0 && (
          <Card>
            <CardTitle sub="Cada questionário com o seu valor, a variação e o gráfico de acompanhamento">
              Resultados por instrumento
            </CardTitle>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))", gap: 12 }}>
              {Object.entries(porInstrumento).map(([qid, arr]) => {
                const inst = acharInstrumento(qid);
                if (!inst) return null;
                return (
                  <CartaoInstrumento
                    key={qid}
                    instrumento={inst.short || inst.shortName || String(qid).toUpperCase()}
                    nome={inst.name}
                    idInstrumento={qid}
                    coletas={arr}
                    maxScore={inst.scaleMax || inst.maxScore || 100}
                    higherIsBetter={inst.higherIsBetter !== false}
                  />
                );
              })}
            </div>
          </Card>
        )}

        <Card>
          <CardTitle sub="Todos os registros, do mais recente ao mais antigo">Histórico de coletas</CardTitle>
          {sub.length === 0 ? (
            <Empty title="Sem coletas" />
          ) : (
            <table className="table">
              <thead>
                <tr><th>Data</th><th>Instrumento</th><th className="num">Semana</th><th className="num">Escore</th><th>Interpretação</th></tr>
              </thead>
              <tbody>
                {sub.slice(0, 30).map((s) => {
                  const inst = acharInstrumento(norm(s.questionnaire));
                  const anterior = sub.filter((x) => x.questionnaire === s.questionnaire && new Date(x.submitted_at) > new Date(s.submitted_at))
                    .sort((a, b) => new Date(a.submitted_at) - new Date(b.submitted_at))[0];
                  const muda = anterior && anterior.total_score != null && s.total_score != null
                    ? interpretChange(s.questionnaire, Number(anterior.total_score), Number(s.total_score))
                    : null;
                  return (
                    <tr key={s.id}>
                      <td style={{ color: "#64748b" }}>{fmtD(s.submitted_at)}</td>
                      <td style={{ fontWeight: 550 }}>{String(s.questionnaire).toUpperCase()}</td>
                      <td className="num">{s.protocol_week ?? "—"}</td>
                      <td className="num" style={{ fontWeight: 600 }}>{s.total_score ?? "—"}</td>
                      <td style={{ fontSize: 12 }}>
                        {muda ? (
                          <Badge tone={muda.meaningful ? (muda.improved ? "green" : "red") : "gray"}>
                            {muda.meaningful ? (muda.improved ? "melhora relevante" : "piora relevante") : "sem mudança relevante"}
                          </Badge>
                        ) : <span style={{ color: "#cbd5e1" }}>—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </Card>
      </div>

      <PacienteForm open={editando} onClose={() => setEditando(false)} initial={p} />
      {novoProm && <AplicarPROM paciente={p} onClose={() => setNovoProm(false)} />}
    </>
  );
}

// ------------------------------------------------------- escolha do instrumento
function AplicarPROM({ paciente, onClose }) {
  const navigate = useNavigate();
  const [busca, setBusca] = React.useState("");
  const lista = QUESTIONNAIRES.filter((q) =>
    !busca || (q.name + " " + (q.shortName || "")).toLowerCase().includes(busca.toLowerCase()));

  return (
    <Modal open onClose={onClose} title={`Aplicar PROM — ${paciente.name}`} wide>
      <p style={{ fontSize: 12.5, color: "#64748b" }}>{QUESTIONNAIRES.length} instrumentos disponíveis. Escolha o que será respondido.</p>
      <input placeholder="Buscar instrumento…" value={busca} onChange={(e) => setBusca(e.target.value)} />
      <div style={{ maxHeight: 380, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6 }}>
        {lista.map((q) => (
          <button key={q.id} className="row-link" style={{ width: "100%", textAlign: "left" }}
            onClick={() => navigate(`/orthoflow/prom/${paciente.id}/${q.id}`)}>
            <div style={{ flex: 1 }}>
              <b style={{ fontSize: 13.5 }}>{q.shortName || q.name}</b>
              <p style={{ fontSize: 11.5, color: "#94a3b8" }}>{q.sections ? q.sections.reduce((n, s) => n + s.items.length, 0) : "?"} itens{q.description ? ` · ${String(q.description).slice(0, 60)}` : ""}</p>
            </div>
            <span style={{ color: "#cbd5e1" }}>→</span>
          </button>
        ))}
      </div>
    </Modal>
  );
}
