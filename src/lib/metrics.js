// Motor de cálculo de carga — porte fiel de @/components/utils/acwr do Base44.
// Mantido idêntico para que os números batam com o app original.

export function parseISO(s) {
  const [y, m, d] = String(s).split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function toISO(date) {
  const p = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`;
}

export function todayISO() {
  return toISO(new Date());
}

export function dayDiff(a, b) {
  const ms = 24 * 60 * 60 * 1000;
  const da = new Date(a.getFullYear(), a.getMonth(), a.getDate()).getTime();
  const db = new Date(b.getFullYear(), b.getMonth(), b.getDate()).getTime();
  return Math.round((db - da) / ms);
}

export function computeAge(dobISO) {
  if (!dobISO) return null;
  const dob = parseISO(dobISO);
  const t = new Date();
  let age = t.getFullYear() - dob.getFullYear();
  const m = t.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && t.getDate() < dob.getDate())) age--;
  if (!Number.isFinite(age) || age < 0 || age > 130) return null;
  return age;
}

/** Carga do registro: usa o campo gravado ou recalcula PSE × duração. */
export function logLoad(log) {
  return log.training_load || log.pse * log.duration_minutes;
}

/** Agrupa os registros por dia, somando as cargas de cada dia. */
export function groupDailyLoads(logs) {
  const map = new Map();
  for (const log of logs) {
    map.set(log.date, (map.get(log.date) || 0) + logLoad(log));
  }
  return [...map.entries()]
    .map(([date, load]) => ({ date, load }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

function sumLoadsInWindow(dailyLoads, endISO, windowDays) {
  const end = parseISO(endISO);
  let sum = 0;
  for (const d of dailyLoads) {
    const diff = dayDiff(parseISO(d.date), end);
    if (diff >= 0 && diff < windowDays) sum += d.load;
  }
  return sum;
}

/**
 * ACWR = carga aguda (7 dias) ÷ (média diária crônica (28 dias) × 7).
 * Só calcula quando há dados suficientes para as duas janelas.
 */
// ACWR — Acute:Chronic Workload Ratio (Gabbett 2016; Impellizzeri 2020).
//
// CORREÇÃO (24/11/2026) — o cálculo herdado do Base44 dividia a soma da janela
// crônica por 28 SEMPRE, mesmo quando o atleta tinha menos de 28 dias de
// histórico. Isso embute no denominador dias anteriores ao primeiro registro,
// que não são dias de descanso do atleta: são dias desconhecidos. O efeito era
// inflar o ACWR justamente em quem começou a monitorar há pouco.
//
//   Lorena (23 dias de histórico, último registro 18/11):
//     ÷28 fixo      → ACWR 2,28  (ALTO, falso alarme)
//     ÷23 cobertos  → ACWR 1,71  (compatível com a carga real)
//
// A crônica passa a ser a média diária sobre os dias EFETIVAMENTE cobertos
// desde o primeiro registro, limitada a 28. Quando o histórico é curto, a
// resposta traz `historicoCurto` para a tela avisar que o número é estimativa.

export const DIAS_MINIMOS_ACWR = 21;

export function computeACWR(dailyLoads) {
  if (!dailyLoads.length) {
    return { acute: null, chronic: null, acwr: null, diasCobertos: 0, historicoCurto: true };
  }
  const inicio = parseISO(dailyLoads[0].date);
  const latest = dailyLoads[dailyLoads.length - 1].date;
  const endDate = parseISO(latest);

  // Dias que compõem a janela crônica.
  //
  // SEGUNDA CORREÇÃO (24/11/2026) — a crônica é média de carga POR DIA DE
  // TREINO, não por dia de calendário. Dividir por 28 corridos supõe que todo
  // dia sem registro foi dia de descanso — o que é falso quando o atleta só
  // treina 3x por semana ou monitora esporadicamente:
  //   Helio, 2 dias de treino em 28 → ACWR 4,0 "ALTO" (falso alarme)
  //   dividindo pelos dias com registro → mesma carga, razão coerente.
  // A referência que vale com histórico longo (28+ dias de treino) não muda.
  const diasCobertos = Math.min(28, dayDiff(inicio, endDate) + 1);

  const acute = sumLoadsInWindow(dailyLoads, latest, 7);
  const somaCronica = sumLoadsInWindow(dailyLoads, latest, 28);

  // quantos dias DENTRO da janela de 28 têm alguma carga registrada
  const diasComTreino = dailyLoads.filter((d) => {
    const diff = dayDiff(parseISO(d.date), endDate);
    return diff >= 0 && diff < 28 && d.load > 0;
  }).length;

  // média aguda: idem, por dia com treino na janela de 7 dias
  const diasComTreino7 = dailyLoads.filter((d) => {
    const diff = dayDiff(parseISO(d.date), endDate);
    return diff >= 0 && diff < 7 && d.load > 0;
  }).length;

  const chronicDailyAvg = diasComTreino > 0 ? somaCronica / diasComTreino : null;
  const acuteDailyAvg = diasComTreino7 > 0 ? acute / diasComTreino7 : null;

  let acwr = null;
  if (chronicDailyAvg && chronicDailyAvg > 0 && acuteDailyAvg != null) {
    acwr = acuteDailyAvg / chronicDailyAvg;
  }

  return {
    acute,
    chronic: chronicDailyAvg,
    acwr,
    diasCobertos,
    diasComTreino,
    historicoCurto: diasCobertos < DIAS_MINIMOS_ACWR,
  };
}

export function acwrStatus(acwr) {
  if (acwr == null) return { label: "N/D", color: "gray" };
  if (acwr < 0.8) return { label: "BAIXO", color: "yellow" };
  if (acwr > 1.2) return { label: "ALTO", color: "red" };
  return { label: "OK", color: "green" };
}

/** Semanas de 7 dias a partir do primeiro registro, com Δ% contra a semana anterior. */
export function computeWeeklyIncrements(dailyLoads) {
  if (dailyLoads.length === 0) return [];
  const start = parseISO(dailyLoads[0].date);
  const end = parseISO(dailyLoads[dailyLoads.length - 1].date);

  const loadByDate = new Map(dailyLoads.map((x) => [x.date, x.load]));
  const days = [];
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    days.push({ date: toISO(d), load: loadByDate.get(toISO(d)) || 0 });
  }

  const weeks = [];
  for (let i = 0; i < days.length; i += 7) {
    const chunk = days.slice(i, i + 7);
    weeks.push({
      weekStart: chunk[0].date,
      weekLoad: chunk.reduce((s, x) => s + x.load, 0),
      complete: chunk.length === 7,
    });
  }

  return weeks.map((w, idx) => {
    const prev = weeks[idx - 1];
    let increment = null;
    if (prev && prev.complete && w.complete && prev.weekLoad > 0) {
      increment = (w.weekLoad - prev.weekLoad) / prev.weekLoad;
    }
    return { ...w, increment };
  });
}

/** Série diária dos últimos N dias (para o gráfico de carga). */
export function dailySeries(logs, days = 21) {
  const map = new Map();
  for (const log of logs) map.set(log.date, (map.get(log.date) || 0) + logLoad(log));
  const out = [];
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const iso = toISO(d);
    out.push({ date: iso, load: map.get(iso) || 0 });
  }
  return out;
}

/**
 * ACWR em cada um dos N dias da janela.
 *
 * CORREÇÃO (24/11/2026) — a janela era ancorada em HOJE, enquanto o KPI usava o
 * ÚLTIMO REGISTRO. Para quem estava treinando até hoje os dois números batiam
 * (caso da Mariana); para quem parou há alguns dias divergiam, porque a janela
 * aguda ia enchendo de dias sem registro:
 *   Lorena, último treino 18/11, consulta em 24/11 → gráfico 0,76 × KPI 1,38.
 * Agora a série termina no MESMO dia de referência do KPI (último registro,
 * ou `ateData` quando a tela quer fixar a data).
 */
export function acwrSeries(logs, days = 28, ateData = null) {
  const daily = groupDailyLoads(logs);
  const out = [];
  if (!daily.length) return out;
  const referencia = ateData
    ? new Date(ateData)
    : parseISO(daily[daily.length - 1].date);
  const today = referencia;
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const iso = toISO(d);
    const end = parseISO(iso);
    let acute = 0, acuteDias = 0;
    let chronicSum = 0, chronicDias = 0;
    for (const x of daily) {
      const diff = dayDiff(parseISO(x.date), end);
      if (diff >= 0 && diff < 7 && x.load > 0) { acute += x.load; acuteDias++; }
      if (diff >= 0 && diff < 28 && x.load > 0) { chronicSum += x.load; chronicDias++; }
    }
    // mesmo critério do computeACWR: média por dia COM TREINO nas duas janelas
    const chronicAvg = chronicDias > 0 ? chronicSum / chronicDias : null;
    const acuteAvg = acuteDias > 0 ? acute / acuteDias : null;
    out.push({
      date: iso,
      acwr: chronicAvg && acuteAvg != null ? acuteAvg / chronicAvg : null,
    });
  }
  return out;
}

/** Complemento: monotonia e strain de Foster (não existiam no original). */
export function weeklyMonotony(logs) {
  const byDate = new Map();
  for (const l of logs) byDate.set(l.date, (byDate.get(l.date) || 0) + logLoad(l));
  const values = [...byDate.values()];
  if (values.length < 3) return null;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const sd = Math.sqrt(values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length);
  if (sd === 0) return { monotony: null, strain: null };
  const monotony = mean / sd;
  return { monotony, strain: mean * 7 * monotony };
}

export const fmt2 = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 });
export const fmt0 = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });

export function fmtDate(iso, style = "short") {
  if (!iso) return "";
  const d = parseISO(String(iso).slice(0, 10));
  if (Number.isNaN(d.getTime())) return iso;
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  if (style === "long") return `${dd}/${mm}/${d.getFullYear()}`;
  if (style === "day") return `${dd}/${mm}`;
  return `${dd}/${mm}/${String(d.getFullYear()).slice(2)}`;
}

// --------------------------------------------------------------- carga 360
// Série que reproduz o gráfico do Base44: carga diária, média aguda (7 d),
// média crônica (28 d) e ACWR, numa janela ANCORADA NO ÚLTIMO REGISTRO.
// O original usava "hoje" como fim da janela, então quem parou de treinar há
// mais de 21 dias via o gráfico vazio mesmo tendo histórico.

/** Converte a lista de treinos numa série diária contínua (sem buracos). */
export function serieCargaCompleta(logs, { dias = 90, ateData = null } = {}) {
  if (!logs?.length) return { serie: [], fim: null, inicio: null };
  const mapa = new Map();
  for (const l of logs) {
    const d = String(l.date).slice(0, 10);
    mapa.set(d, (mapa.get(d) || 0) + logLoad(l));
  }
  const datas = [...mapa.keys()].sort();
  const ultima = datas[datas.length - 1];
  const fimISO = toISO(ateData ? new Date(ateData) : new Date(ultima + "T12:00:00"));
  const inicioISO = toISO(new Date(new Date(fimISO + "T12:00:00").getTime() - (dias - 1) * 864e5));

  const serie = [];
  const cursor = new Date(inicioISO + "T12:00:00");
  const fimD = new Date(fimISO + "T12:00:00");
  while (cursor <= fimD) {
    const iso = toISO(cursor);
    const carga = mapa.get(iso) || 0;
    // aguda: média dos últimos 7 dias (inclui o dia)
    let soma7 = 0, soma28 = 0;
    for (let k = 0; k < 28; k++) {
      const dk = new Date(cursor.getTime() - k * 864e5);
      const v = mapa.get(toISO(dk)) || 0;
      soma28 += v;
      if (k < 7) soma7 += v;
    }
    // médias por dia COM TREINO nas duas janelas (ver computeACWR)
    let dias7 = 0, dias28 = 0;
    for (let k = 0; k < 28; k++) {
      const dk = new Date(cursor.getTime() - k * 864e5);
      const v = mapa.get(toISO(dk)) || 0;
      if (v > 0) { dias28++; if (k < 7) dias7++; }
    }
    const aguda = dias7 > 0 ? soma7 / dias7 : 0;
    const cronica = dias28 > 0 ? soma28 / dias28 : 0;
    serie.push({
      date: iso,
      carga,
      aguda,
      cronica,
      acwr: cronica > 0 ? aguda / cronica : null,
    });
    cursor.setDate(cursor.getDate() + 1);
  }
  return { serie, inicio: inicioISO, fim: fimISO };
}

/** Janelas disponíveis para o seletor do gráfico. */
export function janelasCarga(logs) {
  if (!logs?.length) return [];
  const datas = logs.map((l) => String(l.date).slice(0, 10)).sort();
  const primeira = datas[0];
  const ultima = datas[datas.length - 1];
  const totalDias = Math.round((new Date(ultima) - new Date(primeira)) / 864e5) + 1;
  return [
    { id: 21, label: "21 dias", ok: totalDias >= 1 },
    { id: 42, label: "6 semanas", ok: totalDias >= 1 },
    { id: 90, label: "90 dias", ok: totalDias >= 1 },
    { id: 180, label: "6 meses", ok: totalDias >= 1 },
    { id: 100000, label: "Tudo", ok: true },
  ].map((j) => ({ ...j, diasReais: Math.min(j.id, totalDias) }));
}
