import React from "react";
import {
  AreaChart, Area, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, ReferenceArea, ComposedChart, BarChart, Bar, Cell,
} from "recharts";
import { fmtDate, fmt0 } from "../lib/metrics";

const tooltipStyle = {
  borderRadius: 10,
  border: "1px solid #e2e8f0",
  boxShadow: "0 6px 18px rgba(15,23,42,.10)",
  fontSize: 12,
  padding: "8px 10px",
};

export function LoadArea({ data, height = 240, label = "Carga" }) {
  const rows = data.map((d) => ({ ...d, dia: fmtDate(d.date, "day") }));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={rows} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
        <defs>
          <linearGradient id="gLoad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#0e7490" stopOpacity={0.32} />
            <stop offset="95%" stopColor="#0e7490" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" vertical={false} />
        <XAxis dataKey="dia" tick={{ fontSize: 11, fill: "#94a3b8" }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
        <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} tickLine={false} axisLine={false} />
        <Tooltip
          contentStyle={tooltipStyle}
          formatter={(v) => [`${fmt0.format(v)} UA`, label]}
        />
        <Area type="monotone" dataKey="load" stroke="#0e7490" strokeWidth={2.2} fill="url(#gLoad)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function HrvAcwrLine({ data, height = 270 }) {
  const rows = data.map((d) => ({
    ...d,
    dia: fmtDate(d.date, "day"),
    acwr: d.acwr != null ? Math.round(d.acwr * 100) / 100 : null,
    hrv: d.hrv ?? null,
  }));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={rows} margin={{ top: 10, right: 4, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
        <XAxis dataKey="dia" tick={{ fontSize: 10, fill: "#94a3b8" }} tickLine={false} axisLine={false} interval={3} />
        <YAxis yAxisId="hrv" tick={{ fontSize: 10, fill: "#7c3aed" }} tickLine={false} axisLine={false} />
        <YAxis yAxisId="acwr" orientation="right" domain={[0, 2]} tick={{ fontSize: 10, fill: "#0e7490" }} tickLine={false} axisLine={false} />
        <Tooltip contentStyle={tooltipStyle} />
        <ReferenceLine yAxisId="acwr" y={0.8} stroke="#f59e0b" strokeDasharray="4 3" />
        <ReferenceLine yAxisId="acwr" y={1.2} stroke="#dc2626" strokeDasharray="4 3" />
        <Line yAxisId="hrv" type="monotone" dataKey="hrv" name="VFC (ms)" stroke="#7c3aed" strokeWidth={2.4} dot={{ r: 2.5 }} connectNulls={false} />
        <Line yAxisId="acwr" type="monotone" dataKey="acwr" name="ACWR" stroke="#0e7490" strokeWidth={2.4} dot={false} connectNulls={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function SeverityBars({ items }) {
  // items: [{ label, value, tone }]
  return (
    <ResponsiveContainer width="100%" height={Math.max(120, items.length * 34)}>
      <BarChart data={items} layout="vertical" margin={{ top: 0, right: 28, left: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" horizontal={false} />
        <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10, fill: "#94a3b8" }} tickLine={false} axisLine={false} />
        <YAxis type="category" dataKey="label" width={96} tick={{ fontSize: 10, fill: "#64748b" }} tickLine={false} axisLine={false} />
        <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`${v}/100`, "Escore"]} />
        <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={16}>
          {items.map((it, i) => (
            <Cell key={i} fill={it.color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/**
 * Gráfico de carga relativa no padrão do Base44, com uma melhoria:
 * as linhas de carga aguda (7 d), crônica (28 d) e ACWR ficam no MESMO eixo
 * de carga, e o ACWR tem seu próprio eixo à direita. A janela é ancorada no
 * último registro, não em "hoje" — assim um atleta que parou há 3 semanas
 * ainda mostra o histórico dele.
 */
export function CargaRelativaChart({ serie, height = 300, mostrarAcwr = true, hrvMap = null }) {
  const rows = serie.map((d) => ({
    ...d,
    dia: fmtDate(d.date, "day"),
    aguda: Math.round(d.aguda),
    cronica: Math.round(d.cronica),
    acwr: d.acwr != null ? Math.round(d.acwr * 100) / 100 : null,
    vfc: hrvMap ? (hrvMap.get(d.date) ?? null) : null,
  }));
  const temVfc = hrvMap && rows.some((r) => r.vfc != null);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={rows} margin={{ top: 10, right: 8, left: -14, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" vertical={false} />
        <XAxis dataKey="dia" tick={{ fontSize: 10, fill: "#94a3b8" }} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={22} />
        <YAxis yAxisId="carga" tick={{ fontSize: 10, fill: "#94a3b8" }} tickLine={false} axisLine={false} />
        {/* dois eixos à direita, empilhados: VFC (ms) por fora, ACWR por dentro */}
        {mostrarAcwr && (
          <YAxis yAxisId="acwr" orientation="right" domain={[0, 2]} ticks={[0, 0.8, 1.2, 1.5, 2]}
            tick={{ fontSize: 10, fill: "#dc2626" }} tickLine={false} axisLine={false} width={30} />
        )}
        {temVfc && (
          <YAxis yAxisId="vfc" orientation="right" tick={{ fontSize: 10, fill: "#7c3aed" }}
            tickLine={false} axisLine={false} width={34} />
        )}
        <Tooltip
          contentStyle={tooltipStyle}
          formatter={(v, n) => {
            if (n === "ACWR") return [v ?? "—", n];
            if (n === "VFC (ms)") return [v != null ? `${v} ms` : "—", n];
            return [`${fmt0.format(v)} UA`, n];
          }}
        />
        {/* faixas de referência do ACWR */}
        {mostrarAcwr && <>
          <ReferenceArea yAxisId="acwr" y1={0.8} y2={1.2} fill="#10b981" fillOpacity={0.07} />
          <ReferenceLine yAxisId="acwr" y={0.8} stroke="#f59e0b" strokeDasharray="4 3" strokeWidth={1.2} />
          <ReferenceLine yAxisId="acwr" y={1.2} stroke="#dc2626" strokeDasharray="4 3" strokeWidth={1.2} />
        </>}
        <Bar yAxisId="carga" dataKey="carga" name="Carga diária" fill="#cbd5e1" barSize={rows.length > 60 ? 2 : 8} radius={[2, 2, 0, 0]} />
        <Line yAxisId="carga" type="monotone" dataKey="aguda" name="Aguda (7 d)" stroke="#0e7490" strokeWidth={2.4} dot={false} />
        <Line yAxisId="carga" type="monotone" dataKey="cronica" name="Crônica (28 d)" stroke="#7c3aed" strokeWidth={2.4} dot={false} />
        {temVfc && (
          <Line yAxisId="vfc" type="monotone" dataKey="vfc" name="VFC (ms)" stroke="#7c3aed" strokeWidth={2.2}
            dot={{ r: 2.5 }} connectNulls={false} />
        )}
        {mostrarAcwr && (
          <Line yAxisId="acwr" type="monotone" dataKey="acwr" name="ACWR" stroke="#dc2626" strokeWidth={2} dot={false} connectNulls={false} />
        )}
      </ComposedChart>
    </ResponsiveContainer>
  );
}
