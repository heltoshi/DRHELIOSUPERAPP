// Escores dos questionários: EDAJ–AKPS, EISDF–PSS e OSTRC-BR.
//
// Diferença em relação ao original do Base44: em vez de casar a pergunta por
// palavra-chave e a resposta por prefixo de 8 caracteres (o que fazia toda
// resposta "Participação total..." do OSTRC valer 0), aqui casamos a pergunta
// pelo texto e a resposta pelo ÍNDICE na lista de opções da própria pergunta.
// O índice é a forma correta de aplicar as tabelas de pontos dos instrumentos.

const norm = (s) =>
  String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();

/** Acha a resposta de uma pergunta pelo texto (exato, depois por prefixo). */
export function findAnswer(answers, questionText) {
  if (!answers?.length) return "";
  const exact = answers.find((a) => norm(a.question_text) === norm(questionText));
  if (exact) return exact.answer ?? "";
  const head = norm(questionText).slice(0, 24);
  const near = answers.find((a) => norm(a.question_text).startsWith(head));
  return near ? near.answer ?? "" : "";
}

/**
 * Resposta de uma pergunta. Aceita os dois formatos de gravação:
 *   { i: 3, a: "..." }              → nova forma, compacta (índice da pergunta)
 *   { question_text: "...", answer: "..." } → forma antiga, do Base44
 */
export function answerFor(answers, question, index) {
  if (!answers?.length) return "";
  const byIndex = answers.find((a) => typeof a.i === "number" && a.i === index);
  if (byIndex) return byIndex.a ?? "";
  return findAnswer(answers, question?.text);
}

/** Índice da opção escolhida dentro da lista de opções da pergunta. */
function optionIndex(answer, options) {
  if (answer == null || answer === "") return -1;
  const a = norm(answer);
  const list = (options || []).map(norm);
  let idx = list.findIndex((o) => o === a);
  if (idx >= 0) return idx;
  // resposta costuma repetir o início da opção com um complemento
  idx = list.findIndex((o) => o && (a.startsWith(o) || o.startsWith(a)));
  if (idx >= 0) return idx;
  // respostas no formato "b. Texto"
  const letter = a.trim()[0];
  if (letter >= "a" && letter <= "z") {
    const l = "abcdefghij".indexOf(letter);
    idx = list.findIndex((o) => o.startsWith(letter + ".") || o.startsWith(letter + " "));
    return idx >= 0 ? idx : l;
  }
  return -1;
}

// ---------------------------------------------------------------- OSTRC-BR
// Perguntas 1 e 4: 0 / 8 / 17 / 25.  Perguntas 2 e 3: 0 / 6 / 13 / 19 / 25.
// Total 0–100 (maior = pior).
const OSTRC_MAP_4 = [0, 8, 17, 25];
const OSTRC_MAP_5 = [0, 6, 13, 19, 25];
export const OSTRC_KEYS = [
  { key: "q1", match: "PARTICIPAÇÃO NOS TREINAMENTOS", label: "Participação", map: OSTRC_MAP_4 },
  { key: "q2", match: "REDUÇÃO NO VOLUME", label: "Volume de treino", map: OSTRC_MAP_5 },
  { key: "q3", match: "DIMINUIÇÃO DO DESEMPENHO", label: "Desempenho", map: OSTRC_MAP_5 },
  { key: "q4", match: "SINTOMAS DA LESÃO", label: "Sintomas", map: OSTRC_MAP_4 },
];

export function computeOSTRC(questionnaire, answers) {
  if (!answers?.length) return null;
  const qs = questionnaire?.questions || [];
  const parts = OSTRC_KEYS.map((k) => {
    const qi = qs.findIndex((x) => norm(x.text).includes(norm(k.match)));
    const q = qi >= 0 ? qs[qi] : null;
    const answer = q ? answerFor(answers, q, qi) : "";
    const idx = optionIndex(answer, q?.options);
    const score = idx >= 0 ? k.map[idx] ?? k.map[k.map.length - 1] : 0;
    return { ...k, answer, score, max: 25 };
  });
  const total = parts.reduce((s, p) => s + p.score, 0);
  return { total, parts, maxScore: 100 };
}

export function ostrcSeverity(total) {
  if (total === 0) return { label: "Sem problema", color: "green" };
  if (total <= 25) return { label: "Leve", color: "yellow" };
  if (total <= 50) return { label: "Moderado", color: "orange" };
  return { label: "Grave", color: "red" };
}

/** Alerta do original: total ≥ 40 ou variação ≥ 18,5 pontos vs. coleta anterior. */
export function ostrcAlert(total, prevTotal) {
  if (total >= 40) return { alert: true, reason: `Pontuação total elevada (${total}/100)` };
  if (prevTotal != null && Math.abs(total - prevTotal) >= 18.5) {
    return {
      alert: true,
      reason: `Variação de ${Math.abs(total - prevTotal).toFixed(0)} pontos em relação à coleta anterior`,
    };
  }
  return { alert: false };
}

// ---------------------------------------------------------------- EDAJ–AKPS
// 13 itens com pontuação própria por alternativa (tabela do instrumento),
// total 0–100. Escore alto = menos sintomas; ≥ 85 é o alerta usado no original.
// As tabelas abaixo são as do questionário aplicado, item por item.
const EDAJ_POINTS = [
  [5, 3, 0],              // 1. Claudicação
  [5, 3, 0],              // 2. Suporta carga
  [5, 3, 2, 0],           // 3. Caminhar
  [10, 8, 5, 0],          // 4. Escadas
  [5, 4, 3, 2, 0],        // 5. Agachar
  [10, 8, 6, 3, 0],       // 6. Correr
  [10, 7, 2, 0],          // 7. Saltar
  [10, 8, 6, 4, 0],       // 8. Sentado prolongado
  [10, 8, 6, 3, 0],       // 9. Dor
  [10, 8, 6, 4, 0],       // 10. Inchaço
  [10, 6, 4, 2, 0],       // 11. Movimentos anormais da patela
  [5, 3, 0],              // 12. Atrofia do quadríceps
  [5, 3, 0],              // 13. Déficit de flexão
];
export const EDAJ_LABELS = [
  "Claudicação", "Suporta carga", "Caminhar", "Escadas", "Agachar", "Correr",
  "Saltar", "Sentado prolongado", "Dor", "Inchaço", "Movimentos anormais",
  "Atrofia do quadríceps", "Déficit de flexão",
];

export function computeEDAJ(questionnaire, answers) {
  if (!answers?.length) return null;
  const qs = questionnaire?.questions || [];
  let total = 0;
  const details = qs.map((q, i) => {
    const answer = answerFor(answers, q, i);
    const idx = optionIndex(answer, q.options);
    const table = EDAJ_POINTS[i] || [];
    const maxScore = table[0] ?? 0;
    // fora do intervalo da tabela a pontuação é 0 (mesma regra do original)
    const score = idx >= 0 && idx < table.length ? table[idx] : 0;
    total += score;
    return { key: String(i + 1), label: EDAJ_LABELS[i] || q.text, answer, score, maxScore };
  });
  return { total, details, maxScore: 100 };
}

export function edajStatus(total) {
  if (total >= 85) return { label: "ALERTA", color: "red" };
  if (total >= 50) return { label: "MODERADO", color: "orange" };
  if (total >= 25) return { label: "LEVE", color: "yellow" };
  return { label: "EXCELENTE", color: "green" };
}

// ---------------------------------------------------------------- EISDF–PSS
// 10 itens, 0–10 cada, total 0–100 (maior = pior).
const INCAPACITANTE = 10; // "Não consigo executar a tarefa anterior" / "Muita dor que me impede"

export function computeEISDF(questionnaire, answers) {
  if (!answers?.length) return null;
  const qs = questionnaire?.questions || [];
  let total = 0;
  let counted = 0;
  const details = qs.map((q, i) => {
    const answer = answerFor(answers, q, i);
    const a = norm(answer);
    let score = null;
    if (a.startsWith("nao faco") || a.startsWith("outro") || a === "") {
      score = null; // não conta para o total
    } else if (a.includes("nao consigo executar") || a.includes("muita dor que me impede")) {
      score = INCAPACITANTE;
    } else {
      const n = parseInt(answer, 10);
      if (!Number.isNaN(n) && n >= 0 && n <= 10) score = n;
    }
    if (score !== null) { total += score; counted++; }
    return { key: String(i + 1), label: q.text, answer, score, counted: score !== null };
  });
  return { total, details, countedQuestions: counted, maxScore: counted * 10 };
}

export function eisdfStatus(total) {
  if (total >= 70) return { label: "ALERTA", color: "red" };
  if (total >= 40) return { label: "MODERADO", color: "orange" };
  if (total >= 20) return { label: "LEVE", color: "yellow" };
  return { label: "EXCELENTE", color: "green" };
}

// ---------------------------------------------------------------- despacho
export function scoreResponse(questionnaire, answers) {
  const kind = questionnaire?.kind;
  if (kind === "OSTRC") {
    const s = computeOSTRC(questionnaire, answers);
    return s && { ...s, kind, severity: ostrcSeverity(s.total), higherIsBetter: false };
  }
  if (kind === "EDAJ") {
    const s = computeEDAJ(questionnaire, answers);
    return s && { ...s, kind, severity: edajStatus(s.total), higherIsBetter: true };
  }
  if (kind === "EISDF") {
    const s = computeEISDF(questionnaire, answers);
    return s && { ...s, kind, severity: eisdfStatus(s.total), higherIsBetter: false };
  }
  return null;
}

/** Ordena coletas da mais antiga para a mais recente (o original confiava na API). */
export function sortByDateAsc(list, field = "date") {
  return [...list].sort((a, b) => String(a[field]).localeCompare(String(b[field])));
}
