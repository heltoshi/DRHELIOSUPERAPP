/**
 * INSTRUMENTOS DE PROM — 17 questionários, todos respondidos pelo paciente.
 * ---------------------------------------------------------------------------
 * FONTE: transplantado do `lib/questionnaires` do app Base44 da clínica
 * (fornecido pelo Helio em 30/10/2026). Os itens, opções e a LÓGICA DE CÁLCULO
 * vieram de lá sem reescrita — os números precisam ser idênticos aos do app
 * antigo, senão o histórico do paciente deixa de ser comparável.
 *
 * ⚠️ DUAS INCONSISTÊNCIAS ENCONTRADAS NO ARQUIVO DE ORIGEM (transcritas como
 *    estão, marcadas no código, aguardando decisão do Helio):
 *
 *    1. HOOS — a lista tem 41 itens (qol com 4), mas `scoreHOOS` usa
 *       qol count=3 e divide por 40×4. O 41º item nunca é pontuado e o escore
 *       nunca alcança 100 (teto 97,5). Marcado com // BUG-HOOS.
 *
 *    2. BRUMS — o mapa de subescalas aponta "depressão" para os índices
 *       20-23, que são itens de raiva/confusão/fadiga/tensão. Não há item de
 *       depressão na lista de 24. Marcado com // BUG-BRUMS.
 *
 * ESTRUTURA DE UM ITEM
 *   type "choice" → opções fixas, cada uma com `score` próprio
 *   type "scale"  → escala numérica (min..max)
 *   type "slider" → barra 0..max SEM valor padrão (nunca grava sem toque)
 */

/* ==========================================================================
   HELPERS DE MONTAGEM
   ========================================================================== */

const rangeOpts = (labels) => labels.map((label, score) => ({ label, score }));

/** Opções numéricas 0..max de step em step (VAS 0-100 de 10 em 10). */
const vasOpts = (max = 100, step = 10) => {
  const out = [];
  for (let v = 0; v <= max; v += step) out.push({ label: String(v), score: v });
  return out;
};

const LIKERT_0_4 = rangeOpts(["Nenhuma", "Leve", "Moderada", "Intensa", "Extrema"]);
const LIKERT_0_4_WOMAC = rangeOpts([
  "Nenhuma",
  "Leve",
  "Moderada",
  "Intensa",
  "Muito intensa",
]);
const SPADI_0_10 = rangeOpts(Array.from({ length: 11 }, (_, i) => String(i)));
const EDEQ_0_6 = rangeOpts([
  "Nenhum dia / Nada",
  "1-5 dias",
  "6-12 dias",
  "13-15 dias",
  "16-22 dias",
  "23-27 dias",
  "Todos os dias (28 dias)",
]);
const BRUMS_0_4 = rangeOpts(["Nada", "Um pouco", "Moderadamente", "Bastante", "Extremamente"]);
const QDASH_1_5 = rangeOpts([
  "Nenhuma dificuldade / Não",
  "Dificuldade leve / Mínima",
  "Dificuldade moderada / Moderada",
  "Dificuldade intensa / Intensa",
  "Incapaz / Extrema",
]);
const SST_SIM_NAO = [
  { label: "Sim", score: 1 },
  { label: "Não", score: 0 },
];
const HOS_0_4 = rangeOpts([
  "Sem dificuldade",
  "Dificuldade leve",
  "Dificuldade moderada",
  "Dificuldade extrema",
  "Incapaz / Não realizo",
]).map((o, i) => ({ ...o, score: 4 - i }));

/** Constrói itens de escolha a partir de uma lista de textos. */
const choiceItems = (prefix, texts, options, startAt = 1) =>
  texts.map((label, i) => ({
    id: `${prefix}${startAt + i}`,
    type: "choice",
    label,
    options,
  }));

/* ==========================================================================
   JOELHO
   ========================================================================== */

const WOMAC = {
  id: "womac",
  name: "WOMAC — Osteoartrite de Joelho",
  short: "WOMAC",
  color: "#3B82F6",
  description: "24 itens: dor (5), rigidez (2) e função (17). Escore menor = melhor.",
  scaleMax: 96,
  higherIsBetter: false,
  scoring: "womac",
  periodicity: "Semanas 0, 4, 8, 12",
  sections: [
    {
      title: "Dor",
      items: choiceItems(
        "w",
        [
          "Qual a intensidade da dor ao caminhar em superfície plana?",
          "Qual a intensidade da dor ao subir ou descer escadas?",
          "Qual a intensidade da dor à noite, na cama?",
          "Qual a intensidade da dor ao sentar ou deitar?",
          "Qual a intensidade da dor ao ficar em pé?",
        ],
        LIKERT_0_4_WOMAC,
      ),
    },
    {
      title: "Rigidez",
      items: choiceItems(
        "w",
        [
          "Qual a intensidade da rigidez ao acordar de manhã?",
          "Qual a intensidade da rigidez ao longo do dia, após sentar, deitar ou descansar?",
        ],
        LIKERT_0_4_WOMAC,
        6,
      ),
    },
    {
      title: "Função",
      items: choiceItems(
        "w",
        [
          "Qual o grau de dificuldade ao descer escadas?",
          "Qual o grau de dificuldade ao subir escadas?",
          "Qual o grau de dificuldade ao levantar-se da posição sentada?",
          "Qual o grau de dificuldade ao ficar em pé?",
          "Qual o grau de dificuldade ao abaixar-se para pegar algo no chão?",
          "Qual o grau de dificuldade ao caminhar em superfície plana?",
          "Qual o grau de dificuldade ao entrar ou sair do carro?",
          "Qual o grau de dificuldade ao fazer compras?",
          "Qual o grau de dificuldade ao colocar meias?",
          "Qual o grau de dificuldade ao levantar-se da cama?",
          "Qual o grau de dificuldade ao tirar meias?",
          "Qual o grau de dificuldade ao deitar na cama?",
          "Qual o grau de dificuldade ao entrar ou sair do banho?",
          "Qual o grau de dificuldade ao sentar?",
          "Qual o grau de dificuldade ao sentar ou levantar do vaso sanitário?",
          "Qual o grau de dificuldade ao fazer tarefas domésticas pesadas?",
          "Qual o grau de dificuldade ao fazer tarefas domésticas leves?",
        ],
        LIKERT_0_4_WOMAC,
        8,
      ),
    },
  ],
};

const KOOS = {
  id: "koos",
  name: "KOOS — Lesões e Artrose de Joelho",
  short: "KOOS",
  color: "#10B981",
  description:
    "42 itens em 5 subescalas. Normalizado 0-100, maior = melhor.",
  scaleMax: 100,
  higherIsBetter: true,
  scoring: "koos",
  periodicity: "Mensal",
  sections: [
    {
      title: "Sintomas",
      items: choiceItems(
        "k",
        [
          "Você tem inchaço no joelho?",
          "Você sente rangido, estalido ou qualquer tipo de ruído ao mover o joelho?",
          "Seu joelho trava ou bloqueia ao mover?",
          "Você consegue esticar o joelho completamente?",
          "Você consegue dobrar o joelho completamente?",
          "Qual o grau de rigidez ao acordar de manhã?",
          "Qual o grau de rigidez após sentar, deitar ou descansar durante o dia?",
        ],
        LIKERT_0_4,
      ),
    },
    {
      title: "Dor",
      items: choiceItems(
        "k",
        [
          "Com que frequência sente dor no joelho?",
          "Dor ao girar/torcer o joelho?",
          "Dor ao esticar o joelho completamente?",
          "Dor ao dobrar o joelho completamente?",
          "Dor ao caminhar em superfície plana?",
          "Dor ao subir ou descer escadas?",
          "Dor à noite, na cama?",
          "Dor ao sentar ou deitar?",
          "Dor ao ficar em pé?",
        ],
        LIKERT_0_4,
        8,
      ),
    },
    {
      title: "Atividades de vida diária",
      items: choiceItems(
        "k",
        [
          "Dificuldade ao descer escadas?",
          "Dificuldade ao subir escadas?",
          "Dificuldade ao levantar-se da posição sentada?",
          "Dificuldade ao ficar em pé?",
          "Dificuldade ao abaixar-se para pegar algo?",
          "Dificuldade ao caminhar em superfície plana?",
          "Dificuldade ao entrar/sair do carro?",
          "Dificuldade ao fazer compras?",
          "Dificuldade ao colocar meias?",
          "Dificuldade ao levantar da cama?",
          "Dificuldade ao tirar meias?",
          "Dificuldade ao deitar na cama?",
          "Dificuldade ao entrar/sair do banho?",
          "Dificuldade ao sentar?",
          "Dificuldade ao sentar/levantar do vaso sanitário?",
          "Dificuldade ao fazer tarefas domésticas pesadas?",
          "Dificuldade ao fazer tarefas domésticas leves?",
        ],
        LIKERT_0_4,
        17,
      ),
    },
    {
      title: "Esporte e recreação",
      items: choiceItems(
        "k",
        [
          "Dificuldade ao agachar?",
          "Dificuldade ao correr?",
          "Dificuldade ao pular?",
          "Dificuldade ao girar sobre o joelho lesionado?",
          "Dificuldade ao ajoelhar?",
        ],
        LIKERT_0_4,
        34,
      ),
    },
    {
      title: "Qualidade de vida",
      items: choiceItems(
        "k",
        [
          "Com que frequência você percebe o problema no joelho?",
          "Você modificou seu estilo de vida para evitar atividades que prejudicam o joelho?",
          "Qual seu grau de preocupação com a falta de confiança no joelho?",
          "De modo geral, quanta dificuldade você tem com o joelho?",
        ],
        LIKERT_0_4,
        39,
      ),
    },
  ],
};

const EDAJ = {
  id: "edaj",
  name: "EDAJ (Kujala) — Dor Anterior no Joelho",
  short: "EDAJ",
  color: "#F59E0B",
  description:
    "13 itens com pontuação variável por item. 0-100, maior = melhor.",
  scaleMax: 100,
  higherIsBetter: true,
  scoring: "edaj",
  periodicity: "Mensal",
  sections: [
    {
      title: "Função e sintomas",
      items: [
        {
          id: "e1",
          type: "choice",
          label: "Claudicação (mancar)",
          options: [
            { label: "Nenhuma", score: 5 },
            { label: "Leve ou periódica", score: 3 },
            { label: "Constante", score: 0 },
          ],
        },
        {
          id: "e2",
          type: "choice",
          label: "Apoio",
          options: [
            { label: "Apoio total sem dor", score: 5 },
            { label: "Apoio doloroso", score: 3 },
            { label: "Apoio impossível (< 0.5 kg)", score: 0 },
          ],
        },
        {
          id: "e3",
          type: "choice",
          label: "Marcha",
          options: [
            { label: "Ilimitada", score: 5 },
            { label: "Mais de 2 km", score: 3 },
            { label: "1-2 km", score: 1 },
            { label: "Incapaz", score: 0 },
          ],
        },
        {
          id: "e4",
          type: "choice",
          label: "Escadas",
          options: [
            { label: "Sem dificuldade", score: 10 },
            { label: "Dor leve ao descer", score: 8 },
            { label: "Dor ao subir e descer", score: 5 },
            { label: "Incapaz", score: 2 },
          ],
        },
        {
          id: "e5",
          type: "choice",
          label: "Agachamento",
          options: [
            { label: "Sem dificuldade", score: 5 },
            { label: "Repetição limitada", score: 4 },
            { label: "Não além de 90°", score: 3 },
            { label: "Impossível", score: 0 },
          ],
        },
        {
          id: "e6",
          type: "choice",
          label: "Corrida",
          options: [
            { label: "Sem dificuldade", score: 10 },
            { label: "Dor após 2 km", score: 8 },
            { label: "Dor leve desde o início", score: 5 },
            { label: "Dor intensa", score: 2 },
            { label: "Incapaz", score: 0 },
          ],
        },
        {
          id: "e7",
          type: "choice",
          label: "Salto",
          options: [
            { label: "Sem dificuldade", score: 10 },
            { label: "Dor leve", score: 7 },
            { label: "Dor constante", score: 2 },
            { label: "Incapaz", score: 0 },
          ],
        },
        {
          id: "e8",
          type: "choice",
          label: "Sentar por tempo prolongado com os joelhos flexionados",
          options: [
            { label: "Sem dificuldade", score: 10 },
            { label: "Dor após exercício", score: 8 },
            { label: "Dor constante", score: 6 },
            { label: "Dor obriga a estender os joelhos", score: 4 },
            { label: "Incapaz", score: 0 },
          ],
        },
        {
          id: "e9",
          type: "choice",
          label: "Dor",
          options: [
            { label: "Nenhuma", score: 10 },
            { label: "Leve e ocasional", score: 8 },
            { label: "Interfere com o sono", score: 6 },
            { label: "Ocasionalmente intensa", score: 3 },
            { label: "Constante e intensa", score: 0 },
          ],
        },
        {
          id: "e10",
          type: "choice",
          label: "Inchaço",
          options: [
            { label: "Nenhum", score: 10 },
            { label: "Após esforço intenso", score: 8 },
            { label: "Após atividades diárias", score: 6 },
            { label: "Toda noite", score: 4 },
            { label: "Constante", score: 0 },
          ],
        },
        {
          id: "e11",
          type: "choice",
          label: "Subluxação patelar (deslocamento da patela)",
          options: [
            { label: "Nenhuma", score: 10 },
            { label: "Ocasionalmente em atividades esportivas", score: 6 },
            { label: "Ocasionalmente em atividades diárias", score: 2 },
            { label: "Mais de 2 episódios de luxação", score: 0 },
          ],
        },
        {
          id: "e12",
          type: "choice",
          label: "Atrofia da coxa",
          options: [
            { label: "Nenhuma", score: 5 },
            { label: "1-2 cm", score: 3 },
            { label: "Mais de 2 cm", score: 0 },
          ],
        },
        {
          id: "e13",
          type: "choice",
          label: "Flexão do joelho com déficit",
          options: [
            { label: "Nenhum", score: 5 },
            { label: "Leve", score: 3 },
            { label: "Grave", score: 0 },
          ],
        },
      ],
    },
  ],
};

const VISA_P = {
  id: "visa_p",
  name: "VISA-P Brasil — Tendinopatia Patelar",
  short: "VISA-P",
  color: "#8B5CF6",
  description: "8 itens, 0-100. Escore maior = melhor.",
  scaleMax: 100,
  higherIsBetter: true,
  scoring: "sum",
  periodicity: "Semanas 0, 6, 12",
  sections: [
    {
      title: "Sintomas e função",
      items: [
        {
          id: "v1",
          type: "choice",
          label: "Por quantos minutos você consegue ficar sentado sem dor?",
          options: [
            { label: "0 minutos", score: 0 },
            { label: "10 minutos", score: 2 },
            { label: "20 minutos", score: 5 },
            { label: "30 minutos", score: 7 },
            { label: "Sem dor", score: 10 },
          ],
        },
        {
          id: "v2",
          type: "choice",
          label: "Você tem dor ao descer escadas com passo normal?",
          options: [
            { label: "Dor intensa/severa", score: 0 },
            { label: "Dor moderada", score: 3 },
            { label: "Dor leve", score: 5 },
            { label: "Dor mínima", score: 7 },
            { label: "Sem dor", score: 10 },
          ],
        },
        {
          id: "v3",
          type: "choice",
          label: "Você tem dor no joelho ao estender ativamente o joelho sem carga?",
          options: [
            { label: "Dor intensa/severa", score: 0 },
            { label: "Dor moderada", score: 3 },
            { label: "Dor leve", score: 5 },
            { label: "Dor mínima", score: 7 },
            { label: "Sem dor", score: 10 },
          ],
        },
        {
          id: "v4",
          type: "choice",
          label: "Você tem dor ao fazer agachamento (lunge)?",
          options: [
            { label: "Dor intensa/severa", score: 0 },
            { label: "Dor moderada", score: 3 },
            { label: "Dor leve", score: 5 },
            { label: "Dor mínima", score: 7 },
            { label: "Sem dor", score: 10 },
          ],
        },
        {
          id: "v5",
          type: "choice",
          label: "Você tem problemas ao agachar?",
          options: [
            { label: "Incapaz", score: 0 },
            { label: "Dor intensa", score: 3 },
            { label: "Dor moderada", score: 5 },
            { label: "Dor leve", score: 7 },
            { label: "Sem dor", score: 10 },
          ],
        },
        {
          id: "v6",
          type: "choice",
          label: "Você tem dor durante ou imediatamente após fazer 10 saltos em uma perna?",
          options: [
            { label: "Incapaz", score: 0 },
            { label: "Dor intensa", score: 3 },
            { label: "Dor moderada", score: 5 },
            { label: "Dor leve", score: 7 },
            { label: "Sem dor", score: 10 },
          ],
        },
        {
          id: "v7",
          type: "choice",
          label: "Você está praticando esportes ou atividades físicas atualmente?",
          options: [
            { label: "Não, devido à dor", score: 0 },
            { label: "Treinamento modificado, com limitações", score: 4 },
            { label: "Treinamento completo, mas não em competição", score: 7 },
            { label: "Competindo no mesmo nível ou acima", score: 10 },
          ],
        },
        {
          id: "v8",
          type: "choice",
          label: "Por quanto tempo você consegue treinar/praticar atividade física?",
          options: [
            { label: "Não consigo", score: 0 },
            { label: "1-10 minutos", score: 7 },
            { label: "11-20 minutos", score: 14 },
            { label: "21-30 minutos", score: 21 },
            { label: "Mais de 30 minutos, sem dor", score: 30 },
          ],
        },
      ],
    },
  ],
};

const EVA = {
  id: "eva",
  name: "EVA — Escala Visual Analógica de Dor",
  short: "EVA",
  color: "#EF4444",
  description: "Intensidade da dor agora, de 0 a 10. Menor = melhor.",
  scaleMax: 10,
  higherIsBetter: false,
  scoring: "sum",
  periodicity: "Semanal",
  sections: [
    {
      title: "Dor",
      items: [
        {
          id: "eva1",
          type: "scale",
          label: "Qual a intensidade da sua dor neste momento?",
          min: 0,
          max: 10,
          minLabel: "Sem dor",
          maxLabel: "Pior dor imaginável",
        },
      ],
    },
  ],
};

/* ==========================================================================
   OMBRO
   ========================================================================== */

const SPADI = {
  id: "spadi",
  name: "SPADI — Dor e Incapacidade do Ombro",
  short: "SPADI",
  color: "#0EA5E9",
  description: "13 itens (dor 5 + incapacidade 8), cada 0-10. 0-100, MAIOR = PIOR.",
  scaleMax: 100,
  higherIsBetter: false,
  scoring: "spadi",
  periodicity: "Semanas 0, 4, 8, 12",
  sections: [
    {
      title: "Dor",
      items: choiceItems(
        "s",
        [
          "Qual a intensidade da dor quando é pior?",
          "Qual a intensidade da dor quando você deita sobre o lado afetado?",
          "Qual a intensidade da dor ao alcançar um objeto em uma prateleira alta?",
          "Qual a intensidade da dor ao tocar a nuca?",
          "Qual a intensidade da dor ao empurrar com o braço afetado?",
        ],
        SPADI_0_10,
      ),
    },
    {
      title: "Incapacidade",
      items: choiceItems(
        "s",
        [
          "Dificuldade de lavar o cabelo?",
          "Dificuldade de lavar as costas?",
          "Dificuldade de vestir uma camiseta ou blusa?",
          "Dificuldade de vestir uma camisa com botões na frente?",
          "Dificuldade de vestir as calças?",
          "Dificuldade de colocar um objeto em uma prateleira alta?",
          "Dificuldade de carregar um objeto pesado de 4,5 kg ou mais?",
          "Dificuldade de retirar algo do bolso traseiro da calça?",
        ],
        SPADI_0_10,
        6,
      ),
    },
  ],
};

const QUICKDASH = {
  id: "quickdash",
  name: "QuickDASH — Incapacidade do Membro Superior",
  short: "QDASH",
  color: "#D946EF",
  description: "11 itens, 1-5. Normalizado 0-100, MAIOR = PIOR.",
  scaleMax: 100,
  higherIsBetter: false,
  scoring: "quickdash",
  periodicity: "Semanas 0, 6, 12",
  sections: [
    {
      title: "Última semana",
      items: choiceItems(
        "qd",
        [
          "Abrir um pote (vidro) novo ou com tampa bem fechada?",
          "Fazer tarefas domésticas pesadas (lavar o chão, lavar paredes)?",
          "Carregar uma sacola de compras ou uma maleta?",
          "Lavar as costas?",
          "Usar uma faca para cortar alimentos?",
          "Atividades de lazer que exigem algum esforço do braço, ombro ou mão (ex.: golfe, tênis, martelo)?",
          "Durante a semana passada, sua atividade de trabalho ou de outras atividades foi limitada?",
          "Dor no braço, no ombro ou na mão durante as últimas semanas?",
          "Formigamento (agulhadas/choque) no braço, no ombro ou na mão nas últimas semanas?",
          "Dificuldade para dormir nas últimas semanas devido ao seu problema de ombro/braço/mão?",
          "Me sinto menos capaz, com menos confiança ou menos útil por causa do meu problema no braço, ombro ou mão.",
        ],
        QDASH_1_5,
      ),
    },
  ],
};

const WORC = {
  id: "worc",
  name: "WORC — Manguito Rotador",
  short: "WORC",
  color: "#F97316",
  description:
    "21 itens em 5 domínios, cada 0-100 (VAS). Normalizado 0-100, maior = melhor.",
  scaleMax: 100,
  higherIsBetter: true,
  scoring: "worc",
  periodicity: "Semanas 0, 6, 12",
  sections: [
    {
      title: "Físico",
      items: choiceItems(
        "wo",
        [
          "Dor ao levantar objetos pesados acima da cabeça?",
          "Dificuldade de levantar o braço para lavar/pentear o cabelo?",
          "Dificuldade para alcançar algo acima da cabeça?",
          "Dificuldade de lançar ou arremessar um objeto?",
          "Dor ao realizar atividades físicas pesadas (ex.: cavar, carregar peso)?",
        ],
        vasOpts(),
      ),
    },
    {
      title: "Esporte e recreação",
      items: choiceItems(
        "wo",
        [
          "Dificuldade em esportes que exigem movimentos acima da cabeça (ex.: natação, tênis, vôlei)?",
          "Dificuldade em atividades recreativas que envolvem o uso do braço?",
          "Dificuldade em atividades de lazer que exigem força ou resistência do braço?",
          "Dificuldade de trabalho ou hobby que exige elevação repetitiva do braço?",
        ],
        vasOpts(),
        6,
      ),
    },
    {
      title: "Trabalho",
      items: choiceItems(
        "wo",
        [
          "Dificuldade de trabalhar com o braço elevado por período prolongado?",
          "Dificuldade em atividades de trabalho que exigem levantamento de peso?",
          "Dificuldade de empurrar/puxar objetos pesados no trabalho?",
          "Dificuldade de trabalho ou tarefa repetitiva envolvendo o ombro?",
        ],
        vasOpts(),
        10,
      ),
    },
    {
      title: "Estilo de vida",
      items: choiceItems(
        "wo",
        [
          "Dificuldade de dormir por causa do ombro?",
          "Dificuldade de deitar sobre o lado do ombro afetado?",
          "Consciência do ombro durante atividades rotineiras?",
          "Dificuldade de se vestir (ex.: colocar casaco, sutiã)?",
        ],
        vasOpts(),
        14,
      ),
    },
    {
      title: "Emocional",
      items: choiceItems(
        "wo",
        [
          "Preocupação com o ombro não melhorar?",
          "Frustração pela incapacidade de realizar as atividades desejadas?",
          "Medo de machucar o ombro novamente?",
          "Sensação de fragilidade ou insegurança do ombro?",
        ],
        vasOpts(),
        18,
      ),
    },
  ],
};

const SST = {
  id: "sst",
  name: "SST — Simple Shoulder Test",
  short: "SST",
  color: "#14B8A6",
  description: "12 perguntas de sim/não. Normalizado 0-100, maior = melhor.",
  scaleMax: 100,
  higherIsBetter: true,
  scoring: "sst",
  periodicity: "Semanas 0, 6, 12",
  sections: [
    {
      title: "Função do ombro",
      items: choiceItems(
        "sst",
        [
          "É confortável para você dormir do lado afetado?",
          "Você consegue dormir sem acordar de dor por causa do ombro?",
          "Você consegue colocar a mão atrás das costas para colocar a camisa dentro da calça?",
          "Você consegue colocar a mão no bolso traseiro da calça?",
          "Você consegue colocar a mão atrás da cabeça com o cotovelo para o lado?",
          "Você consegue colocar uma moeda em uma prateleira no nível dos olhos sem dobrar o cotovelo?",
          "Você consegue levantar 500g (uma lata de refrigerante) até a altura do ombro com o cotovelo estendido?",
          "Você consegue levantar 4,5 kg (um saco de batatas) até a altura do ombro?",
          "Você consegue carregar 10 kg (uma maleta ou bolsa pesada) com o braço ao lado do corpo?",
          "Você consegue lançar uma bola por cima da cabeça pelo menos a 9 metros?",
          "Você consegue jogar uma bola por baixo pelo menos a 9 metros?",
          "Você consegue lavar as costas/a parte de trás da cabeça?",
        ],
        SST_SIM_NAO,
      ),
    },
  ],
};

const OSS_PAIN = [
  { label: "Nunca / Nenhuma dor", score: 4 },
  { label: "Apenas ocasionalmente", score: 3 },
  { label: "Alguns dias", score: 2 },
  { label: "Na maioria dos dias", score: 1 },
  { label: "Todos os dias / Dor constante", score: 0 },
];

const OSS_FUNCTION = [
  { label: "Sim, sem dificuldade", score: 4 },
  { label: "Com pequena dificuldade", score: 3 },
  { label: "Com moderada dificuldade", score: 2 },
  { label: "Com muita dificuldade", score: 1 },
  { label: "Não consegui fazer", score: 0 },
];

const OSS = {
  id: "oss",
  name: "OSS — Oxford Shoulder Score",
  short: "OSS",
  color: "#6366F1",
  description: "12 itens, cada 0-4. Normalizado 0-100, maior = melhor.",
  scaleMax: 100,
  higherIsBetter: true,
  scoring: "oss",
  periodicity: "Semanas 0, 6, 12",
  sections: [
    {
      title: "Últimas 4 semanas",
      items: [
        {
          id: "oss1",
          type: "choice",
          label: "Com que frequência você sentiu dor no ombro?",
          options: OSS_PAIN,
        },
        {
          id: "oss2",
          type: "choice",
          label: "A dor perturbou seu sono noturno?",
          options: OSS_PAIN,
        },
        {
          id: "oss3",
          type: "choice",
          label:
            "A dor interferiu em suas atividades normais de trabalho (incluindo tarefas domésticas)?",
          options: OSS_PAIN,
        },
        {
          id: "oss4",
          type: "choice",
          label: "Você conseguiu usar transporte público ou dirigir um carro?",
          options: OSS_FUNCTION,
        },
        {
          id: "oss5",
          type: "choice",
          label: "Você conseguiu lavar e secar embaixo dos dois braços?",
          options: OSS_FUNCTION,
        },
        {
          id: "oss6",
          type: "choice",
          label: "Você conseguiu fazer sua higiene pessoal (como lavar as axilas)?",
          options: OSS_FUNCTION,
        },
        {
          id: "oss7",
          type: "choice",
          label: "Você conseguiu se vestir sozinho completamente?",
          options: OSS_FUNCTION,
        },
        {
          id: "oss8",
          type: "choice",
          label: "Você conseguiu fazer compras sozinho?",
          options: OSS_FUNCTION,
        },
        {
          id: "oss9",
          type: "choice",
          label: "Você conseguiu carregar uma bandeja com comida usando o braço afetado?",
          options: OSS_FUNCTION,
        },
        {
          id: "oss10",
          type: "choice",
          label: "Você conseguiu pentear o cabelo sozinho?",
          options: OSS_FUNCTION,
        },
        {
          id: "oss11",
          type: "choice",
          label: "Você conseguiu alcançar uma prateleira acima da cabeça?",
          options: OSS_FUNCTION,
        },
        {
          id: "oss12",
          type: "choice",
          label: "Você conseguiu pendurar roupa em um varal?",
          options: OSS_FUNCTION,
        },
      ],
    },
  ],
};

/* ==========================================================================
   QUADRIL
   ========================================================================== */

const HOOS = {
  id: "hoos",
  name: "HOOS — Osteoartrite do Quadril",
  short: "HOOS",
  color: "#0891B2",
  description: "41 itens em 5 subescalas. Normalizado 0-100, maior = melhor.",
  scaleMax: 100,
  higherIsBetter: true,
  scoring: "hoos",
  periodicity: "Semanas 0, 4, 8, 12",
  sections: [
    {
      title: "Sintomas",
      items: choiceItems(
        "h",
        [
          "Você sente rangido, estalido ou qualquer tipo de ruído ao mover o quadril?",
          "Seu quadril trava ou bloqueia ao mover?",
          "Você consegue esticar o quadril completamente?",
          "Você consegue dobrar o quadril completamente?",
          "Qual o grau de rigidez ao acordar de manhã?",
          "Qual o grau de rigidez após sentar, deitar ou descansar durante o dia?",
        ],
        LIKERT_0_4,
      ),
    },
    {
      title: "Dor",
      items: choiceItems(
        "h",
        [
          "Com que frequência sente dor no quadril?",
          "Dor ao girar o quadril?",
          "Dor ao esticar o quadril completamente?",
          "Dor ao dobrar o quadril completamente?",
          "Dor ao caminhar em superfície plana?",
          "Dor ao subir ou descer escadas?",
          "Dor à noite, na cama?",
          "Dor ao sentar ou deitar?",
          "Dor ao ficar em pé?",
        ],
        LIKERT_0_4,
        7,
      ),
    },
    {
      title: "Atividades de vida diária",
      items: choiceItems(
        "h",
        [
          "Dificuldade ao descer escadas?",
          "Dificuldade ao subir escadas?",
          "Dificuldade ao levantar-se da posição sentada?",
          "Dificuldade ao ficar em pé?",
          "Dificuldade ao abaixar-se para pegar algo?",
          "Dificuldade ao caminhar em superfície plana?",
          "Dificuldade ao entrar/sair do carro?",
          "Dificuldade ao fazer compras?",
          "Dificuldade ao colocar meias?",
          "Dificuldade ao levantar da cama?",
          "Dificuldade ao tirar meias?",
          "Dificuldade ao deitar na cama?",
          "Dificuldade ao entrar/sair do banho?",
          "Dificuldade ao sentar?",
          "Dificuldade ao sentar/levantar do vaso sanitário?",
          "Dificuldade ao fazer tarefas domésticas pesadas?",
          "Dificuldade ao fazer tarefas domésticas leves?",
        ],
        LIKERT_0_4,
        16,
      ),
    },
    {
      title: "Esporte e recreação",
      items: choiceItems(
        "h",
        [
          "Dificuldade ao agachar?",
          "Dificuldade ao correr?",
          "Dificuldade ao pular?",
          "Dificuldade ao girar sobre o quadril lesionado?",
          "Dificuldade ao ajoelhar?",
        ],
        LIKERT_0_4,
        33,
      ),
    },
    {
      title: "Qualidade de vida",
      items: choiceItems(
        "h",
        [
          "Com que frequência você percebe o problema no quadril?",
          "Você modificou seu estilo de vida para evitar atividades que prejudicam o quadril?",
          "Qual seu grau de preocupação com a falta de confiança no quadril?",
          "De modo geral, quanta dificuldade você tem com o quadril?",
        ],
        LIKERT_0_4,
        38,
      ),
    },
  ],
};

const HAGOS = {
  id: "hagos",
  name: "HAGOS — Quadril e Virilha",
  short: "HAGOS",
  color: "#7C3AED",
  description: "35 itens em 6 subescalas. Normalizado 0-100, maior = melhor.",
  scaleMax: 100,
  higherIsBetter: true,
  scoring: "hagos",
  periodicity: "Semanas 0, 6, 12",
  sections: [
    {
      title: "Sintomas",
      items: choiceItems(
        "hg",
        [
          "Você tem inchaço no quadril/virilha?",
          "Você sente rangido ou estalido ao mover o quadril?",
          "Seu quadril trava ou bloqueia ao mover?",
          "Qual o grau de rigidez ao acordar de manhã?",
          "Qual o grau de rigidez após sentar ou descansar durante o dia?",
        ],
        LIKERT_0_4,
      ),
    },
    {
      title: "Dor",
      items: choiceItems(
        "hg",
        [
          "Com que frequência sente dor no quadril/virilha?",
          "Dor ao girar o quadril?",
          "Dor ao esticar o quadril completamente?",
          "Dor ao dobrar o quadril completamente?",
          "Dor ao caminhar em superfície plana?",
          "Dor ao subir ou descer escadas?",
          "Dor à noite, na cama?",
          "Dor ao sentar ou deitar?",
          "Dor ao ficar em pé por muito tempo?",
        ],
        LIKERT_0_4,
        6,
      ),
    },
    {
      title: "Atividades de vida diária",
      items: choiceItems(
        "hg",
        [
          "Dificuldade ao subir/descer escadas?",
          "Dificuldade ao agachar/dobrar os joelhos?",
          "Dificuldade ao caminhar em superfície plana?",
          "Dificuldade ao entrar/sair do carro?",
          "Dificuldade ao colocar meias ou sapatos?",
          "Dificuldade ao levantar da cama?",
          "Dificuldade ao realizar tarefas domésticas pesadas?",
          "Dificuldade ao realizar tarefas domésticas leves?",
        ],
        LIKERT_0_4,
        15,
      ),
    },
    {
      title: "Esporte e recreação",
      items: choiceItems(
        "hg",
        [
          "Dificuldade ao correr?",
          "Dificuldade ao pular ou saltar?",
          "Dificuldade ao fazer movimentos de torção?",
          "Dificuldade ao fazer movimentos de corte laterais?",
          "Dificuldade ao sentar com as pernas cruzadas?",
          "Dificuldade ao chutar uma bola?",
        ],
        LIKERT_0_4,
        23,
      ),
    },
    {
      title: "Recreação",
      items: choiceItems(
        "hg",
        [
          "Dificuldade ao se abaixar para amarrar os sapatos?",
          "Dificuldade em atividades recreativas moderadas (caminhada, ciclismo)?",
          "Dificuldade em atividades recreativas intensas (corrida, esportes)?",
        ],
        LIKERT_0_4,
        29,
      ),
    },
    {
      title: "Qualidade de vida",
      items: choiceItems(
        "hg",
        [
          "Com que frequência você percebe o problema no quadril?",
          "Você modificou seu estilo de vida para evitar atividades que prejudicam o quadril?",
          "Qual sua preocupação com a falta de confiança no quadril?",
          "De modo geral, quanta dificuldade você tem com o quadril?",
        ],
        LIKERT_0_4,
        32,
      ),
    },
  ],
};

const IHOT12 = {
  id: "ihot12",
  name: "iHOT-12 — Qualidade de Vida no Quadril",
  short: "iHOT",
  color: "#DB2777",
  description: "12 itens, cada 0-100 (VAS). Total = média. Maior = melhor.",
  scaleMax: 100,
  higherIsBetter: true,
  scoring: "ihot12",
  periodicity: "Semanas 0, 6, 12",
  sections: [
    {
      title: "Quadril",
      items: choiceItems(
        "ih",
        [
          "Dor no quadril durante atividades físicas intensas?",
          "Dor no quadril ao caminhar no dia a dia?",
          "Dor no quadril ao sentar por longo período?",
          "Dificuldade ao entrar/sair do carro?",
          "Dificuldade ao subir escadas?",
          "Dificuldade ao correr?",
          "Dificuldade ao realizar esportes ou atividades recreativas?",
          "Você teve que modificar sua forma de se exercitar por causa do quadril?",
          "O problema no quadril afeta seu trabalho ou atividades cotidianas?",
          "Preocupação com o quadril ao realizar atividades?",
          "Sentimento de frustração relacionado ao quadril?",
          "Pensamento sobre o quadril ao fazer suas atividades normais?",
        ],
        vasOpts(),
      ),
    },
  ],
};

const HOS = {
  id: "hos",
  name: "HOS — Hip Outcome Score",
  short: "HOS",
  color: "#059669",
  description: "29 itens: AVD (19) e esporte (10). Total ponderado 60/40. Maior = melhor.",
  scaleMax: 100,
  higherIsBetter: true,
  scoring: "hos",
  periodicity: "Semanas 0, 6, 12",
  sections: [
    {
      title: "Atividades de vida diária",
      items: choiceItems(
        "hos",
        [
          "Ficar em pé por 1 minuto?",
          "Ficar em pé por 10 minutos?",
          "Ficar em pé por mais de 1 hora?",
          "Caminhar por 1 minuto?",
          "Caminhar por 10 minutos?",
          "Caminhar por mais de 15 minutos?",
          "Subir escadas?",
          "Descer escadas?",
          "Entrar/sair do carro?",
          "Iniciar uma caminhada (primeiros passos)?",
          "Andar reto em superfície desigual?",
          "Subir e descer declives acentuados?",
          "Fazer atividades recreativas inicialmente?",
          "Fazer atividades recreativas por tempo prolongado?",
          "Ficar agachado?",
          "Cruzar as pernas ao sentar?",
          "Caminhar em superfície plana?",
          "Fazer tarefas domésticas leves?",
          "Fazer tarefas domésticas pesadas?",
        ],
        HOS_0_4,
      ),
    },
    {
      title: "Esporte",
      items: choiceItems(
        "hos",
        [
          "Realizar atividade física leve?",
          "Realizar atividade física moderada?",
          "Realizar atividade física intensa?",
          "Realizar atividade física de alta intensidade?",
          "Capacidade de participar de esportes recreativos?",
          "Capacidade de participar de esportes competitivos?",
          "Correr em superfície plana?",
          "Correr em superfície irregular?",
          "Girar/torcer sobre o quadril?",
          "Saltar e aterrissar no mesmo lado?",
        ],
        HOS_0_4,
        20,
      ),
    },
  ],
};

/* ==========================================================================
   PSICOLÓGICO
   ========================================================================== */

const ACL_RSI = {
  id: "acl_rsi",
  name: "ACL-RSI — Retorno ao Esporte (LCA)",
  short: "ACL",
  color: "#16A34A",
  description: "12 itens, 0-100. Prontidão psicológica para voltar ao esporte.",
  scaleMax: 100,
  higherIsBetter: true,
  scoring: "acl_rsi",
  periodicity: "Semanas 0, 6, 12, 24",
  sections: [
    {
      title: "Confiança e emoções",
      items: choiceItems(
        "ac",
        [
          "Você se sente nervoso(a) em relação à sua performance durante a recuperação?",
          "Você está frustrado(a) com sua recuperação do LCA?",
          "Você está com medo de se machucar novamente ao retornar ao esporte?",
          "Você confia na sua capacidade de se desempenhar bem no esporte?",
          "Você pensa no joelho quando pratica esporte ou atividade física?",
          "Você está animado(a) para voltar ao esporte?",
          "Você sente que o joelho está pronto para retornar ao esporte?",
          "Você está preocupado(a) em machucar o joelho novamente ao retornar ao esporte?",
          "Você sente que pode competir com o mesmo nível de antes da lesão?",
          "Você está relaxado(a) quanto ao retorno ao esporte?",
          "Você sente que consegue se concentrar totalmente no esporte, sem pensar no joelho?",
          "Você sente que pode se mover com confiança no esporte praticado?",
        ],
        vasOpts(),
      ),
    },
  ],
};

const EDEQ = {
  id: "edeq",
  name: "EDE-Q — Questionário de Alimentação",
  short: "EDE-Q",
  color: "#BE185D",
  description:
    "23 itens em 4 subescalas. Escala 0-6, MAIOR = PIOR. Normalizado 0-100.",
  scaleMax: 100,
  higherIsBetter: false,
  scoring: "edeq",
  periodicity: "Inicial e reavaliações",
  sections: [
    {
      title: "Restrição alimentar",
      items: choiceItems(
        "ed",
        [
          "Você tentou restringir deliberadamente a quantidade de comida que ingeriu, para influenciar sua forma ou peso corporal?",
          "Você ficou por longos períodos de tempo (de 8 horas acordado ou mais) sem comer nada, para influenciar sua forma ou peso?",
          "Você tentou excluir da sua dieta alimentos que você gosta, para influenciar sua forma ou peso?",
          "Você tentou seguir regras definidas sobre o que comer (por exemplo, um limite de calorias), para influenciar sua forma ou peso?",
          "Você desejou ter um estômago vazio?",
        ],
        EDEQ_0_6,
      ),
    },
    {
      title: "Preocupação com alimentação",
      items: choiceItems(
        "ed",
        [
          "Você ficou preocupado(a) com comida?",
          "Você comeu em segredo?",
          "Você sentiu que comer estava fora do controle (enquanto estava comendo)?",
          "Você comeu por razões emocionais (por exemplo, por se sentir sozinho(a), entediado(a), ansioso(a) ou deprimido(a))?",
        ],
        EDEQ_0_6,
        6,
      ),
    },
    {
      title: "Preocupação com a forma corporal",
      items: choiceItems(
        "ed",
        [
          "Você se sentiu insatisfeito(a) com sua forma corporal?",
          "Você ficou muito preocupado(a) com sua forma corporal?",
          "Seu peso influenciou como você se sente como pessoa?",
          "Você ficou tão preocupado(a) com sua forma que sentiu que deveria fazer dieta, fazer exercícios ou tomar outras medidas?",
          "Você queria não ser do tamanho que é?",
          "Você pensou que ocupava muito espaço?",
          "Você se sentiu gordo(a)?",
          "Você desejou ser mais magro(a)?",
        ],
        EDEQ_0_6,
        10,
      ),
    },
    {
      title: "Preocupação com o peso",
      items: choiceItems(
        "ed",
        [
          "Você se pesou?",
          "Você ficou preocupado(a) se outras pessoas poderiam ver suas dobras de gordura ou sua forma?",
          "O seu peso influenciou como você se sente como pessoa?",
          "Você ficou descontente com seu peso?",
          "Você queria perder peso?",
          "Quando você come em companhia de outras pessoas, você se sentiu consciente de quanto estava comendo?",
        ],
        EDEQ_0_6,
        18,
      ),
    },
  ],
};

const BRUMS_ADJETIVOS = [
  "Apavorado",
  "Animado",
  "Confuso",
  "Esgotado",
  "Deprimido",
  "Desanimado",
  "Irritado",
  "Exausto",
  "Inseguro",
  "Sonolento",
  "Zangado",
  "Triste",
  "Ansioso",
  "Preocupado",
  "Com disposição",
  "Infeliz",
  "Desorientado",
  "Tenso",
  "Com raiva",
  "Com energia",
  "Cansado",
  "Mal-humorado",
  "Alerta",
  "Indeciso",
];

const BRUMS = {
  id: "brums",
  name: "BRUMS — Escala de Humor",
  short: "BRUMS",
  color: "#92400E",
  description:
    "24 adjetivos sobre como você se sente agora (0 = nada, 4 = extremamente).",
  scaleMax: 100,
  higherIsBetter: true,
  scoring: "brums",
  periodicity: "Pré e pós-sessão",
  sections: [
    {
      title: "Como você está se sentindo agora?",
      items: choiceItems("br", BRUMS_ADJETIVOS, BRUMS_0_4),
    },
  ],
};

/* ==========================================================================
   REGISTRO E CÁLCULO
   ========================================================================== */

export const QUESTIONNAIRES = [
  WOMAC,
  KOOS,
  EDAJ,
  VISA_P,
  EVA,
  SPADI,
  QUICKDASH,
  WORC,
  SST,
  OSS,
  ACL_RSI,
  EDEQ,
  BRUMS,
  HOOS,
  HAGOS,
  IHOT12,
  HOS,
];

export const byId = (id) => QUESTIONNAIRES.find((q) => q.id === id) || null;

export const allItems = (q) => q.sections.flatMap((s) => s.items);

export const totalItems = (q) => allItems(q).length;

const round1 = (n) => Math.round(n * 10) / 10;

/** Valor bruto de um item: score da opção escolhida ou número da escala. */
function rawValue(item, answers) {
  const v = answers[item.id];
  if (v === undefined || v === null) return null;
  if (item.type === "choice") {
    const opt = item.options[Number(v)];
    return opt ? opt.score : 0;
  }
  return Number(v) || 0;
}

/**
 * ESCORE — a lógica abaixo é transcrita do Base44, função por função.
 * Não altere sem aprovação do Helio: o número mostrado ao paciente precisa ser
 * idêntico ao do app antigo para o histórico continuar comparável.
 */
export function computeScore(q, answers = {}) {
  const items = allItems(q);
  const missing = items.filter((it) => answers[it.id] === undefined || answers[it.id] === null);
  if (missing.length > 0) return { total: null, missing: missing.length, subscales: null };

  const v = items.map((it) => rawValue(it, answers));

  switch (q.scoring) {
    case "womac": {
      const dor = v.slice(0, 5).reduce((a, b) => a + b, 0);
      const rigidez = v.slice(5, 7).reduce((a, b) => a + b, 0);
      const funcao = v.slice(7, 24).reduce((a, b) => a + b, 0);
      return { total: v.reduce((a, b) => a + b, 0), missing: 0, subscales: { dor, rigidez, funcao } };
    }

    case "koos": {
      const secs = [
        { name: "sintomas", start: 0, count: 7 },
        { name: "dor", start: 7, count: 9 },
        { name: "avd", start: 16, count: 17 },
        { name: "esporte", start: 33, count: 5 },
        { name: "qualidade_vida", start: 38, count: 4 },
      ];
      const subscales = {};
      secs.forEach((s) => {
        const raw = v.slice(s.start, s.start + s.count).reduce((a, b) => a + b, 0);
        subscales[s.name] = round1((1 - raw / (s.count * 4)) * 100);
      });
      const totalRaw = v.reduce((a, b) => a + b, 0);
      return { total: round1((1 - totalRaw / (42 * 4)) * 100), missing: 0, subscales };
    }

    case "edaj":
      return { total: v.reduce((a, b) => a + b, 0), missing: 0, subscales: {} };

    case "sst":
      return {
        total: Math.round((v.reduce((a, b) => a + b, 0) / 12) * 100),
        missing: 0,
        subscales: {},
      };

    case "oss":
      return {
        total: round1((v.reduce((a, b) => a + b, 0) / 48) * 100),
        missing: 0,
        subscales: {},
      };

    case "spadi": {
      const dor = round1((v.slice(0, 5).reduce((a, b) => a + b, 0) / 50) * 100);
      const incapacidade = round1((v.slice(5, 13).reduce((a, b) => a + b, 0) / 80) * 100);
      return { total: round1((dor + incapacidade) / 2), missing: 0, subscales: { dor, incapacidade } };
    }

    case "quickdash": {
      const sum = v.reduce((a, b) => a + b, 0);
      return { total: round1(((sum / v.length - 1) / 4) * 100), missing: 0, subscales: {} };
    }

    case "worc": {
      const secs = [
        { name: "fisico", start: 0, count: 5 },
        { name: "esporte", start: 5, count: 4 },
        { name: "trabalho", start: 9, count: 4 },
        { name: "estilo_vida", start: 13, count: 4 },
        { name: "emocional", start: 17, count: 4 },
      ];
      const subscales = {};
      secs.forEach((s) => {
        const slice = v.slice(s.start, s.start + s.count);
        subscales[s.name] = Math.round((slice.reduce((a, b) => a + b, 0) / (s.count * 100)) * 100);
      });
      const totalRaw = v.reduce((a, b) => a + b, 0);
      return { total: round1((1 - totalRaw / 2100) * 100), missing: 0, subscales };
    }

    case "acl_rsi": {
      // Itens negativos (índices 0, 2, 4, 7) invertidos: 100 - valor.
      const INVERTED = new Set([0, 2, 4, 7]);
      const adj = v.map((val, i) => (INVERTED.has(i) ? 100 - val : val));
      return { total: Math.round(adj.reduce((a, b) => a + b, 0) / 12), missing: 0, subscales: {} };
    }

    case "ihot12":
      return {
        total: Math.round(v.reduce((a, b) => a + b, 0) / v.length),
        missing: 0,
        subscales: {},
      };

    case "hos": {
      const avd = round1((v.slice(0, 19).reduce((a, b) => a + b, 0) / (19 * 4)) * 100);
      const esporte = round1((v.slice(19, 29).reduce((a, b) => a + b, 0) / (10 * 4)) * 100);
      return { total: round1(avd * 0.6 + esporte * 0.4), missing: 0, subscales: { avd, esporte } };
    }

    case "hoos": {
      // CORRIGIDO (30/10): o original usava qol count=3 e divisor 40*4, mas a
      // lista tem 4 itens de qol (41 no total) — o 41º item era respondido e
      // ignorado, e o escore nunca alcançava 100 (teto 97,5). Agora count=4 e
      // divisor 41*4, como o HOOS canônico.
      const secs = [
        { name: "sintomas", start: 0, count: 6 },
        { name: "dor", start: 6, count: 9 },
        { name: "avd", start: 15, count: 17 },
        { name: "esporte", start: 32, count: 5 },
        { name: "qualidade_vida", start: 37, count: 4 },
      ];
      const subscales = {};
      secs.forEach((s) => {
        const raw = v.slice(s.start, s.start + s.count).reduce((a, b) => a + b, 0);
        subscales[s.name] = round1((1 - raw / (s.count * 4)) * 100);
      });
      const totalRaw = v.reduce((a, b) => a + b, 0);
      return { total: round1((1 - totalRaw / (41 * 4)) * 100), missing: 0, subscales };
    }

    case "hagos": {
      const secs = [
        { name: "sintomas", start: 0, count: 5 },
        { name: "dor", start: 5, count: 9 },
        { name: "avd", start: 14, count: 8 },
        { name: "esporte", start: 22, count: 6 },
        { name: "recreacao", start: 28, count: 3 },
        { name: "qualidade_vida", start: 31, count: 4 },
      ];
      const subscales = {};
      secs.forEach((s) => {
        const raw = v.slice(s.start, s.start + s.count).reduce((a, b) => a + b, 0);
        subscales[s.name] = round1((1 - raw / (s.count * 4)) * 100);
      });
      const totalRaw = v.reduce((a, b) => a + b, 0);
      return { total: round1((1 - totalRaw / (35 * 4)) * 100), missing: 0, subscales };
    }

    case "edeq": {
      const secs = [
        { name: "restricao", start: 0, count: 5 },
        { name: "preocupacao_alimentar", start: 5, count: 4 },
        { name: "preocupacao_forma", start: 9, count: 8 },
        { name: "preocupacao_peso", start: 17, count: 6 },
      ];
      const subscales = {};
      secs.forEach((s) => {
        const slice = v.slice(s.start, s.start + s.count);
        subscales[s.name] = Math.round((slice.reduce((a, b) => a + b, 0) / s.count) * 100) / 100;
      });
      const global =
        Math.round(
          ((subscales.restricao +
            subscales.preocupacao_alimentar +
            subscales.preocupacao_forma +
            subscales.preocupacao_peso) /
            4) *
            100,
        ) / 100;
      return { total: Math.round((global / 6) * 100), missing: 0, subscales };
    }

    case "brums": {
      // Subescalas do BRUMS validado (Rohlfs et al., 2008) — índices 0-based
      // sobre a ordem de apresentação dos 24 adjetivos:
      //   raiva 7,11,19,22 | tensao 1,13,14,18 | depressao 5,6,12,16
      //   vigor 2,15,20,23 | fadiga 4,8,10,21  | confusao 3,9,17,24
      const MAP = {
        raiva: [6, 10, 18, 21],
        tensao: [0, 12, 13, 17],
        depressao: [4, 5, 11, 15],
        vigor: [1, 14, 19, 22],
        fadiga: [3, 7, 9, 20],
        confusao: [2, 8, 16, 23],
      };
      const subscales = {};
      Object.entries(MAP).forEach(([k, idx]) => {
        subscales[k] = idx.reduce((sum, i) => sum + (Number(v[i]) || 0), 0);
      });
      // TMD = soma dos cinco fatores negativos - vigor + 16
      // Faixa real: 0 (melhor: neg=0, vigor=16) a 96 (pior: neg=80, vigor=0).
      // O original dividia por 80 — qualquer TMD acima de 80 era cortado para
      // zero, achatando toda a faixa de humor ruim. Agora divide por 96.
      const neg =
        subscales.raiva +
        subscales.confusao +
        subscales.depressao +
        subscales.fadiga +
        subscales.tensao;
      const tmd = neg - subscales.vigor + 16;
      return {
        total: Math.max(0, Math.min(100, Math.round(100 - (tmd / 96) * 100))),
        missing: 0,
        subscales,
      };
    }

    default:
      return { total: v.reduce((a, b) => a + b, 0), missing: 0, subscales: null };
  }
}

/* ==========================================================================
   MCID — valores do arquivo original
   ========================================================================== */
export const MCID_MAP = {
  womac: 12.5,
  koos: 10,
  edaj: 10,
  visa_p: 13,
  eva: 2.5,
  spadi: 13,
  quickdash: 14,
  worc: 12,
  sst: 8,
  oss: 5,
  hoos: 10,
  hagos: 10,
  ihot12: 11,
  hos: 9,
  acl_rsi: 12,
  edeq: null,
  brums: null,
};

/** Interpreta a variação entre duas medições em linguagem de paciente. */
export function interpretChange(qId, from, to) {
  const q = byId(qId);
  const mcid = MCID_MAP[qId];
  if (!q || mcid == null || from == null || to == null) return null;

  const delta = to - from;
  const higherIsBetter = q.higherIsBetter !== false;
  const improved = higherIsBetter ? delta >= mcid : delta <= -mcid;
  const worsened = higherIsBetter ? delta <= -mcid : delta >= mcid;

  if (improved) return { tone: "good", text: "Melhorou de forma perceptível" };
  if (worsened) return { tone: "bad", text: "Piorou de forma perceptível" };
  if (Math.abs(delta) < 0.05) return { tone: "flat", text: "Sem mudança" };
  return { tone: "flat", text: "Variação pequena, dentro da margem" };
}

/** Nome legível de cada subescala (ficha da equipe). */
export const SUBSCALE_LABELS = {
  dor: "Dor",
  rigidez: "Rigidez",
  funcao: "Função",
  sintomas: "Sintomas",
  avd: "AVD",
  esporte: "Esporte",
  qualidade_vida: "Qualidade de vida",
  incapacidade: "Incapacidade",
  fisico: "Físico",
  trabalho: "Trabalho",
  estilo_vida: "Estilo de vida",
  emocional: "Emocional",
  recreacao: "Recreação",
  restricao: "Restrição",
  preocupacao_alimentar: "Preocupação alimentar",
  preocupacao_forma: "Preocupação com a forma",
  preocupacao_peso: "Preocupação com o peso",
  raiva: "Raiva",
  confusao: "Confusão",
  depressao: "Depressão",
  fadiga: "Fadiga",
  tensao: "Tensão",
  vigor: "Vigor",
};
