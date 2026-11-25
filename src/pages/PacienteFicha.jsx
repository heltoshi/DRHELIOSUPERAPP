import React from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import {
  Patients, Logs, HRV, Responses, Questionnaires, PROMs, protocolWeek, subscribe, maturacaoVisitas,
} from "../lib/data";
import { groupDailyLoads, computeACWR, acwrStatus, fmt2, fmt0, fmtDate } from "../lib/metrics";
import { Card, CardTitle, Badge, Button, Empty } from "../components/ui";
import { MODULOS } from "./PacientesUnificados";

/**
 * Ficha única do paciente: reúne os três apps numa tela só.
 * Cada módulo mostra o essencial e leva para a tela completa dele.
 */
export default function PacienteFicha() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [, force] = React.useState(0);
  React.useEffect(() => subscribe(() => force((n) => n + 1)), []);

  const p = Patients.get(id);
  const [visitasMat, setVisitasMat] = React.useState([]);

  React.useEffect(() => {
    if (!id) return;
    let vivo = true;
    maturacaoVisitas.list(id).then((v) => { if (vivo) setVisitasMat(v || []); }).catch(() => {});
    return () => { vivo = false; };
  }, [id]);

  if (!p) {
    return <div className="content"><Card><Empty title="Paciente não encontrado" action={<Link to="/pacientes" className="btn btn-sm btn-outline" style={{ marginTop: 12 }}>Voltar</Link>} /></Card></div>;
  }

  const logs = Logs.list(id);
  const hrv = HRV.list(id);
  const respostas = Responses.list({ patient_id: id });
  const proms = PROMs.list(id);
  const questions = Questionnaires.list();
  const acwr = computeACWR(groupDailyLoads(logs));
  const st = acwrStatus(acwr.acwr);
  const semana = protocolWeek(p.protocol_start);
  const tem = (m) => (p.modules || []).includes(m);

  const últimos = [...logs].sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 5);

  return (
    <>
      <div className="topbar">
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <button className="icon-btn" onClick={() => navigate("/pacientes")} style={{ fontSize: 17 }}>←</button>
          <div>
            <h1 style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              {p.name} <Badge tone="gray">{p.code}</Badge>
            </h1>
            <p>
              {p.diagnosis || "sem diagnóstico"}
              {p.dob && ` · nasceu ${fmtDate(p.dob)}`}
              {semana ? ` · semana ${semana}` : ""}
            </p>
          </div>
        </div>
        <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
          {tem("orthoflow") && (
            <Link to={`/orthoflow/paciente/${id}`} className="btn btn-sm btn-outline">OrthoFlow</Link>
          )}
          {tem("atleta360") && (
            <Link to={`/360/pacientes/${id}`} className="btn btn-sm btn-outline">Atleta 360</Link>
          )}
        </div>
      </div>

      <div className="content">
        {/* identificação + módulos */}
        <Card>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
              {MODULOS.map((m) => {
                const ativo = tem(m.id);
                return (
                  <span key={m.id} style={{
                    fontSize: 11.5, fontWeight: 700, padding: "4px 10px", borderRadius: 6,
                    border: "1px solid", borderColor: ativo ? m.cor : "#e2e8f0",
                    background: ativo ? m.cor : "#f8fafc", color: ativo ? "#fff" : "#94a3b8",
                  }}>
                    {m.nome}
                  </span>
                );
              })}
            </div>
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap", fontSize: 12, color: "#64748b" }}>
              {p.email && <span>✉ {p.email}</span>}
              {p.phone && <span>☎ {p.phone}</span>}
              <span>{p.user_id ? "acesso ativo" : "sem acesso criado"}</span>
            </div>
          </div>
        </Card>

        {/* ---------------- ATLETA 360 ---------------- */}
        {tem("atleta360") && (
          <Card>
            <CardTitle sub={`${logs.length} treinos · ${hrv.length} coletas de VFC · ${respostas.length} questionários`}>
              Atleta 360 — carga e recuperação
            </CardTitle>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))", gap: 10 }}>
              <div className="kpi">
                <p className="kpi-label">Carga aguda (7 d)</p>
                <p className="kpi-value">{acwr.acute != null ? fmt0.format(acwr.acute) : "—"}</p>
                <p className="kpi-unit">UA</p>
              </div>
              <div className="kpi">
                <p className="kpi-label">Carga crônica (28 d)</p>
                <p className="kpi-value">{acwr.chronic != null ? fmt0.format(acwr.chronic) : "—"}</p>
                <p className="kpi-unit">UA/dia</p>
              </div>
              <div className="kpi">
                <p className="kpi-label">ACWR</p>
                <p className="kpi-value" style={{ color: st.color === "red" ? "#dc2626" : st.color === "yellow" ? "#d97706" : "#059669" }}>
                  {acwr.acwr != null ? fmt2.format(acwr.acwr) : "—"}
                </p>
                <p className="kpi-unit">{st.label}</p>
              </div>
              <div className="kpi">
                <p className="kpi-label">VFC mais recente</p>
                <p className="kpi-value">{hrv[0]?.hrv ?? "—"}</p>
                <p className="kpi-unit">{hrv[0] ? "ms" : "sem registro"}</p>
              </div>
            </div>

            {últimos.length > 0 && (
              <>
                <p style={{ fontSize: 12, fontWeight: 600, color: "#475569", margin: "14px 0 6px" }}>Últimos treinos</p>
                <table className="table">
                  <thead><tr><th>Data</th><th>Tipo</th><th className="num">PSE</th><th className="num">Min</th><th className="num">Carga</th></tr></thead>
                  <tbody>
                    {últimos.map((l) => (
                      <tr key={l.id}>
                        <td style={{ color: "#64748b" }}>{fmtDate(l.date)}</td>
                        <td>{l.training_type || "—"}</td>
                        <td className="num">{l.pse}</td>
                        <td className="num">{l.duration_minutes}</td>
                        <td className="num" style={{ fontWeight: 600 }}>{fmt0.format(l.pse * l.duration_minutes)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}

            <div style={{ marginTop: 12 }}>
              <Link to={`/360/pacientes/${id}`} className="btn btn-sm btn-primary">
                Ver gráficos e questionários completos →
              </Link>
            </div>
          </Card>
        )}

        {/* ---------------- ORTHOFLOW ---------------- */}
        {tem("orthoflow") && (
          <Card>
            <CardTitle sub={semana ? `Semana ${semana} do protocolo de 12 semanas` : "Protocolo não iniciado"}>
              OrthoFlow — PROMs e reabilitação
            </CardTitle>
            {proms.length === 0 ? (
              <Empty title="Nenhuma coleta de PROM" hint="Aplique o primeiro questionário no módulo OrthoFlow." />
            ) : (
              <>
                <p style={{ fontSize: 12, color: "#94a3b8", marginBottom: 8 }}>
                  {proms.length} {proms.length === 1 ? "coleta" : "coletas"} · último resultado de cada instrumento
                </p>
                <table className="table">
                  <thead><tr><th>Instrumento</th><th className="num">Último escore</th><th>Data</th><th className="num">Coletas</th></tr></thead>
                  <tbody>
                    {[...new Set(proms.map((s) => s.questionnaire))].map((qid) => {
                      const arr = proms.filter((s) => s.questionnaire === qid);
                      const ult = arr[0];
                      return (
                        <tr key={qid}>
                          <td style={{ fontWeight: 600 }}>{String(qid).toUpperCase()}</td>
                          <td className="num" style={{ fontWeight: 700 }}>{ult.total_score ?? "—"}</td>
                          <td style={{ color: "#64748b" }}>{fmtDate(ult.submitted_at)}</td>
                          <td className="num">{arr.length}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </>
            )}
            <div style={{ marginTop: 12 }}>
              <Link to={`/orthoflow/paciente/${id}`} className="btn btn-sm btn-primary">
                Abrir evolução por instrumento →
              </Link>
            </div>
          </Card>
        )}

        {/* ---------------- MATURAÇÃO ---------------- */}
        {tem("maturacao") && (
          <Card>
            <CardTitle sub={`${visitasMat.length} ${visitasMat.length === 1 ? "avaliação" : "avaliações"}`}>
              Maturação — crescimento e bio-banding
            </CardTitle>
            {visitasMat.length === 0 ? (
              <Empty title="Nenhuma avaliação" hint="Registre a primeira avaliação na aba Maturação." />
            ) : (
              <table className="table">
                <thead>
                  <tr><th>Data</th><th className="num">Estatura</th><th className="num">Est. final</th><th className="num">% atingido</th><th>Janela</th></tr>
                </thead>
                <tbody>
                  {[...visitasMat]
                    .sort((a, b) => String(b.data_avaliacao || b.date).localeCompare(String(a.data_avaliacao || a.date)))
                    .map((v) => (
                      <tr key={v.id}>
                        <td>{fmtDate(v.data_avaliacao || v.date)}</td>
                        <td className="num">{v.estatura != null ? Number(v.estatura).toFixed(1) : "—"} cm</td>
                        <td className="num">{v.consenso_pah != null ? Number(v.consenso_pah).toFixed(1) : "—"} cm</td>
                        <td className="num">{v.consenso_pct != null ? Number(v.consenso_pct).toFixed(1) : "—"}%</td>
                        <td style={{ fontSize: 12 }}>{v.banding || "—"}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            )}
            <div style={{ marginTop: 12 }}>
              <Link to={`/360/maturacao?paciente=${id}`} className="btn btn-sm btn-primary">
                Abrir Maturação →
              </Link>
            </div>
          </Card>
        )}

        {!(p.modules || []).length && (
          <Card><Empty title="Nenhum módulo ligado" hint="Ligue ao menos um módulo nesta ficha." /></Card>
        )}
      </div>
    </>
  );
}
