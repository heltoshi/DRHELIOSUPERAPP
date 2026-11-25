import React from "react";
import { fmtDate } from "../lib/metrics";
import { scoreResponse } from "../lib/scores";
import { Badge } from "./ui";

/**
 * Cronologia das coletas de questionário, com as respostas item a item.
 * O objetivo é o médico abrir no perfil do atleta e ver, em ordem, o que ele
 * respondeu em cada aplicação — e onde o escore saiu da faixa.
 */
export function CronologiaRespostas({ questionnaire, responses }) {
  const [aberto, setAberto] = React.useState(null);

  const linhas = [...responses]
    .sort((a, b) => String(b.date).localeCompare(String(a.date)))
    .map((r) => ({ r, s: scoreResponse(questionnaire, r.answers) }));

  if (!linhas.length) {
    return <p style={{ fontSize: 13, color: "#94a3b8" }}>Nenhuma coleta deste instrumento.</p>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {linhas.map(({ r, s }, idx) => {
        const tone = s?.severity?.color || "gray";
        const prev = linhas[idx + 1]?.s;
        const delta = s && prev ? s.total - prev.total : null;
        const melhorou = delta != null && (s.higherIsBetter ? delta > 0 : delta < 0);
        const abertoAqui = aberto === r.id;

        return (
          <div key={r.id} style={{ border: "1px solid #e8eef5", borderRadius: 11, overflow: "hidden" }}>
            <button
              onClick={() => setAberto(abertoAqui ? null : r.id)}
              style={{
                width: "100%", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
                padding: "11px 13px", background: abertoAqui ? "#f8fafc" : "#fff",
                border: 0, cursor: "pointer", textAlign: "left", font: "inherit",
              }}
            >
              <span style={{ fontSize: 12, color: "#64748b", minWidth: 76, fontVariantNumeric: "tabular-nums" }}>
                {fmtDate(r.date, "long")}
              </span>
              <Badge tone={tone}>{s?.severity?.label || "—"}</Badge>
              <span style={{ fontSize: 17, fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>
                {s?.total ?? "—"}<span style={{ fontSize: 11, fontWeight: 400, color: "#94a3b8" }}>/{s?.maxScore ?? "—"}</span>
              </span>
              {delta != null && delta !== 0 && (
                <span style={{ fontSize: 11.5, fontWeight: 700, color: melhorou ? "#059669" : "#dc2626" }}>
                  {delta > 0 ? "+" : ""}{delta} vs anterior
                </span>
              )}
              <span style={{ marginLeft: "auto", fontSize: 11.5, color: "#0e7490", fontWeight: 600 }}>
                {abertoAqui ? "ocultar respostas ▲" : "ver respostas ▼"}
              </span>
            </button>

            {abertoAqui && (
              <div style={{ padding: "4px 13px 13px", borderTop: "1px solid #eef2f7" }}>
                {(r.answers || []).map((a, i) => {
                  const q = (questionnaire.questions || [])[a.i ?? i];
                  const pergunta = a.question_text || q?.text || `Pergunta ${i + 1}`;
                  const resposta = a.answer ?? a.a ?? "";
                  const alerta = /total|intensa|grave|imposs|não consegui|nao consegui|sever|pior/i.test(resposta);
                  return (
                    <div key={i} style={{ padding: "8px 0", borderBottom: i < r.answers.length - 1 ? "1px dashed #eef2f7" : 0 }}>
                      <p style={{ fontSize: 11.5, color: "#94a3b8", marginBottom: 2 }}>{i + 1}. {pergunta}</p>
                      <p style={{ fontSize: 13, fontWeight: 600, color: alerta ? "#b91c1c" : "#0f172a" }}>{resposta || <span style={{ color: "#cbd5e1" }}>sem resposta</span>}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
