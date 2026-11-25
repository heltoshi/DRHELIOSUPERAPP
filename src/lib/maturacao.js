// Predição de estatura adulta e maturação biológica (bio-banding).
//
// Motor portado do app "Predição de Estatura & Maturação — CEMEP Care", com as
// tabelas de Khamis-Roche (KR) e Bayley-Pinneau (BP) preservadas verbatim.
// Métodos: Khamis-Roche (PAH sem idade óssea), Mirwald (offset do pico de
// velocidade), Moore (PHV por estatura/sentada), Bayley-Pinneau (com idade
// óssea) e o consenso ponderado entre eles.
//
// Referências: Khamis & Roche 1994 (J Pediatr); Mirwald et al. 2002 (MSSE);
// Moore et al. 2015; Bayley & Pinneau 1952; Tanner (mid-parental).
// AVISO: predição é estimativa populacional, não substitui avaliação clínica.

const KR_BOYS = [
  { age: 4.0, b0: -10.2567, b1: 1.23812, b2: -0.087235, b3: 0.50286 },
  { age: 4.5, b0: -10.719,  b1: 1.15964, b2: -0.074454, b3: 0.52887 },
  { age: 5.0, b0: -11.0213, b1: 1.10674, b2: -0.064778, b3: 0.53919 },
  { age: 5.5, b0: -11.1556, b1: 1.07480, b2: -0.057760, b3: 0.53691 },
  { age: 6.0, b0: -11.1138, b1: 1.05923, b2: -0.052947, b3: 0.52513 },
  { age: 6.5, b0: -11.0221, b1: 1.05542, b2: -0.049892, b3: 0.50692 },
  { age: 7.0, b0: -10.9984, b1: 1.05877, b2: -0.048144, b3: 0.48538 },
  { age: 7.5, b0: -11.0214, b1: 1.06467, b2: -0.047256, b3: 0.46361 },
  { age: 8.0, b0: -11.0696, b1: 1.06853, b2: -0.046778, b3: 0.44469 },
  { age: 8.5, b0: -11.1220, b1: 1.06572, b2: -0.046261, b3: 0.43171 },
  { age: 9.0, b0: -11.1571, b1: 1.05166, b2: -0.045254, b3: 0.42776 },
  { age: 9.5, b0: -11.1405, b1: 1.02174, b2: -0.043311, b3: 0.43593 },
  { age: 10.0, b0: -11.0380, b1: 0.97135, b2: -0.039981, b3: 0.45932 },
  { age: 10.5, b0: -10.8286, b1: 0.89589, b2: -0.034814, b3: 0.50101 },
  { age: 11.0, b0: -10.4917, b1: 0.81239, b2: -0.029050, b3: 0.54781 },
  { age: 11.5, b0: -10.0065, b1: 0.74134, b2: -0.024167, b3: 0.58409 },
  { age: 12.0, b0: -9.3522,  b1: 0.68325, b2: -0.020076, b3: 0.60927 },
  { age: 12.5, b0: -8.6055,  b1: 0.63869, b2: -0.016681, b3: 0.62279 },
  { age: 13.0, b0: -7.8632,  b1: 0.60818, b2: -0.013895, b3: 0.62407 },
  { age: 13.5, b0: -7.1348,  b1: 0.59228, b2: -0.011624, b3: 0.61253 },
  { age: 14.0, b0: -6.4299,  b1: 0.59151, b2: -0.009776, b3: 0.58762 },
  { age: 14.5, b0: -5.7578,  b1: 0.60643, b2: -0.008261, b3: 0.54875 },
  { age: 15.0, b0: -5.1282,  b1: 0.63757, b2: -0.006988, b3: 0.49536 },
  { age: 15.5, b0: -4.5092,  b1: 0.68548, b2: -0.005863, b3: 0.42687 },
  { age: 16.0, b0: -3.9292,  b1: 0.75069, b2: -0.004795, b3: 0.34271 },
  { age: 16.5, b0: -3.4873,  b1: 0.83375, b2: -0.003695, b3: 0.24231 },
  { age: 17.0, b0: -3.2830,  b1: 0.93520, b2: -0.002470, b3: 0.12510 },
  { age: 17.5, b0: -3.4156,  b1: 1.05558, b2: -0.001027, b3: -0.00950 }
];

const KR_GIRLS = [
  { age: 4.0, b0: -8.13250, b1: 1.24768, b2: -0.19435, b3: 0.44774 },
  { age: 4.5, b0: -6.47656, b1: 1.22177, b2: -0.18519, b3: 0.41381 },
  { age: 5.0, b0: -5.13582, b1: 1.19932, b2: -0.17530, b3: 0.38467 },
  { age: 5.5, b0: -4.13791, b1: 1.17880, b2: -0.16484, b3: 0.36039 },
  { age: 6.0, b0: -3.51039, b1: 1.15866, b2: -0.15400, b3: 0.34105 },
  { age: 6.5, b0: -3.14322, b1: 1.13737, b2: -0.14294, b3: 0.32672 },
  { age: 7.0, b0: -2.87645, b1: 1.11342, b2: -0.13184, b3: 0.31748 },
  { age: 7.5, b0: -2.66291, b1: 1.08525, b2: -0.12086, b3: 0.31340 },
  { age: 8.0, b0: -2.45559, b1: 1.05135, b2: -0.11019, b3: 0.31457 },
  { age: 8.5, b0: -2.20728, b1: 1.01018, b2: -0.09999, b3: 0.32105 },
  { age: 9.0, b0: -1.87098, b1: 0.96020, b2: -0.09044, b3: 0.33291 },
  { age: 9.5, b0: -1.06330, b1: 0.89989, b2: -0.08171, b3: 0.35025 },
  { age: 10.0, b0: 0.33468,  b1: 0.82771, b2: -0.07397, b3: 0.37312 },
  { age: 10.5, b0: 1.97366,  b1: 0.74213, b2: -0.06739, b3: 0.40161 },
  { age: 11.0, b0: 3.50436,  b1: 0.67173, b2: -0.06136, b3: 0.42042 },
  { age: 11.5, b0: 4.57747,  b1: 0.64150, b2: -0.05518, b3: 0.41686 },
  { age: 12.0, b0: 4.84365,  b1: 0.64452, b2: -0.04894, b3: 0.39490 },
  { age: 12.5, b0: 4.27869,  b1: 0.67386, b2: -0.04272, b3: 0.35850 },
  { age: 13.0, b0: 3.21417,  b1: 0.72260, b2: -0.03661, b3: 0.31163 },
  { age: 13.5, b0: 1.83456,  b1: 0.78383, b2: -0.03067, b3: 0.25826 },
  { age: 14.0, b0: 0.32425,  b1: 0.85062, b2: -0.02500, b3: 0.20235 },
  { age: 14.5, b0: -1.13224, b1: 0.91605, b2: -0.01967, b3: 0.14787 },
  { age: 15.0, b0: -2.35055, b1: 0.97319, b2: -0.01477, b3: 0.09880 },
  { age: 15.5, b0: -3.10326, b1: 1.01514, b2: -0.01037, b3: 0.05909 },
  { age: 16.0, b0: -3.17885, b1: 1.03496, b2: -0.00655, b3: 0.03272 },
  { age: 16.5, b0: -2.41657, b1: 1.02573, b2: -0.00340, b3: 0.02364 },
  { age: 17.0, b0: -0.65579, b1: 0.98054, b2: -0.00100, b3: 0.03584 },
  { age: 17.5, b0: 2.26429,  b1: 0.89246, b2: 0.00057,  b3: 0.07327 }
];

const BP_BOYS = [
  { boneAge: 6.0, pct: 68.3 }, { boneAge: 6.5, pct: 70.4 }, { boneAge: 7.0, pct: 72.6 },
  { boneAge: 7.5, pct: 74.7 }, { boneAge: 8.0, pct: 76.6 }, { boneAge: 8.5, pct: 78.7 },
  { boneAge: 9.0, pct: 80.4 }, { boneAge: 9.5, pct: 82.2 }, { boneAge: 10.0, pct: 84.0 },
  { boneAge: 10.5, pct: 85.7 }, { boneAge: 11.0, pct: 87.3 }, { boneAge: 11.5, pct: 88.8 },
  { boneAge: 12.0, pct: 90.4 }, { boneAge: 12.5, pct: 91.7 }, { boneAge: 13.0, pct: 93.1 },
  { boneAge: 13.5, pct: 94.3 }, { boneAge: 14.0, pct: 95.4 }, { boneAge: 14.5, pct: 96.4 },
  { boneAge: 15.0, pct: 97.4 }, { boneAge: 15.5, pct: 98.2 }, { boneAge: 16.0, pct: 98.9 },
  { boneAge: 16.5, pct: 99.2 }, { boneAge: 17.0, pct: 99.7 }, { boneAge: 17.5, pct: 99.9 },
  { boneAge: 18.0, pct: 100.0 }
];

const BP_GIRLS = [
  { boneAge: 6.0, pct: 72.7 }, { boneAge: 6.5, pct: 74.7 }, { boneAge: 7.0, pct: 76.7 },
  { boneAge: 7.5, pct: 78.6 }, { boneAge: 8.0, pct: 80.4 }, { boneAge: 8.5, pct: 82.0 },
  { boneAge: 9.0, pct: 83.9 }, { boneAge: 9.5, pct: 85.6 }, { boneAge: 10.0, pct: 87.1 },
  { boneAge: 10.5, pct: 88.6 }, { boneAge: 11.0, pct: 90.0 }, { boneAge: 11.5, pct: 91.4 },
  { boneAge: 12.0, pct: 92.7 }, { boneAge: 12.5, pct: 93.9 }, { boneAge: 13.0, pct: 95.0 },
  { boneAge: 13.5, pct: 96.0 }, { boneAge: 14.0, pct: 96.8 }, { boneAge: 14.5, pct: 97.6 },
  { boneAge: 15.0, pct: 98.2 }, { boneAge: 15.5, pct: 98.8 }, { boneAge: 16.0, pct: 99.2 },
  { boneAge: 16.5, pct: 99.5 }, { boneAge: 17.0, pct: 99.7 }, { boneAge: 17.5, pct: 99.9 },
  { boneAge: 18.0, pct: 100.0 }
];
function interpLinear(x, x0, y0, x1, y1) {
  if (x1 === x0) return y0;
  return y0 + ((x - x0) / (x1 - x0)) * (y1 - y0);
}

function getKhamisCoeffs(age, sex) {
  const table = sex === 'male' ? KR_BOYS : KR_GIRLS;
  const clampedAge = Math.max(4.0, Math.min(17.5, age));
  
  let lower = table[0];
  let upper = table[table.length - 1];

  for (let i = 0; i < table.length - 1; i++) {
    if (clampedAge >= table[i].age && clampedAge <= table[i + 1].age) {
      lower = table[i];
      upper = table[i + 1];
      break;
    }
  }

  if (lower.age === upper.age) {
    return { b0: lower.b0, b1: lower.b1, b2: lower.b2, b3: lower.b3 };
  }

  return {
    b0: interpLinear(clampedAge, lower.age, lower.b0, upper.age, upper.b0),
    b1: interpLinear(clampedAge, lower.age, lower.b1, upper.age, upper.b1),
    b2: interpLinear(clampedAge, lower.age, lower.b2, upper.age, upper.b2),
    b3: interpLinear(clampedAge, lower.age, lower.b3, upper.age, upper.b3)
  };
}

function getBayleyPinneauPct(boneAge, sex) {
  const table = sex === 'male' ? BP_BOYS : BP_GIRLS;
  const clampedBA = Math.max(6.0, Math.min(18.0, boneAge));
  
  let lower = table[0];
  let upper = table[table.length - 1];

  for (let i = 0; i < table.length - 1; i++) {
    if (clampedBA >= table[i].boneAge && clampedBA <= table[i + 1].boneAge) {
      lower = table[i];
      upper = table[i + 1];
      break;
    }
  }

  if (lower.boneAge === upper.boneAge) return lower.pct;
  return interpLinear(clampedBA, lower.boneAge, lower.pct, upper.boneAge, upper.pct);
}

function addMonthsToDate(dateStr, months) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setMonth(d.getMonth() + months);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatBrDate(dateStr) {
  if (!dateStr) return '--/--/----';
  const parts = dateStr.split('-');
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return dateStr;
}

function performCalculation(entrada) {
  const {
    name, sex, birthDate: birthDateVal, evalDate: evalDateVal,
    stature, sittingHeight, weight,
    fatherHeight: fatherH, motherHeight: motherH,
    menarche, menarcheDate,
  } = entrada;

  // Validação obrigatória
  if (!name) {
    throw new Error('Por favor, informe o nome do atleta.');
  }
  if (!birthDateVal || !evalDateVal) {
    throw new Error('Informe a data de nascimento e a data da avaliação.');
  }
  if (isNaN(stature) || isNaN(sittingHeight) || isNaN(weight) || isNaN(fatherH) || isNaN(motherH)) {
    throw new Error('Preencha todos os campos antropométricos e estaturas parentais.');
  }
  if (sittingHeight >= stature) {
    throw new Error('A estatura sentada deve ser estritamente menor que a estatura total.');
  }
  if (new Date(evalDateVal) < new Date(birthDateVal)) {
    throw new Error('A data da avaliação não pode ser anterior à data de nascimento.');
  }

  // 1. Idade Decimal e Comprimento de Membro Inferior
  const dBirth = new Date(birthDateVal + 'T00:00:00');
  const dEval = new Date(evalDateVal + 'T00:00:00');
  const diffDays = (dEval - dBirth) / (1000 * 60 * 60 * 24);
  const ageDecimal = diffDays / 365.25;
  const legLength = stature - sittingHeight;
  const sittingRatio = (sittingHeight / stature) * 100;

  // 2. Estatura Mid-Parental (Tanner)
  let midParental;
  if (sex === 'male') {
    midParental = (fatherH + motherH + 13) / 2;
  } else {
    midParental = (fatherH + motherH - 13) / 2;
  }
  const targetMin = midParental - 8.5;
  const targetMax = midParental + 8.5;

  // 3. Offset Mirwald et al. 2002
  const whr100 = (weight / stature) * 100;
  let mirwaldOffset = 0;
  if (sex === 'male') {
    mirwaldOffset = -9.236 + 
      (0.0002708 * (legLength * sittingHeight)) - 
      (0.001663 * (ageDecimal * legLength)) + 
      (0.007216 * (ageDecimal * sittingHeight)) + 
      (0.02292 * whr100);
  } else {
    mirwaldOffset = -9.376 + 
      (0.0001882 * (legLength * sittingHeight)) + 
      (0.0022 * (ageDecimal * legLength)) + 
      (0.005841 * (ageDecimal * sittingHeight)) - 
      (0.002658 * (ageDecimal * weight)) + 
      (0.07693 * whr100);
  }
  const mirwaldPHV = ageDecimal - mirwaldOffset;
  const mirwaldValid = (sex === 'male' && ageDecimal >= 12 && ageDecimal <= 16) ||
                       (sex === 'female' && ageDecimal >= 11 && ageDecimal <= 15);

  // 4. Moore et al. 2015
  let mooreResults = [];
  if (sex === 'male') {
    const m1 = -8.128741 + (0.0070346 * (ageDecimal * sittingHeight));
    const m2 = -7.999994 + (0.0036124 * (ageDecimal * stature));
    mooreResults.push({ label: 'Moore-1 (Sentada)', offset: m1, phv: ageDecimal - m1 });
    mooreResults.push({ label: 'Moore-2 (Estatura)', offset: m2, phv: ageDecimal - m2 });
  } else {
    const mGirl = -7.709133 + (0.0042232 * (ageDecimal * stature));
    mooreResults.push({ label: 'Moore (Estatura)', offset: mGirl, phv: ageDecimal - mGirl });
  }

  // 5. Bio-Banding por Offset Mirwald
  let bandingMirwald = 'No tempo';
  if (mirwaldOffset > 1.0) {
    bandingMirwald = 'Maturador precoce';
  } else if (mirwaldOffset < -1.0) {
    bandingMirwald = 'Maturador tardio';
  }

  // 6. Khamis-Roche
  const heightInches = stature / 2.54;
  const weightLbs = weight / 0.45359237;
  const midparentInches = ((fatherH + motherH) / 2) / 2.54; // Média simples SEM 13cm
  const c = getKhamisCoeffs(ageDecimal, sex);
  const pahInches = c.b0 + (c.b1 * heightInches) + (c.b2 * weightLbs) + (c.b3 * midparentInches);
  const khamisPAH = pahInches * 2.54;
  const khamisPct = (stature / khamisPAH) * 100;
  const khamisValid = ageDecimal >= 4.0 && ageDecimal <= 17.5;
  const khamisErr50 = sex === 'male' ? 2.2 : 1.7;
  const khamisErr90 = sex === 'male' ? 5.3 : 4.3;

  // 7. Bayley-Pinneau (Idade Óssea)
  const boneAgeVal = entrada.boneAge != null && entrada.boneAge !== '' ? parseFloat(entrada.boneAge) : NaN;
  const bpSource = entrada.bpSource || 'none';
  const bpManualPct = entrada.bpManualPct != null && entrada.bpManualPct !== '' ? parseFloat(entrada.bpManualPct) : NaN;
  const boneAgeMethod = entrada.boneAgeMethod || 'greulich';
  let bpPAH = null;
  let bpPct = null;

  if (!isNaN(boneAgeVal) && boneAgeVal > 0) {
    if (bpSource === 'manual' && !isNaN(bpManualPct) && bpManualPct > 0) {
      bpPct = bpManualPct;
      bpPAH = stature / (bpPct / 100);
    } else {
      bpPct = getBayleyPinneauPct(boneAgeVal, sex);
      bpPAH = stature / (bpPct / 100);
    }
  }

  // 8. Consenso Clínico PAH
  const availablePAHs = [khamisPAH];
  if (bpPAH !== null) availablePAHs.push(bpPAH);
  const consensusPAH = availablePAHs.reduce((a, b) => a + b, 0) / availablePAHs.length;
  const consensusMin = Math.min(...availablePAHs);
  const consensusMax = Math.max(...availablePAHs);
  const consensusPct = (stature / consensusPAH) * 100;

  // 9. Bio-Banding por %PAH
  let bandingPct = '';
  if (consensusPct < 85.0) {
    bandingPct = 'Pré-estirão';
  } else if (consensusPct < 90.0) {
    bandingPct = 'Início do estirão';
  } else if (consensusPct < 95.0) {
    bandingPct = 'Peripuberal';
  } else {
    bandingPct = 'Pós-estirão';
  }

  // 10. Comparativo Longitudinal: a visita anterior vem de fora (do banco),
  // não do localStorage — o motor é puro e não acessa armazenamento.
  const prevVisit = entrada.visitaAnterior || null;

  let diffPrev = null;
  if (prevVisit) {
    const dPrev = new Date(prevVisit.date + 'T00:00:00');
    const dCurrent = new Date(evalDateVal + 'T00:00:00');
    const daysSince = Math.round((dCurrent - dPrev) / (1000 * 60 * 60 * 24));
    diffPrev = {
      days: daysSince,
      stature: stature - prevVisit.stature,
      mirwaldOffset: mirwaldOffset - prevVisit.mirwaldOffset,
      pctPAH: consensusPct - prevVisit.consensusPct,
      phv: mirwaldPHV - prevVisit.mirwaldPHV,
      prevDate: prevVisit.date
    };
  }

  // 11. Próxima Reavaliação Recomendada
  const isPeripubertal = Math.abs(mirwaldOffset) <= 1.0;
  const nextMonths = isPeripubertal ? 3 : 6;
  const nextEvalDate = addMonthsToDate(evalDateVal, nextMonths);

  const computed = {
    name,
    sex,
    birthDate: birthDateVal,
    evalDate: evalDateVal,
    stature,
    sittingHeight,
    weight,
    fatherHeight: fatherH,
    motherHeight: motherH,
    menarche,
    menarcheDate,
    boneAge: isNaN(boneAgeVal) ? null : boneAgeVal,
    boneAgeMethod,
    bpSource,
    bpPct,
    bpPAH,
    ageDecimal,
    legLength,
    sittingRatio,
    midParental,
    targetMin,
    targetMax,
    mirwaldOffset,
    mirwaldPHV,
    mirwaldValid,
    mooreResults,
    bandingMirwald,
    khamisPAH,
    khamisPct,
    khamisValid,
    khamisErr50,
    khamisErr90,
    consensusPAH,
    consensusMin,
    consensusMax,
    consensusPct,
    bandingPct,
    diffPrev,
    nextEvalDate,
    isPeripubertal
  };

  return computed;
}

// ------------------------------------------------------------------ API
/**
 * Calcula a predição completa de uma avaliação.
 * @param {object} entrada  {name, sex, birthDate, evalDate, stature, sittingHeight,
 *                           weight, fatherHeight, motherHeight, menarche, menarcheDate,
 *                           boneAge, boneAgeMethod, bpSource, bpManualPct}
 * @returns {object} resultado com PAH de cada método, percentil e bio-banding.
 * @throws {Error} quando falta dado obrigatório ou há inconsistência.
 */
export function calcularMaturacao(entrada) {
  return performCalculation(entrada);
}

/** Idade decimal (anos) entre nascimento e avaliação. */
export function idadeDecimal(birthDate, evalDate) {
  const d1 = new Date(String(birthDate) + "T00:00:00");
  const d2 = new Date(String(evalDate) + "T00:00:00");
  return (d2 - d1) / (1000 * 60 * 60 * 24) / 365.25;
}

/** Faixas de bio-banding (Mirwald) — sincronia com a coorte da mesma idade. */
export const FAIXAS_BANDING = [
  { id: "atrasado",   label: "Atrasado",   desc: "maturação < -1,0 ano da coorte" },
  { id: "no-tempo",   label: "No tempo",   desc: "entre -1,0 e +1,0 ano da coorte" },
  { id: "adiantado",  label: "Adiantado",  desc: "maturação > +1,0 ano da coorte" },
];
