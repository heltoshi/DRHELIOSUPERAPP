import React from "react";
import {
  Patients, Logs, HRV, Responses, Questionnaires, PROMs, protocolWeek,
  subscribe, currentSession, logout, changePassword, exportBackup,
} from "../lib/data";
import {
  groupDailyLoads, computeACWR, acwrStatus, fmt2, fmt0, fmtDate, todayISO, logLoad, parseISO,
  serieCargaCompleta,
} from "../lib/metrics";
import { scoreResponse, sortByDateAsc } from "../lib/scores";
import { Card, Badge, Button, Field, Empty, Bar, Modal } from "../components/ui";
import { CargaRelativaChart } from "../components/charts";
import { PainelOrthoflow } from "../components/PainelClinico";
import PainelMaturacao from "../components/PainelMaturacaoV2";
import Relatorio from "../components/Relatorio";

const TABS = [
  { id: "inicio", ico: "◎", label: "Início" },
  { id: "treino", ico: "▲", label: "Treino" },
  { id: "vfc", ico: "♥", label: "VFC" },
  { id: "quest", ico: "☑", label: "Questionários" },
  { id: "proms", ico: "◈", label: "PROMs" },
  { id: "crescimento", ico: "◑", label: "Crescimento" },
  { id: "perfil", ico: "◍", label: "Perfil" },
];

// ---------------------------------------------------------------- treino
function TreinoForm({ patientId, onDone }) {
  const [date, setDate] = React.useState(todayISO());
  const [pse, setPse] = React.useState(null);
  const [dur, setDur] = React.useState(60);
  const [tipo, setTipo] = React.useState("");
  const [obs, setObs] = React.useState("");
  const [sono, setSono] = React.useState("");
  const [qual, setQual] = React.useState(null);
  const [dor, setDor] = React.useState(null);
  const [fad, setFad] = React.useState(null);
  const [humor, setHumor] = React.useState(null);
  const [err, setErr] = React.useState("");
  const [ok, setOk] = React.useState(false);

  const [gravando, setGravando] = React.useState(false);

  const salvar = async () => {
    setErr("");
    if (!pse) return setErr("Escolha o esforço percebido (PSE).");
    if (!dur || dur <= 0) return setErr("Informe a duração em minutos.");
    setGravando(true);
    try {
      // await é obrigatório: sem ele o erro do banco passa em silêncio e o
      // paciente acha que salvou quando não salvou.
      await Logs.create({
        patient_id: patientId, date, pse, duration_minutes: Number(dur),
        training_load: pse * Number(dur),
        training_type: tipo || undefined, observations: obs || undefined,
        sleep_hours: sono === "" ? undefined : Number(sono),
        sleep_quality: qual ?? undefined, muscle_soreness: dor ?? undefined,
        fatigue_level: fad ?? undefined, mood: humor ?? undefined,
      });
      setOk(true);
      setTimeout(() => { setOk(false); onDone?.(); }, 1400);
    } catch (e) {
      setErr("Não consegui salvar: " + (e?.message || "erro desconhecido"));
    }
    setGravando(false);
  };

  if (ok) {
    return (
      <Card>
        <div className="alert-box alert-green" style={{ justifyContent: "center", padding: 16 }}>
          ✓ Treino registrado — carga {fmt0.format(pse * Number(dur))} UA
        </div>
      </Card>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
      <Card>
        <div className="form-grid">
          <Field label="Data"><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
          <Field label="Duração (min)">
            <input type="number" min="1" max="600" value={dur} onChange={(e) => setDur(e.target.value)} />
          </Field>
        </div>
      </Card>

      <Card>
        <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Quanto foi o esforço?</p>
        <p style={{ fontSize: 11.5, color: "#94a3b8", marginBottom: 11 }}>1 = muito leve · 10 = esforço máximo</p>
        <div className="scale-row">
          {["1","2","3","4","5","6","7","8","9","10"].map((n) => (
            <button key={n} className={String(pse) === n ? "on" : ""} onClick={() => setPse(Number(n))}>{n}</button>
          ))}
        </div>
        <p style={{ fontSize: 12, color: "#64748b", marginTop: 10 }}>
          Carga desta sessão: <b>{pse ? fmt0.format(pse * Number(dur || 0)) : "—"} UA</b>
        </p>
      </Card>

      <Card>
        <Field label="Tipo de treino">
          <input value={tipo} onChange={(e) => setTipo(e.target.value)} placeholder="Físico, técnico, jogo, academia…" />
        </Field>
      </Card>

      <Card>
        <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 11 }}>Como você está? (opcional)</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Field label="Horas de sono">
            <input type="number" step="0.5" min="0" max="16" value={sono} onChange={(e) => setSono(e.target.value)} placeholder="Ex.: 7.5" />
          </Field>
          {[
            ["Qualidade do sono", qual, setQual, "1 = péssima · 5 = ótima"],
            ["Dor muscular", dor, setDor, "1 = nenhuma · 5 = muita"],
            ["Fadiga", fad, setFad, "1 = descansado · 5 = exausto"],
            ["Humor", humor, setHumor, "1 = péssimo · 5 = ótimo"],
          ].map(([label, val, setter, hint]) => (
            <div key={label}>
              <p style={{ fontSize: 12.5, fontWeight: 600, color: "#475569", marginBottom: 2 }}>{label}</p>
              <p style={{ fontSize: 11, color: "#94a3b8", marginBottom: 6 }}>{hint}</p>
              <div className="scale-row">
                {["1","2","3","4","5"].map((n) => (
                  <button key={n} className={String(val) === n ? "on" : ""} onClick={() => setter(Number(n))}>{n}</button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <Field label="Observações"><textarea value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Como foi o treino…" /></Field>
      </Card>

      {err && <div className="alert-box alert-red">{err}</div>}
      <Button variant="primary" onClick={salvar} disabled={gravando} style={{ padding: 13 }}>{gravando ? "Salvando…" : "Salvar treino"}</Button>
    </div>
  );
}

// ------------------------------------------------------------------ VFC
function VfcForm({ patientId, onDone }) {
  const [date, setDate] = React.useState(todayISO());
  const [hrv, setHrv] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [err, setErr] = React.useState("");

  const [ok, setOk] = React.useState(false);
  const [gravando, setGravando] = React.useState(false);

  const salvar = async () => {
    setErr("");
    const v = Number(hrv);
    if (!(v > 0 && v < 400)) return setErr("Informe a VFC em ms (ex.: 56).");
    setGravando(true);
    try {
      await HRV.create({ patient_id: patientId, date, hrv: v, notes });
      setOk(true);
      setTimeout(() => { setOk(false); onDone?.(); }, 1400);
    } catch (e) {
      setErr("Não consegui salvar: " + (e?.message || "erro desconhecido"));
    }
    setGravando(false);
  };

  if (ok) {
    return <Card><div className="alert-box alert-green" style={{ justifyContent: "center", padding: 16 }}>✓ VFC registrada — {hrv} ms</div></Card>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
      <Card>
        <div className="form-grid">
          <Field label="Data"><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
          <Field label="VFC (ms)" hint="rMSSD ou SDNN">
            <input type="number" step="0.1" value={hrv} onChange={(e) => setHrv(e.target.value)} placeholder="56" />
          </Field>
        </div>
      </Card>
      <Card><Field label="Observações"><textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ex.: dormi mal, dia de jogo…" /></Field></Card>
      {err && <div className="alert-box alert-red">{err}</div>}
      <Button variant="primary" onClick={salvar} disabled={gravando} style={{ padding: 13 }}>{gravando ? "Salvando…" : "Salvar VFC"}</Button>
    </div>
  );
}

// --------------------------------------------------------- questionários
function ResponderQuestionnaire({ q, patientId, onDone }) {
  const [answers, setAnswers] = React.useState({});
  const [i, setI] = React.useState(0);
  const [ok, setOk] = React.useState(false);
  const qs = q.questions || [];
  const atual = qs[i];
  const respondidas = qs.filter((x) => answers[x.text] != null && answers[x.text] !== "").length;
  const pct = Math.round((respondidas / Math.max(1, qs.length)) * 100);

  const [gravando, setGravando] = React.useState(false);
  const [err, setErr] = React.useState("");

  const salvar = async () => {
    setErr("");
    setGravando(true);
    try {
      await Responses.create({
        questionnaire_id: q.id, patient_id: patientId, date: todayISO(),
        answers: qs.map((x) => ({ question_text: x.text, answer: answers[x.text] ?? "" })),
      });
      setOk(true);
      setTimeout(() => { setOk(false); onDone?.(); }, 1400);
    } catch (e) {
      setErr("Não consegui enviar: " + (e?.message || "erro desconhecido"));
    }
    setGravando(false);
  };

  if (ok) {
    return <Card><div className="alert-box alert-green" style={{ justifyContent: "center", padding: 16 }}>✓ Respostas enviadas. Obrigado!</div></Card>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
          <span style={{ fontSize: 11.5, color: "#94a3b8" }}>Pergunta {i + 1} de {qs.length}</span>
          <span style={{ fontSize: 11.5, color: "#94a3b8" }}>{pct}%</span>
        </div>
        <div className="progress-track" style={{ marginBottom: 15 }}>
          <div className="progress-fill" style={{ width: `${pct}%` }} />
        </div>
        <p style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.45, marginBottom: 14 }}>{atual?.text}</p>

        {atual?.type === "scale" ? (
          <div className="scale-row">
            {Array.from({ length: (atual.scale_max ?? 10) - (atual.scale_min ?? 0) + 1 }, (_, k) => (atual.scale_min ?? 0) + k).map((n) => (
              <button key={n} className={String(answers[atual.text]) === String(n) ? "on" : ""} onClick={() => setAnswers((a) => ({ ...a, [atual.text]: String(n) }))}>{n}</button>
            ))}
          </div>
        ) : atual?.type === "text" ? (
          <textarea value={answers[atual.text] || ""} onChange={(e) => setAnswers((a) => ({ ...a, [atual.text]: e.target.value }))} placeholder="Escreva aqui" />
        ) : (
          <div className="opt-list">
            {(atual?.options || []).map((o) => (
              <button key={o} className={answers[atual.text] === o ? "on" : ""} onClick={() => setAnswers((a) => ({ ...a, [atual.text]: o }))}>{o}</button>
            ))}
          </div>
        )}
      </Card>

      {err && <div className="alert-box alert-red">{err}</div>}

      <div style={{ display: "flex", gap: 8 }}>
        <Button variant="outline" onClick={() => setI((n) => Math.max(0, n - 1))} disabled={i === 0} style={{ flex: 1 }}>← Voltar</Button>
        {i < qs.length - 1 ? (
          <Button variant="primary" onClick={() => setI((n) => n + 1)} style={{ flex: 2 }}>Próxima →</Button>
        ) : (
          <Button variant="teal" onClick={salvar} disabled={gravando} style={{ flex: 2 }}>{gravando ? "Enviando…" : "Enviar respostas"}</Button>
        )}
      </div>
    </div>
  );
}

// -------------------------------------------------------------- portal
export default function AthletePortal({ session: propSession, onLogout }) {
  const [, force] = React.useState(0);
  React.useEffect(() => subscribe(() => force((n) => n + 1)), []);

  const session = propSession || currentSession();
  const myPatient = session?.patient_id ? Patients.get(session.patient_id) : Patients.byEmail(session?.email || "");
  const [tab, setTab] = React.useState(myPatient ? "inicio" : "perfil");
  // tela inicial de escolha do módulo (o paciente tem mais de um app)
  const [modulo, setModulo] = React.useState(null);
  const [relatorio, setRelatorio] = React.useState(false);
  const [tela, setTela] = React.useState(null); // null | 'treino' | 'vfc' | {q}

  const patientId = myPatient?.id;
  const logs = patientId ? Logs.list(patientId) : [];
  const hrv = patientId ? HRV.list(patientId) : [];
  const responses = patientId ? Responses.list({ patient_id: patientId }) : [];
  const questionnaires = Questionnaires.list();
  const tem360 = (myPatient?.modules || []).includes("atleta360");
  const temOrtho = (myPatient?.modules || []).includes("orthoflow");
  const meusProms = patientId ? PROMs.list(patientId) : [];
  const [minhasVisitas, setMinhasVisitas] = React.useState([]);
  React.useEffect(() => {
    if (!patientId) return;
    let vivo = true;
    import("../lib/data").then(({ maturacaoVisitas }) => {
      if (!maturacaoVisitas) return;
      maturacaoVisitas.list(patientId).then((v) => { if (vivo) setMinhasVisitas(v || []); }).catch(() => {});
    });
    return () => { vivo = false; };
  }, [patientId]);
  const resumoQuest = React.useMemo(() => {
    const out = [];
    for (const q of questionnaires) {
      const rs = responses.filter((r) => r.questionnaire_id === q.id);
      if (!rs.length) continue;
      const ult = [...rs].sort((a, b) => String(b.date).localeCompare(String(a.date)))[0];
      const s = scoreResponse(q, ult.answers);
      if (s) out.push({ kind: q.kind, total: s.total, max: s.maxScore, date: ult.date, label: s.severity.label, tone: s.severity.color });
    }
    return out;
  }, [questionnaires, responses]);
  const semanaProto = protocolWeek(myPatient?.protocol_start);

  const meusModulos = React.useMemo(() => {
    const m = myPatient?.modules || [];
    return [
      { id: "atleta360", nome: "Atleta 360", ico: "◉", cor: "#0e7490",
        desc: "Treino, VFC e questionários",
        detalhe: "Registrar carga, medir VFC e responder EDAJ, EISDF e OSTRC" },
      { id: "orthoflow", nome: "OrthoFlow", ico: "◈", cor: "#7c3aed",
        desc: "Reabilitação e questionários de função",
        detalhe: semanaProto ? `Semana ${semanaProto} do protocolo` : "Acompanhamento do protocolo" },
      { id: "maturacao", nome: "Maturação", ico: "◑", cor: "#059669",
        desc: "Crescimento e maturação",
        detalhe: "Sua curva de estatura e a previsão de estatura adulta" },
    ].filter((x) => m.includes(x.id));
  }, [myPatient?.modules, semanaProto]);

  // com um único módulo não há o que escolher: entra nele direto.
  // com mais de um, SEMPRE mostra a escolha ao abrir o portal (decisão 24/11).
  React.useEffect(() => {
    if (myPatient && !modulo && meusModulos.length === 1) setModulo(meusModulos[0].id);
  }, [myPatient?.id, meusModulos.length, modulo]);

  const hoje = todayISO();
  const treinoHoje = logs.filter((l) => l.date === hoje);
  const ultimos7 = logs.filter((l) => (Date.now() - new Date(l.date + "T12:00:00").getTime()) / 864e5 <= 7);
  const hrvHoje = hrv.filter((h) => h.date === hoje)[0];
  const { acwr, acute, chronic } = computeACWR(groupDailyLoads(logs));
  const status = acwrStatus(acwr);
  const ultimaResp = sortByDateAsc(responses).slice(-1)[0];
  const pendentes = questionnaires.filter(
    (q) => !responses.some((r) => r.questionnaire_id === q.id && (Date.now() - parseISO(r.date).getTime()) / 864e5 < 7),
  );

  // abas de cada módulo, na ordem em que o paciente faz as coisas
  const abasDoModulo = React.useMemo(() => {
    const porId = Object.fromEntries(TABS.map((t) => [t.id, t]));
    if (modulo === "maturacao") return [porId.inicio, porId.perfil];
    if (modulo === "orthoflow") return [porId.inicio, porId.perfil];
    return [porId.inicio, porId.treino, porId.vfc, porId.quest, porId.perfil];
  }, [modulo]);

  const sair = async () => { await logout(); onLogout?.(); };

  if (myPatient && relatorio) {
    return (
      <div className="athlete">
        <main className="athlete-body">
          <Relatorio
            paciente={myPatient} coletas={meusProms} visitas={minhasVisitas}
            logs={logs} hrv={hrv} onVoltar={() => setRelatorio(false)}
          />
        </main>
      </div>
    );
  }

  return (
    <div className="athlete">
      <header className="athlete-head">
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div className="brand-mark" style={{ width: 32, height: 32, fontSize: 11 }}>A360</div>
          <div>
            <p className="nm">{
              !modulo
                ? "Meus módulos"
                : (meusModulos.find((m) => m.id === modulo)?.nome || "Atleta 360")
            }</p>
            <p className="sm">{myPatient?.name || "Complete seu perfil"}</p>
            {modulo && meusModulos.length > 1 && (
              <button
                onClick={() => { setModulo(null); setTab("inicio"); setTela(null); }}
                style={{ fontSize: 10.5, color: "#7dd3fc", background: "none", border: 0, padding: 0, cursor: "pointer", textDecoration: "underline" }}>
                trocar módulo
              </button>
            )}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          {myPatient && (
            <button className="icon-btn" onClick={() => setRelatorio(true)} style={{ color: "#8fa6bc", fontSize: 15 }} aria-label="Relatório" title="Relatório de evolução">⎙</button>
          )}
          <button className="icon-btn" onClick={sair} style={{ color: "#8fa6bc" }} aria-label="Sair">⏻</button>
        </div>
      </header>

      <main className="athlete-body">
        {!myPatient && (
          <Card>
            <Empty
              title="Seu perfil ainda não está vinculado"
              hint="A clínica precisa cadastrar um prontuário com este e-mail. Fale com a recepção do CEMEP Care."
            />
          </Card>
        )}

        {/* ESCOLHA DO MÓDULO — aparece logo após o login */}
        {myPatient && !modulo && meusModulos.length > 1 && (
          <>
            <div>
              <h2 style={{ fontSize: 19 }}>Olá, {myPatient.name.split(" ")[0]} 👋</h2>
              <p style={{ fontSize: 12.5, color: "#94a3b8", marginTop: 2 }}>
                Escolha o que você quer fazer hoje
              </p>
            </div>
            {meusModulos.map((m) => (
              <button key={m.id} className="mod-card" onClick={() => { setModulo(m.id); setTab("inicio"); }}
                style={{ borderLeft: `4px solid ${m.cor}` }}>
                <span className="q-ico" style={{ background: `${m.cor}18`, color: m.cor, fontSize: 19 }}>{m.ico}</span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span className="q-t" style={{ display: "block", fontWeight: 700 }}>{m.nome}</span>
                  <span className="q-s">{m.desc}</span>
                  <span className="q-s" style={{ display: "block", color: "#b6c2d1", fontSize: 10.5, marginTop: 2 }}>{m.detalhe}</span>
                </span>
                <span style={{ color: "#cbd5e1", fontSize: 18 }}>›</span>
              </button>
            ))}
          </>
        )}

        {/* INÍCIO do módulo escolhido */}
        {myPatient && modulo === "orthoflow" && tab === "inicio" && (
          <>
            <div style={{ marginBottom: 2 }}>
              <h2 style={{ fontSize: 19, margin: 0 }}>Olá, {myPatient.name.split(" ")[0]} 👋</h2>
              <p style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>
                {semanaProto ? `Semana ${semanaProto} do seu protocolo` : "Seu acompanhamento de reabilitação"}
              </p>
            </div>
            <PainelOrthoflow paciente={myPatient} coletas={meusProms} recarregar={() => force((n) => n + 1)} />
          </>
        )}

        {myPatient && modulo === "maturacao" && tab === "inicio" && (
          <>
            <div style={{ marginBottom: 2 }}>
              <h2 style={{ fontSize: 19, margin: 0 }}>Olá, {myPatient.name.split(" ")[0]} 👋</h2>
              <p style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>Crescimento e maturação</p>
            </div>
            <PainelMaturacao paciente={myPatient} visitas={minhasVisitas} />
          </>
        )}

        {myPatient && modulo && modulo === "atleta360" && tab === "inicio" && (
          <>
            <div>
              <h2 style={{ fontSize: 19 }}>Olá, {myPatient.name.split(" ")[0]} 👋</h2>
              <p style={{ fontSize: 12.5, color: "#94a3b8", marginTop: 2 }}>
                {new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}
              </p>
            </div>

            <div className="today-grid">
              <div className={`today-card ${treinoHoje.length ? "done" : ""}`}>
                <span style={{ fontSize: 18 }}>▲</span>
                <p className="t">Treino hoje</p>
                <p className="v">{treinoHoje.length ? `${treinoHoje.length} registrado${treinoHoje.length > 1 ? "s" : ""} ✓` : "Pendente"}</p>
              </div>
              <div className={`today-card ${hrvHoje ? "done-v" : ""}`}>
                <span style={{ fontSize: 18 }}>♥</span>
                <p className="t">VFC hoje</p>
                <p className="v">{hrvHoje ? `${hrvHoje.hrv} ms ✓` : "Pendente"}</p>
              </div>
            </div>

            {pendentes.length > 0 && (
              <div className="alert-box alert-amber">☑ {pendentes.length} questionário{pendentes.length > 1 ? "s" : ""} para responder esta semana</div>
            )}

            {/* EVOLUÇÃO — só os dados finais, sem os registros brutos */}
            <Card>
              <p style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Sua evolução</p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))", gap: 9 }}>
                <div className="kpi">
                  <p className="kpi-label">Treinos no total</p>
                  <p className="kpi-value">{logs.length}</p>
                  <p className="kpi-unit">{ultimos7.length} nos últimos 7 dias</p>
                </div>
                <div className="kpi">
                  <p className="kpi-label">Carga aguda (7 d)</p>
                  <p className="kpi-value">{acute != null ? fmt0.format(acute) : "—"}</p>
                  <p className="kpi-unit">UA</p>
                </div>
                <div className="kpi">
                  <p className="kpi-label">Equilíbrio da carga</p>
                  <p className="kpi-value" style={{ fontSize: 17, color: status.color === "red" ? "#dc2626" : status.color === "yellow" ? "#d97706" : "#059669" }}>{status.label}</p>
                  <p className="kpi-unit">{acwr != null ? `ACWR ${fmt2.format(acwr)}` : "aguardando histórico"}</p>
                </div>
                <div className="kpi">
                  <p className="kpi-label">VFC mais recente</p>
                  <p className="kpi-value">{hrv[0] ? hrv[0].hrv : "—"}</p>
                  <p className="kpi-unit">{hrv[0] ? "ms" : "sem registro"}</p>
                </div>
              </div>

              {resumoQuest.length > 0 && (
                <>
                  <p style={{ fontSize: 12, fontWeight: 600, color: "#475569", margin: "14px 0 6px" }}>Questionários — último resultado</p>
                  <table className="table">
                    <tbody>
                      {resumoQuest.map((q) => (
                        <tr key={q.kind}>
                          <td style={{ fontWeight: 600 }}>{q.kind}</td>
                          <td className="num">{q.total}/{q.max}</td>
                          <td style={{ color: "#64748b", fontSize: 12 }}>{fmtDate(q.date, "long")}</td>
                          <td><span className={`badge badge-${q.tone}`}>{q.label}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}
              {semanaProto && (
                <p style={{ fontSize: 12.5, color: "#0e7490", fontWeight: 600, marginTop: 12 }}>
                  Semana {semanaProto} do seu protocolo de reabilitação
                </p>
              )}

              {logs.length > 0 && (
                <>
                  <p style={{ fontSize: 12, fontWeight: 600, color: "#475569", margin: "16px 0 4px" }}>Como sua carga evoluiu</p>
                  <p style={{ fontSize: 11.5, color: "#94a3b8", marginBottom: 6 }}>
                    Barras: o que você treinou em cada dia. Linhas: a média da última semana (aguda),
                    do último mês (crônica) e o equilíbrio entre elas (ACWR).
                  </p>
                  <CargaRelativaChart serie={serieCargaCompleta(logs, { dias: 90 }).serie} height={220} />
                </>
              )}
            </Card>

            <button className="quick" onClick={() => setTela("treino")}>
              <span className="q-ico" style={{ background: "#dbeafe", color: "#1d4ed8" }}>▲</span>
              <span style={{ flex: 1 }}>
                <span className="q-t">Registrar treino</span>
                <span className="q-s">Esforço, duração e como você está</span>
              </span>
              <span style={{ color: "#cbd5e1", fontSize: 18 }}>›</span>
            </button>

            <button className="quick" onClick={() => setTela("vfc")}>
              <span className="q-ico" style={{ background: "#ede9fe", color: "#6d28d9" }}>♥</span>
              <span style={{ flex: 1 }}>
                <span className="q-t">Registrar VFC</span>
                <span className="q-s">Sua variabilidade cardíaca de hoje</span>
              </span>
              <span style={{ color: "#cbd5e1", fontSize: 18 }}>›</span>
            </button>

            <button className="quick" onClick={() => setTab("quest")}>
              <span className="q-ico" style={{ background: "#d1fae5", color: "#047857" }}>☑</span>
              <span style={{ flex: 1 }}>
                <span className="q-t">Questionários</span>
                <span className="q-s">{pendentes.length ? `${pendentes.length} pendente${pendentes.length > 1 ? "s" : ""}` : "Todos em dia"}</span>
              </span>
              <span style={{ color: "#cbd5e1", fontSize: 18 }}>›</span>
            </button>

            {acwr != null && (
              <Card>
                <p style={{ fontSize: 12, color: "#94a3b8" }}>Relação carga aguda/crônica</p>
                <div style={{ display: "flex", alignItems: "baseline", gap: 9, marginTop: 4 }}>
                  <span style={{ fontSize: 26, fontWeight: 800, color: status.color === "green" ? "#059669" : status.color === "red" ? "#dc2626" : "#d97706" }}>
                    {fmt2.format(acwr)}
                  </span>
                  <Badge tone={status.color}>{status.label}</Badge>
                </div>
                <p style={{ fontSize: 11.5, color: "#94a3b8", marginTop: 5 }}>
                  {status.color === "red"
                    ? "Sua carga subiu rápido. Vale conversar com a equipe antes de aumentar o volume."
                    : status.color === "yellow"
                      ? "Carga em queda. Progressão gradual é o caminho."
                      : "Faixa considerada segura (0,80 a 1,20)."}
                </p>
              </Card>
            )}

            {ultimaResp && (() => {
              const q = questionnaires.find((x) => x.id === ultimaResp.questionnaire_id);
              const s = q ? scoreResponse(q, ultimaResp.answers) : null;
              if (!s) return null;
              return (
                <Card>
                  <p style={{ fontSize: 12, color: "#94a3b8" }}>Último questionário — {q.kind} · {fmtDate(ultimaResp.date, "long")}</p>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 9, marginTop: 4 }}>
                    <span style={{ fontSize: 24, fontWeight: 800 }}>{s.total}<span style={{ fontSize: 13, fontWeight: 400, color: "#94a3b8" }}>/{s.maxScore}</span></span>
                    <Badge tone={s.severity.color}>{s.severity.label}</Badge>
                  </div>
                  <div style={{ marginTop: 8 }}><Bar value={s.total} max={s.maxScore || 100} tone={s.severity.color} /></div>
                </Card>
              );
            })()}
          </>
        )}

        {myPatient && modulo && tab === "treino" && (
          <TreinoForm patientId={patientId} onDone={() => setTab("inicio")} />
        )}

        {myPatient && modulo && tab === "vfc" && (
          <>
            <VfcForm patientId={patientId} onDone={() => setTab("inicio")} />
            {hrv.length > 0 && (
              <Card>
                <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 9 }}>Últimas medições</p>
                <table className="table">
                  <tbody>
                    {hrv.slice(0, 10).map((h) => (
                      <tr key={h.id}>
                        <td style={{ color: "#64748b" }}>{fmtDate(h.date, "long")}</td>
                        <td className="num" style={{ fontWeight: 600 }}>{h.hrv} ms</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            )}
          </>
        )}

        {myPatient && modulo && tab === "quest" && (
          tela?.id ? (
            <>
              <Button variant="outline" size="sm" onClick={() => setTela(null)}>← Voltar</Button>
              <ResponderQuestionnaire q={tela} patientId={patientId} onDone={() => { setTela(null); setTab("inicio"); }} />
            </>
          ) : (
            <>
              <h2 style={{ fontSize: 17 }}>Questionários</h2>
              <p style={{ fontSize: 12, color: "#94a3b8", marginTop: -8 }}>Preencha uma vez por semana, sempre no mesmo dia.</p>
              {questionnaires.map((q) => {
                const rs = responses.filter((r) => r.questionnaire_id === q.id);
                const ultima = rs.sort((a, b) => String(b.date).localeCompare(String(a.date)))[0];
                const dias = ultima ? Math.floor((Date.now() - parseISO(ultima.date).getTime()) / 864e5) : null;
                return (
                  <button key={q.id} className="quick" onClick={() => setTela(q)}>
                    <span className="q-ico" style={{ background: dias != null && dias < 7 ? "#d1fae5" : "#fef3c7", color: dias != null && dias < 7 ? "#047857" : "#b45309" }}>
                      {dias != null && dias < 7 ? "✓" : "!"}
                    </span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span className="q-t" style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{q.kind}</span>
                      <span className="q-s">{dias == null ? "Nunca respondido" : dias === 0 ? "Respondido hoje" : `Última resposta há ${dias} dia${dias > 1 ? "s" : ""}`}</span>
                    </span>
                    <span style={{ color: "#cbd5e1", fontSize: 18 }}>›</span>
                  </button>
                );
              })}
            </>
          )
        )}

        {myPatient && modulo && tab === "proms" && (
          <>
            <h2 style={{ fontSize: 17 }}>Meus questionários</h2>
            <p style={{ fontSize: 12, color: "#94a3b8", marginTop: -8 }}>
              {semanaProto ? `Semana ${semanaProto} do seu protocolo` : "Acompanhamento de reabilitação"}
            </p>
            {meusProms.length === 0 ? (
              <Card><Empty title="Nenhuma resposta ainda" hint="A clínica vai aplicar os questionários nas consultas." /></Card>
            ) : (
              <Card>
                <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 9 }}>Suas respostas</p>
                <table className="table">
                  <tbody>
                    {meusProms.slice(0, 20).map((r) => (
                      <tr key={r.id}>
                        <td style={{ color: "#64748b" }}>{fmtDate(r.submitted_at, "long")}</td>
                        <td style={{ fontWeight: 600 }}>{String(r.questionnaire).toUpperCase()}</td>
                        <td className="num">{r.total_score ?? "—"}</td>
                        <td className="num" style={{ color: "#94a3b8" }}>{r.protocol_week ? `sem ${r.protocol_week}` : ""}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            )}
          </>
        )}

        {myPatient && modulo && tab === "crescimento" && (
          <>
            <h2 style={{ fontSize: 17 }}>Meu crescimento</h2>
            <p style={{ fontSize: 12, color: "#94a3b8", marginTop: -8 }}>
              Como sua estatura e sua maturação evoluíram nas avaliações
            </p>
            {minhasVisitas.length === 0 ? (
              <Card><Empty title="Sem avaliações registradas" hint="A clínica vai registrar nas consultas." /></Card>
            ) : (
              <Card>
                <table className="table">
                  <thead><tr><th>Data</th><th className="num">Estatura</th><th className="num">Est. final prevista</th><th className="num">% atingido</th></tr></thead>
                  <tbody>
                    {[...minhasVisitas].sort((a, b) => String(b.data_avaliacao || b.date).localeCompare(String(a.data_avaliacao || a.date))).map((v) => (
                      <tr key={v.id}>
                        <td>{fmtDate(v.data_avaliacao || v.date, "long")}</td>
                        <td className="num">{v.estatura != null ? Number(v.estatura).toFixed(1) : "—"} cm</td>
                        <td className="num">{v.consenso_pah != null ? Number(v.consenso_pah).toFixed(1) : "—"} cm</td>
                        <td className="num">{v.consenso_pct != null ? Number(v.consenso_pct).toFixed(1) : "—"}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p style={{ fontSize: 11.5, color: "#94a3b8", marginTop: 10, lineHeight: 1.5 }}>
                  Estatura final é uma estimativa populacional — serve para acompanhar a sua curva,
                  não como promessa de resultado.
                </p>
              </Card>
            )}
          </>
        )}

        {myPatient && tab === "perfil" && <PerfilAtleta patient={myPatient} session={session} />}
      </main>

      {modulo && <nav className="tabbar">
        {abasDoModulo.map((t) => (
          <button key={t.id} className={tab === t.id ? "on" : ""} onClick={() => { setTab(t.id); setTela(null); }}>
            <span className="ico">{t.ico}</span>
            {t.label}
          </button>
        ))}
      </nav>}

    </div>
  );
}

function PerfilAtleta({ patient, session }) {
  const [senhaAtual, setSenhaAtual] = React.useState("");
  const [senhaNova, setSenhaNova] = React.useState("");
  const [msg, setMsg] = React.useState(null);

  const [busy, setBusy] = React.useState(false);
  const trocar = async () => {
    setBusy(true);
    const r = await changePassword(senhaAtual, senhaNova);
    setBusy(false);
    setMsg(r.error ? { tipo: "err", txt: r.error } : { tipo: "ok", txt: "Senha alterada." });
    if (!r.error) { setSenhaAtual(""); setSenhaNova(""); }
  };

  return (
    <>
      <h2 style={{ fontSize: 17 }}>Meu perfil</h2>
      <Card>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div className="avatar" style={{ width: 48, height: 48, fontSize: 20 }}>{patient.name[0]}</div>
          <div>
            <p style={{ fontWeight: 700, fontSize: 15 }}>{patient.name}</p>
            <p style={{ fontSize: 12, color: "#94a3b8" }}>{patient.sport}{patient.team ? ` · ${patient.team}` : ""}</p>
          </div>
        </div>
        <table className="table" style={{ marginTop: 13 }}>
          <tbody>
            {[
              ["Nascimento", patient.dob ? fmtDate(patient.dob, "long") : "—"],
              ["Peso", patient.weight ? `${patient.weight} kg` : "—"],
              ["Altura", patient.height ? `${patient.height} cm` : "—"],
              ["E-mail", patient.email || "—"],
              ["Telefone", patient.phone || "—"],
            ].map(([k, v]) => (
              <tr key={k}><td style={{ color: "#94a3b8", width: 110 }}>{k}</td><td style={{ fontWeight: 550 }}>{v}</td></tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card>
        <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 11 }}>Alterar senha</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <Field label="Senha atual"><input type="password" value={senhaAtual} onChange={(e) => setSenhaAtual(e.target.value)} /></Field>
          <Field label="Nova senha" hint="Mínimo 6 caracteres"><input type="password" value={senhaNova} onChange={(e) => setSenhaNova(e.target.value)} /></Field>
          {msg && <div className={`alert-box alert-${msg.tipo === "ok" ? "green" : "red"}`}>{msg.txt}</div>}
          <Button variant="primary" size="sm" onClick={trocar} disabled={busy}>{busy ? "Alterando…" : "Alterar senha"}</Button>
        </div>
      </Card>

      <Card>
        <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Privacidade e dados</p>
        <p style={{ fontSize: 12, color: "#64748b", lineHeight: 1.55, marginBottom: 11 }}>
          Seus dados são de acompanhamento clínico e ficam visíveis apenas para você e para a equipe do CEMEP Care.
          Este app não substitui o prontuário oficial da clínica.
        </p>
        <Button variant="outline" size="sm" onClick={exportBackup}>Baixar meus dados (JSON)</Button>
      </Card>
    </>
  );
}
