import React from "react";
import { useSearchParams } from "react-router-dom";
import { Patients, subscribe, state } from "../lib/data";
import { calcularMaturacao, idadeDecimal } from "../lib/maturacao";
import { Card, CardTitle, Badge, Button, Field, Empty, Modal } from "../components/ui";
import { fmt0, fmt2, fmtDate } from "../lib/metrics";
import PainelMaturacao from "../components/PainelMaturacaoV2";

const fmt1 = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
// data LOCAL: toISOString converte para UTC e, depois das 21h em Brasília,
// devolve o dia seguinte ("avaliação amanhã").
const hoje = () => {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

const CORES = {
  "Pré-estirão": "gray",
  "Início do estirão": "amber",
  "Peripuberal": "teal",
  "Pós-estirão": "green",
};

function Campo({ label, hint, children }) {
  return (
    <div style={{ marginBottom: 11 }}>
      <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#475569", marginBottom: 4 }}>{label}</label>
      {children}
      {hint && <p style={{ fontSize: 11, color: "#94a3b8", marginTop: 3 }}>{hint}</p>}
    </div>
  );
}

export default function Maturacao() {
  const [, force] = React.useState(0);
  React.useEffect(() => subscribe(() => force((n) => n + 1)), []);

  const pacientes = Patients.list();
  const [params] = useSearchParams();
  const [sel, setSel] = React.useState(params.get("paciente") || null);
  const [form, setForm] = React.useState({ sex: "male", evalDate: hoje() });
  const [res, setRes] = React.useState(null);
  const [erro, setErro] = React.useState("");
  const [visitas, setVisitas] = React.useState([]);
  const [salvando, setSalvando] = React.useState(false);
  const [salvo, setSalvo] = React.useState(false);
  const [impMsg, setImpMsg] = React.useState("");
  const [impErro, setImpErro] = React.useState(false);

  const paciente = sel ? Patients.get(sel) : null;

  React.useEffect(() => {
    if (!paciente) { setVisitas([]); return; }
    setForm((f) => ({ ...f, sex: f.sex || "male", birthDate: paciente.dob || "" }));
    let vivo = true;
    import("../lib/data").then(({ maturacaoVisitas }) => {
      if (!maturacaoVisitas) return;
      maturacaoVisitas.list(paciente.id).then((v) => {
        if (!vivo) return;
        const lista = v || [];
        setVisitas(lista);
        // traz a última avaliação para o formulário: o médico só atualiza o que mudou
        const ult = lista[0];
        if (ult) {
          setForm((f) => ({
            ...f,
            evalDate: hoje(),
            sex: ult.sexo || f.sex,
            stature: ult.estatura ?? "",
            sittingHeight: ult.sentada ?? "",
            weight: ult.peso ?? "",
            fatherHeight: ult.pai ?? "",
            motherHeight: ult.mae ?? "",
            boneAge: ult.idade_ossea ?? "",
          }));
        }
      }).catch(() => {});
    });
    return () => { vivo = false; };
  }, [sel]);

  const set = (k) => (e) => setForm((x) => ({ ...x, [k]: e.target.value }));

  // Importa o JSON exportado pelo app antigo de maturação.
  // Formato: [{ name, sex, birthDate, visits:[{date, stature, sittingHeight,
  //   weight, khamisPAH, khamisPct, mirwaldOffset, mirwaldPHV, consensusPAH,
  //   consensusPct, bandingPct, ...}] }]
  const importar = async (ev) => {
    const file = ev.target.files?.[0];
    if (!file) return;
    setImpMsg(""); setImpErro(false);
    try {
      const texto = await file.text();
      const lista = JSON.parse(texto);
      if (!Array.isArray(lista)) throw new Error("O arquivo não parece ser a exportação do app antigo.");
      const { maturacaoVisitas } = await import("../lib/data");
      const todos = Patients.list();
      let ok = 0, semFicha = [], jaExiste = 0;
      for (const atleta of lista) {
        const nome = String(atleta.name || "").trim().toLowerCase();
        const ficha = todos.find((p) => String(p.name || "").trim().toLowerCase() === nome);
        if (!ficha) { semFicha.push(atleta.name); continue; }
        const existentes = await maturacaoVisitas.list(ficha.id);
        for (const v of atleta.visits || []) {
          // evita duplicar a mesma data
          if ((existentes || []).some((e) => String(e.data_avaliacao || e.date).slice(0, 10) === String(v.date).slice(0, 10))) { jaExiste++; continue; }
          await maturacaoVisitas.criar(ficha.id, {
            evalDate: v.date, sex: atleta.sex, stature: v.stature,
            sittingHeight: v.sittingHeight, weight: v.weight,
            fatherHeight: v.fatherHeight ?? atleta.fatherHeight,
            motherHeight: v.motherHeight ?? atleta.motherHeight,
            menarca: atleta.menarche === "yes", menarcaData: atleta.menarcheDate,
            boneAge: v.boneAge,
          }, {
            ageDecimal: v.ageDecimal, mirwaldOffset: v.mirwaldOffset, mirwaldPHV: v.mirwaldPHV,
            khamisPAH: v.khamisPAH, khamisPct: v.khamisPct, bpPAH: v.bpPAH, bpPct: v.bpPct,
            consensusPAH: v.consensusPAH, consensusPct: v.consensusPct, bandingPct: v.bandingPct,
          });
          ok++;
        }
      }
      let msg = `${ok} avaliação(ões) importada(s).`;
      if (jaExiste) msg += ` ${jaExiste} já existia(m) e foi(ram) ignorada(s).`;
      if (semFicha.length) { msg += ` Sem ficha cadastrada: ${semFicha.join(", ")}.`; setImpErro(true); }
      setImpMsg(msg);
    } catch (e) {
      setImpErro(true);
      setImpMsg("Não consegui importar: " + e.message);
    }
    ev.target.value = "";
  };

  const salvar = async () => {
    setSalvando(true);
    try {
      const { maturacaoVisitas } = await import("../lib/data");
      await maturacaoVisitas.criar(paciente.id, form, res);
      const v = await maturacaoVisitas.list(paciente.id);
      setVisitas(v || []);
      setSalvo(true);
    } catch (e) {
      setErro("Não consegui salvar: " + e.message);
    }
    setSalvando(false);
  };

  const calcular = () => {
    setErro(""); setRes(null); setSalvo(false);
    try {
      const entrada = {
        name: paciente?.name || "avaliação",
        sex: form.sex,
        birthDate: paciente?.dob || form.birthDate,
        evalDate: form.evalDate,
        stature: parseFloat(form.stature),
        sittingHeight: parseFloat(form.sittingHeight),
        weight: parseFloat(form.weight),
        fatherHeight: parseFloat(form.fatherHeight),
        motherHeight: parseFloat(form.motherHeight),
        menarche: form.menarca ? "yes" : "no",
        menarcheDate: form.menarcaData || "",
        // a idade óssea habilita o Bayley-Pinneau e entra no consenso.
        // Sem passar estes campos o método fica sempre vazio.
        boneAge: form.boneAge != null && form.boneAge !== "" ? form.boneAge : "",
        boneAgeMethod: "greulich",
        bpSource: "auto",
        visitaAnterior: visitas[0] || null,
      };
      if (!paciente?.dob) throw new Error("A ficha do paciente não tem data de nascimento. Complete o cadastro.");
      setRes(calcularMaturacao(entrada));
    } catch (e) {
      setErro(e.message);
    }
  };

  return (
    <>
      <div className="topbar">
        <div>
          <h1>Maturação</h1>
          <p>Predição de estatura adulta e janela de maturação (bio-banding)</p>
        </div>
      </div>

      <div className="content">
        <Card>
          <CardTitle sub="Traga o histórico do app antigo (Predição de Estatura) — um arquivo JSON por vez">Importar histórico do app antigo</CardTitle>
          <p style={{ fontSize: 12.5, color: "#64748b", marginBottom: 9 }}>
            No app antigo, use <b>Exportar JSON</b> e traga o arquivo aqui. As avaliações entram no
            histórico do paciente correspondente, casando pelo nome.
          </p>
          <input type="file" accept=".json" onChange={importar}
            style={{ fontSize: 12.5, padding: "6px 0" }} />
          {impMsg && <div className={`alert-box ${impErro ? "alert-red" : "alert-green"}`} style={{ marginTop: 9 }}>{impMsg}</div>}
        </Card>

        <Card>
          <CardTitle sub="Escolha o paciente da ficha">Paciente</CardTitle>
          <select value={sel || ""} onChange={(e) => { setSel(e.target.value || null); setRes(null); setErro(""); }}>
            <option value="">— selecione —</option>
            {pacientes.map((p) => (
              <option key={p.id} value={p.id}>{p.name} {p.code ? `· ${p.code}` : ""}</option>
            ))}
          </select>
          {paciente && !paciente.dob && (
            <div className="alert-box alert-amber" style={{ marginTop: 10 }}>
              Esta ficha não tem data de nascimento. Preencha em Pacientes → Editar antes de calcular.
            </div>
          )}
        </Card>

        {/* O painel aparece assim que o paciente é escolhido, com o histórico
            que já existe — igual ao que o cliente vê no portal. */}
        {paciente && !res && (visitas || []).length > 0 && (
          <PainelMaturacao paciente={paciente} visitas={visitas} />
        )}

        {paciente && (
          <Card>
            <CardTitle sub="Antropometria, estaturas parentais e idade óssea (opcional)">Dados da avaliação</CardTitle>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 12 }}>
              <Campo label="Data da avaliação *">
                <input type="date" value={form.evalDate || ""} onChange={set("evalDate")} />
              </Campo>
              <Campo label="Sexo *">
                <select value={form.sex} onChange={set("sex")}>
                  <option value="male">Masculino</option>
                  <option value="female">Feminino</option>
                </select>
              </Campo>
              <Campo label="Estatura (cm) *"><input type="number" step="0.1" value={form.stature || ""} onChange={set("stature")} placeholder="153.2" /></Campo>
              <Campo label="Estatura sentada (cm) *"><input type="number" step="0.1" value={form.sittingHeight || ""} onChange={set("sittingHeight")} placeholder="78.5" /></Campo>
              <Campo label="Peso (kg) *"><input type="number" step="0.1" value={form.weight || ""} onChange={set("weight")} placeholder="42.5" /></Campo>
              <Campo label="Estatura do pai (cm) *"><input type="number" step="0.1" value={form.fatherHeight || ""} onChange={set("fatherHeight")} placeholder="180.5" /></Campo>
              <Campo label="Estatura da mãe (cm) *"><input type="number" step="0.1" value={form.motherHeight || ""} onChange={set("motherHeight")} placeholder="166" /></Campo>
              <Campo label="Idade óssea (anos)" hint="Opcional — habilita Bayley-Pinneau">
                <input type="number" step="0.1" value={form.boneAge || ""} onChange={set("boneAge")} placeholder="13.5" />
              </Campo>
              {form.sex === "female" && (
                <>
                  <Campo label="Menarca">
                    <select value={form.menarca ? "1" : "0"} onChange={(e) => setForm((x) => ({ ...x, menarca: e.target.value === "1" }))}>
                      <option value="0">Não</option>
                      <option value="1">Sim</option>
                    </select>
                  </Campo>
                  {form.menarca && <Campo label="Data da menarca"><input type="date" value={form.menarcaData || ""} onChange={set("menarcaData")} /></Campo>}
                </>
              )}
            </div>
            {erro && <div className="alert-box alert-red" style={{ marginTop: 10 }}>{erro}</div>}
            <Button variant="primary" onClick={calcular} style={{ marginTop: 6 }}>Calcular predição</Button>
          </Card>
        )}

        {res && (
          <>
            <PainelMaturacao
              paciente={paciente}
              visitas={[
                ...(visitas || []),
                {
                  id: "em-calculo",
                  data_avaliacao: form.evalDate,
                  sexo: form.sex,
                  estatura: parseFloat(form.stature),
                  sentada: parseFloat(form.sittingHeight),
                  peso: parseFloat(form.weight),
                  pai: parseFloat(form.fatherHeight),
                  mae: parseFloat(form.motherHeight),
                  idade_ossea: form.boneAge ? parseFloat(form.boneAge) : null,
                  mirwald_offset: res.mirwaldOffset,
                  mirwald_phv: res.mirwaldPHV,
                  khamis_pah: res.khamisPAH,
                  khamis_pct: res.khamisPct,
                  bp_pah: res.bpPAH,
                  bp_pct: res.bpPct,
                  consenso_pah: res.consensusPAH,
                  consenso_pct: res.consensusPct,
                  banding: res.bandingPct,
                },
              ].filter((v) => !(visitas || []).some(
                (x) => String(x.data_avaliacao || x.date) === String(form.evalDate)))}
            />

            <Card>
              <CardTitle sub="Grave no histórico do paciente para acompanhar a evolução">Salvar avaliação</CardTitle>
              {salvo ? (
                <div className="alert-box alert-green">Avaliação salva no histórico de {paciente.name}.</div>
              ) : (
                <>
                  <p style={{ fontSize: 13, color: "#64748b" }}>
                    O cálculo acima ainda não foi gravado. Salve para registrar no histórico e permitir a comparação na próxima consulta.
                  </p>
                  <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                    <Button variant="primary" onClick={salvar} disabled={salvando}>{salvando ? "Salvando…" : "Salvar no histórico"}</Button>
                  </div>
                </>
              )}
            </Card>
          </>
        )}

        {!paciente && (
          <Card><Empty title="Selecione um paciente" hint="A maturação é calculada a partir da ficha já cadastrada." /></Card>
        )}
      </div>
    </>
  );
}
