import React from "react";
import { useNavigate } from "react-router-dom";
import { state, logout } from "../lib/data";

const MODULOS = [
  {
    id: "clientes",
    nome: "Clientes",
    rota: "/clientes",
    ico: "◉",
    cor: "#0b2545",
    desc: "Cadastro único, módulos e senhas",
    detalhe: "Criar, editar e apagar clientes; liberar módulos; criar e trocar senhas de acesso",
  },
  {
    id: "atleta360",
    nome: "Atleta 360",
    rota: "/360/painel",
    ico: "◉",
    cor: "#0e7490",
    desc: "Carga de treino, ACWR, VFC e saúde do atleta",
    detalhe: "PSE × duração, ACWR, monitoramento de VFC, OSTRC-BR, EDAJ e EISDF",
  },
  {
    id: "orthoflow",
    nome: "OrthoFlow",
    rota: "/orthoflow",
    ico: "◈",
    cor: "#7c3aed",
    desc: "PROMs e acompanhamento de reabilitação",
    detalhe: "17 instrumentos validados, protocolo de 12 semanas, evolução por escore",
  },
  {
    id: "maturacao",
    nome: "Maturação",
    rota: "/360/maturacao",
    ico: "◑",
    cor: "#059669",
    desc: "Predição de estatura e bio-banding",
    detalhe: "Khamis-Roche, Mirwald, Moore, Bayley-Pinneau e consenso",
  },
];

export default function Seletor({ session, onLogout }) {
  const navigate = useNavigate();
  const db = state();
  const contar = (id) => db.patients.filter((p) => p.modules.includes(id)).length;

  return (
    <div className="seletor-wrap">
      <header className="seletor-head">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div className="brand-mark" style={{ width: 44, height: 44 }}>DH</div>
          <div>
            <h1 style={{ fontSize: 20, color: "#fff" }}>Dr. Hélio</h1>
            <p style={{ fontSize: 12.5, color: "#9fb4c9" }}>{session.email}</p>
          </div>
        </div>
        <button className="btn btn-sm btn-outline" onClick={async () => { await logout(); if (onLogout) onLogout(); navigate("/", { replace: true }); }}>
          Sair
        </button>
      </header>

      <div className="seletor-body">
        <p className="seletor-titulo">Escolha o módulo</p>
        <div className="seletor-grid">
          {MODULOS.map((m) => (
            <button key={m.id} className="modulo-card" onClick={() => navigate(m.rota)}>
              <span className="mc-ico" style={{ background: m.cor + "18", color: m.cor }}>{m.ico}</span>
              <span className="mc-nome">{m.nome}</span>
              <span className="mc-desc">{m.desc}</span>
              <span className="mc-det">{m.detalhe}</span>
              <span className="mc-foot">
                <b>{contar(m.id)}</b> {contar(m.id) === 1 ? "paciente" : "pacientes"}
                <span className="mc-arrow">→</span>
              </span>
            </button>
          ))}
        </div>
        <p className="seletor-nota">
          Uma ficha por paciente. Os módulos leem e gravam na mesma ficha — o que o atleta registra de treino
          e o que ele responde de PROM ficam juntos no histórico dele.
        </p>
      </div>
    </div>
  );
}
