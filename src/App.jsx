import React from "react";
import { Routes, Route, Navigate, NavLink, useNavigate, useLocation } from "react-router-dom";
import { hydrate, cachedSession, logout } from "./lib/data";
import Login from "./pages/Login";
import Seletor from "./pages/Seletor";
import Dashboard from "./pages/Dashboard";
import Pacientes from "./pages/PacientesUnificados";
import PatientDetail from "./pages/PatientDetail";
import TrainingLogs from "./pages/TrainingLogs";
import Questionnaires from "./pages/Questionnaires";
import OrthoFlow from "./pages/Orthoflow";
import Maturacao from "./pages/Maturacao";
import NovoCliente from "./pages/NovoCliente";
import Clientes from "./pages/Clientes";
import Laudos from "./pages/Laudos";

import PacienteFicha from "./pages/PacienteFicha";
import PROMForm from "./pages/PROMForm";
import Portal from "./pages/Portal";

const NAV_360 = [
  { to: "/360/painel", ico: "▦", label: "Painel" },
  { to: "/pacientes/novo", ico: "＋", label: "Novo paciente" },
  { to: "/pacientes", ico: "◉", label: "Pacientes" },
  { to: "/360/treinos", ico: "▤", label: "Treinos" },
  { to: "/360/questionarios", ico: "☑", label: "Questionários" },
  { to: "/360/maturacao", ico: "◑", label: "Maturação" },
];
const NAV_ORTHO = [
  { to: "/clientes", ico: "◉", label: "Clientes" },
  { to: "/pacientes/novo", ico: "＋", label: "Novo paciente" },
  { to: "/orthoflow", ico: "◈", label: "OrthoFlow" },
];

function Shell({ session, children, onLogout }) {
  const navigate = useNavigate();
  const loc = useLocation();
  const no360 = loc.pathname.startsWith("/360");
  const nav = no360 ? NAV_360 : NAV_ORTHO;
  const modNome = no360 ? "Atleta 360" : "OrthoFlow";

  const sair = async () => { await logout(); if (onLogout) onLogout(); navigate("/", { replace: true }); };

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">DH</div>
          <div className="brand-text">
            <b>Dr. Hélio</b>
            <span>{modNome}</span>
          </div>
        </div>

        <button className="modulo-troca" onClick={() => navigate("/modulos")}>
          <span className="mt-ico">{no360 ? "◉" : "◈"}</span>
          <span style={{ flex: 1, textAlign: "left" }}>
            <b>{modNome}</b>
            <small>trocar módulo</small>
          </span>
          <span style={{ opacity: 0.6 }}>⇄</span>
        </button>

        <nav className="nav">
          {nav.map((n) => (
            <NavLink key={n.to} to={n.to} className={({ isActive }) => (isActive ? "active" : "")}>
              <span className="ico">{n.ico}</span>
              {n.label}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-foot">
          <p className="who"><b>{session.email}</b>{session.role === "admin" ? "Administrador" : "Paciente"}</p>
          <button className="btn btn-sm btn-outline" onClick={sair} style={{ width: "100%" }}>Sair</button>
        </div>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}

export default function App() {
  const [session, setSession] = React.useState(null);
  const [booting, setBooting] = React.useState(true);
  const [erro, setErro] = React.useState("");

  React.useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const db = await hydrate();
        if (alive) setSession(db.session || null);
      } catch (e) {
        if (alive) setErro(e.message || "Falha ao carregar.");
      }
      if (alive) setBooting(false);
    })();
    const c = cachedSession();
    if (c) setSession(c);
    return () => { alive = false; };
  }, []);

  if (booting) {
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#f6f8fb" }}>
        <div style={{ textAlign: "center" }}>
          <div className="brand-mark" style={{ margin: "0 auto 12px", width: 46, height: 46 }}>DH</div>
          <p style={{ fontSize: 13, color: "#64748b" }}>Carregando…</p>
        </div>
      </div>
    );
  }

  if (erro) {
    return (
      <div className="login-wrap">
        <div className="login-card">
          <h1 style={{ fontSize: 18 }}>Não consegui carregar</h1>
          <div className="alert-box alert-red">{erro}</div>
          <button className="btn btn-primary" onClick={() => window.location.reload()}>Tentar novamente</button>
        </div>
      </div>
    );
  }

  if (!session) {
    return <Routes><Route path="*" element={<Login onLogin={setSession} />} /></Routes>;
  }

  // paciente vê o próprio painel (com os módulos que ele tem)
  if (session.role !== "admin") {
    return (
      <Routes>
        <Route path="/portal" element={<Portal session={session} onLogout={() => setSession(null)} />} />
        <Route path="*" element={<Navigate to="/portal" replace />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route path="/modulos" element={<Seletor session={session} onLogout={() => setSession(null)} />} />
      <Route path="/clientes" element={<Clientes />} />
      <Route path="/clientes/:id" element={<PacienteFicha />} />
      <Route path="/clientes/:id/laudo" element={<Laudos />} />
      <Route path="/pacientes" element={<Pacientes />} />
      <Route path="/pacientes/novo" element={<NovoCliente />} />
      <Route path="/pacientes/:id" element={<PacienteFicha />} />
      <Route path="/360/*" element={
        <Shell session={session} onLogout={() => setSession(null)}>
          <Routes>
            <Route path="painel" element={<Dashboard />} />
            <Route path="pacientes" element={<Pacientes />} />
            <Route path="pacientes/:id" element={<PatientDetail />} />
            <Route path="treinos" element={<TrainingLogs />} />
            <Route path="questionarios" element={<Questionnaires />} />
            <Route path="maturacao" element={<Maturacao />} />
            <Route path="novo-cliente" element={<NovoCliente />} />
            <Route path="*" element={<Navigate to="painel" replace />} />
          </Routes>
        </Shell>
      } />
      <Route path="/orthoflow/*" element={
        <Shell session={session} onLogout={() => setSession(null)}>
          <Routes>
            <Route index element={<OrthoFlow />} />
            <Route path="paciente/:id" element={<OrthoFlow detalhe />} />
            <Route path="prom/:patientId/:instrumento" element={<PROMForm />} />
            <Route path="novo-cliente" element={<NovoCliente />} />
            <Route path="*" element={<Navigate to="/orthoflow" replace />} />
          </Routes>
        </Shell>
      } />
      <Route path="*" element={<Navigate to="/modulos" replace />} />
    </Routes>
  );
}
