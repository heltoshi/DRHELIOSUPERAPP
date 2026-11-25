import React from "react";

/* ============================================================
   Gráficos e cartões de evolução — SVG puro, sem dependência.
   Usado no portal do cliente, na ficha do admin e no relatório.
   ============================================================ */

export const CORES_DOMINIO = {
  sintomas: "#0e7490", dor: "#dc2626", avd: "#2563eb", esporte: "#7c3aed",
  qualidade_vida: "#059669", funcao: "#2563eb", rigidez: "#d97706",
  fisico: "#0e7490", trabalho: "#7c3aed", estilo_vida: "#059669",
  emocional: "#d97706", incapacidade: "#dc2626",
  sintomas_quadril: "#0e7490", atividades_diarias: "#2563eb",
};

export const NOMES_DOMINIO = {
  sintomas: "Sintomas", dor: "Dor", avd: "Atividades diárias",
  esporte: "Esporte e lazer", qualidade_vida: "Qualidade de vida",
  funcao: "Função", rigidez: "Rigidez", fisico: "Físico",
  trabalho: "Trabalho", estilo_vida: "Estilo de vida", emocional: "Emocional",
  incapacidade: "Incapacidade",
};

const nome = (k) => NOMES_DOMINIO[k] || k.replace(/_/g, " ");
const cor = (k, i = 0) =>
  CORES_DOMINIO[k] || ["#0e7490", "#7c3aed", "#059669", "#dc2626", "#d97706", "#2563eb"][i % 6];

/** Linha simples com área — para a série de um domínio. */
export function Sparkline({ serie, cor: c = "#0e7490", h = 34, w = 100, suave = true }) {
  const vals = serie.filter((v) => v != null).map(Number);
  if (vals.length < 2) return <div style={{ height: h }} />;
  const min = Math.min(...vals), max = Math.max(...vals);
  const rng = max - min || 1;
  const pts = vals.map((v, i) => [
    (i / (vals.length - 1)) * w,
    h - 3 - ((v - min) / rng) * (h - 6),
  ]);
  const d = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
  const area = `${d} L${w},${h} L0,${h} Z`;
  const id = `sp${c.replace("#", "")}${vals.length}`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} preserveAspectRatio="none" style={{ display: "block" }}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={c} stopOpacity="0.28" />
          <stop offset="100%" stopColor={c} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${id})`} />
      <path d={d} fill="none" stroke={c} strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="2.6" fill={c} />
    </svg>
  );
}

/** Série temporal de vários domínios no mesmo eixo (0–100). */
export function GraficoDominios({ dominios, datas, h = 190 }) {
  const chaves = Object.keys(dominios).filter((k) => (dominios[k] || []).some((v) => v != null));
  if (!chaves.length) return null;
  const W = 320, H = h, L = 26, R = 6, T = 8, B = 20;
  const iw = W - L - R, ih = H - T - B;
  const n = datas.length;
  const x = (i) => L + (n <= 1 ? iw / 2 : (i / (n - 1)) * iw);
  const y = (v) => T + ih - (Math.max(0, Math.min(100, v)) / 100) * ih;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: "block", overflow: "visible" }}>
      {[0, 25, 50, 75, 100].map((g) => (
        <g key={g}>
          <line x1={L} y1={y(g)} x2={W - R} y2={y(g)} stroke="#e8eef5" strokeWidth="1" />
          <text x={L - 5} y={y(g) + 3} fontSize="7.5" fill="#a8b6c6" textAnchor="end">{g}</text>
        </g>
      ))}
      {chaves.map((k, ki) => {
        const vals = dominios[k];
        const pts = vals.map((v, i) => (v == null ? null : [x(i), y(v)])).filter(Boolean);
        if (pts.length < 2) return null;
        const d = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
        return (
          <g key={k}>
            <path d={d} fill="none" stroke={cor(k, ki)} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
            {pts.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r="2.4" fill={cor(k, ki)} />)}
          </g>
        );
      })}
      {datas.map((dt, i) => (
        (n <= 6 || i === 0 || i === n - 1 || i === Math.floor(n / 2)) && (
          <text key={i} x={x(i)} y={H - 4} fontSize="7.5" fill="#a8b6c6" textAnchor="middle">
            {String(dt).slice(8, 10)}/{String(dt).slice(5, 7)}
          </text>
        )
      ))}
    </svg>
  );
}

export function Legenda({ dominios }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 13px", marginTop: 9 }}>
      {Object.keys(dominios).map((k, i) => (
        <span key={k} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10.5, color: "#64748b" }}>
          <span style={{ width: 7, height: 7, borderRadius: 2, background: cor(k, i) }} />
          {nome(k)}
        </span>
      ))}
    </div>
  );
}

/**
 * Um cartão por instrumento: valor de hoje, variação desde a primeira coleta,
 * sparkline do total e barras dos domínios atuais.
 */
export function CardInstrumento({ instr, coletas, onAbrir }) {
  const ord = [...coletas].sort((a, b) => String(a.submitted_at).localeCompare(String(b.submitted_at)));
  const ult = ord[ord.length - 1];
  const pri = ord[0];
  if (!ult) return null;
  const total = Number(ult.total_score);
  const inicial = Number(pri.total_score);
  const delta = total - inicial;
  const subiu = instr.higherIsBetter ? delta >= 0 : delta <= 0;
  const subs = ult.subscale_scores && Object.keys(ult.subscale_scores).length ? ult.subscale_scores : null;

  return (
    <div
      onClick={onAbrir}
      style={{
        background: "#fff", border: "1px solid #e8eef5", borderRadius: 14, padding: "13px 14px",
        boxShadow: "0 1px 2px rgba(15,23,42,.04)", cursor: onAbrir ? "pointer" : "default",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <div style={{ minWidth: 0 }}>
          <p style={{ fontSize: 12.5, fontWeight: 700, color: "#0f172a", margin: 0 }}>{instr.short || instr.id.toUpperCase()}</p>
          <p style={{ fontSize: 10.5, color: "#94a3b8", margin: "1px 0 0" }}>
            {ord.length} {ord.length > 1 ? "coletas" : "coleta"} · última {String(ult.submitted_at).slice(8, 10)}/{String(ult.submitted_at).slice(5, 7)}
          </p>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <p style={{ fontSize: 21, fontWeight: 800, color: "#0f172a", margin: 0, letterSpacing: "-0.02em", lineHeight: 1.1 }}>
            {Number.isFinite(total) ? total.toFixed(instr.scaleMax > 10 && !Number.isInteger(total) ? 1 : 0) : "—"}
          </p>
          <p style={{ fontSize: 9.5, color: "#a8b6c6", margin: 0 }}>de {instr.scaleMax}</p>
        </div>
      </div>

      {ord.length > 1 && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 7 }}>
          <span style={{
            fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 20,
            background: subiu ? "#dcfce7" : "#fee2e2", color: subiu ? "#047857" : "#b91c1c",
          }}>
            {delta > 0 ? "+" : ""}{delta.toFixed(1).replace(".0", "")} {subiu ? "melhor" : "pior"}
          </span>
          <span style={{ fontSize: 10, color: "#94a3b8" }}>desde {String(pri.submitted_at).slice(8, 10)}/{String(pri.submitted_at).slice(5, 7)}</span>
        </div>
      )}

      {ord.length > 1 && (
        <div style={{ marginTop: 8, marginLeft: -2, marginRight: -2 }}>
          <Sparkline serie={ord.map((o) => Number(o.total_score))} cor={subiu ? "#059669" : "#dc2626"} h={30} />
        </div>
      )}

      {subs && (
        <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 5 }}>
          {Object.entries(subs).map(([k, v], i) => (
            <div key={k}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#64748b", marginBottom: 2 }}>
                <span>{nome(k)}</span><b style={{ color: "#0f172a" }}>{Number(v).toFixed(1)}</b>
              </div>
              <div style={{ height: 4, background: "#f1f5f9", borderRadius: 3, overflow: "hidden" }}>
                <div style={{ width: `${Math.max(0, Math.min(100, Number(v)))}%`, height: "100%", background: cor(k, i), borderRadius: 3 }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
