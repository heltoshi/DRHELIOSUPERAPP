import React from "react";
import { useParams, Link } from "react-router-dom";
import { Patients, Logs, HRV, Responses, Questionnaires, subscribe } from "../lib/data";
import {
  computeAge, groupDailyLoads, computeACWR, acwrStatus, computeWeeklyIncrements,
  dailySeries, acwrSeries, weeklyMonotony, fmt2, fmt0, fmtDate, todayISO, logLoad,
  serieCargaCompleta, janelasCarga,
} from "../lib/metrics";
import { scoreResponse, sortByDateAsc, ostrcAlert } from "../lib/scores";
import { Card, CardTitle, Badge, Button, Field, Modal, Empty, Bar } from "../components/ui";
import { LoadArea, HrvAcwrLine, CargaRelativaChart } from "../components/charts";
import { CronologiaRespostas } from "../components/Cronologia";

const ST = {
  ativo: { label: "Ativo", tone: "green" },
  inativo: { label: "Inativo", tone: "gray" },
  lesionado: { label: "Lesionado", tone: "red" },
};

function Kpi({ label, value, unit, tone }) {
  return (
    <div className="kpi">
      <p className="kpi-label">{label}</p>
      <p className={`kpi-value ${tone ? `is-${tone}` : ""}`}>{value ?? "—"}</p>
      {unit && <p className="kpi-unit">{unit}</p>}
    </div>
  );
}

function HRVForm({ open, onClose, patientId, onSave }) {
  const [date, setDate] = React.useState(todayISO());
  const [hrv, setHrv] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [err, setErr] = React.useState("");

  React.useEffect(() => {
    if (open) { setDate(todayISO()); setHrv(""); setNotes(""); setErr(""); }
  }, [open]);

  const submit = () => {
    const v = Number(hrv);
    if (!(v > 0 && v < 400)) return setErr("Informe a VFC em ms (entre 1 e 400).");
    onSave({ patient_id: patientId, date, hrv: v, notes });
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Registrar VFC / HRV"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button variant="primary" onClick={submit}>Salvar</Button>
        </>
      }
    >
      <Field label="Data"><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
      <Field label="VFC (ms)" hint="rMSSD ou SDNN, sempre a mesma medida">
        <input type="number" step="0.1" value={hrv} onChange={(e) => setHrv(e.target.value)} placeholder="Ex.: 56" />
      </Field>
      <Field label="Observações"><textarea value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
      {err && <div className="alert-box alert-red">{err}</div>}
    </Modal>
  );
}

function ScoreBlock({ questionnaire, responses }) {
  const asc = sortByDateAsc(responses);
  const scored = asc.map((r) => ({ r, s: scoreResponse(questionnaire, r.answers) })).filter((x) => x.s);
  if (!scored.length) return null;
  const ultimo = scored[scored.length - 1];
  const prev = scored[scored.length - 2]?.s ?? null;
  const alerta = questionnaire.kind === "OSTRC" ? ostrcAlert(ultimo.s.total, prev?.total ?? null) : { alert: ultimo.s.severity.color === "red" };
  const tone = ultimo.s.severity.color;

  return (
    <div style={{ borderTop: "1px solid #eef2f7", paddingTop: 12, marginTop: 12 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
        <b style={{ fontSize: 13 }}>{questionnaire.kind}</b>
        <span style={{ fontSize: 11.5, color: "#94a3b8" }}>{fmtDate(ultimo.r.date, "long")}</span>
        <Badge tone={tone}>{ultimo.s.severity.label}</Badge>
        <span style={{ marginLeft: "auto", fontSize: 20, fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>
          {ultimo.s.total}<span style={{ fontSize: 12, fontWeight: 400, color: "#94a3b8" }}>/{ultimo.s.maxScore}</span>
        </span>
      </div>
      <div style={{ marginTop: 7 }}><Bar value={ultimo.s.total} max={ultimo.s.maxScore || 100} tone={tone} /></div>
      {alerta.alert && (
        <div className="alert-box alert-red" style={{ marginTop: 9 }}>
          ⚠ {alerta.reason || "Escore em faixa de alerta"}
        </div>
      )}
      <p style={{ fontSize: 11.5, color: "#94a3b8", marginTop: 6 }}>
        Série das últimas {Math.min(6, scored.length)} coletas: {scored.slice(-6).map((x) => x.s.total).join(" → ")}
      </p>
    </div>
  );
}

export default function PatientDetail() {
  const { id } = useParams();
  const [, force] = React.useState(0);
  React.useEffect(() => subscribe(() => force((n) => n + 1)), []);

  const patient = Patients.get(id);
  const [logOpen, setLogOpen] = React.useState(false);
  const [hrvOpen, setHrvOpen] = React.useState(false);
  const [editOpen, setEditOpen] = React.useState(false);
  const [janela, setJanela] = React.useState(90);

  if (!patient) {
    return (
      <div className="content">
        <Card><Empty title="Atleta não encontrado" action={<Link to="/360/pacientes" className="btn btn-sm btn-outline" style={{ marginTop: 12 }}>Voltar</Link>} /></Card>
      </div>
    );
  }

  const logs = Logs.list(id);
  const hrv = HRV.list(id);
  const responses = Responses.list({ patient_id: id });
  const questionnaires = Questionnaires.list();

  const daily = groupDailyLoads(logs);
  const { acute, chronic, acwr } = computeACWR(daily);
  const status = acwrStatus(acwr);
  const semanas = computeWeeklyIncrements(daily);
  const mono = weeklyMonotony(logs);
  const idade = computeAge(patient.dob);
  const st = ST[patient.status] || ST.ativo;

  // série de VFC casada por data com o ACWR diário
  const { serie: serieCarga, fim: ultimoRegistro } = serieCargaCompleta(logs, { dias: janela });
  const janelas = janelasCarga(logs);
  const acwrSerie = acwrSeries(logs, 28);
  const hrvMap = new Map(hrv.map((h) => [String(h.date).slice(0, 10), h.hrv]));
  const combinado = acwrSerie.map((d) => ({ ...d, hrv: hrvMap.get(d.date) ?? null }));

  const cargaTotal = logs.reduce((s, l) => s + logLoad(l), 0);
  const ultimos7 = logs.filter((l) => (Date.now() - new Date(l.date).getTime()) / 864e5 <= 7);
  const mediaSono = logs.filter((l) => l.sleep_hours).slice(0, 14);

  return (
    <>
      <div className="topbar">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link to="/360/pacientes" className="icon-btn" style={{ fontSize: 17 }}>←</Link>
          <div>
            <h1 style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {patient.name} <Badge tone={st.tone}>{st.label}</Badge>
            </h1>
            <p>
              {patient.sport}
              {idade != null && ` · ${idade} anos`}
              {patient.team && ` · ${patient.team}`}
              {patient.position && ` · ${patient.position}`}
            </p>
          </div>
        </div>
        <div style={{ display: "flex", gap: 7 }}>
          <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>Editar</Button>
          <Button variant="outline" size="sm" onClick={() => setHrvOpen(true)}>+ VFC</Button>
          <Button variant="primary" size="sm" onClick={() => setLogOpen(true)}>+ Treino</Button>
        </div>
      </div>

      <div className="content">
        <div className="grid grid-4">
          <Card><p className="stat-label">Treinos</p><p className="stat-value">{logs.length}</p><p className="stat-sub">{ultimos7.length} nos últimos 7 d</p></Card>
          <Card><p className="stat-label">Carga acumulada</p><p className="stat-value">{fmt0.format(cargaTotal)}</p><p className="stat-sub">UA no período</p></Card>
          <Card><p className="stat-label">Coletas de VFC</p><p className="stat-value">{hrv.length}</p><p className="stat-sub">{hrv[0] ? `última ${hrv[0].hrv} ms` : "sem registro"}</p></Card>
          <Card><p className="stat-label">Questionários</p><p className="stat-value">{responses.length}</p><p className="stat-sub">coletas registradas</p></Card>
        </div>

        {/* ACWR */}
        <Card style={{ background: "#0b2136", borderColor: "#0b2136" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 13, flexWrap: "wrap", gap: 8 }}>
            <h3 style={{ color: "#fff", fontSize: 15 }}>Carga e ACWR</h3>
            <div className="legend" style={{ color: "#8ba3ba" }}>
              <span><i className="dot dot-yellow" style={{ display: "inline-block" }} /> BAIXO &lt; 0,80</span>
              <span><i className="dot dot-green" style={{ display: "inline-block" }} /> OK 0,80–1,20</span>
              <span><i className="dot dot-red" style={{ display: "inline-block" }} /> ALTO &gt; 1,20</span>
            </div>
          </div>
          <div className="kpi-row">
            <Kpi label="Carga aguda (7 d)" value={acute != null ? fmt0.format(acute) : null} unit="UA" />
            <Kpi label="Carga crônica (28 d)" value={chronic != null ? fmt0.format(chronic) : null} unit="UA/dia (média)" />
            <Kpi label="ACWR" value={acwr != null ? fmt2.format(acwr) : null} unit="aguda ÷ (crônica × 7)" tone={status.color} />
            <Kpi label="Monotonia" value={mono?.monotony != null ? fmt2.format(mono.monotony) : null} unit="Foster — ideal < 2,0" />
          </div>
          {daily.length > 0 && acwr == null && (
            <p style={{ fontSize: 12, color: "#8ba3ba", marginTop: 11 }}>
              O ACWR aparece quando há pelo menos 28 dias de registro — são necessários dados das duas janelas.
            </p>
          )}
        </Card>

        {/* CARGA RELATIVA — aguda, crônica e ACWR */}
        <Card>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap", marginBottom: 6 }}>
            <div>
              <CardTitle sub={ultimoRegistro
                ? `Carga diária, média aguda (7 d), média crônica (28 d) e ACWR — último registro em ${fmtDate(ultimoRegistro, "long")}`
                : "Sem treinos registrados"}>
                Carga relativa
              </CardTitle>
            </div>
            {logs.length > 0 && (
              <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                {janelas.filter((j) => j.ok).map((j) => (
                  <button key={j.id} onClick={() => setJanela(j.id)}
                    className={`btn btn-sm ${janela === j.id ? "btn-primary" : "btn-outline"}`}>
                    {j.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="legend" style={{ marginBottom: 10, flexWrap: "wrap" }}>
            <span><i className="dot" style={{ background: "#0e7490", display: "inline-block" }} /> Aguda (7 d)</span>
            <span><i className="dot" style={{ background: "#7c3aed", display: "inline-block" }} /> Crônica (28 d)</span>
            <span><i className="dot" style={{ background: "#dc2626", display: "inline-block" }} /> ACWR (eixo direito)</span>
            <span><i style={{ width: 10, height: 10, borderRadius: 2, background: "#cbd5e1", display: "inline-block" }} /> Carga diária</span>
            {hrv.length > 0 && <span><i className="dot" style={{ background: "#7c3aed", display: "inline-block" }} /> VFC (ms, eixo direito)</span>}
          </div>
          {logs.length === 0 ? (
            <Empty title="Sem treinos" hint="Registre treinos para o gráfico de carga relativa aparecer." />
          ) : (
            <CargaRelativaChart serie={serieCarga} height={330} hrvMap={hrvMap} />
          )}
        </Card>

        <div className="grid grid-2">
          <Card>
            <CardTitle sub="Somatório diário de carga">Evolução da carga</CardTitle>
            <LoadArea data={dailySeries(logs, janela === 100000 ? 365 : janela)} />
          </Card>
          <Card>
            <CardTitle sub="VFC (ms) sobreposta ao ACWR — 28 dias">VFC × ACWR</CardTitle>
            <HrvAcwrLine data={combinado} />
          </Card>
        </div>

        {/* Incremento semanal */}
        <Card>
          <CardTitle sub="Regra prática: não passar de +10% de uma semana para outra">Incremento semanal</CardTitle>
          {semanas.length === 0 ? (
            <Empty title="Sem semanas fechadas" hint="Registre treinos para calcular o incremento." />
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Semana (início)</th>
                  <th className="num">Carga semanal (UA)</th>
                  <th className="num">Δ vs anterior</th>
                  <th>Situação</th>
                </tr>
              </thead>
              <tbody>
                {semanas.slice(-10).map((w) => {
                  const inc = w.increment;
                  const txt = inc == null ? "—" : `${inc >= 0 ? "+" : ""}${fmt2.format(inc * 100)}%`;
                  const tone = inc == null ? "gray" : inc > 0.1 ? "red" : inc < -0.1 ? "amber" : "green";
                  const lab = inc == null ? "—" : inc > 0.1 ? "Salto alto" : inc < -0.1 ? "Queda" : "Progressão ok";
                  return (
                    <tr key={w.weekStart}>
                      <td style={{ color: "#64748b" }}>
                        {fmtDate(w.weekStart)}
                        {!w.complete && <span style={{ fontSize: 11, color: "#94a3b8" }}> (em curso)</span>}
                      </td>
                      <td className="num" style={{ fontWeight: 600 }}>{fmt0.format(w.weekLoad)}</td>
                      <td className="num" style={{ fontWeight: 600, color: tone === "red" ? "#dc2626" : tone === "amber" ? "#d97706" : tone === "green" ? "#059669" : "#94a3b8" }}>{txt}</td>
                      <td>{inc != null && <Badge tone={tone}>{lab}</Badge>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </Card>

        {/* Questionários — cronologia com as respostas */}
        <Card>
          <CardTitle sub="Resumo do último escore de cada instrumento">Questionários — situação atual</CardTitle>
          {responses.length === 0 ? (
            <Empty title="Nenhuma coleta" hint="Aplique um questionário na aba Questionários." />
          ) : (
            questionnaires.map((q) => {
              const rs = responses.filter((r) => r.questionnaire_id === q.id);
              return rs.length ? <ScoreBlock key={q.id} questionnaire={q} responses={rs} /> : null;
            })
          )}
        </Card>

        {responses.length > 0 && questionnaires.map((q) => {
          const rs = responses.filter((r) => r.questionnaire_id === q.id);
          if (!rs.length) return null;
          return (
            <Card key={`crono-${q.id}`}>
              <CardTitle sub={`${rs.length} ${rs.length === 1 ? "coleta" : "coletas"} · da mais recente para a mais antiga · clique para ver item a item`}>
                Histórico de respostas — {q.kind}
              </CardTitle>
              <CronologiaRespostas questionnaire={q} responses={rs} />
            </Card>
          );
        })}

        {/* Histórico */}
        <Card>
          <CardTitle sub="Últimos 20 registros">Histórico de treinos</CardTitle>
          {logs.length === 0 ? (
            <Empty title="Nenhum treino" action={<Button variant="primary" size="sm" onClick={() => setLogOpen(true)} style={{ marginTop: 12 }}>+ Registrar</Button>} />
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Data</th><th>Tipo</th><th className="num">PSE</th><th className="num">Min</th>
                  <th className="num">Carga</th><th className="num">Sono</th><th>Obs.</th>
                </tr>
              </thead>
              <tbody>
                {logs.slice(0, 20).map((l) => (
                  <tr key={l.id}>
                    <td style={{ color: "#64748b" }}>{fmtDate(l.date)}</td>
                    <td>{l.training_type || <span style={{ color: "#cbd5e1" }}>—</span>}</td>
                    <td className="num">{l.pse}</td>
                    <td className="num">{l.duration_minutes}</td>
                    <td className="num" style={{ fontWeight: 600 }}>{fmt0.format(logLoad(l))}</td>
                    <td className="num" style={{ color: "#64748b" }}>{l.sleep_hours ?? "—"}</td>
                    <td style={{ fontSize: 12, color: "#64748b", maxWidth: 190, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {l.observations || ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        {mediaSono.length > 0 && (
          <Card>
            <CardTitle sub="Média das últimas 14 sessões com registro">Recuperação</CardTitle>
            <div className="grid grid-4">
              {[
                ["Sono (h)", (arr) => arr.reduce((s, x) => s + x.sleep_hours, 0) / arr.length, mediaSono.filter((l) => l.sleep_hours)],
                ["Qualidade do sono", (arr) => arr.reduce((s, x) => s + x.sleep_quality, 0) / arr.length, mediaSono.filter((l) => l.sleep_quality)],
                ["Dor muscular", (arr) => arr.reduce((s, x) => s + x.muscle_soreness, 0) / arr.length, mediaSono.filter((l) => l.muscle_soreness)],
                ["Fadiga", (arr) => arr.reduce((s, x) => s + x.fatigue_level, 0) / arr.length, mediaSono.filter((l) => l.fatigue_level)],
              ].map(([label, fn, arr]) =>
                arr.length ? (
                  <div key={label}>
                    <p className="stat-label">{label}</p>
                    <p className="stat-value" style={{ fontSize: 21 }}>{fn(arr).toFixed(1)}</p>
                  </div>
                ) : null,
              )}
            </div>
          </Card>
        )}
      </div>

      <HRVForm open={hrvOpen} onClose={() => setHrvOpen(false)} patientId={id} onSave={(d) => HRV.create(d)} />
      <EditPatient open={editOpen} onClose={() => setEditOpen(false)} patient={patient} />
      <LogModal open={logOpen} onClose={() => setLogOpen(false)} patientId={id} />
    </>
  );
}

function LogModal({ open, onClose, patientId }) {
  // importa sob demanda para evitar ciclo entre páginas
  const [Comp, setComp] = React.useState(null);
  React.useEffect(() => {
    import("./TrainingLogs").then((m) => setComp(() => m.TrainingLogForm));
  }, []);
  if (!Comp) return null;
  return <Comp open={open} onClose={onClose} patientId={patientId} onSave={(d) => Logs.create(d)} />;
}

function EditPatient({ open, onClose, patient }) {
  const [Comp, setComp] = React.useState(null);
  React.useEffect(() => {
    import("./Patients").then((m) => setComp(() => m.PatientForm));
  }, []);
  if (!Comp) return null;
  return (
    <Comp
      open={open}
      onClose={onClose}
      initial={patient}
      onSave={(d) => Patients.update(patient.id, d)}
    />
  );
}
