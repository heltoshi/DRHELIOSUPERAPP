import React from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Patients, Logs, HRV, Responses, PROMs, protocolWeek, subscribe, maturacaoVisitas,
} from "../lib/data";
import { acwrStatus, computeACWR, groupDailyLoads, fmt2, fmt0, fmtDate } from "../lib/metrics";
import { Card, CardTitle, Badge, Button, Empty, Avatar } from "../components/ui";

// Os três apps que compõem o super app. A ficha é UMA só: o que muda é
// quais módulos a pessoa usa. Aqui o admin vê e liga/desliga cada módulo.
export const MODULOS = [
  { id: "atleta360", nome: "Atleta 360", curto: "360", cor: "#0e7490" },
  { id: "orthoflow", nome: "OrthoFlow", curto: "Ortho", cor: "#7c3aed" },
  { id: "maturacao", nome: "Maturação", curto: "Mat", cor: "#059669" },
];

/**
 * Seção única de pacientes — a mesma ficha serve aos três apps.
 * Fonte da verdade: patient.modules. Sem ficha duplicada em nenhum módulo.
 */
export default function Pacientes() {
  const [, force] = React.useState(0);
  React.useEffect(() => subscribe(() => force((n) => n + 1)), []);
  const navigate = useNavigate();

  const [busca, setBusca] = React.useState("");
  const [filtro, setFiltro] = React.useState("todos");
  const [ajustando, setAjustando] = React.useState(null);
  const [contagem, setContagem] = React.useState({});

  const todos = Patients.list();

  // Contagem de registros por paciente em cada módulo (para mostrar "tem dados")
  React.useEffect(() => {
    let vivo = true;
    (async () => {
      const out = {};
      for (const p of todos) {
        const [m, pr] = await Promise.all([
          maturacaoVisitas.list(p.id).catch(() => []),
          Promise.resolve(PROMs.list(p.id)),
        ]);
        const logs = Logs.list(p.id);
        const resp = Responses.list({ patient_id: p.id });
        out[p.id] = { mat: (m || []).length, prom: pr.length, treino: logs.length, quest: resp.length };
      }
      if (vivo) setContagem(out);
    })();
    return () => { vivo = false; };
  }, [todos.length]);

  const lista = todos.filter((p) => {
    const casa = !busca || (p.name + " " + (p.diagnosis || "") + " " + (p.email || ""))
      .toLowerCase().includes(busca.toLowerCase());
    if (!casa) return false;
    if (filtro === "todos") return true;
    return (p.modules || []).includes(filtro);
  });

  const alternarModulo = async (p, mod) => {
    const atual = p.modules || [];
    const novas = atual.includes(mod) ? atual.filter((m) => m !== mod) : [...atual, mod];
    if (!novas.length) return; // não deixa a ficha sem módulo nenhum
    await Patients.setModules(p.id, novas);
  };

  return (
    <>
      <div className="topbar">
        <div>
          <button className="link-back" onClick={() => navigate("/modulos")}>← módulos</button>
          <h1>Pacientes</h1>
          <p>Uma ficha só para os três apps — {todos.length} {todos.length === 1 ? "paciente" : "pacientes"}</p>
        </div>
        <Button variant="primary" size="sm" onClick={() => navigate("/pacientes/novo")}>
          + Novo paciente
        </Button>
      </div>

      <div className="content">
        <Card>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <input
              placeholder="Buscar por nome, diagnóstico ou e-mail…"
              value={busca} onChange={(e) => setBusca(e.target.value)}
              style={{ flex: 1, minWidth: 200 }}
            />
            <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
              <button className={`btn btn-sm ${filtro === "todos" ? "btn-primary" : "btn-outline"}`}
                onClick={() => setFiltro("todos")}>
                Todos ({todos.length})
              </button>
              {MODULOS.map((m) => {
                const n = todos.filter((p) => (p.modules || []).includes(m.id)).length;
                return (
                  <button key={m.id}
                    className={`btn btn-sm ${filtro === m.id ? "btn-primary" : "btn-outline"}`}
                    onClick={() => setFiltro(m.id)}>
                    {m.nome} ({n})
                  </button>
                );
              })}
            </div>
          </div>
        </Card>

        {lista.length === 0 ? (
          <Card><Empty title="Nenhum paciente" hint="Cadastre o primeiro pela seção Novo paciente." /></Card>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
            {lista.map((p) => {
              const c = contagem[p.id] || {};
              const acwr = computeACWR(groupDailyLoads(Logs.list(p.id)));
              const st = acwrStatus(acwr.acwr);
              const semana = protocolWeek(p.protocol_start);
              const temDados = (c.mat || 0) + (c.prom || 0) + (c.treino || 0) + (c.quest || 0) > 0;

              return (
                <Card key={p.id} style={{ padding: "13px 15px" }}>
                  <div style={{ display: "flex", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
                    <Avatar name={p.name} size={44} />
                    <div style={{ flex: 1, minWidth: 190 }}>
                      <div style={{ display: "flex", gap: 7, alignItems: "center", flexWrap: "wrap" }}>
                        <Link to={`/pacientes/${p.id}`} style={{ fontSize: 15, fontWeight: 650, color: "#0f172a" }}>
                          {p.name}
                        </Link>
                        <Badge tone="gray">{p.code}</Badge>
                        {!p.email && <Badge tone="amber">sem e-mail</Badge>}
                        {p.user_id && <Badge tone="green">tem acesso</Badge>}
                      </div>
                      <p style={{ fontSize: 12, color: "#94a3b8", marginTop: 3 }}>
                        {p.diagnosis || "sem diagnóstico"}
                        {p.dob && ` · ${p.dob.split("-").reverse().join("/")}`}
                        {semana ? ` · semana ${semana}` : ""}
                        {p.email ? ` · ${p.email}` : ""}
                      </p>

                      {/* módulos — clicáveis para ligar/desligar */}
                      <div style={{ display: "flex", gap: 5, marginTop: 8, flexWrap: "wrap" }}>
                        {MODULOS.map((m) => {
                          const ativo = (p.modules || []).includes(m.id);
                          const nDados = m.id === "maturacao" ? c.mat : m.id === "orthoflow" ? c.prom : c.treino;
                          return (
                            <button
                              key={m.id}
                              onClick={() => alternarModulo(p, m.id)}
                              title={ativo ? `Desligar ${m.nome}` : `Ligar ${m.nome}`}
                              style={{
                                fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 6,
                                cursor: "pointer", border: "1px solid",
                                borderColor: ativo ? m.cor : "#e2e8f0",
                                background: ativo ? m.cor : "#fff",
                                color: ativo ? "#fff" : "#94a3b8",
                              }}
                            >
                              {m.nome}{nDados ? ` · ${nDados}` : ""}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
                      {acwr.acwr != null && (
                        <div style={{ textAlign: "right" }}>
                          <p style={{ fontSize: 10.5, color: "#94a3b8" }}>ACWR</p>
                          <p style={{ fontSize: 15, fontWeight: 700, color: st.color === "red" ? "#dc2626" : st.color === "yellow" ? "#d97706" : "#059669" }}>
                            {fmt2.format(acwr.acwr)}
                          </p>
                        </div>
                      )}
                      <Link to={`/pacientes/${p.id}`} className="btn btn-sm btn-outline">Abrir</Link>
                    </div>
                  </div>

                  {!temDados && (
                    <p style={{ fontSize: 11.5, color: "#cbd5e1", marginTop: 8, borderTop: "1px dashed #eef2f7", paddingTop: 7 }}>
                      Ficha sem registros ainda — nenhum treino, PROM ou avaliação de maturação.
                    </p>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
