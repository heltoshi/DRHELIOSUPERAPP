import React from "react";
import { PROMs } from "../lib/data";
import { QUESTIONNAIRES, byId, allItems, computeScore, MCID_MAP } from "../lib/instrumentos";
import { calcularMaturacao } from "../lib/maturacao";
import { Card, Badge, Button, Empty } from "./ui";
import { CardInstrumento, GraficoDominios, Legenda, NOMES_DOMINIO } from "./Evolucao";
import { EvolucaoPorValencia, EvolucaoItens } from "./EvolucaoValencia";
import { fmtDate } from "../lib/metrics";

const f1 = (v) => (v == null ? "—" : Number(v).toFixed(1).replace(".", ","));

/* ============================================================
   FORMULÁRIO DE PROM — o paciente responde qualquer instrumento
   ============================================================ */
export function PROMInline({ instr, paciente, onFim }) {
  const itens = allItems(instr);
  const [answers, setAnswers] = React.useState({});
  const [salvando, setSalvando] = React.useState(false);
  const [erro, setErro] = React.useState("");
  const [pronto, setPronto] = React.useState(null);

  const respondidos = itens.filter((i) => answers[i.id] !== undefined).length;
  const pct = Math.round((respondidos / itens.length) * 100);
  const score = respondidos === itens.length ? computeScore(instr, answers) : null;

  const salvar = async () => {
    setSalvando(true); setErro("");
    try {
      await PROMs.create({
        patient_id: paciente.id, questionnaire: instr.id, answers,
        total_score: score.total, subscale_scores: score.subscales || null,
      });
      setPronto(score);
      setTimeout(() => onFim?.(), 1500);
    } catch (e) { setErro(e.message); }
    setSalvando(false);
  };

  if (pronto) {
    return (
      <Card>
        <div className="alert-box alert-green" style={{ justifyContent: "center", padding: 20, fontSize: 14 }}>
          ✓ {instr.short} registrado — {Number(pronto.total).toFixed(1)} de {instr.scaleMax}
        </div>
      </Card>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, color: "#94a3b8", marginBottom: 6 }}>
          <span>{respondidos} de {itens.length}</span><span>{pct}%</span>
        </div>
        <div className="progress-track"><div className="progress-fill" style={{ width: `${pct}%` }} /></div>
      </div>
      {instr.sections.map((sec) => (
        <div key={sec.title}>
          <p style={{ fontSize: 11, fontWeight: 800, letterSpacing: ".06em", textTransform: "uppercase", color: "#0e7490", margin: "4px 0 8px" }}>
            {sec.title}
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
            {sec.items.map((it) => (
              <div key={it.id} style={{ background: "#fff", border: "1px solid #e8eef5", borderRadius: 11, padding: "11px 12px" }}>
                <p style={{ fontSize: 12.5, lineHeight: 1.4, margin: "0 0 8px", color: "#1e293b" }}>{it.label}</p>
                {it.type === "choice" || it.options ? (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                    {it.options.map((o, i) => (
                      <button key={i} onClick={() => setAnswers((a) => ({ ...a, [it.id]: i }))}
                        className={answers[it.id] === i ? "opt on" : "opt"}>{o.label}</button>
                    ))}
                  </div>
                ) : it.type === "scale" ? (
                  <div className="scale-row">
                    {Array.from({ length: (it.scaleMax ?? 10) + 1 }, (_, k) => (
                      <button key={k} className={answers[it.id] === k ? "on" : ""} onClick={() => setAnswers((a) => ({ ...a, [it.id]: k }))}>{k}</button>
                    ))}
                  </div>
                ) : (
                  <textarea value={answers[it.id] || ""} onChange={(e) => setAnswers((a) => ({ ...a, [it.id]: e.target.value }))} />
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
      {erro && <div className="alert-box alert-red">{erro}</div>}
      <Button variant="primary" onClick={salvar} disabled={salvando || respondidos < itens.length} style={{ padding: 13 }}>
        {salvando ? "Enviando…" : respondidos < itens.length ? `Faltam ${itens.length - respondidos}` : "Enviar respostas"}
      </Button>
    </div>
  );
}

/* ============================================================
   ORTHOFLOW — evolução por competência + todos os instrumentos
   ============================================================ */
export function PainelOrthoflow({ paciente, coletas, recarregar }) {
  const [aberto, setAberto] = React.useState(null);
  const [respondendo, setRespondendo] = React.useState(null);
  const [aba, setAba] = React.useState("evolucao");

  const porInstr = React.useMemo(() => {
    const m = {};
    for (const c of coletas) (m[c.questionnaire] ||= []).push(c);
    return m;
  }, [coletas]);

  const comDados = Object.keys(porInstr).filter((k) => byId(k));
  const selecionado = aberto ? byId(aberto) : null;
  const serie = selecionado ? [...porInstr[selecionado.id] || []].sort((a, b) => String(a.submitted_at).localeCompare(String(b.submitted_at))) : [];
  const dominios = React.useMemo(() => {
    const out = {};
    for (const c of serie) {
      if (!c.subscale_scores) continue;
      for (const [k, v] of Object.entries(c.subscale_scores)) (out[k] ||= []).push(Number(v));
    }
    return out;
  }, [serie]);

  if (respondendo) {
    return (
      <>
        <button className="link-back" onClick={() => setRespondendo(null)}>← voltar</button>
        <PROMInline instr={respondendo} paciente={paciente} onFim={() => {
          setRespondendo(null);
          setAba("evolucao");
          recarregar?.();
        }} />
      </>
    );
  }

  if (aberto) {
    const ult = serie[serie.length - 1];
    return (
      <>
        <button className="link-back" onClick={() => setAberto(null)}>← voltar</button>
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: -30 }}>
          <Button size="sm" variant="teal" onClick={() => { const q = selecionado; setAberto(null); setRespondendo(q); }}>Responder</Button>
        </div>
        <h2 style={{ fontSize: 17, margin: "0 0 2px" }}>{selecionado.name}</h2>
        <p style={{ fontSize: 11.5, color: "#94a3b8", marginTop: 0 }}>{selecionado.description}</p>

        {serie.length > 1 && (
          <Card>
            <p style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 10 }}>
              Evolução por valência
            </p>
            <EvolucaoPorValencia instrumento={selecionado} coletas={serie} />
          </Card>
        )}

        {serie.length > 1 && (
          <Card>
            <p style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 2 }}>Evolução item a item</p>
            <p style={{ fontSize: 10.5, color: "#94a3b8", margin: "0 0 10px", lineHeight: 1.45 }}>
              Cada pergunta do questionário, com a própria curva. Toque para abrir o gráfico.
            </p>
            <EvolucaoItens
              instrumento={selecionado}
              coletas={serie}
              itens={allItems(selecionado)}
            />
          </Card>
        )}


        <Card>
          <p style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 9 }}>Histórico</p>
          <table className="table">
            <thead><tr><th>Data</th><th className="num">Total</th><th className="num">Variação</th></tr></thead>
            <tbody>
              {[...serie].reverse().map((c, i) => {
                const ant = [...serie].reverse()[i + 1];
                const d = ant ? Number(c.total_score) - Number(ant.total_score) : null;
                return (
                  <tr key={c.id}>
                    <td>{fmtDate(c.submitted_at)}</td>
                    <td className="num" style={{ fontWeight: 700 }}>{f1(c.total_score)}</td>
                    <td className="num" style={{ color: d == null ? "#cbd5e1" : d > 0 ? "#059669" : "#dc2626" }}>
                      {d == null ? "—" : `${d > 0 ? "+" : ""}${f1(d)}`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {ult?.subscale_scores && (
            <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 7 }}>
              {Object.entries(ult.subscale_scores).map(([k, v]) => (
                <div key={k}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#64748b" }}>
                    <span>{NOMES_DOMINIO[k] || k}</span><b style={{ color: "#0f172a" }}>{f1(v)}</b>
                  </div>
                  <div className="progress-track" style={{ marginTop: 3 }}>
                    <div className="progress-fill" style={{ width: `${v}%`, background: "#0e7490" }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </>
    );
  }

  return (
    <>
      <div className="seg">
        <button className={aba === "evolucao" ? "on" : ""} onClick={() => setAba("evolucao")}>Evolução</button>
        <button className={aba === "responder" ? "on" : ""} onClick={() => setAba("responder")}>Responder</button>
      </div>

      {aba === "evolucao" && (
        <>
          {comDados.length === 0 ? (
            <Card><Empty title="Nenhum questionário respondido" hint="Comece pela aba Responder." /></Card>
          ) : (
            <>
              <p style={{ fontSize: 12, color: "#94a3b8", margin: "0 0 2px" }}>
                {comDados.length} instrumentos com resultado · toque para ver a evolução por domínio
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(158px,1fr))", gap: 10 }}>
                {comDados.map((k) => (
                  <CardInstrumento key={k} instr={byId(k)} coletas={porInstr[k]} onAbrir={() => setAberto(k)} />
                ))}
              </div>
            </>
          )}
        </>
      )}

      {aba === "responder" && (
        <>
          <p style={{ fontSize: 12, color: "#94a3b8", margin: "0 0 2px" }}>
            Todos os questionários disponíveis. Responda os que se aplicam ao seu caso.
          </p>
          {QUESTIONNAIRES.map((q) => {
            const rs = porInstr[q.id] || [];
            const ult = [...rs].sort((a, b) => String(b.submitted_at).localeCompare(String(a.submitted_at)))[0];
            return (
              <button key={q.id} className="quick" onClick={() => setRespondendo(q)}>
                <span className="q-ico" style={{ background: `${q.color}18`, color: q.color, fontSize: 11, fontWeight: 800 }}>
                  {(q.short || q.id).slice(0, 4)}
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span className="q-t" style={{ display: "block" }}>{q.short || q.name}</span>
                  <span className="q-s">
                    {ult ? `Último: ${f1(ult.total_score)} · ${fmtDate(ult.submitted_at)}` : "Nunca respondido"}
                  </span>
                </span>
                <span style={{ color: "#cbd5e1", fontSize: 17 }}>›</span>
              </button>
            );
          })}
        </>
      )}
    </>
  );
}

/* ============================================================
   MATURAÇÃO — painel completo, como o app original
   ============================================================ */
function Linha({ rotulo, valor, unidade, destaque, nota }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10, padding: "7px 0", borderBottom: "1px solid #f1f5f9" }}>
      <div style={{ minWidth: 0 }}>
        <span style={{ fontSize: 11.5, color: "#64748b" }}>{rotulo}</span>
        {nota && <p style={{ fontSize: 9.5, color: "#b6c2d1", margin: "1px 0 0" }}>{nota}</p>}
      </div>
      <span style={{ fontSize: destaque ? 15 : 12.5, fontWeight: destaque ? 800 : 700, color: "#0f172a", whiteSpace: "nowrap" }}>
        {valor}{unidade ? <span style={{ fontSize: 10, fontWeight: 400, color: "#94a3b8" }}> {unidade}</span> : ""}
      </span>
    </div>
  );
}

const CORES_BAND = {
  "Pré-estirão": "#64748b", "Início do estirão": "#d97706",
  "Peripuberal": "#0e7490", "Pós-estirão": "#059669",
};

export function PainelMaturacao({ paciente, visitas, aoRegistrar }) {
  const ord = [...(visitas || [])].sort((a, b) => String(a.data_avaliacao || a.date).localeCompare(String(b.data_avaliacao || b.date)));
  const ult = ord[ord.length - 1];

  // recomputa o painel completo a partir do que está gravado
  const r = React.useMemo(() => {
    if (!ult) return null;
    try {
      return calcularMaturacao({
        name: paciente?.name || "",
        sex: ult.sexo || (paciente?.gender === "feminino" ? "female" : "male"),
        birthDate: paciente?.dob || "2011-06-22",
        evalDate: ult.data_avaliacao || ult.date,
        stature: Number(ult.estatura), sittingHeight: Number(ult.sentada),
        weight: Number(ult.peso), fatherHeight: Number(ult.pai), motherHeight: Number(ult.mae),
        boneAge: ult.idade_ossea, boneAgeMethod: "greulich", bpSource: "auto",
        visitaAnterior: ord.length > 1 ? {
          date: ord[ord.length - 2].data_avaliacao || ord[ord.length - 2].date,
          stature: Number(ord[ord.length - 2].estatura),
          mirwaldOffset: Number(ord[ord.length - 2].mirwald_offset),
          consensusPct: Number(ord[ord.length - 2].consenso_pct),
          mirwaldPHV: Number(ord[ord.length - 2].mirwald_phv),
        } : null,
      });
    } catch { return null; }
  }, [ult?.id, paciente?.id]);

  if (!ult) {
    return (
      <Card>
        <Empty title="Sem avaliação de maturação" hint="O registro é feito pelo médico na consulta; você verá o resultado aqui." />
      </Card>
    );
  }

  const imc = utlSafe(() => Number(ult.peso) / Math.pow(Number(ult.estatura) / 100, 2));

  return (
    <>
      {aoRegistrar && (
        <button className="btn btn-teal" onClick={aoRegistrar} style={{ padding: 12 }}>＋ Nova avaliação</button>
      )}

      {/* resumo no topo */}
      <Card style={{ background: "linear-gradient(150deg,#0b2545,#0e7490)", border: 0 }}>
        <p style={{ fontSize: 10.5, letterSpacing: ".09em", textTransform: "uppercase", color: "#7dd3fc", margin: 0, fontWeight: 800 }}>
          Estatura adulta prevista
        </p>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 4 }}>
          <span style={{ fontSize: 34, fontWeight: 800, color: "#fff", letterSpacing: "-0.03em" }}>{f1(r?.consensusPAH ?? ult.consenso_pah)}</span>
          <span style={{ fontSize: 13, color: "#7dd3fc" }}>cm · consenso</span>
        </div>
        <p style={{ fontSize: 11.5, color: "#bae6fd", margin: "3px 0 0" }}>
          Intervalo {f1(r?.consensusMin)}–{f1(r?.consensusMax)} cm ·
          {" "}alvo parental {f1(r?.targetMin)}–{f1(r?.targetMax)} cm
        </p>
        <div style={{ display: "flex", gap: 7, marginTop: 11, flexWrap: "wrap" }}>
          <span style={{ background: `${CORES_BAND[r?.bandingPct]}33`, color: "#fff", fontSize: 10.5, fontWeight: 700, padding: "4px 9px", borderRadius: 20, border: `1px solid ${CORES_BAND[r?.bandingPct]}88` }}>
            {r?.bandingPct}
          </span>
          <span style={{ background: "#ffffff1a", color: "#e0f2fe", fontSize: 10.5, padding: "4px 9px", borderRadius: 20 }}>
            {f1(r?.consensusPct ?? ult.consenso_pct)}% da estatura adulta
          </span>
        </div>
      </Card>

      {/* gráfico da trajetória */}
      {ord.length > 1 && (
        <Card>
          <p style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 8 }}>Estatura ao longo das avaliações</p>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 96 }}>
            {ord.map((v, i) => {
              const min = Math.min(...ord.map((x) => Number(x.estatura))) - 2;
              const max = Math.max(...ord.map((x) => Number(x.consenso_pah || x.estatura))) + 1;
              const h = ((Number(v.estatura) - min) / (max - min)) * 88;
              return (
                <div key={v.id} style={{ flex: 1, textAlign: "center" }}>
                  <div style={{ height: `${Math.max(6, h)}px`, background: i === ord.length - 1 ? "#0e7490" : "#bfdbfe", borderRadius: "4px 4px 0 0" }} />
                  <p style={{ fontSize: 8.5, color: "#94a3b8", margin: "3px 0 0" }}>{String(v.data_avaliacao || v.date).slice(5, 7)}/{String(v.data_avaliacao || v.date).slice(2, 4)}</p>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* todos os parâmetros */}
      <Card>
        <p style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 4 }}>Antropometria · {fmtDate(ult.data_avaliacao || ult.date)}</p>
        <Linha rotulo="Idade cronológica" valor={f1(r?.ageDecimal)} unidade="anos" />
        <Linha rotulo="Estatura" valor={f1(ult.estatura)} unidade="cm" destaque />
        <Linha rotulo="Estatura sentada" valor={f1(ult.sentada)} unidade="cm" />
        <Linha rotulo="Comprimento de membro inferior" valor={f1(r?.legLength)} unidade="cm" />
        <Linha rotulo="Razão sentada/estatura" valor={f1(r?.sittingRatio)} unidade="%" />
        <Linha rotulo="Peso" valor={f1(ult.peso)} unidade="kg" />
        <Linha rotulo="IMC" valor={f1(imc)} unidade="kg/m²" />
        <Linha rotulo="Idade óssea" valor={f1(ult.idade_ossea)} unidade="anos" nota="Greulich & Pyle" />
      </Card>

      <Card>
        <p style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 4 }}>Maturação biológica — Mirwald</p>
        <Linha rotulo="Offset de maturação" valor={f1(r?.mirwaldOffset)} unidade="anos" destaque
          nota="positivo = adiantado em relação à idade" />
        <Linha rotulo="Idade no pico (PHV)" valor={f1(r?.mirwaldPHV)} unidade="anos" />
        <Linha rotulo="Bio-banding por offset" valor={r?.bandingMirwald} />
        <Linha rotulo="Dentro da faixa de validade" valor={r?.mirwaldValid ? "Sim" : "Não"} nota="M 12–16 · F 11–15 anos" />
      </Card>

      <Card>
        <p style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 4 }}>Mirwald — detalhe do cálculo</p>
        <Linha rotulo="Maturity offset (anos)" valor={(r?.mirwaldOffset >= 0 ? "+" : "") + f1(r?.mirwaldOffset)} unidade="anos" />
        <Linha rotulo="Idade cronológica" valor={f1(r?.ageDecimal)} unidade="anos" />
        <Linha rotulo="Idade estimada no PHV" valor={f1(r?.mirwaldPHV)} unidade="anos" />
        <Linha rotulo="Comprimento de membro inferior" valor={f1(r?.legLength)} unidade="cm" />
        <Linha rotulo="Estatura sentada" valor={f1(r?.sittingHeight)} unidade="cm" />
        <Linha rotulo="Razão sentada/estatura" valor={f1(r?.sittingRatio)} unidade="%" />
        <Linha rotulo="Offset negativo" valor={r?.mirwaldOffset < 0 ? "pré-PHV (ainda vai crescer)" : "pós-PHV"} />
      </Card>

      <Card>
        <p style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 4 }}>Moore — PHV por medidas</p>
        {(r?.mooreResults || []).map((m) => (
          <Linha key={m.label} rotulo={m.label} valor={f1(m.phv)} unidade="anos" />
        ))}
      </Card>

      <Card>
        <p style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 4 }}>Predição de estatura adulta</p>
        <Linha rotulo="Khamis-Roche" valor={f1(ult.khamis_pah)} unidade="cm" destaque />
        <Linha rotulo="% da estatura adulta (Khamis)" valor={f1(ult.khamis_pct)} unidade="%" />
        <Linha rotulo="Bayley-Pinneau" valor={ult.bp_pah == null ? "—" : f1(ult.bp_pah)} unidade="cm" nota="usa idade óssea" />
        <Linha rotulo="Consenso (média)" valor={f1(ult.consenso_pah)} unidade="cm" destaque />
        <Linha rotulo="Amplitude do consenso" valor={`${f1(r?.consensusMin)}–${f1(r?.consensusMax)}`} unidade="cm" />
        <Linha rotulo="Alvo parental (Tanner)" valor={`${f1(r?.targetMin)}–${f1(r?.targetMax)}`} unidade="cm" />
        <Linha rotulo="Erro do Khamis (±1 DP)" valor={`±${f1(r?.khamisErr50)}`} unidade="cm" nota="50% das previsões ficam nesta faixa" />
        <Linha rotulo="Erro do Khamis (±1,64 DP)" valor={`±${f1(r?.khamisErr90)}`} unidade="cm" nota="90% das previsões ficam nesta faixa" />
      </Card>

      {r?.diffPrev && (
        <Card>
          <p style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 4 }}>Desde a avaliação anterior</p>
          <Linha rotulo="Intervalo" valor={r.diffPrev.days} unidade="dias" />
          <Linha rotulo="Ganho de estatura" valor={(r.diffPrev.stature > 0 ? "+" : "") + f1(r.diffPrev.stature)} unidade="cm" destaque />
          <Linha rotulo="Variação do % de estatura adulta" valor={(r.diffPrev.pctPAH > 0 ? "+" : "") + f1(r.diffPrev.pctPAH)} unidade="%" />
          <Linha rotulo="Variação do offset" valor={(r.diffPrev.mirwaldOffset > 0 ? "+" : "") + f1(r.diffPrev.mirwaldOffset)} unidade="anos" />
        </Card>
      )}

      <Card>
        <p style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 4 }}>Próximo passo</p>
        <Linha rotulo="Reavaliação recomendada" valor={fmtDate(r?.nextEvalDate || ult.data_avaliacao)}
          nota={r?.isPeripubertal ? "fase peripuberal: a cada 3 meses" : "a cada 6 meses"} />
        <Linha rotulo="Faixa de maturação" valor={r?.bandingPct} />
      </Card>

      <p style={{ fontSize: 10.5, color: "#94a3b8", lineHeight: 1.5, padding: "0 4px" }}>
        Estimativas populacionais servem para acompanhar a curva individual — não são medidas
        definitivas. A interpretação final é do seu médico.
      </p>
    </>
  );
}

function utlSafe(f) { try { return f(); } catch { return null; } }
