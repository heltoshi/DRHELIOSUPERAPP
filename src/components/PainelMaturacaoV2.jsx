import React from "react";
import { calcularMaturacao } from "../lib/maturacao";
import { Card, Badge, Button, Empty } from "./ui";
import { fmtDate } from "../lib/metrics";

const f1 = (v) => (v == null || !Number.isFinite(Number(v)) ? "—" : Number(v).toFixed(1).replace(".", ","));
const f2 = (v) => (v == null || !Number.isFinite(Number(v)) ? "—" : Number(v).toFixed(2).replace(".", ","));
const sinal = (v, casas = 1) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  return (n >= 0 ? "+" : "") + n.toFixed(casas).replace(".", ",");
};

const COR_BANDING = {
  "Pré-estirão": "#64748b", "Início do estirão": "#d97706",
  "Peripuberal": "#0e7490", "Pós-estirão": "#059669",
};

/** Cartão numerado, no formato do app de maturação original. */
function ResCard({ n, titulo, valor, unidade, sub, children, destaque }) {
  return (
    <div className={`res-card${destaque ? " destaque" : ""}`}>
      <span className="res-num">{String(n).padStart(2, "0")}</span>
      <h3>{titulo}</h3>
      <div className="res-valor">
        {valor}<span className="res-un">{unidade}</span>
      </div>
      {sub && <div className="res-sub">{sub}</div>}
      {children}
    </div>
  );
}

/**
 * PAINEL DE MATURAÇÃO — replica os 11 cartões de resultado do app
 * "Predição de Estatura & Maturação" (CEMEP Care), na mesma ordem e com os
 * mesmos campos, inclusive os que o app não mostrava juntos.
 */
export default function PainelMaturacao({ paciente, visitas, aoRegistrar }) {
  const ord = React.useMemo(
    () => [...(visitas || [])].sort((a, b) =>
      String(a.data_avaliacao || a.date).localeCompare(String(b.data_avaliacao || b.date))),
    [visitas],
  );
  const ult = ord[ord.length - 1];
  const ant = ord[ord.length - 2];

  const r = React.useMemo(() => {
    if (!ult) return null;
    try {
      return calcularMaturacao({
        name: paciente?.name || "",
        sex: ult.sexo || (paciente?.gender === "Feminino" ? "female" : "male"),
        birthDate: paciente?.dob || "2011-06-22",
        evalDate: ult.data_avaliacao || ult.date,
        stature: Number(ult.estatura), sittingHeight: Number(ult.sentada),
        weight: Number(ult.peso), fatherHeight: Number(ult.pai), motherHeight: Number(ult.mae),
        boneAge: ult.idade_ossea, boneAgeMethod: "greulich", bpSource: "auto",
        visitaAnterior: ant ? {
          date: ant.data_avaliacao || ant.date,
          stature: Number(ant.estatura),
          mirwaldOffset: Number(ant.mirwald_offset),
          consensusPct: Number(ant.consenso_pct),
          mirwaldPHV: Number(ant.mirwald_phv),
        } : null,
      });
    } catch { return null; }
  }, [ult?.id, paciente?.id, ant?.id]);

  if (!ult) {
    return (
      <Card>
        <Empty title="Sem avaliação de maturação" hint="O registro é feito na consulta; o painel completo aparece aqui." />
      </Card>
    );
  }

  const imc = Number(ult.peso) / Math.pow(Number(ult.estatura) / 100, 2);
  const excluir = (dias) => {
    const d = new Date(ult.data_avaliacao || ult.date);
    d.setDate(d.getDate() - dias);
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
  };

  return (
    <>
      {aoRegistrar && (
        <button className="btn btn-teal" onClick={aoRegistrar} style={{ padding: 12 }}>＋ Nova avaliação</button>
      )}

      {/* resumo de capa */}
      <div className="mat-capa">
        <div>
          <p className="mc-kicker">Estatura adulta prevista · consenso</p>
          <div className="mc-val">
            {f1(r?.consensusPAH ?? ult.consenso_pah)}<span>cm</span>
          </div>
          <p className="mc-sub">
            Faixa {f1(r?.consensusMin)}–{f1(r?.consensusMax)} cm · alvo parental {f1(r?.targetMin)}–{f1(r?.targetMax)} cm
          </p>
        </div>
        <div className="mc-right">
          <div className="mc-gauge">
            <svg viewBox="0 0 100 56" width="118">
              <path d="M6 52 A44 44 0 0 1 94 52" fill="none" stroke="#1e4a6b" strokeWidth="9" strokeLinecap="round" />
              <path d="M6 52 A44 44 0 0 1 94 52" fill="none" stroke="#38bdf8" strokeWidth="9" strokeLinecap="round"
                strokeDasharray="138" strokeDashoffset={138 - (138 * (r?.consensusPct ?? ult.consenso_pct)) / 100} />
              <text x="50" y="46" textAnchor="middle" fontSize="19" fontWeight="800" fill="#fff">
                {f1(r?.consensusPct ?? ult.consenso_pct)}%
              </text>
            </svg>
            <p className="mc-gauge-lbl">da estatura adulta</p>
          </div>
          <span className="mc-band" style={{ background: `${COR_BANDING[r?.bandingPct]}30`, borderColor: `${COR_BANDING[r?.bandingPct]}90` }}>
            {r?.bandingPct}
          </span>
        </div>
      </div>

      {/* 01 */}
      <ResCard n={1} titulo="Idade decimal e segmentos" valor={f1(r?.ageDecimal)} unidade="anos"
        sub={`Membro inferior ${f1(r?.legLength)} cm · razão sentada/estatura ${f1(r?.sittingRatio)}%`}>
        <div className="res-grid2">
          <div><span>Estatura</span><b>{f1(ult.estatura)} cm</b></div>
          <div><span>Sentada</span><b>{f1(ult.sentada)} cm</b></div>
          <div><span>Peso</span><b>{f1(ult.peso)} kg</b></div>
          <div><span>IMC</span><b>{f1(imc)} kg/m²</b></div>
          <div><span>Idade óssea</span><b>{f1(ult.idade_ossea)} a</b></div>
          <div><span>Avaliação</span><b>{fmtDate(ult.data_avaliacao || ult.date)}</b></div>
        </div>
      </ResCard>

      {/* 02 */}
      <ResCard n={2} titulo="Estatura alvo parental (Tanner)" valor={f1(r?.midParental)} unidade="cm"
        sub={`Faixa alvo ±8,5 cm: ${f1(r?.targetMin)} a ${f1(r?.targetMax)} cm`}>
        <p className="res-nota">
          Referência genética: pai {f1(ult.pai)} cm e mãe {f1(ult.mae)} cm.
          A previsão dentro desta faixa é considerada compatível com a família.
        </p>
        <div className="alvo-barra">
          <span style={{ left: "0%" }}>{f1(r?.targetMin)}</span>
          <span style={{ left: "100%" }}>{f1(r?.targetMax)}</span>
          <i style={{ left: `${Math.max(2, Math.min(98, ((Number(ult.consenso_pah) - Number(r?.targetMin)) / (Number(r?.targetMax) - Number(r?.targetMin))) * 100))}%` }} />
        </div>
        <p className="res-nota centro">a previsão de {f1(ult.consenso_pah)} cm cai dentro da faixa familiar</p>
      </ResCard>

      {/* 03 */}
      <ResCard n={3} titulo="Maturity offset (Mirwald 2002)" valor={sinal(r?.mirwaldOffset, 2)} unidade="anos"
        sub={`Idade estimada no PHV: ${f1(r?.mirwaldPHV)} anos`}>
        <div className="escala-offset">
          <div className="eo-trilha">
            <div className="eo-zona" style={{ left: "0%", width: "40%" }} />
            <div className="eo-zona meio" style={{ left: "40%", width: "20%" }} />
            <div className="eo-zona" style={{ left: "60%", width: "40%" }} />
            <i style={{ left: `${Math.max(2, Math.min(98, ((Number(r?.mirwaldOffset) + 3) / 6) * 100))}%` }} />
          </div>
          <div className="eo-legenda">
            <span>−3 (tardio)</span><span>0 (no pico)</span><span>+3 (precoce)</span>
          </div>
        </div>
        <p className="res-nota">
          {r?.mirwaldOffset < -1 ? "Ainda não chegou ao pico de velocidade — há crescimento pela frente."
            : r?.mirwaldOffset > 1 ? "Já passou do pico de velocidade de crescimento."
              : "Está na janela peripuberal, próxima do pico."}
          {" "}Validade: machos 12–16 anos, fêmeas 11–15 anos — {r?.mirwaldValid ? "dentro" : "fora"}.
        </p>
      </ResCard>

      {/* 04 */}
      {(r?.mooreResults || []).length > 0 && (
        <ResCard n={4} titulo="Maturity offset (Moore 2015)" valor={f1(r.mooreResults[0].phv)} unidade="anos PHV"
          sub="Estimativa independente, só com estatura, sentada e idade">
          {r.mooreResults.map((m) => (
            <div key={m.label} className="res-linha">
              <span>{m.label}</span>
              <b>offset {sinal(m.offset, 2)} · PHV {f1(m.phv)} a</b>
            </div>
          ))}
        </ResCard>
      )}

      {/* 05 */}
      <ResCard n={5} titulo="Classificação bio-banding (offset)" valor={r?.bandingMirwald} unidade="">
        <div className="band-faixas">
          {["Maturador tardio", "No tempo", "Maturador precoce"].map((b) => (
            <span key={b} className={r?.bandingMirwald === b ? "on" : ""}>{b}</span>
          ))}
        </div>
        <p className="res-nota">
          Bio-banding compara o atleta com a coorte da MESMA maturação, não da mesma idade —
          é a base para agrupar treino e competição por desenvolvimento.
        </p>
      </ResCard>

      {/* 06 */}
      <ResCard n={6} titulo="Predição Khamis-Roche (PAH)" valor={f1(ult.khamis_pah)} unidade="cm"
        sub={`${f1(ult.khamis_pct)}% da estatura adulta já atingida`}>
        <div className="erro-faixa">
          <div className="ef-barra">
            <i style={{ left: "50%" }} />
            <span className="ef-50" />
            <span className="ef-90" />
          </div>
          <div className="ef-lbl">
            <span>±{f1(r?.khamisErr50)} cm (50%)</span>
            <span>±{f1(r?.khamisErr90)} cm (90%)</span>
          </div>
        </div>
        <div className="res-linha">
          <span>Faixa provável</span>
          <b>{f1(Number(ult.khamis_pah) - Number(r?.khamisErr90))}–{f1(Number(ult.khamis_pah) + Number(r?.khamisErr90))} cm</b>
        </div>
        <p className="res-nota">Não usa idade óssea — é o método que se aplica em qualquer consulta.</p>
      </ResCard>

      {/* 07 */}
      <ResCard n={7} titulo="Bayley-Pinneau (idade óssea)"
        valor={ult.bp_pah == null ? "—" : f1(ult.bp_pah)} unidade="cm"
        sub={ult.bp_pah == null ? "Sem idade óssea registrada nesta avaliação" : `${f1(ult.bp_pct)}% da estatura adulta`}>
        <div className="res-linha"><span>Idade óssea usada</span><b>{f1(ult.idade_ossea)} anos</b></div>
        <p className="res-nota">
          Método de Greulich &amp; Pyle: usa a idade óssea do RX de mão e punho. É o mais preciso
          quando há radiografia; sem ela, fica de fora do consenso.
        </p>
      </ResCard>

      {/* 08 */}
      <ResCard n={8} titulo="Consenso clínico (PAH)" destaque
        valor={f1(ult.consenso_pah)} unidade="cm"
        sub={`Faixa preditiva ${f1(r?.consensusMin)}–${f1(r?.consensusMax)} cm · ${f1(ult.consenso_pct)}% atingido`}>
        <div className="consenso-barras">
          <div className="cb-linha">
            <span>Khamis-Roche</span>
            <div className="cb-t"><i style={{ width: "100%", background: "#0e7490" }} /></div>
            <b>{f1(ult.khamis_pah)}</b>
          </div>
          {ult.bp_pah != null && (
            <div className="cb-linha">
              <span>Bayley-Pinneau</span>
              <div className="cb-t"><i style={{ width: "100%", background: "#7c3aed" }} /></div>
              <b>{f1(ult.bp_pah)}</b>
            </div>
          )}
          <div className="cb-linha total">
            <span>Consenso</span>
            <div className="cb-t"><i style={{ width: "100%", background: "#059669" }} /></div>
            <b>{f1(ult.consenso_pah)}</b>
          </div>
        </div>
        <p className="res-nota">
          {ult.bp_pah != null
            ? "Média entre Khamis-Roche e Bayley-Pinneau — os dois métodos com base diferente concordando."
            : "Apenas Khamis-Roche disponível: registre a idade óssea para o consenso ganhar o segundo método."}
        </p>
      </ResCard>

      {/* 09 */}
      <ResCard n={9} titulo="Estágio de bio-banding por %PAH" valor={ult.banding || r?.bandingPct} unidade="">
        <div className="pct-trilha">
          {[["Pré-estirão", 0, 85], ["Início do estirão", 85, 90], ["Peripuberal", 90, 95], ["Pós-estirão", 95, 100]].map(([nome, a, b]) => (
            <div key={nome}
              className={`pt-seg${(r?.bandingPct === nome || ult.banding === nome) ? " on" : ""}`}
              style={{ width: `${b - a}%`, background: COR_BANDING[nome] }}>
              <span>{nome.split(" ")[0]}</span>
            </div>
          ))}
          <i style={{ left: `${Math.max(1, Math.min(99, ult.consenso_pct))}%` }} />
        </div>
        <div className="pct-lbl"><span>85%</span><span>90%</span><span>95%</span><span>100%</span></div>
        <p className="res-nota">
          Com {f1(ult.consenso_pct)}% da estatura adulta, o atleta está em <b>{ult.banding || r?.bandingPct}</b>.
        </p>
      </ResCard>

      {/* 10 */}
      {r?.diffPrev && (
        <ResCard n={10} titulo="Evolução vs. avaliação anterior"
          valor={sinal(r.diffPrev.stature)} unidade="cm"
          sub={`${r.diffPrev.days} dias desde ${fmtDate(r.diffPrev.prevDate)}`}>
          <div className="res-grid2">
            <div><span>Δ estatura</span><b className="bom">{sinal(r.diffPrev.stature)} cm</b></div>
            <div><span>Δ % da PAH</span><b className="bom">{sinal(r.diffPrev.pctPAH)} p.p.</b></div>
            <div><span>Δ offset Mirwald</span><b>{sinal(r.diffPrev.mirwaldOffset, 2)} a</b></div>
            <div><span>Δ idade no PHV</span><b>{sinal(r.diffPrev.phv)} a</b></div>
          </div>
          <p className="res-nota">
            Crescimento de {f1((r.diffPrev.stature / r.diffPrev.days) * 365)} cm/ano nesta janela —
            a velocidade cai conforme se aproxima da estatura final.
          </p>
        </ResCard>
      )}

      {/* 11 */}
      <ResCard n={11} titulo="Próxima reavaliação recomendada"
        valor={fmtDate(r?.nextEvalDate)} unidade="">
        <p className="res-nota">
          {r?.isPeripubertal
            ? "Intervalo trimestral: atleta em janela peripuberal (|offset| ≤ 1,0 ano), quando a velocidade muda rápido."
            : "Intervalo semestral: fora do pico imediato de velocidade."}
        </p>
        <div className="res-linha">
          <span>Faixa de maturação</span><b>{r?.bandingPct}</b>
        </div>
      </ResCard>

      {/* histórico */}
      {ord.length > 1 && (
        <Card>
          <p className="sec-title">Histórico de avaliações</p>
          <div className="hist-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th>Data</th><th className="num">Est.</th><th className="num">Peso</th>
                  <th className="num">Idade óssea</th><th className="num">Offset</th>
                  <th className="num">Khamis</th><th className="num">Consenso</th><th className="num">%</th><th>Faixa</th>
                </tr>
              </thead>
              <tbody>
                {[...ord].reverse().map((v) => (
                  <tr key={v.id}>
                    <td>{fmtDate(v.data_avaliacao || v.date)}</td>
                    <td className="num">{f1(v.estatura)}</td>
                    <td className="num">{f1(v.peso)}</td>
                    <td className="num">{f1(v.idade_ossea)}</td>
                    <td className="num">{sinal(v.mirwald_offset, 2)}</td>
                    <td className="num">{f1(v.khamis_pah)}</td>
                    <td className="num" style={{ fontWeight: 700 }}>{f1(v.consenso_pah)}</td>
                    <td className="num">{f1(v.consenso_pct)}</td>
                    <td><span className="band-mini" style={{ background: `${COR_BANDING[v.banding]}22`, color: COR_BANDING[v.banding] }}>{v.banding}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <p className="res-rodape">
        Estimativas populacionais servem para acompanhar a curva individual e planejar treino —
        não são medidas definitivas. A leitura clínica é do médico assistente.
      </p>
    </>
  );
}
