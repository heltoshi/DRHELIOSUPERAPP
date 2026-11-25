/**
 * MONTAGEM DO PRONTUÁRIO COMPLETO
 * ---------------------------------
 * Junta tudo o que existe de um paciente num objeto único, em JSON, para:
 *   - exportar o prontuário (backup, troca de sistema, segunda opinião)
 *   - alimentar o gerador de laudo e a análise por IA
 *
 * Duas responsabilidades separadas de propósito:
 *   1. `montarProntuario` — COLETA, é só dados (puro, testável)
 *   2. o laudo é TEXTO gerado a partir dele (components/Laudo.jsx)
 */
import { Patients, Logs, HRV, Responses, PROMs, Questionnaires, maturacaoVisitas } from "./data";
import { byId, allItems, computeScore, MCID_MAP } from "./instrumentos";
import { calcularMaturacao } from "./maturacao";
import { computeACWR, groupDailyLoads, acwrStatus } from "./metrics";

const n = (v) => (v == null || v === "" ? null : Number(v));
const d10 = (s) => (s ? String(s).slice(0, 10) : null);
const sem = (k) => (k ? k.replace(/_/g, " ") : "");

/** Estatística simples de uma série. */
function stats(arr) {
  const v = arr.filter((x) => Number.isFinite(Number(x))).map(Number);
  if (!v.length) return null;
  const s = [...v].sort((a, b) => a - b);
  const media = v.reduce((a, b) => a + b, 0) / v.length;
  return {
    n: v.length,
    min: s[0],
    max: s[s.length - 1],
    media: Math.round(media * 10) / 10,
    mediana: s.length % 2 ? s[(s.length - 1) / 2] : Math.round(((s[s.length / 2 - 1] + s[s.length / 2]) / 2) * 10) / 10,
    primeiro: v[0],
    ultimo: v[v.length - 1],
    delta: Math.round((v[v.length - 1] - v[0]) * 10) / 10,
  };
}

/**
 * Monta o prontuário. `patientId` é o uuid da linha em `patient`.
 * Retorna um objeto pronto para JSON.stringify.
 */
export async function montarProntuario(patientId, opcoes = {}) {
  const p = Patients.get(patientId);
  if (!p) throw new Error("Paciente não encontrado.");

  // período: {de:"AAAA-MM-DD", ate:"AAAA-MM-DD"} ou vazio = tudo
  const de = opcoes.de ? String(opcoes.de).slice(0, 10) : null;
  const ate = opcoes.ate ? String(opcoes.ate).slice(0, 10) : null;
  const dentro = (data) => {
    if (!data) return false;
    const d = String(data).slice(0, 10);
    if (de && d < de) return false;
    if (ate && d > ate) return false;
    return true;
  };
  const filtrando = Boolean(de || ate);
  // no recorte, um registro no limite do período pode estar fora por fuso:
  // compara só a data (AAAA-MM-DD), nunca o timestamp completo.

  const logs0 = Logs.list(p.id);
  const hrv0 = HRV.list(p.id);
  const resp0 = Responses.list({ patient_id: p.id });
  const proms0 = PROMs.list(p.id);
  const visitas0 = (await maturacaoVisitas.list(p.id).catch(() => [])) || [];
  const quests = Questionnaires.list();

  const logs = filtrando ? logs0.filter((l) => dentro(l.date)) : logs0;
  const hrv = filtrando ? hrv0.filter((h) => dentro(h.date)) : hrv0;
  const resp = filtrando ? resp0.filter((r) => dentro(r.date)) : resp0;
  const proms = filtrando ? proms0.filter((c) => dentro(c.submitted_at || c.date)) : proms0;
  const visitas = filtrando
    ? visitas0.filter((v) => dentro(v.data_avaliacao || v.date))
    : visitas0;

  // ---- carga de treino
  const carga = logs.map((l) => ({
    data: d10(l.date), pse: n(l.pse), duracao: n(l.duration_minutes),
    carga: n(l.training_load), tipo: l.training_type || null,
    sono_h: n(l.sleep_hours), sono_q: n(l.sleep_quality),
    dor: n(l.muscle_soreness), fadiga: n(l.fatigue_level), humor: n(l.mood),
  }));
  const { acwr } = computeACWR(groupDailyLoads(logs));
  const st = acwrStatus(acwr);

  const resumoCarga = {
    sessoes: carga.length,
    primeira: carga.length ? carga[carga.length - 1].data : null,
    ultima: carga.length ? carga[0].data : null,
    carga_total: carga.reduce((a, x) => a + (x.carga || 0), 0),
    carga_media: carga.length ? Math.round(carga.reduce((a, x) => a + (x.carga || 0), 0) / carga.length) : 0,
    pse: stats(carga.map((c) => c.pse)),
    duracao: stats(carga.map((c) => c.duracao)),
    sono: stats(carga.map((c) => c.sono_h)),
    minutos_totais: carga.reduce((a, x) => a + (x.duracao || 0), 0),
    acwr: acwr == null ? null : Math.round(acwr * 100) / 100,
    acwr_status: acwr == null ? null : st.label,
  };

  // ---- VFC
  const resumoVfc = {
    ...(stats(hrv.map((h) => h.hrv)) || { n: 0 }),
    ultima_data: hrv[0] ? d10(hrv[0].date) : null,
    serie: hrv.map((h) => ({ data: d10(h.date), vfc: n(h.hrv) })),
  };

  // ---- OrthoFlow (PROMs): por instrumento, com domínios e itens
  const porInstr = {};
  for (const c of proms) {
    const k = String(c.questionnaire).toLowerCase();
    (porInstr[k] ||= []).push(c);
  }
  const promResumo = {};
  for (const [k, lista] of Object.entries(porInstr)) {
    const instr = byId(k);
    const ord = [...lista].sort((a, b) => String(a.submitted_at).localeCompare(String(b.submitted_at)));
    const tot = ord.map((c) => Number(c.total_score));
    const doms = {};
    for (const c of ord) {
      for (const [dk, dv] of Object.entries(c.subscale_scores || {})) {
        (doms[dk] ||= []).push(Number(dv));
      }
    }
    const itens = instr ? allItems(instr).map((it) => {
      const vals = ord.map((c) => (c.answers || {})[it.id]);
      return { item: it.label || it.text, id: it.id, respostas: vals };
    }) : [];
    promResumo[k] = {
      nome: instr?.name || k,
      sigla: instr?.short || k.toUpperCase(),
      escala_max: instr?.scaleMax ?? null,
      maior_melhor: instr?.higherIsBetter !== false,
      coletas: ord.length,
      primeira: ord.length ? d10(ord[0].submitted_at) : null,
      ultima: ord.length ? d10(ord[ord.length - 1].submitted_at) : null,
      total: stats(tot),
      dominios: Object.fromEntries(Object.entries(doms).map(([dk, dv]) => [sem(dk), stats(dv)])),
      mcid: MCID_MAP?.[k] ?? null,
      itens,
    };
  }

  // ---- Atleta 360 (questionários esportivos)
  const questResumo = {};
  for (const q of quests) {
    const rs = resp.filter((r) => r.questionnaire_id === q.id);
    if (!rs.length) continue;
    const ord = [...rs].sort((a, b) => String(a.date).localeCompare(String(b.date)));
    const scores = ord.map((r) => {
      const s = computeScore(q, r.answers);
      return s?.total;
    }).filter((x) => x != null);
    questResumo[q.kind] = {
      titulo: q.title,
      respostas: ord.length,
      primeira: ord.length ? d10(ord[0].date) : null,
      ultima: ord.length ? d10(ord[ord.length - 1].date) : null,
      score: stats(scores),
    };
  }

  // ---- Maturação
  const ordVis = [...visitas].sort((a, b) => String(a.data_avaliacao || a.date).localeCompare(String(b.data_avaliacao || b.date)));
  let matur = null;
  if (ordVis.length) {
    const ult = ordVis[ordVis.length - 1];
    const ant = ordVis[ordVis.length - 2];
    let calc = null;
    try {
      calc = calcularMaturacao({
        name: p.name, sex: ult.sexo || (p.gender === "Feminino" ? "female" : "male"),
        birthDate: p.dob || "2011-06-22", evalDate: ult.data_avaliacao || ult.date,
        stature: Number(ult.estatura), sittingHeight: Number(ult.sentada),
        weight: Number(ult.peso), fatherHeight: Number(ult.pai), motherHeight: Number(ult.mae),
        boneAge: ult.idade_ossea, boneAgeMethod: "greulich", bpSource: "auto",
        visitaAnterior: ant ? {
          date: ant.data_avaliacao || ant.date, stature: Number(ant.estatura),
          mirwaldOffset: Number(ant.mirwald_offset), consensusPct: Number(ant.consenso_pct),
          mirwaldPHV: Number(ant.mirwald_phv),
        } : null,
      });
    } catch { /* mantém o que está gravado */ }
    matur = {
      avaliacoes: ordVis.length,
      atual: {
        data: d10(ult.data_avaliacao || ult.date),
        estatura: n(ult.estatura), sentada: n(ult.sentada), peso: n(ult.peso),
        idade_ossea: n(ult.idade_ossea),
        pai: n(ult.pai), mae: n(ult.mae),
        imc: ult.peso && ult.estatura ? Math.round((Number(ult.peso) / Math.pow(Number(ult.estatura) / 100, 2)) * 10) / 10 : null,
        idade_decimal: calc ? Math.round(calc.ageDecimal * 100) / 100 : n(ult.idade_decimal),
        offset_mirwald: calc ? Math.round(calc.mirwaldOffset * 100) / 100 : n(ult.mirwald_offset),
        phv_idade: calc ? Math.round(calc.mirwaldPHV * 100) / 100 : n(ult.mirwald_phv),
        moore: calc?.mooreResults?.map((m) => ({ metodo: m.label, phv: Math.round(m.phv * 100) / 100 })) || [],
        khamis_pah: n(ult.khamis_pah), khamis_pct: n(ult.khamis_pct),
        khamis_erro_50: calc?.khamisErr50 ?? null, khamis_erro_90: calc?.khamisErr90 ?? null,
        bp_pah: n(ult.bp_pah), bp_pct: n(ult.bp_pct),
        consenso_pah: n(ult.consenso_pah), consenso_pct: n(ult.consenso_pct),
        consenso_faixa: calc ? [Math.round(calc.consensusMin * 10) / 10, Math.round(calc.consensusMax * 10) / 10] : null,
        alvo_parental: calc ? [Math.round(calc.targetMin * 10) / 10, Math.round(calc.targetMax * 10) / 10] : null,
        mid_parental: calc ? Math.round(calc.midParental * 10) / 10 : null,
        banding_offset: calc?.bandingMirwald ?? null,
        banding_pct: ult.banding || (calc?.bandingPct ?? null),
        proxima_avaliacao: calc?.nextEvalDate ?? null,
        variacao: calc?.diffPrev ? {
          dias: calc.diffPrev.days,
          estatura: Math.round(calc.diffPrev.stature * 10) / 10,
          pct_pah: Math.round(calc.diffPrev.pctPAH * 10) / 10,
        } : null,
      },
      historico: ordVis.map((v) => ({
        data: d10(v.data_avaliacao || v.date),
        estatura: n(v.estatura), peso: n(v.peso), sentada: n(v.sentada),
        idade_ossea: n(v.idade_ossea),
        offset: n(v.mirwald_offset), phv: n(v.mirwald_phv),
        khamis: n(v.khamis_pah), consenso: n(v.consenso_pah),
        pct: n(v.consenso_pct), banding: v.banding || null,
      })),
    };
  }

  return {
    versao: 1,
    gerado_em: new Date().toISOString(),
    periodo: { de, ate, recortado: filtrando },
    inventario_completo: {
      treinos: logs0.length, vfc: hrv0.length, coletas_prom: proms0.length,
      avaliacoes_maturacao: visitas0.length,
      questionarios: resp0.length,
    },
    origem: "Dr. Hélio — super app (Atleta 360 + OrthoFlow + Maturação)",
    paciente: {
      codigo: p.code, nome: p.name, email: p.email || null, whatsapp: p.phone || null,
      nascimento: d10(p.dob), sexo: p.gender || null,
      diagnostico: p.diagnosis || null, detalhe: p.diagnosis_detail || null,
      regiao: p.region || null, lateralidade: p.laterality || null,
      inicio_protocolo: d10(p.protocol_start),
      esporte: p.sport || null, equipe: p.team || null, treinador: p.coach || null,
      estatura: n(p.height), peso: n(p.weight),
      modulos: p.modules || [], observacoes: p.notes || null,
    },
    atleta360: { carga: resumoCarga, vfc: resumoVfc, questionarios: questResumo, treinos: carga },
    orthoflow: { instrumentos: promResumo, coletas_brutas: proms.map((c) => ({
      instrumento: c.questionnaire, data: d10(c.submitted_at),
      total: n(c.total_score), dominios: c.subscale_scores || null, respostas: c.answers || null,
    })) },
    maturacao: matur,
  };
}

/** Nome de arquivo seguro: sem acento, sem espaço. */
export function nomeArquivo(paciente) {
  const base = String(paciente?.nome || "paciente")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase();
  return `prontuario-${paciente?.codigo || "sem-codigo"}-${base}`;
}

/** Baixa o prontuário como JSON. */
export function baixarJson(obj, nome) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${nome}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
