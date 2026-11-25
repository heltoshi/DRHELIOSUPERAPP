import React from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Patients, PROMs, protocolWeek } from "../lib/data";
import { byId, allItems, computeScore, interpretChange, MCID_MAP } from "../lib/instrumentos";
import { Card, CardTitle, Badge, Button, Empty } from "../components/ui";

export default function PROMForm() {
  const { patientId, instrumento } = useParams();
  const navigate = useNavigate();
  const paciente = Patients.get(patientId);
  const q = byId(instrumento);

  const [answers, setAnswers] = React.useState({});
  const [salvando, setSalvando] = React.useState(false);
  const [erro, setErro] = React.useState("");
  const [pronto, setPronto] = React.useState(null);

  if (!paciente || !q) {
    return <div className="content"><Card><Empty title="Instrumento ou paciente não encontrado" /></Card></div>;
  }

  const itens = allItems(q);
  const respondidos = itens.filter((it) => answers[it.id] !== undefined).length;
  const faltam = itens.length - respondidos;
  const pct = Math.round((respondidos / itens.length) * 100);
  const score = faltam === 0 ? computeScore(q, answers) : null;

  const set = (id, val) => setAnswers((a) => ({ ...a, [id]: val }));

  const ultima = PROMs.list(patientId).find((s) => s.questionnaire === q.id);
  const mudanca = score && ultima?.total_score != null
    ? interpretChange(q.id, Number(ultima.total_score), Number(score.total))
    : null;

  const salvar = async () => {
    if (faltam > 0) return setErro(`Ainda faltam ${faltam} ${faltam > 1 ? "itens" : "item"}.`);
    setSalvando(true);
    setErro("");
    try {
      await PROMs.create({
        patient_id: patientId,
        questionnaire: q.id,
        answers,
        total_score: score.total,
        subscale_scores: score.subscales || null,
        protocol_week: protocolWeek(paciente.protocol_start) ?? null,
      });
      setPronto({ total: score.total, mudanca });
    } catch (e) {
      setErro(e.message);
    }
    setSalvando(false);
  };

  if (pronto) {
    return (
      <div className="content">
        <Card>
          <CardTitle sub={`${paciente.name} · ${q.short || q.name}`}>Coleta registrada</CardTitle>
          <div style={{ display: "flex", alignItems: "baseline", gap: 12, margin: "14px 0" }}>
            <span style={{ fontSize: 40, fontWeight: 800, letterSpacing: "-0.02em" }}>{pronto.total}</span>
            <span style={{ color: "#94a3b8", fontSize: 13 }}>de {q.scaleMax ?? "—"}</span>
            {pronto.mudanca && (
              <Badge tone={pronto.mudanca.tone === "good" ? "green" : pronto.mudanca.tone === "bad" ? "red" : "gray"}>
                {pronto.mudanca.text}
              </Badge>
            )}
          </div>
          {pronto.mudanca && (
            <p style={{ fontSize: 12.5, color: "#64748b", marginBottom: 14 }}>
              Comparado à coleta anterior. Mudança mínima clinicamente importante deste instrumento: {MCID_MAP[q.id] ?? "—"} pontos.
            </p>
          )}
          <div style={{ display: "flex", gap: 8 }}>
            <Button variant="primary" onClick={() => navigate(`/orthoflow/paciente/${patientId}`)}>Ver a ficha</Button>
            <Button variant="outline" onClick={() => { setAnswers({}); setPronto(null); }}>Aplicar de novo</Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <>
      <div className="topbar">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button className="icon-btn" onClick={() => navigate(`/orthoflow/paciente/${patientId}`)} style={{ fontSize: 17 }}>←</button>
          <div>
            <h1 style={{ fontSize: 18 }}>{q.short || q.name}</h1>
            <p>{paciente.name} · {itens.length} itens{ultima ? " · já aplicado antes" : " · primeira aplicação"}</p>
          </div>
        </div>
        <Button variant="primary" size="sm" onClick={salvar} disabled={salvando || faltam > 0}>
          {salvando ? "Salvando…" : faltam > 0 ? `Faltam ${faltam}` : "Salvar coleta"}
        </Button>
      </div>

      <div className="content">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div className="progress-track" style={{ flex: 1 }}>
            <div className="progress-fill" style={{ width: `${pct}%` }} />
          </div>
          <span style={{ fontSize: 12.5, color: "#64748b", fontVariantNumeric: "tabular-nums" }}>{respondidos}/{itens.length}</span>
        </div>

        {q.description && (
          <div className="alert-box" style={{ background: "#f8fafc", color: "#475569", border: "1px solid #e6ebf1", fontSize: 12.5, fontWeight: 400 }}>
            {q.description}
          </div>
        )}

        {q.sections.map((sec, si) => (
          <Card key={si}>
            <CardTitle sub={`${sec.items.length} ${sec.items.length > 1 ? "itens" : "item"}`}>{sec.title || "Questões"}</CardTitle>
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              {sec.items.map((it) => (
                <div key={it.id}>
                  <p style={{ fontSize: 13.5, fontWeight: 550, marginBottom: 8, lineHeight: 1.45 }}>{it.label}</p>

                  {it.type === "choice" ? (
                    <div className="opt-list">
                      {it.options.map((o, oi) => (
                        <button key={oi}
                          className={answers[it.id] === oi ? "on" : ""}
                          onClick={() => set(it.id, oi)}>
                          {o.label}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div>
                      <div className="scale-row">
                        {Array.from({ length: (it.max - it.min) + 1 }, (_, k) => it.min + k).map((n) => (
                          <button key={n} className={String(answers[it.id]) === String(n) ? "on" : ""} onClick={() => set(it.id, n)}>{n}</button>
                        ))}
                      </div>
                      {(it.minLabel || it.maxLabel) && (
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10.5, color: "#94a3b8", marginTop: 4 }}>
                          <span>{it.minLabel}</span><span>{it.maxLabel}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Card>
        ))}

        {erro && <div className="alert-box alert-red">{erro}</div>}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <Button variant="outline" onClick={() => navigate(`/orthoflow/paciente/${patientId}`)}>Cancelar</Button>
          <Button variant="primary" onClick={salvar} disabled={salvando || faltam > 0}>
            {faltam > 0 ? `Faltam ${faltam} ${faltam > 1 ? "itens" : "item"}` : "Salvar coleta"}
          </Button>
        </div>
      </div>
    </>
  );
}
