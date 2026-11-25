import React from "react";
import { byId, MCID_MAP } from "../lib/instrumentos";
import { calcularMaturacao } from "../lib/maturacao";
import { GraficoDominios, Legenda, NOMES_DOMINIO } from "./Evolucao";

const f1 = (v) => (v == null || !Number.isFinite(Number(v)) ? "—" : Number(v).toFixed(1).replace(".", ","));
const dbr = (s) => (s ? `${String(s).slice(8, 10)}/${String(s).slice(5, 7)}/${String(s).slice(0, 4)}` : "—");

/**
 * Relatório de evolução — imprimível e exportável em PDF pelo próprio
 * navegador ("Salvar como PDF"). Não depende de biblioteca externa.
 */
export default function Relatorio({ paciente, coletas, visitas, logs, hrv, onVoltar, prontuario: pre, secoes }) {
  const sec = { identificacao: true, carga: true, proms: true, maturacao: true, itens: false, ...(secoes || {}) };
  const porInstr = React.useMemo(() => {
    const m = {};
    for (const c of coletas) (m[String(c.questionnaire).toLowerCase()] ||= []).push(c);
    for (const k of Object.keys(m)) m[k].sort((a, b) => String(a.submitted_at).localeCompare(String(b.submitted_at)));
    return m;
  }, [coletas]);

  const ativos = Object.keys(porInstr).filter((k) => byId(k));
  const P = pre?.orthoflow?.instrumentos || {};
  const cargaP = pre?.atleta360?.carga;
  const matP = pre?.maturacao;
  const ordVis = [...(visitas || [])].sort((a, b) =>
    String(a.data_avaliacao || a.date).localeCompare(String(b.data_avaliacao || b.date)));
  const ultVis = ordVis[ordVis.length - 1];

  const carga = React.useMemo(() => {
    if (cargaP) {
      return {
        sessoes: cargaP.sessoes || 0,
        cargaTotal: cargaP.carga_total || 0,
        cargaMedia: cargaP.carga_media || 0,
        minutos: cargaP.minutos_totais || 0,
        pseMedio: cargaP.pse?.media != null ? String(cargaP.pse.media).replace(".", ",") : "—",
        acwr: cargaP.acwr,
        acwrStatus: cargaP.acwr_status,
      };
    }
    const l = [...(logs || [])];
    const soma = l.reduce((a, x) => a + Number(x.training_load || 0), 0);
    const dias = l.length;
    const min = l.reduce((a, x) => a + Number(x.duration_minutes || 0), 0);
    return {
      sessoes: dias,
      cargaTotal: Math.round(soma),
      cargaMedia: dias ? Math.round(soma / dias) : 0,
      minutos: min,
      pseMedio: dias ? (l.reduce((a, x) => a + Number(x.pse || 0), 0) / dias).toFixed(1) : "—",
      acwr: null,
      acwrStatus: null,
    };
  }, [logs, cargaP]);

  const hrvUlt = [...(hrv || [])].sort((a, b) => String(b.date).localeCompare(String(a.date)))[0];
  const vfcMedia = pre?.atleta360?.vfc?.media;
  const vfcN = pre?.atleta360?.vfc?.n;

  const mat = React.useMemo(() => {
    if (!ultVis) return null;
    try {
      return calcularMaturacao({
        name: paciente?.name || "", sex: ultVis.sexo || "male",
        birthDate: paciente?.dob || "2011-06-22",
        evalDate: ultVis.data_avaliacao || ultVis.date,
        stature: Number(ultVis.estatura), sittingHeight: Number(ultVis.sentada),
        weight: Number(ultVis.peso), fatherHeight: Number(ultVis.pai), motherHeight: Number(ultVis.mae),
        boneAge: ultVis.idade_ossea, boneAgeMethod: "greulich", bpSource: "auto",
      });
    } catch { return null; }
  }, [ultVis?.id]);

  const hoje = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });

  return (
    <div className="relatorio">
      <div className="rel-acoes no-print">
        <button className="link-back" onClick={onVoltar}>← voltar</button>
        <button className="btn btn-teal" onClick={() => window.print()}>⎙ Imprimir / salvar PDF</button>
      </div>

      <header className="rel-capa">
        <div>
          <p className="rel-kicker">CEMEP Care · Medicina Esportiva</p>
          <h1>{paciente?.name || "Paciente"}</h1>
          <p className="rel-sub">
            Relatório de evolução clínica · emitido em {hoje}
          </p>
        </div>
        <div className="rel-marca">Dr. Hélio<br /><span>Okamura</span></div>
      </header>

      <div className="rel-identidade">
        <div><span>Diagnóstico</span><b>{paciente?.diagnosis || "—"}</b></div>
        <div><span>Região</span><b>{paciente?.region || "—"}{paciente?.laterality ? ` · ${paciente.laterality}` : ""}</b></div>
        <div><span>Início do protocolo</span><b>{dbr(paciente?.protocol_start)}</b></div>
        <div><span>Coletas de questionário</span><b>{coletas.length}</b></div>
      </div>

      {/* resumo de carga */}
      {sec.carga && <section className="rel-sec">
        <h2>1. Carga de treino</h2>
        <div className="rel-grid">
          <div className="rel-kpi"><span>Sessões registradas</span><b>{carga.sessoes}</b></div>
          <div className="rel-kpi"><span>Carga média / sessão</span><b>{carga.cargaMedia} <i>UA</i></b></div>
          <div className="rel-kpi"><span>PSE médio</span><b>{carga.pseMedio}</b></div>
          <div className="rel-kpi"><span>{hrvUlt ? "VFC mais recente" : "VFC média"}</span><b>{hrvUlt ? f1(hrvUlt.hrv) : f1(vfcMedia)} <i>ms</i></b>{vfcN ? <em style={{ display: "block", fontSize: 9, color: "#94a3b8", fontStyle: "normal" }}>{vfcN} medições</em> : null}</div>
        </div>
        <p className="rel-nota">
          Carga = PSE × duração (UA). {carga.sessoes} sessões somam {carga.cargaTotal} UA em {Math.round(carga.minutos / 60)} h de treino.
          {carga.acwr != null && <> Razão carga aguda/crônica (ACWR) no último registro: <b>{carga.acwr}</b> — {carga.acwrStatus}.</>}
        </p>
      </section>}

      {/* evolução por instrumento */}
      {sec.proms && <section className="rel-sec">
        <h2>2. Questionários — evolução por domínio</h2>
        {ativos.length === 0 && <p className="rel-nota">Nenhum questionário respondido.</p>}
        {ativos.map((k) => {
          const q = byId(k);
          const serie = porInstr[k];
          const ult = serie[serie.length - 1];
          const pri = serie[0];
          const delta = Number(ult.total_score) - Number(pri.total_score);
          const melhor = q.higherIsBetter ? delta >= 0 : delta <= 0;
          const dominios = {};
          for (const c of serie) {
            if (!c.subscale_scores) continue;
            for (const [dk, dv] of Object.entries(c.subscale_scores)) (dominios[dk] ||= []).push(Number(dv));
          }
          const mcid = MCID_MAP?.[k];
          return (
            <div key={k} className="rel-instr">
              <div className="rel-instr-head">
                <div>
                  <h3>{q.short || q.name}</h3>
                  <p>{q.description}</p>
                </div>
                <div className="rel-instr-val">
                  <b>{f1(ult.total_score)}</b>
                  <span>de {q.scaleMax}</span>
                  {serie.length > 1 && (
                    <em className={melhor ? "bom" : "ruim"}>
                      {delta > 0 ? "+" : ""}{f1(delta)} ({serie.length} coletas)
                    </em>
                  )}
                </div>
              </div>
              {Object.keys(dominios).length > 0 && serie.length > 1 && (
                <div className="rel-graf">
                  <GraficoDominios dominios={dominios} datas={serie.map((s) => s.submitted_at)} h={150} />
                  <Legenda dominios={dominios} />
                </div>
              )}
              {mcid != null && <p className="rel-nota">Diferença mínima importante (MCID): {mcid} pontos.</p>}
            </div>
          );
        })}
      </section>}

      {/* maturação */}
      {sec.maturacao && mat && (
        <section className="rel-sec">
          <h2>3. Maturação e crescimento</h2>
          <div className="rel-grid">
            <div className="rel-kpi"><span>Estatura atual</span><b>{f1(ultVis.estatura)} <i>cm</i></b></div>
            <div className="rel-kpi"><span>Estatura adulta prevista</span><b>{f1(mat.consensusPAH)} <i>cm</i></b></div>
            <div className="rel-kpi"><span>% da estatura adulta</span><b>{f1(mat.consensusPct)} <i>%</i></b></div>
            <div className="rel-kpi"><span>Faixa de maturação</span><b style={{ fontSize: 13 }}>{mat.bandingPct}</b></div>
          </div>
          <table className="rel-tab">
            <thead>
              <tr><th>Data</th><th>Estatura</th><th>Sentada</th><th>Peso</th>
              <th>Idade óssea</th><th>Offset</th><th>% adulto</th><th>Faixa</th></tr>
            </thead>
            <tbody>
              {ordVis.map((v) => (
                <tr key={v.id}>
                  <td>{dbr(v.data_avaliacao || v.date)}</td>
                  <td>{f1(v.estatura)}</td><td>{f1(v.sentada)}</td><td>{f1(v.peso)}</td>
                  <td>{f1(v.idade_ossea)}</td><td>{f1(v.mirwald_offset)}</td>
                  <td>{f1(v.consenso_pct)}</td><td>{v.banding}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="rel-nota">
            Alvo parental {f1(mat.targetMin)}–{f1(mat.targetMax)} cm · consenso {f1(mat.consensusMin)}–{f1(mat.consensusMax)} cm ·
            próxima reavaliação em {mat.nextEvalDate ? dbr(mat.nextEvalDate) : "—"}.
          </p>
        </section>
      )}

      <footer className="rel-rodape">
        <p>
          Este relatório reúne dados registrados pelo paciente e avaliações da equipe.
          Estimativas de estatura adulta são populacionais e servem de referência, não de medida definitiva.
        </p>
        <div className="rel-assina">
          <div className="linha" />
          <p>Dr. Hélio Okamura — Medicina Esportiva e Ortopedia<br />CEMEP Care · Londrina/PR</p>
        </div>
      </footer>
    </div>
  );
}
