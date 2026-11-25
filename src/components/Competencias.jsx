import React from "react";

// Nomes apresentáveis e o que cada domínio avalia (para o paciente entender).
const ROTULOS = {
  // KOOS (0-100, maior = melhor)
  sintomas:       { nome: "Sintomas",        desc: "dor, rigidez e inchaço" },
  dor:            { nome: "Dor",             desc: "intensidade e frequência" },
  avd:            { nome: "AVD",             desc: "atividades do dia a dia" },
  esporte:        { nome: "Esporte",         desc: "correr, saltar, girar" },
  qualidade_vida: { nome: "Qualidade de vida", desc: "consciência e limitação" },
  // WOMAC (0-96, menor = melhor)
  rigidez:        { nome: "Rigidez",         desc: "ao acordar e à noite" },
  funcao:         { nome: "Função",          desc: "andar, subir escada, sentar" },
  incapacidade:   { nome: "Incapacidade",    desc: "limitação nas tarefas" },
  // outros
  avd_esporte:    { nome: "AVD/Esporte",     desc: "uso no dia a dia e no esporte" },
};

const rotulo = (k) =>
  ROTULOS[k] || { nome: k.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase()), desc: "" };

/** Barra de um domínio. Para KOOS maior=melhor (verde); WOMAC maior=pior (vermelho). */
function BarraDominio({ chave, valor, maiorMelhor, max = 100, delta = null, melhorou = null }) {
  const { nome, desc } = rotulo(chave);
  const pct = Math.max(0, Math.min(100, (Number(valor) / max) * 100));
  // cor pela situação clínica, não pelo "encher a barra"
  let cor = "#0e7490";
  if (maiorMelhor) {
    cor = pct >= 75 ? "#059669" : pct >= 50 ? "#d97706" : "#dc2626";
  } else {
    cor = pct <= 25 ? "#059669" : pct <= 50 ? "#d97706" : "#dc2626";
  }
  return (
    <div style={{ marginBottom: 9 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: "#334155" }}>
          {nome}
          {desc && <span style={{ fontWeight: 400, color: "#94a3b8", fontSize: 10.5 }}> · {desc}</span>}
        </span>
        <span style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
          {delta != null && (
            <span style={{ fontSize: 10, fontWeight: 700, color: melhorou ? "#059669" : "#dc2626" }}>
              {delta > 0 ? "+" : ""}{delta}
            </span>
          )}
          <span style={{ fontSize: 13, fontWeight: 800, fontVariantNumeric: "tabular-nums", color: cor }}>
            {valor}
            <span style={{ fontSize: 10, fontWeight: 400, color: "#cbd5e1" }}>/{max}</span>
          </span>
        </span>
      </div>
      <div style={{ height: 7, background: "#eef2f7", borderRadius: 4, marginTop: 4, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: cor, borderRadius: 4, transition: "width .3s" }} />
      </div>
    </div>
  );
}

/**
 * Competências avaliadas de um instrumento, uma por linha, com a nota atual
 * e a comparação com a coleta anterior de cada domínio.
 */
export function Subescalas({ atual, anterior, maiorMelhor }) {
  if (!atual || !Object.keys(atual).length) return null;
  const chaves = Object.keys(atual);
  return (
    <div style={{ borderTop: "1px solid #eef2f7", marginTop: 10, paddingTop: 10 }}>
      <p style={{ fontSize: 11, fontWeight: 700, color: "#64748b", marginBottom: 8, letterSpacing: .3 }}>
        COMPETÊNCIAS AVALIADAS
      </p>
      {chaves.map((k) => {
        const v = Number(atual[k]);
        const ant = anterior?.[k] != null ? Number(anterior[k]) : null;
        const d = ant != null ? Math.round((v - ant) * 10) / 10 : null;
        const melhor = d == null ? null : maiorMelhor ? d > 0 : d < 0;
        return (
          <BarraDominio
            key={k} chave={k} valor={v} maiorMelhor={maiorMelhor}
            delta={d != null && d !== 0 ? d : null} melhorou={melhor}
          />
        );
      })}
    </div>
  );
}

// ------------------------------------------------------------- EVA: régua
const FACES = [
  { v: 0, txt: "Sem dor" },
  { v: 1, txt: "" }, { v: 2, txt: "Dor leve" },
  { v: 3, txt: "" }, { v: 4, txt: "Moderada" },
  { v: 5, txt: "" }, { v: 6, txt: "Forte" },
  { v: 7, txt: "" }, { v: 8, txt: "Muito forte" },
  { v: 9, txt: "" }, { v: 10, txt: "Pior dor" },
];

const corDaDor = (v) =>
  v <= 3 ? "#059669" : v <= 6 ? "#d97706" : "#dc2626";

const faixa = (v) =>
  v === 0 ? "Sem dor"
  : v <= 3 ? "Dor leve — não atrapalha o dia"
  : v <= 6 ? "Dor moderada — atrapalha algumas atividades"
  : v <= 8 ? "Dor forte — limita bastante"
  : "Dor intensa — incapacitante";

/**
 * Régua de dor (EVA 0-10) desenhada, com o valor apontado e a interpretação.
 * Serve para o paciente se orientar ao responder.
 */
export function ReguaDor({ valor, anterior, interativo = false, onChange }) {
  const v = Number(valor);
  if (Number.isNaN(v)) return null;
  const cor = corDaDor(v);
  const pct = (v / 10) * 100;

  return (
    <div style={{ borderTop: "1px solid #eef2f7", marginTop: 10, paddingTop: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
        <p style={{ fontSize: 11, fontWeight: 700, color: "#64748b", letterSpacing: .3 }}>RÉGUA DE DOR (EVA)</p>
        <span style={{ fontSize: 11, color: "#94a3b8" }}>
          {anterior != null && `antes ${anterior} → `}
          <b style={{ color: cor, fontSize: 14 }}>{v}</b>
          <span style={{ fontSize: 10 }}>/10</span>
        </span>
      </div>

      {/* barra com gradiente verde → amarelo → vermelho */}
      <div style={{ position: "relative", height: 26, borderRadius: 6, overflow: "hidden",
        background: "linear-gradient(90deg,#059669 0%,#10b981 22%,#fbbf24 45%,#f59e0b 62%,#ef4444 82%,#b91c1c 100%)" }}>
        {/* marcador */}
        <div style={{
          position: "absolute", left: `calc(${pct}% - 2px)`, top: 0, bottom: 0, width: 4,
          background: "#0f172a", boxShadow: "0 0 0 2px #fff", borderRadius: 2,
        }} />
      </div>

      {/* números da escala */}
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 3 }}>
        {Array.from({ length: 11 }, (_, i) => (
          <span key={i} style={{
            fontSize: 9.5, fontVariantNumeric: "tabular-nums",
            color: i === v ? "#0f172a" : "#cbd5e1",
            fontWeight: i === v ? 800 : 400,
          }}>{i}</span>
        ))}
      </div>

      {interativo && (
        <input type="range" min="0" max="10" step="1" value={v}
          onChange={(e) => onChange?.(Number(e.target.value))}
          style={{ width: "100%", marginTop: 8, accentColor: cor }} />
      )}

      <div style={{
        marginTop: 9, padding: "7px 10px", borderRadius: 7, fontSize: 12,
        background: `${cor}14`, color: cor, fontWeight: 600,
      }}>
        {faixa(v)}
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 9.5, color: "#94a3b8" }}>
        <span>😀 sem dor</span>
        <span>😐 suportável</span>
        <span>😣 insuportável</span>
      </div>
    </div>
  );
}
