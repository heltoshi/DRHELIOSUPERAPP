// Camada de dados do SUPER APP DR. HÉLIO.
//
// Uma ficha só (`patient`) e módulos pendurados nela:
//   Atleta 360 → a360_training_log, a360_hrv_log, a360_response, a360_questionnaire
//   Orthoflow  → prom_submission
//
// As telas leem de um cache em memória (síncrono); toda gravação vai ao
// Supabase e o cache é recarregado. A autorização é do BANCO (RLS):
//   admin   → vê e edita tudo
//   patient → vê apenas as próprias linhas
//
// A regra "quem tem qual módulo" vive em patient.modules.

import { createClient } from "@supabase/supabase-js";
import { QUESTIONNAIRES as PROM_INSTRUMENTS } from "./instrumentos";

const cfg = (typeof window !== "undefined" && window.__HELIO_CONFIG) || {};
const URL_ = cfg.supabaseUrl || "";
const KEY_ = cfg.supabaseKey || "";
const cloudOn = Boolean(URL_ && KEY_ && !URL_.includes("SEU-PROJETO"));

export const supabase = cloudOn
  ? createClient(URL_, KEY_, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } })
  : null;

export const isCloud = () => Boolean(supabase);

const SESSION_KEY = "helio_app_session";

let DB = {
  patients: [], logs: [], hrv: [], questionnaires: [], responses: [], proms: [],
  session: null, profile: null, ready: false, offline: !cloudOn, lastError: null,
};

const listeners = new Set();
export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
function emit() {
  listeners.forEach((fn) => fn());
}
export const state = () => DB;
export const lastError = () => DB.lastError;

// ------------------------------------------------------------- mapeamento
const pRow = (r) => ({
  id: r.id,
  code: r.patient_id || "",
  name: r.full_name || "",
  dob: r.date_of_birth || "",
  gender: r.gender || "",
  email: r.email || "",
  phone: r.whatsapp || "",
  notes: r.notes || "",
  diagnosis: r.diagnosis || "",
  diagnosis_detail: r.diagnosis_detail || "",
  region: r.affected_region || "",
  laterality: r.laterality || "",
  protocol_start: r.protocol_start_date || "",
  onboarded: Boolean(r.onboarding_complete),
  user_id: r.user_id || null,
  // módulo esportivo
  sport: r.sport || "",
  position: r.position || "",
  team: r.team || "",
  coach: r.coach || "",
  weight: r.weight ?? "",
  height: r.height ?? "",
  status: r.status || "ativo",
  modules: r.modules && r.modules.length ? r.modules : ["orthoflow"],
  created_at: r.created_at,
});

function pDb(d) {
  const o = {};
  const map = {
    name: "full_name", dob: "date_of_birth", gender: "gender", email: "email",
    phone: "whatsapp", notes: "notes", diagnosis: "diagnosis", diagnosis_detail: "diagnosis_detail",
    region: "affected_region", laterality: "laterality", protocol_start: "protocol_start_date",
    sport: "sport", position: "position", team: "team", coach: "coach",
    weight: "weight", height: "height", status: "status", modules: "modules",
  };
  Object.entries(map).forEach(([k, col]) => {
    if (d[k] === undefined) return;
    o[col] = d[k] === "" ? null : d[k];
  });
  if (o.date_of_birth) o.date_of_birth = String(o.date_of_birth).slice(0, 10);
  if (o.protocol_start_date) o.protocol_start_date = String(o.protocol_start_date).slice(0, 10);
  ["weight", "height"].forEach((k) => {
    if (o[k] != null) o[k] = Number(o[k]);
  });
  return o;
}

const lRow = (r) => ({
  id: r.id, patient_id: r.patient_id, date: String(r.date).slice(0, 10),
  pse: Number(r.pse), duration_minutes: Number(r.duration_minutes),
  training_load: Number(r.training_load ?? r.pse * r.duration_minutes),
  training_type: r.training_type ?? "", observations: r.observations ?? "",
  sleep_hours: r.sleep_hours ?? "", sleep_quality: r.sleep_quality ?? "",
  muscle_soreness: r.muscle_soreness ?? "", fatigue_level: r.fatigue_level ?? "",
  mood: r.mood ?? "", created_at: r.created_at,
});
const lDb = (d) => ({
  patient_id: d.patient_id, date: String(d.date).slice(0, 10),
  pse: Number(d.pse), duration_minutes: Number(d.duration_minutes),
  training_type: d.training_type || null, observations: d.observations || null,
  sleep_hours: d.sleep_hours === "" || d.sleep_hours == null ? null : Number(d.sleep_hours),
  sleep_quality: d.sleep_quality === "" || d.sleep_quality == null ? null : Number(d.sleep_quality),
  muscle_soreness: d.muscle_soreness === "" || d.muscle_soreness == null ? null : Number(d.muscle_soreness),
  fatigue_level: d.fatigue_level === "" || d.fatigue_level == null ? null : Number(d.fatigue_level),
  mood: d.mood === "" || d.mood == null ? null : Number(d.mood),
});

const hRow = (r) => ({
  id: r.id, patient_id: r.patient_id, date: String(r.date).slice(0, 10),
  hrv: Number(r.hrv), notes: r.notes ?? "",
});

const qRow = (r) => ({
  id: r.id, title: r.title, description: r.description ?? "", kind: r.kind,
  is_active: r.is_active, questions: r.questions || [],
});

const rRow = (r) => ({
  id: r.id, questionnaire_id: r.questionnaire_id, patient_id: r.patient_id,
  date: String(r.date).slice(0, 10), answers: r.answers || [], notes: r.notes ?? "",
});

const sRow = (r) => ({
  id: r.id, patient_id: r.patient_id, questionnaire: r.questionnaire,
  answers: r.answers || {}, total_score: r.total_score == null ? null : Number(r.total_score),
  subscale_scores: r.subscale_scores || null, protocol_week: r.protocol_week,
  submitted_at: r.submitted_at || r.created_at,
});

// --------------------------------------------------------------- hidratação
export async function hydrate() {
  if (!supabase) {
    DB = { ...DB, ready: true, offline: true };
    emit();
    return DB;
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    DB = { ...DB, patients: [], logs: [], hrv: [], questionnaires: [], responses: [], proms: [],
           session: null, profile: null, ready: true, offline: false };
    localStorage.removeItem(SESSION_KEY);
    emit();
    return DB;
  }

  const [prof, patients, questionnaires] = await Promise.all([
    supabase.from("profile").select("*").eq("id", user.id).maybeSingle(),
    supabase.from("patient").select("*").order("full_name"),
    supabase.from("a360_questionnaire").select("*").order("title"),
  ]);

  const role = prof?.data?.role || "patient";
  const isAdmin = role === "admin";
  const myPatient = isAdmin ? null : (patients.data || []).find((p) => p.user_id === user.id) || null;

  const scope = (q) => (isAdmin || !myPatient ? q : q.eq("patient_id", myPatient.id));

  const [lg, hv, rs, ps] = await Promise.all([
    scope(supabase.from("a360_training_log").select("*").order("date", { ascending: false })),
    scope(supabase.from("a360_hrv_log").select("*").order("date", { ascending: false })),
    scope(supabase.from("a360_response").select("*").order("date", { ascending: false })),
    scope(supabase.from("prom_submission").select("*").order("submitted_at", { ascending: false })),
  ]);

  const session = {
    id: user.id,
    email: user.email,
    role,
    patient_id: myPatient?.id || null,
    modules: myPatient?.modules || (isAdmin ? ["atleta360", "orthoflow"] : []),
  };
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));

  DB = {
    patients: (patients.data || []).map(pRow),
    logs: (lg.data || []).map(lRow),
    hrv: (hv.data || []).map(hRow),
    questionnaires: (questionnaires.data || []).map(qRow),
    responses: (rs.data || []).map(rRow),
    proms: (ps.data || []).map(sRow),
    session,
    profile: prof?.data || null,
    ready: true,
    offline: false,
    lastError: null,
  };
  emit();
  return DB;
}

export function cachedSession() {
  // Entrada SEMPRE pela tela de login (decisão 24/11/2026): a sessão não é
  // restaurada do localStorage. Só vale a que está viva em memória.
  return DB.session || null;
}

// ------------------------------------------------------------------- auth
function traduz(msg) {
  const m = String(msg || "").toLowerCase();
  if (m.includes("invalid login")) return "E-mail ou senha inválidos.";
  if (m.includes("already registered")) return "Esta conta já existe. Entre com a senha.";
  if (m.includes("password should be") || m.includes("at least 6")) return "A senha precisa ter ao menos 6 caracteres.";
  if (m.includes("email not confirmed")) return "Confirme o e-mail antes de entrar.";
  if (m.includes("invalid email")) return "E-mail inválido.";
  if (m.includes("rate limit") || m.includes("too many")) return "Muitas tentativas. Aguarde um minuto.";
  return msg;
}

export async function login(email, pass, { hidratar = true } = {}) {
  if (!supabase) return { error: "Banco não configurado." };
  const { error } = await supabase.auth.signInWithPassword({ email: String(email).trim(), password: pass });
  if (error) return { error: traduz(error.message) };
  if (!hidratar) return { ok: true };
  const db = await hydrate();
  if (!db.session) return { error: "Sessão não confirmada. Tente novamente." };
  return { session: db.session };
}

/** Primeiro acesso: cria a conta e vincula a ficha pelo e-mail. */
export async function firstAccess(email, pass) {
  if (!supabase) return { error: "Banco não configurado." };
  const mail = String(email).trim().toLowerCase();
  const { data, error } = await supabase.auth.signUp({ email: mail, password: pass });
  if (error) return { error: traduz(error.message) };
  if (!data.session) return { error: "Conta criada. Confirme o e-mail que enviamos para entrar." };

  const { data: pid, error: e2 } = await supabase.rpc("a360_claim_patient");
  if (e2) return { error: traduz(e2.message) };

  const db = await hydrate();
  if (!pid) {
    return { error: "Não encontrei ficha com este e-mail. Peça à clínica para cadastrar seu e-mail." };
  }
  return { session: db.session };
}

export async function logout() {
  if (supabase) await supabase.auth.signOut();
  localStorage.removeItem(SESSION_KEY);
  DB.session = null;
  DB.profile = null;
  emit();
}

export async function changePassword(currentPass, newPass) {
  if (!supabase) return { error: "Banco não configurado." };
  if (!newPass || newPass.length < 6) return { error: "A nova senha precisa ter ao menos 6 caracteres." };
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Sessão expirada. Entre novamente." };
  const { error: e1 } = await supabase.auth.signInWithPassword({ email: user.email, password: currentPass });
  if (e1) return { error: "Senha atual incorreta." };
  const { error } = await supabase.auth.updateUser({ password: newPass });
  if (error) return { error: traduz(error.message) };
  return { ok: true };
}

export async function resetPassword(email) {
  if (!supabase) return { error: "Banco não configurado." };
  const { error } = await supabase.auth.resetPasswordForEmail(String(email).trim(), {
    redirectTo: window.location.origin + window.location.pathname,
  });
  if (error) return { error: traduz(error.message) };
  return { ok: true };
}

// ---------------------------------------------------------------- pacientes
const byName = (a, b) => String(a.name).localeCompare(String(b.name));
const byDateDesc = (a, b) => String(b.date).localeCompare(String(a.date));

export const Patients = {
  list: () => [...DB.patients].sort(byName),
  get: (id) => DB.patients.find((p) => p.id === id) || null,
  byEmail: (e) => DB.patients.find((p) => (p.email || "").toLowerCase() === String(e).toLowerCase()) || null,
  active: (mod) => DB.patients.filter((p) => p.status === "ativo" && (!mod || p.modules.includes(mod))),

  async create(d) {
    const payload = pDb(d);
    // paciente criado pela clínica entra como sem conta (user_id nulo)
    const { data, error } = await supabase.from("patient").insert(payload).select().single();
    if (error) { DB.lastError = error.message; throw new Error(error.message); }
    await hydrate();
    // devolve no formato do app (id/code/name…), não a linha crua do banco
    return pRow(data);
  },
  async update(id, d) {
    const { error } = await supabase.from("patient").update(pDb(d)).eq("id", id);
    if (error) throw new Error(error.message);
    await hydrate();
  },
  async remove(id) {
    const { error } = await supabase.from("patient").delete().eq("id", id);
    if (error) throw new Error(error.message);
    await hydrate();
  },
  async setModules(id, modules) {
    const { error } = await supabase.from("patient").update({ modules }).eq("id", id);
    if (error) throw new Error(error.message);
    await hydrate();
  },
};

// ------------------------------------------------------------------ treinos
export const Logs = {
  list: (pid) => [...DB.logs].filter((l) => !pid || l.patient_id === pid).sort(byDateDesc),
  recent: (n = 100) => [...DB.logs].sort(byDateDesc).slice(0, n),
  async create(d) {
    const { error } = await supabase.from("a360_training_log").insert(lDb(d));
    if (error) { DB.lastError = error.message; throw new Error(error.message); }
    await hydrate();
  },
  async update(id, d) {
    const patch = lDb({ ...d, patient_id: d.patient_id || DB.logs.find((l) => l.id === id)?.patient_id });
    delete patch.patient_id;
    const { error } = await supabase.from("a360_training_log").update(patch).eq("id", id);
    if (error) throw new Error(error.message);
    await hydrate();
  },
  async remove(id) {
    const { error } = await supabase.from("a360_training_log").delete().eq("id", id);
    if (error) throw new Error(error.message);
    await hydrate();
  },
};

export const HRV = {
  list: (pid) => [...DB.hrv].filter((h) => !pid || h.patient_id === pid).sort(byDateDesc),
  async create(d) {
    const { error } = await supabase.from("a360_hrv_log").insert({
      patient_id: d.patient_id, date: String(d.date).slice(0, 10), hrv: Number(d.hrv), notes: d.notes || null,
    });
    if (error) throw new Error(error.message);
    await hydrate();
  },
  async remove(id) {
    const { error } = await supabase.from("a360_hrv_log").delete().eq("id", id);
    if (error) throw new Error(error.message);
    await hydrate();
  },
};

export const Questionnaires = {
  list: () => [...DB.questionnaires],
  get: (id) => DB.questionnaires.find((q) => q.id === id) || null,
};

export const Responses = {
  list: (filter = {}) =>
    [...DB.responses]
      .filter((r) => Object.entries(filter).every(([k, v]) => (v == null ? true : r[k] === v)))
      .sort(byDateDesc),
  async create(d) {
    const q = Questionnaires.get(d.questionnaire_id);
    const texts = (q?.questions || []).map((x) => x.text);
    const answers = (d.answers || []).map((a) => {
      const i = a.i != null ? a.i : texts.indexOf(a.question_text);
      return { i: i >= 0 ? i : 0, a: a.answer ?? a.a ?? "" };
    });
    const { error } = await supabase.from("a360_response").insert({
      questionnaire_id: d.questionnaire_id, patient_id: d.patient_id,
      date: String(d.date).slice(0, 10), answers, notes: d.notes || null,
    });
    if (error) throw new Error(error.message);
    await hydrate();
  },
  async remove(id) {
    const { error } = await supabase.from("a360_response").delete().eq("id", id);
    if (error) throw new Error(error.message);
    await hydrate();
  },
};

// ---------------------------------------------------------------- Orthoflow
export const PROMs = {
  instruments: () => PROM_INSTRUMENTS,
  list: (pid) => [...DB.proms].filter((s) => !pid || s.patient_id === pid).sort((a, b) => String(b.submitted_at).localeCompare(String(a.submitted_at))),
  async create(d) {
    const payload = {
      patient_id: d.patient_id,
      questionnaire: d.questionnaire,
      answers: d.answers || {},
      total_score: d.total_score ?? null,
      subscale_scores: d.subscale_scores ?? null,
      protocol_week: d.protocol_week ?? null,
    };
    const { error } = await supabase.from("prom_submission").insert(payload);
    if (error) throw new Error(error.message);
    await hydrate();
  },
  async remove(id) {
    const { error } = await supabase.from("prom_submission").delete().eq("id", id);
    if (error) throw new Error(error.message);
    await hydrate();
  },
};

/** Semana do protocolo a partir da data de início. */
export function protocolWeek(protocolStart, date = new Date()) {
  if (!protocolStart) return null;
  const [y, m, d] = String(protocolStart).slice(0, 10).split("-").map(Number);
  const start = new Date(y, (m || 1) - 1, d || 1);
  const diff = Math.floor((date.getTime() - start.getTime()) / 864e5);
  if (diff < 0) return 0;
  return Math.floor(diff / 7) + 1;
}

// ------------------------------------------------------------------ backup
export function exportBackup() {
  const payload = {
    exportedAt: new Date().toISOString(),
    patients: DB.patients, logs: DB.logs, hrv: DB.hrv,
    questionnaires: DB.questionnaires, responses: DB.responses, proms: DB.proms,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `doutor-helio-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

// alias usado pelas telas migradas
export const currentSession = cachedSession;

// -------------------------------------------------- acesso do paciente
// O app NÃO tem cadastro público: só a clínica cria acesso. O admin abre a
// ficha, gera uma senha temporária e entrega ao paciente por WhatsApp/e-mail.
// A conta é criada no Supabase Auth e a ficha é vinculada ao usuário na hora.

/** Gera senha legível — sem 0/O e 1/l/I, para ditar por telefone. */
export function gerarSenha(tamanho = 10) {
  const letras = "abcdefghjkmnpqrstuvwxyz";
  const nums = "23456789";
  const maius = "ABCDEFGHJKMNPQRSTUVWXYZ";
  const alfabeto = letras + nums + maius;
  const rnd = (n) => Math.floor(Math.random() * n);
  let s = "";
  for (let i = 0; i < tamanho; i++) s += alfabeto[rnd(alfabeto.length)];
  // garante ao menos uma maiúscula e um número (política do Supabase)
  if (!/[A-Z]/.test(s)) s = s.slice(0, -1) + maius[rnd(maius.length)];
  if (!/[0-9]/.test(s)) s = s.slice(0, -2) + nums[rnd(nums.length)] + s.slice(-1);
  return s;
}

/**
 * Cria o acesso de um paciente já cadastrado.
 * @returns {{ok:true, email:string, senha:string}} ou {{error:string}}
 */
export async function criarAcessoPaciente(patientId, { email, senha } = {}) {
  if (!supabase) return { error: "Banco não configurado." };
  const p = Patients.get(patientId);
  if (!p) return { error: "Paciente não encontrado." };
  const mail = String(email || p.email || "").trim().toLowerCase();
  if (!mail) return { error: "Cadastre o e-mail do paciente antes de criar o acesso." };
  const pass = senha || gerarSenha();

  // IMPORTANTE: supabase.auth.signUp TROCA a sessão ativa pela do usuário
  // recém-criado. Sem restaurar, o admin vira o paciente por baixo e passa a
  // ver só a própria ficha (a lista caía de 8 para 1 paciente). Guardamos a
  // sessão do admin e voltamos para ela no fim.
  const { data: atual } = await supabase.auth.getSession();
  const adminAccess = atual?.session?.access_token;
  const adminRefresh = atual?.session?.refresh_token;
  const restaurarAdmin = async () => {
    if (!adminAccess || !adminRefresh) return;
    await supabase.auth.setSession({ access_token: adminAccess, refresh_token: adminRefresh });
  };

  const { data, error } = await supabase.auth.signUp({ email: mail, password: pass });
  if (error) {
    const m = String(error.message || "");
    await restaurarAdmin();
    if (/already registered|already been registered/i.test(m)) {
      return { error: "Este e-mail já tem acesso. Use 'Redefinir senha' na ficha do paciente." };
    }
    return { error: traduz(m) };
  }
  const userId = data?.user?.id;
  if (!userId) {
    await restaurarAdmin();
    return { error: "O Supabase não devolveu o usuário. Verifique se 'Confirm email' está desligado." };
  }

  // vincula a ficha ao usuário recém-criado (a política permite ao admin)
  const { error: e2 } = await supabase
    .from("patient")
    .update({ user_id: userId, email: mail })
    .eq("id", patientId);

  // devolve a sessão ao admin ANTES de recarregar o cache
  await restaurarAdmin();
  await hydrate();

  if (e2) return { error: "Conta criada, mas não consegui vincular à ficha: " + traduz(e2.message) };
  return { ok: true, email: mail, senha: pass };
}

/** Redefine a senha de um paciente que já tem acesso. */
export async function redefinirSenhaPaciente(novaSenha) {
  if (!supabase) return { error: "Banco não configurado." };
  const { error } = await supabase.auth.updateUser({ password: novaSenha });
  if (error) return { error: traduz(error.message) };
  return { ok: true };
}

// ------------------------------------------------------------ maturação
export const maturacaoVisitas = {
  async list(patientId) {
    if (!supabase) return [];
    const { data, error } = await supabase
      .from("maturacao_visita").select("*")
      .eq("patient_id", patientId).order("data_avaliacao", { ascending: false });
    if (error) throw error;
    return (data || []).map((r) => ({
      date: r.data_avaliacao, stature: r.estatura, mirwaldOffset: r.mirwald_offset,
      consensusPct: r.consenso_pct, mirwaldPHV: r.mirwald_phv, ...r,
    }));
  },
  async criar(patientId, form, res) {
    if (!supabase) throw new Error("Banco não configurado.");
    const { error } = await supabase.from("maturacao_visita").insert({
      patient_id: patientId,
      data_avaliacao: form.evalDate,
      sexo: form.sex,
      estatura: Num(form.stature), sentada: Num(form.sittingHeight), peso: Num(form.weight),
      pai: Num(form.fatherHeight), mae: Num(form.motherHeight),
      menarca: !!form.menarca, menarca_data: form.menarcaData || null,
      idade_ossea: Num(form.boneAge),
      idade_decimal: res.ageDecimal,
      mirwald_offset: res.mirwaldOffset, mirwald_phv: res.mirwaldPHV,
      khamis_pah: res.khamisPAH, khamis_pct: res.khamisPct,
      bp_pah: res.bpPAH, bp_pct: res.bpPct,
      consenso_pah: res.consensusPAH, consenso_pct: res.consensusPct,
      banding: res.bandingPct,
    });
    if (error) throw error;
  },
};
const Num = (v) => (v === "" || v == null || Number.isNaN(parseFloat(v)) ? null : parseFloat(v));

/**
 * Troca a senha de um paciente pelo ADMIN.
 * A troca roda numa função SQL SECURITY DEFINER (admin_set_patient_password)
 * que confere `is_admin()` antes de agir: a senha nunca passa pelo navegador
 * como hash, e nenhum paciente consegue chamar.
 */
export async function trocarSenhaPaciente(patientId, novaSenha) {
  if (!supabase) return { error: "Banco não configurado." };
  // Aceita tanto o uuid da linha quanto o código da ficha (PAC-0001).
  // O importante é NUNCA mandar undefined: o supabase-js descarta a chave e a
  // chamada vira "function(p_password)" — que não existe.
  const chave = String(patientId || "").trim();
  if (!chave) return { error: "Ficha não informada." };
  if (!novaSenha || novaSenha.length < 6) return { error: "A senha precisa ter ao menos 6 caracteres." };
  const { data, error } = await supabase.rpc("admin_set_patient_password", {
    p_patient_id: chave,
    p_password: novaSenha,
  });
  if (error) return { error: "Não consegui trocar a senha: " + error.message };
  if (data?.error) return { error: data.error };
  return { ok: true };
}
