import React from "react";
import { Patients, Logs, subscribe } from "../lib/data";
import { fmtDate, fmt0, todayISO, logLoad } from "../lib/metrics";
import { Card, Badge, Button, Modal, Field, Empty } from "../components/ui";

const EMPTY = {
  date: todayISO(), pse: 5, duration_minutes: 60, training_type: "", observations: "",
  sleep_hours: "", sleep_quality: "", muscle_soreness: "", fatigue_level: "", mood: "",
};

export function TrainingLogForm({ open, onClose, patientId, initial, onSave }) {
  const [form, setForm] = React.useState(EMPTY);
  const [err, setErr] = React.useState("");

  React.useEffect(() => {
    if (open) {
      setForm(initial ? { ...EMPTY, ...initial, date: String(initial.date).slice(0, 10) } : { ...EMPTY, date: todayISO() });
      setErr("");
    }
  }, [open, initial]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const carga = (Number(form.pse) || 0) * (Number(form.duration_minutes) || 0);

  const submit = (e) => {
    e?.preventDefault();
    if (!form.date) return setErr("Informe a data do treino.");
    const pse = Number(form.pse);
    const dur = Number(form.duration_minutes);
    if (!(pse >= 1 && pse <= 10)) return setErr("O PSE precisa estar entre 1 e 10.");
    if (!(dur > 0 && dur <= 600)) return setErr("A duração precisa estar entre 1 e 600 minutos.");

    const num = (v) => (v === "" || v == null ? undefined : Number(v));
    onSave({
      patient_id: patientId,
      date: form.date,
      pse,
      duration_minutes: dur,
      training_load: pse * dur,
      training_type: form.training_type || undefined,
      observations: form.observations || undefined,
      sleep_hours: num(form.sleep_hours),
      sleep_quality: num(form.sleep_quality),
      muscle_soreness: num(form.muscle_soreness),
      fatigue_level: num(form.fatigue_level),
      mood: num(form.mood),
    });
    onClose();
  };

  const ESCALA = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"];

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initial ? "Editar treino" : "Registrar treino"}
      footer={
        <>
          <Button variant="outline" type="button" onClick={onClose}>Cancelar</Button>
          <Button variant="primary" type="button" onClick={submit}>Salvar</Button>
        </>
      }
    >
      <form className="form-grid" onSubmit={submit}>
        <Field label="Data">
          <input type="date" value={form.date} onChange={set("date")} />
        </Field>
        <Field label="Tipo de treino">
          <input value={form.training_type} onChange={set("training_type")} placeholder="Ex.: Físico, Técnico, Jogo" />
        </Field>

        <div className="span-2">
          <Field label={`PSE — percepção de esforço: ${form.pse}`}>
            <div className="scale-row">
              {ESCALA.map((n) => (
                <button
                  type="button"
                  key={n}
                  className={String(form.pse) === n ? "on" : ""}
                  onClick={() => setForm((f) => ({ ...f, pse: Number(n) }))}
                >
                  {n}
                </button>
              ))}
            </div>
          </Field>
        </div>

        <Field label="Duração (min)">
          <input type="number" min="1" max="600" value={form.duration_minutes} onChange={set("duration_minutes")} />
        </Field>
        <Field label="Carga calculada" hint="PSE × duração — gravada automaticamente">
          <input value={`${fmt0.format(carga)} UA`} readOnly style={{ background: "#f8fafc", fontWeight: 600 }} />
        </Field>

        <div className="span-2" style={{ borderTop: "1px solid #eef2f7", paddingTop: 11, marginTop: 2 }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: "#475569", marginBottom: 9 }}>
            Bem-estar (opcional) — quanto maior, melhor, exceto dor e fadiga
          </p>
        </div>

        <Field label="Horas de sono">
          <input type="number" step="0.5" min="0" max="16" value={form.sleep_hours ?? ""} onChange={set("sleep_hours")} />
        </Field>
        <Field label="Qualidade do sono (1–5)">
          <input type="number" min="1" max="5" value={form.sleep_quality ?? ""} onChange={set("sleep_quality")} />
        </Field>
        <Field label="Dor muscular (1–5)">
          <input type="number" min="1" max="5" value={form.muscle_soreness ?? ""} onChange={set("muscle_soreness")} />
        </Field>
        <Field label="Fadiga (1–5)">
          <input type="number" min="1" max="5" value={form.fatigue_level ?? ""} onChange={set("fatigue_level")} />
        </Field>
        <Field label="Humor (1–5)">
          <input type="number" min="1" max="5" value={form.mood ?? ""} onChange={set("mood")} />
        </Field>

        <div className="span-2">
          <Field label="Observações">
            <textarea value={form.observations} onChange={set("observations")} placeholder="Como foi o treino…" />
          </Field>
        </div>

        {err && <div className="span-2 alert-box alert-red">{err}</div>}
      </form>
    </Modal>
  );
}

export default function TrainingLogsPage() {
  const [, force] = React.useState(0);
  React.useEffect(() => subscribe(() => force((n) => n + 1)), []);

  const patients = Patients.list().filter((p) => p.modules.includes("atleta360"));
  const [filtro, setFiltro] = React.useState("all");
  const [busca, setBusca] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const [novoPara, setNovoPara] = React.useState("");

  const todos = Logs.list();
  const lista = todos
    .filter((l) => filtro === "all" || l.patient_id === filtro)
    .filter((l) => {
      if (!busca) return true;
      const p = patients.find((x) => x.id === l.patient_id);
      const q = busca.toLowerCase();
      return (p?.name || "").toLowerCase().includes(q) || (l.training_type || "").toLowerCase().includes(q);
    });

  const totalCarga = lista.reduce((s, l) => s + logLoad(l), 0);
  const totalMin = lista.reduce((s, l) => s + (l.duration_minutes || 0), 0);
  const mediaPse = lista.length ? lista.reduce((s, l) => s + (l.pse || 0), 0) / lista.length : 0;

  return (
    <>
      <div className="topbar">
        <div>
          <h1>Treinos</h1>
          <p>{todos.length} registros · {fmt0.format(totalCarga)} UA no filtro atual</p>
        </div>
        <Button
          variant="primary"
          size="sm"
          disabled={patients.length === 0}
          onClick={() => { setNovoPara(filtro !== "all" ? filtro : patients[0]?.id); setOpen(true); }}
        >
          + Registrar treino
        </Button>
      </div>

      <div className="content">
        <div className="grid grid-3">
          <Card><p className="stat-label">Registros no filtro</p><p className="stat-value">{lista.length}</p></Card>
          <Card><p className="stat-label">Carga total</p><p className="stat-value">{fmt0.format(totalCarga)} <span style={{ fontSize: 13, color: "#94a3b8" }}>UA</span></p></Card>
          <Card><p className="stat-label">PSE média</p><p className="stat-value">{mediaPse.toFixed(1)} <span style={{ fontSize: 13, color: "#94a3b8" }}>/ 10</span></p></Card>
        </div>

        <div style={{ display: "flex", gap: 9, flexWrap: "wrap" }}>
          <select value={filtro} onChange={(e) => setFiltro(e.target.value)} style={{ width: 210 }}>
            <option value="all">Todos os atletas</option>
            {patients.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <input placeholder="Buscar por atleta ou tipo…" value={busca} onChange={(e) => setBusca(e.target.value)} style={{ flex: 1, minWidth: 180 }} />
        </div>

        <Card style={{ padding: 0, overflow: "hidden" }}>
          {lista.length === 0 ? (
            <Empty title="Nenhum treino registrado" hint="Registre o primeiro treino deste atleta." />
          ) : (
            <table className="table treinos">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Atleta</th>
                  <th>Tipo</th>
                  <th className="num">PSE</th>
                  <th className="num">Min</th>
                  <th className="num">Carga</th>
                  <th className="num">Sono</th>
                </tr>
              </thead>
              <tbody>
                {lista.slice(0, 300).map((l) => {
                  const p = patients.find((x) => x.id === l.patient_id);
                  return (
                    <tr key={l.id}>
                      <td style={{ color: "#64748b" }}>{fmtDate(l.date)}</td>
                      <td style={{ fontWeight: 550 }}>{p?.name || "—"}</td>
                      <td>{l.training_type ? <Badge tone="blue">{l.training_type}</Badge> : <span style={{ color: "#cbd5e1" }}>—</span>}</td>
                      <td className="num">{l.pse}</td>
                      <td className="num">{l.duration_minutes}</td>
                      <td className="num" style={{ fontWeight: 600 }}>{fmt0.format(logLoad(l))}</td>
                      <td className="num" style={{ color: "#64748b" }}>{l.sleep_hours ?? "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </Card>
        {lista.length > 300 && (
          <p style={{ fontSize: 12, color: "#94a3b8", textAlign: "center" }}>
            Mostrando os 300 registros mais recentes de {lista.length}. Use o filtro por atleta para ver o histórico completo.
          </p>
        )}
      </div>

      <TrainingLogForm
        open={open}
        onClose={() => setOpen(false)}
        patientId={novoPara}
        onSave={(data) => Logs.create(data)}
      />
    </>
  );
}
