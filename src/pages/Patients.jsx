import React from "react";
import { Link } from "react-router-dom";
import { Patients, Logs, Responses, subscribe } from "../lib/data";
import { computeAge, groupDailyLoads, computeACWR, acwrStatus, fmt2, fmtDate } from "../lib/metrics";
import { BotaoAcesso } from "../components/Acesso";
import { Card, Badge, Button, Modal, Field, Empty, Avatar } from "../components/ui";

const STATUS = {
  ativo: { label: "Ativo", tone: "green" },
  inativo: { label: "Inativo", tone: "gray" },
  lesionado: { label: "Lesionado", tone: "red" },
};

const EMPTY = {
  name: "", dob: "", weight: "", height: "", gender: "feminino", sport: "",
  position: "", team: "", coach: "", email: "", phone: "", notes: "", status: "ativo",
};

export function PatientForm({ open, onClose, initial, onSave }) {
  const [form, setForm] = React.useState(EMPTY);
  const [err, setErr] = React.useState("");

  React.useEffect(() => {
    if (open) {
      setForm(initial ? { ...EMPTY, ...initial } : EMPTY);
      setErr("");
    }
  }, [open, initial]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = (e) => {
    e.preventDefault();
    if (!form.name.trim()) return setErr("O nome é obrigatório.");
    if (!form.sport.trim()) return setErr("A modalidade esportiva é obrigatória.");
    const payload = { ...form };
    ["weight", "height"].forEach((k) => {
      if (payload[k] === "" || payload[k] == null) delete payload[k];
      else payload[k] = Number(String(payload[k]).replace(",", "."));
    });
    onSave(payload);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initial ? "Editar atleta" : "Novo atleta"}
      wide
      footer={
        <>
          <Button variant="outline" onClick={onClose} type="button">Cancelar</Button>
          <Button variant="primary" onClick={submit} type="button">Salvar</Button>
        </>
      }
    >
      <form className="form-grid" onSubmit={submit}>
        <div className="span-2">
          <Field label="Nome completo *">
            <input value={form.name} onChange={set("name")} placeholder="Nome do atleta" />
          </Field>
        </div>
        <Field label="Data de nascimento">
          <input type="date" value={form.dob || ""} onChange={set("dob")} />
        </Field>
        <Field label="Modalidade *">
          <input value={form.sport} onChange={set("sport")} placeholder="Ex.: Tênis" />
        </Field>
        <Field label="Peso (kg)">
          <input type="number" step="0.1" value={form.weight ?? ""} onChange={set("weight")} />
        </Field>
        <Field label="Altura (cm)" hint="Aceita 1,75 — converto para 175 cm">
          <input type="number" step="0.1" value={form.height ?? ""} onChange={set("height")} />
        </Field>
        <Field label="Gênero">
          <select value={form.gender} onChange={set("gender")}>
            <option value="feminino">Feminino</option>
            <option value="masculino">Masculino</option>
            <option value="outro">Outro</option>
          </select>
        </Field>
        <Field label="Situação">
          <select value={form.status} onChange={set("status")}>
            <option value="ativo">Ativo</option>
            <option value="lesionado">Lesionado</option>
            <option value="inativo">Inativo</option>
          </select>
        </Field>
        <Field label="Posição / função">
          <input value={form.position} onChange={set("position")} placeholder="Ex.: Levantador" />
        </Field>
        <Field label="Equipe / clube">
          <input value={form.team} onChange={set("team")} />
        </Field>
        <Field label="Treinador">
          <input value={form.coach} onChange={set("coach")} />
        </Field>
        <Field label="E-mail" hint="É por este e-mail que o atleta entra no portal">
          <input type="email" value={form.email} onChange={set("email")} />
        </Field>
        <Field label="Telefone">
          <input value={form.phone} onChange={set("phone")} placeholder="(43) 9...." />
        </Field>
        <div className="span-2">
          <Field label="Observações">
            <textarea value={form.notes} onChange={set("notes")} />
          </Field>
        </div>
        {err && <div className="span-2 alert-box alert-red">{err}</div>}
      </form>
    </Modal>
  );
}

export default function PatientsPage() {
  const [, force] = React.useState(0);
  React.useEffect(() => subscribe(() => force((n) => n + 1)), []);

  const [busca, setBusca] = React.useState("");
  const [filtro, setFiltro] = React.useState("todos");
  const [formOpen, setFormOpen] = React.useState(false);

  const todos = Patients.list().filter((p) => p.modules.includes("atleta360"));
  const logs = Logs.list();
  const responses = Responses.list();

  const lista = todos.filter((p) => {
    const okBusca =
      !busca ||
      p.name.toLowerCase().includes(busca.toLowerCase()) ||
      (p.sport || "").toLowerCase().includes(busca.toLowerCase()) ||
      (p.team || "").toLowerCase().includes(busca.toLowerCase());
    const okFiltro = filtro === "todos" || p.status === filtro;
    return okBusca && okFiltro;
  });

  const darInfo = (p) => {
    const pl = logs.filter((l) => l.patient_id === p.id);
    const { acwr } = computeACWR(groupDailyLoads(pl));
    const ultimo = pl.sort((a, b) => String(b.date).localeCompare(String(a.date)))[0];
    const resp = responses.filter((r) => r.patient_id === p.id);
    const ultimaResp = resp.sort((a, b) => String(b.date).localeCompare(String(a.date)))[0];
    return {
      acwr,
      status: acwrStatus(acwr),
      ultimo,
      nLogs: pl.length,
      nResp: resp.length,
      ultimaResp,
    };
  };

  return (
    <>
      <div className="topbar">
        <div>
          <h1>Pacientes</h1>
          <p>{todos.length} atletas cadastrados</p>
        </div>
        <Button variant="primary" size="sm" onClick={() => setFormOpen(true)}>+ Novo atleta</Button>
      </div>

      <div className="content">
        <div style={{ display: "flex", gap: 9, flexWrap: "wrap" }}>
          <input
            placeholder="Buscar por nome, modalidade ou equipe…"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            style={{ flex: 1, minWidth: 200 }}
          />
          <select value={filtro} onChange={(e) => setFiltro(e.target.value)} style={{ width: 160 }}>
            <option value="todos">Todos</option>
            <option value="ativo">Ativos</option>
            <option value="lesionado">Lesionados</option>
            <option value="inativo">Inativos</option>
          </select>
        </div>

        {lista.length === 0 ? (
          <Card>
            <Empty
              title="Nenhum atleta encontrado"
              hint={busca ? "Ajuste a busca ou limpe o filtro." : "Cadastre o primeiro atleta para começar o monitoramento."}
              action={<Button variant="primary" size="sm" onClick={() => setFormOpen(true)} style={{ marginTop: 12 }}>+ Novo atleta</Button>}
            />
          </Card>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
            {lista.map((p) => {
              const info = darInfo(p);
              const st = STATUS[p.status] || STATUS.ativo;
              const idade = computeAge(p.dob);
              return (
                <Link key={p.id} to={`/360/pacientes/${p.id}`} className="row-link" style={{ padding: "13px 15px" }}>
                  <Avatar name={p.name} size={42} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <b style={{ fontSize: 14 }}>{p.name}</b>
                      <Badge tone={st.tone}>{st.label}</Badge>
                    </div>
                    <p style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>
                      {p.sport}
                      {idade != null && ` · ${idade} anos`}
                      {p.team && ` · ${p.team}`}
                      {` · ${info.nLogs} treinos`}
                      {info.nResp > 0 && ` · ${info.nResp} coletas`}
                    </p>
                  </div>
                  <div style={{ textAlign: "right", minWidth: 74 }}>
                    <p style={{ fontSize: 11, color: "#94a3b8" }}>ACWR</p>
                    <p style={{ fontSize: 15, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
                      {info.acwr != null ? fmt2.format(info.acwr) : "—"}
                    </p>
                  </div>
                  <div style={{ textAlign: "right", minWidth: 74 }}>
                    <p style={{ fontSize: 11, color: "#94a3b8" }}>Último treino</p>
                    <p style={{ fontSize: 12.5, fontWeight: 550 }}>
                      {info.ultimo ? fmtDate(info.ultimo.date) : "—"}
                    </p>
                  </div>
                  <span className={`dot dot-${info.status.color}`} />
                  <span onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}>
                    <BotaoAcesso patient={p} />
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      <PatientForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSave={(data) => Patients.create(data)}
      />
    </>
  );
}
