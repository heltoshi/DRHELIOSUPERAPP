import React from "react";
import { Patients, Responses, Questionnaires, subscribe } from "../lib/data";
import { scoreResponse, sortByDateAsc } from "../lib/scores";
import { fmtDate, todayISO } from "../lib/metrics";
import { Card, CardTitle, Badge, Button, Field, Empty, Bar } from "../components/ui";

/** Formulário de aplicação de um questionário a um atleta. */
function ApplyForm({ questionnaire, patients, onSave, onCancel }) {
  const [patientId, setPatientId] = React.useState("");
  const [date, setDate] = React.useState(todayISO());
  const [answers, setAnswers] = React.useState({});
  const [err, setErr] = React.useState("");
  const [i, setI] = React.useState(0);

  const qs = questionnaire.questions || [];
  const atual = qs[i];
  const respondidas = qs.filter((q) => answers[q.text] != null && answers[q.text] !== "").length;
  const pct = Math.round((respondidas / Math.max(1, qs.length)) * 100);

  const setResp = (text, val) => setAnswers((a) => ({ ...a, [text]: val }));

  const salvar = () => {
    if (!patientId) return setErr("Escolha o atleta.");
    const payload = {
      questionnaire_id: questionnaire.id,
      patient_id: patientId,
      date,
      answers: qs.map((q) => ({ question_text: q.text, answer: answers[q.text] ?? "" })),
    };
    onSave(payload);
    onCancel();
  };

  return (
    <>
      <div style={{ display: "flex", gap: 9, flexWrap: "wrap" }}>
        <select value={patientId} onChange={(e) => setPatientId(e.target.value)} style={{ flex: 1, minWidth: 160 }}>
          <option value="">Escolha o atleta…</option>
          {patients.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ width: 150 }} />
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div className="progress-track" style={{ flex: 1 }}>
          <div className="progress-fill" style={{ width: `${pct}%` }} />
        </div>
        <span style={{ fontSize: 12, color: "#64748b", fontVariantNumeric: "tabular-nums" }}>{respondidas}/{qs.length}</span>
      </div>

      <div style={{ borderTop: "1px solid #eef2f7", paddingTop: 12 }}>
        <p style={{ fontSize: 11.5, color: "#94a3b8", marginBottom: 4 }}>Pergunta {i + 1} de {qs.length}</p>
        <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 11, lineHeight: 1.45 }}>{atual?.text}</p>

        {atual?.type === "scale" ? (
          <div className="scale-row">
            {Array.from({ length: (atual.scale_max ?? 10) - (atual.scale_min ?? 0) + 1 }, (_, k) => (atual.scale_min ?? 0) + k).map((n) => (
              <button
                key={n}
                type="button"
                className={String(answers[atual.text]) === String(n) ? "on" : ""}
                onClick={() => setResp(atual.text, String(n))}
              >
                {n}
              </button>
            ))}
          </div>
        ) : atual?.type === "text" ? (
          <textarea
            value={answers[atual.text] || ""}
            onChange={(e) => setResp(atual.text, e.target.value)}
            placeholder="Resposta livre"
          />
        ) : (
          <div className="opt-list">
            {(atual?.options || []).map((o) => (
              <button
                key={o}
                type="button"
                className={answers[atual.text] === o ? "on" : ""}
                onClick={() => setResp(atual.text, o)}
              >
                {o}
              </button>
            ))}
          </div>
        )}
      </div>

      {err && <div className="alert-box alert-red">{err}</div>}

      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, paddingTop: 4 }}>
        <Button variant="outline" size="sm" type="button" onClick={() => setI((n) => Math.max(0, n - 1))} disabled={i === 0}>
          ← Anterior
        </Button>
        {i < qs.length - 1 ? (
          <Button variant="primary" size="sm" type="button" onClick={() => setI((n) => Math.min(qs.length - 1, n + 1))}>
            Próxima →
          </Button>
        ) : (
          <Button variant="teal" size="sm" type="button" onClick={salvar}>Salvar coleta</Button>
        )}
      </div>
    </>
  );
}

function ScorePanel({ questionnaire, patient, responses }) {
  const asc = sortByDateAsc(responses);
  const scored = asc.map((r) => ({ r, s: scoreResponse(questionnaire, r.answers) })).filter((x) => x.s);
  if (scored.length === 0) return null;

  const ultimo = scored[scored.length - 1];
  const penultimo = scored[scored.length - 2];
  const delta = penultimo ? ultimo.s.total - penultimo.s.total : null;
  const tone = ultimo.s.severity.color;

  return (
    <div style={{ borderTop: "1px solid #eef2f7", paddingTop: 11, marginTop: 11 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 9, flexWrap: "wrap" }}>
        <b style={{ fontSize: 13 }}>{patient.name}</b>
        <span style={{ fontSize: 11.5, color: "#94a3b8" }}>{fmtDate(ultimo.r.date, "long")}</span>
        <Badge tone={tone}>{ultimo.s.severity.label}</Badge>
        <span style={{ marginLeft: "auto", fontSize: 19, fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>
          {ultimo.s.total}<span style={{ fontSize: 12, fontWeight: 400, color: "#94a3b8" }}>/{ultimo.s.maxScore}</span>
        </span>
        {delta != null && (
          <span style={{ fontSize: 12, fontWeight: 600, color: delta === 0 ? "#94a3b8" : (ultimo.s.higherIsBetter ? delta > 0 : delta < 0) ? "#059669" : "#dc2626" }}>
            {delta > 0 ? "+" : ""}{delta}
          </span>
        )}
      </div>
      <div style={{ marginTop: 7 }}>
        <Bar value={ultimo.s.total} max={ultimo.s.maxScore || 100} tone={tone} />
      </div>
      {scored.length > 1 && (
        <p style={{ fontSize: 11.5, color: "#94a3b8", marginTop: 5 }}>
          {scored.length} coletas · série: {scored.slice(-6).map((x) => x.s.total).join(" → ")}
        </p>
      )}
    </div>
  );
}

export default function QuestionnairesPage() {
  const [, force] = React.useState(0);
  React.useEffect(() => subscribe(() => force((n) => n + 1)), []);

  const patients = Patients.list().filter((p) => p.modules.includes("atleta360"));
  const questionnaires = Questionnaires.list();
  const responses = Responses.list();

  const [aplicando, setAplicando] = React.useState(null);
  const [expandido, setExpandido] = React.useState(null);

  return (
    <>
      <div className="topbar">
        <div>
          <h1>Questionários</h1>
          <p>{questionnaires.length} instrumentos · {responses.length} coletas</p>
        </div>
      </div>

      <div className="content">
        {aplicando ? (
          <Card>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 13 }}>
              <CardTitle sub={aplicando.title}>Aplicar questionário</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setAplicando(null)}>✕ Fechar</Button>
            </div>
            <ApplyForm
              questionnaire={aplicando}
              patients={patients}
              onCancel={() => setAplicando(null)}
              onSave={(data) => Responses.create(data)}
            />
          </Card>
        ) : (
          <div className="grid grid-2">
            {questionnaires.map((q) => {
              const resp = responses.filter((r) => r.questionnaire_id === q.id);
              const pacientesDistintos = [...new Set(resp.map((r) => r.patient_id))];
              return (
                <Card key={q.id}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 9 }}>
                    <div style={{ minWidth: 0 }}>
                      <h3 style={{ fontSize: 14, lineHeight: 1.35 }}>{q.title}</h3>
                      <p style={{ fontSize: 12, color: "#94a3b8", marginTop: 3 }}>
                        {q.questions?.length || 0} itens · {resp.length} coletas · {pacientesDistintos.length} atletas
                      </p>
                    </div>
                    <Badge tone="teal">{q.kind}</Badge>
                  </div>
                  {q.description && (
                    <p style={{ fontSize: 12, color: "#64748b", marginTop: 9, lineHeight: 1.5 }}>{q.description}</p>
                  )}
                  <div style={{ display: "flex", gap: 7, marginTop: 13, flexWrap: "wrap" }}>
                    <Button variant="teal" size="sm" disabled={patients.length === 0} onClick={() => setAplicando(q)}>
                      Aplicar
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={resp.length === 0}
                      onClick={() => setExpandido(expandido === q.id ? null : q.id)}
                    >
                      {expandido === q.id ? "Fechar" : "Ver escores"}
                    </Button>
                  </div>

                  {expandido === q.id && (
                    <div style={{ marginTop: 13 }}>
                      {pacientesDistintos.length === 0 ? (
                        <p style={{ fontSize: 12, color: "#94a3b8" }}>Nenhuma coleta registrada.</p>
                      ) : (
                        pacientesDistintos.map((pid) => {
                          const p = patients.find((x) => x.id === pid);
                          const rs = resp.filter((r) => r.patient_id === pid);
                          return <ScorePanel key={pid} questionnaire={q} patient={p || { name: "Atleta" }} responses={rs} />;
                        })
                      )}
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}

        {!aplicando && questionnaires.length === 0 && (
          <Card><Empty title="Nenhum questionário" hint="Os instrumentos EDAJ, EISDF e OSTRC-BR vêm carregados." /></Card>
        )}

        <Card>
          <CardTitle sub="Últimas coletas registradas, de todos os instrumentos">Coletas recentes</CardTitle>
          <table className="table">
            <thead>
              <tr>
                <th>Data</th>
                <th>Atleta</th>
                <th>Instrumento</th>
                <th className="num">Escore</th>
                <th>Classificação</th>
              </tr>
            </thead>
            <tbody>
              {responses.slice(0, 12).map((r) => {
                const q = questionnaires.find((x) => x.id === r.questionnaire_id);
                const p = patients.find((x) => x.id === r.patient_id);
                const s = q ? scoreResponse(q, r.answers) : null;
                return (
                  <tr key={r.id}>
                    <td style={{ color: "#64748b" }}>{fmtDate(r.date)}</td>
                    <td style={{ fontWeight: 550 }}>{p?.name?.split(" ").slice(0, 2).join(" ") || "—"}</td>
                    <td>{q?.kind || "—"}</td>
                    <td className="num" style={{ fontWeight: 600 }}>
                      {s ? `${s.total}/${s.maxScore}` : "—"}
                    </td>
                    <td>{s ? <Badge tone={s.severity.color}>{s.severity.label}</Badge> : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      </div>
    </>
  );
}
