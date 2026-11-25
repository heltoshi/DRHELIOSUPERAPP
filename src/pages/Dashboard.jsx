import React from "react";
import { Link } from "react-router-dom";
import { Patients, Logs, HRV, Responses, subscribe } from "../lib/data";
import {
  groupDailyLoads, computeACWR, acwrStatus, dailySeries,
  fmt2, fmt0, fmtDate, todayISO, logLoad,
} from "../lib/metrics";
import { Card, CardTitle, Badge, Stat, Empty, Avatar } from "../components/ui";
import { LoadArea } from "../components/charts";

export default function Dashboard() {
  const [, force] = React.useState(0);
  React.useEffect(() => subscribe(() => force((n) => n + 1)), []);

  const patients = Patients.list().filter((p) => p.modules.includes("atleta360"));
  const logs = Logs.list();
  const hrv = HRV.list();
  const responses = Responses.list();

  const ativos = patients.filter((p) => p.status === "ativo");
  const lesionados = patients.filter((p) => p.status === "lesionado");

  const today = todayISO();
  const logsHoje = logs.filter((l) => l.date === today);
  const semTreino = ativos.filter((p) => !logs.some((l) => l.patient_id === p.id && l.date === today));

  const tipoCount = {};
  logs.slice(0, 200).forEach((l) => {
    const t = l.training_type || "Não informado";
    tipoCount[t] = (tipoCount[t] || 0) + 1;
  });

  const rows = ativos
    .map((p) => {
      const pl = logs.filter((l) => l.patient_id === p.id);
      const daily = groupDailyLoads(pl);
      const { acwr, acute, chronic } = computeACWR(daily);
      const lastLog = pl.sort((a, b) => String(b.date).localeCompare(String(a.date)))[0];
      return { patient: p, acwr, acute, chronic, status: acwrStatus(acwr), lastLog, n: pl.length };
    })
    .sort((a, b) => {
      const order = { red: 0, yellow: 1, gray: 2, green: 3 };
      return order[a.status.color] - order[b.status.color];
    });

  const serie = dailySeries(logs, 14);

  return (
    <>
      <div className="topbar">
        <div>
          <h1>Painel</h1>
          <p>Visão geral do monitoramento — {fmtDate(today, "long")}</p>
        </div>
        <Link to="/360/pacientes" className="btn btn-sm btn-primary">
          + Paciente
        </Link>
      </div>

      <div className="content">
        <div className="grid grid-4">
          <Stat label="Atletas ativos" value={ativos.length} sub={`${patients.length} cadastrados`} tone="teal" />
          <Stat label="Treinos registrados" value={fmt0.format(logs.length)} sub={`${logsHoje.length} hoje`} tone="blue" />
          <Stat label="Coletas de VFC" value={fmt0.format(hrv.length)} sub="HRV / rMSSD" tone="violet" />
          <Stat label="Lesionados" value={lesionados.length} sub={`${responses.length} questionários`} tone="red" />
        </div>

        {semTreino.length > 0 && (
          <div className="alert-box alert-amber">
            ⚠ {semTreino.length} atleta{semTreino.length > 1 ? "s" : ""} ativo{semTreino.length > 1 ? "s" : ""} sem registro de treino hoje:{" "}
            {semTreino.map((p) => p.name.split(" ")[0]).join(", ")}
          </div>
        )}

        <div className="grid grid-2-1">
          <Card>
            <CardTitle sub="Somatório diário de PSE × duração, todos os atletas">Carga de treino — 14 dias</CardTitle>
            <LoadArea data={serie} />
          </Card>

          <Card>
            <CardTitle sub="Ordenado por risco">ACWR por atleta</CardTitle>
            {rows.length === 0 ? (
              <Empty title="Nenhum atleta ativo" hint="Cadastre um paciente para começar." />
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {rows.map(({ patient, acwr, status, n }) => (
                  <Link key={patient.id} to={`/360/pacientes/${patient.id}`} className="row-link">
                    <span className={`dot dot-${status.color}`} />
                    <span style={{ flex: 1, fontSize: 13, fontWeight: 550, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {patient.name}
                    </span>
                    <span style={{ fontSize: 11.5, color: "#94a3b8" }}>{patient.sport}</span>
                    <span className="num" style={{ fontWeight: 700, fontSize: 13, minWidth: 38, color: status.color === "gray" ? "#94a3b8" : undefined }}>
                      {acwr != null ? fmt2.format(acwr) : "N/D"}
                    </span>
                    <Badge tone={status.color === "gray" ? "gray" : status.color}>{status.label}</Badge>
                  </Link>
                ))}
              </div>
            )}
            <p style={{ fontSize: 11.5, color: "#94a3b8", marginTop: 12 }}>
              ACWR = carga aguda (7 d) ÷ média diária crônica (28 d) × 7. Faixa segura: 0,80 – 1,20.
            </p>
          </Card>
        </div>

        <div className="grid grid-2">
          <Card>
            <CardTitle sub="Últimos registros">Atividade recente</CardTitle>
            <table className="table">
              <thead>
                <tr>
                  <th>Atleta</th>
                  <th>Data</th>
                  <th className="num">PSE</th>
                  <th className="num">Min</th>
                  <th className="num">Carga</th>
                </tr>
              </thead>
              <tbody>
                {logs.slice(0, 8).map((l) => {
                  const p = patients.find((x) => x.id === l.patient_id);
                  return (
                    <tr key={l.id}>
                      <td>{p?.name?.split(" ")[0] || "—"}</td>
                      <td style={{ color: "#64748b" }}>{fmtDate(l.date)}</td>
                      <td className="num">{l.pse}</td>
                      <td className="num">{l.duration_minutes}</td>
                      <td className="num" style={{ fontWeight: 600 }}>{fmt0.format(logLoad(l))}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>

          <Card>
            <CardTitle sub="Distribuição por tipo de treino">Composição dos treinos</CardTitle>
            {Object.keys(tipoCount).length === 0 ? (
              <Empty title="Sem treinos registrados" />
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                {Object.entries(tipoCount)
                  .sort((a, b) => b[1] - a[1])
                  .slice(0, 6)
                  .map(([tipo, n]) => {
                    const pct = Math.round((n / Math.max(...Object.values(tipoCount))) * 100);
                    return (
                      <div key={tipo}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 3 }}>
                          <span style={{ color: "#475569", fontWeight: 550 }}>{tipo}</span>
                          <span style={{ color: "#94a3b8" }}>{n}</span>
                        </div>
                        <div className="bar">
                          <div className="bar-fill tone-teal" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
