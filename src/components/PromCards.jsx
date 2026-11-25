import React from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ReferenceLine, Legend,
} from "recharts";
import { Subescalas, ReguaDor } from "./Competencias";

const fmtD = (iso) => {
  if (!iso) return "—";
  const [y, m, d] = String(iso).slice(0, 10).split("-");
  return `${d}/${m}/${y.slice(2)}`;
};

const CORES = {
  KOOS: "#0e7490",
  WOMAC: "#dc2626",
  EVA: "#f59e0b",
  EDAJ: "#7c3aed",
  "VISA-P": "#059669",
  OSTRC: "#0891b2",
  EISDF: "#be123c",
};

const cor = (id) => CORES[id] || "#64748b";

/**
 * Gráfico de acompanhamento de um instrumento: uma linha por paciente
 * (aqui, sempre um paciente), eixo em % do máximo para permitir comparar
 * instrumentos de escalas diferentes. Pontos clicáveis mostram a data.
 */
export function GraficoPROM({ instrumento, coletas, maxScore, higherIsBetter }) {
  const rows = [...coletas]
    .filter((c) => c.total_score != null)
    .sort((a, b) => String(a.submitted_at).localeCompare(String(b.submitted_at)))
    .map((c) => ({
      data: fmtD(c.submitted_at),
      raw: String(c.submitted_at).slice(0, 10),
      valor: Number(c.total_score),
      pct: Math.round((Number(c.total_score) / (maxScore || 100)) * 100),
      semana: c.protocol_week,
    }));

  if (rows.length === 0) return null;

  const vals = rows.map((r) => r.valor);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const pad = Math.max(2, (max - min) * 0.15);

  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={rows} margin={{ top: 10, right: 12, left: -16, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" vertical={false} />
        <XAxis dataKey="data" tick={{ fontSize: 10, fill: "#94a3b8" }} tickLine={false} axisLine={false} minTickGap={18} />
        <YAxis
          domain={[Math.max(0, Math.floor(min - pad)), Math.ceil(max + pad)]}
          tick={{ fontSize: 10, fill: "#94a3b8" }} tickLine={false} axisLine={false} width={40}
        />
        <Tooltip
          contentStyle={{ borderRadius: 10, border: "1px solid #e2e8f0", fontSize: 12 }}
          formatter={(v, n, p) => [`${v} (${p.payload.pct}%)`, instrumento]}
          labelFormatter={(l, p) => `${l}${p?.[0]?.payload?.semana != null ? ` · semana ${p[0].payload.semana}` : ""}`}
        />
        <Line
          type="monotone" dataKey="valor" stroke={cor(instrumento)} strokeWidth={2.6}
          dot={{ r: 4, fill: "#fff", strokeWidth: 2.4, stroke: cor(instrumento) }}
          activeDot={{ r: 6 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

/**
 * Cartão de um instrumento: valor isolado atual, variação, faixa e mini-gráfico.
 * É o "cada valor isolado" pedido: um bloco por PROM, sem misturar escalas.
 */
export function CartaoInstrumento({ instrumento, nome, coletas, maxScore, higherIsBetter, idInstrumento }) {
  if (!coletas.length) return null;
  const asc = [...coletas]
    .filter((c) => c.total_score != null)
    .sort((a, b) => String(a.submitted_at).localeCompare(String(b.submitted_at)));
  if (!asc.length) return null;

  const ult = asc[asc.length - 1];
  const prime = asc[0];
  const prev = asc[asc.length - 2];
  const n = Number(ult.total_score);
  const pct = Math.round((n / (maxScore || 100)) * 100);

  // arredondar: as coletas vêm com float e o delta saía como 2.3999999999999988
  const r1 = (x) => Math.round(x * 10) / 10;
  const delta = prev ? r1(n - Number(prev.total_score)) : null;
  const deltaTotal = asc.length > 1 ? r1(n - Number(prime.total_score)) : null;
  const melhorou = deltaTotal == null ? null : (higherIsBetter ? deltaTotal > 0 : deltaTotal < 0);

  return (
    <div style={{ border: "1px solid #e8eef5", borderRadius: 12, padding: "13px 14px", background: "#fff" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
        <span style={{ fontSize: 11.5, fontWeight: 700, color: cor(instrumento), letterSpacing: .3 }}>{instrumento}</span>
        <span style={{ fontSize: 11, color: "#94a3b8" }}>{fmtD(ult.submitted_at)}</span>
        <span style={{ marginLeft: "auto", fontSize: 21, fontWeight: 800, fontVariantNumeric: "tabular-nums", color: cor(instrumento) }}>
          {r1(n)}
          <span style={{ fontSize: 11, fontWeight: 400, color: "#94a3b8" }}> / {maxScore}</span>
        </span>
      </div>

      <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 4, flexWrap: "wrap" }}>
        {delta != null && delta !== 0 && (
          <span style={{
            fontSize: 11.5, fontWeight: 700, padding: "2px 7px", borderRadius: 5,
            background: (higherIsBetter ? delta > 0 : delta < 0) ? "#d1fae5" : "#fee2e2",
            color: (higherIsBetter ? delta > 0 : delta < 0) ? "#047857" : "#b91c1c",
          }}>
            {delta > 0 ? "+" : ""}{delta} vs anterior
          </span>
        )}
        {deltaTotal != null && deltaTotal !== 0 && (
          <span style={{ fontSize: 10.5, color: "#94a3b8" }}>
            desde {fmtD(prime.submitted_at)}: {deltaTotal > 0 ? "+" : ""}{deltaTotal}
            {melhorou != null && (melhorou ? " ↓ melhor" : " ↑ pior")}
          </span>
        )}
        <span style={{ fontSize: 10.5, color: "#94a3b8", marginLeft: "auto" }}>{asc.length} coletas</span>
      </div>

      <div style={{ marginTop: 6 }}>
        <GraficoPROM instrumento={instrumento} coletas={coletas} maxScore={maxScore} higherIsBetter={higherIsBetter} />
      </div>

      {/* EVA: régua de dor. Demais instrumentos: competências avaliadas */}
      {String(idInstrumento || "").toLowerCase() === "eva" ? (
        <ReguaDor valor={n} anterior={prev ? Number(prev.total_score) : null} />
      ) : (
        <Subescalas
          atual={ult.subscale_scores}
          anterior={prev?.subscale_scores}
          maiorMelhor={higherIsBetter !== false}
        />
      )}
    </div>
  );
}
