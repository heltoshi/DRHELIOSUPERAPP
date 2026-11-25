import React from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Patients, PROMs, subscribe } from "../lib/data";
import { byId } from "../lib/instrumentos";
import { montarProntuario, baixarJson, nomeArquivo } from "../lib/prontuario";
import { Card, Button, Empty } from "../components/ui";
import Relatorio from "../components/Relatorio";

const f1 = (v) => (v == null || !Number.isFinite(Number(v)) ? "—" : Number(v).toFixed(1).replace(".", ","));

/**
 * CRIADOR DE LAUDOS
 * Monta o prontuário do paciente (dados completos), permite escolher o que
 * entra no laudo e gera: laudo pronto para imprimir/PDF + exportação JSON
 * do prontuário inteiro (para análise posterior, backup ou segundo parecer).
 */
export default function Laudos() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [, force] = React.useState(0);
  React.useEffect(() => subscribe(() => force((n) => n + 1)), []);

  const paciente = id ? Patients.get(id) : null;
  const [pront, setPront] = React.useState(null);
  const [erro, setErro] = React.useState("");
  const [carregando, setCarregando] = React.useState(true);
  const [modo, setModo] = React.useState("escolher"); // escolher | laudo
  const [secoes, setSecoes] = React.useState({
    identificacao: true, carga: true, proms: true, maturacao: true, itens: false,
  });

  React.useEffect(() => {
    if (!paciente) { setCarregando(false); return; }
    setCarregando(true);
    montarProntuario(paciente.id)
      .then(setPront)
      .catch((e) => setErro(e.message))
      .finally(() => setCarregando(false));
  }, [paciente?.id, id]);

  if (!paciente) {
    return (
      <div className="content">
        <Card><Empty title="Paciente não encontrado" hint="Abra o laudo a partir da ficha do cliente." /></Card>
      </div>
    );
  }

  const instrs = pront?.orthoflow?.instrumentos || {};
  const comDados = Object.keys(instrs);
  const nColetas = pront?.orthoflow?.coletas_brutas?.length || 0;
  const veioMat = !!pront?.maturacao;

  if (modo === "laudo") {
    return (
      <div className="content">
        <div className="no-print" style={{ display: "flex", justifyContent: "space-between", marginBottom: 12, gap: 8, flexWrap: "wrap" }}>
          <button className="link-back" onClick={() => setModo("escolher")}>← configurações do laudo</button>
          <Button variant="teal" onClick={() => window.print()}>⎙ Imprimir / salvar PDF</Button>
        </div>
        <Relatorio
          paciente={paciente}
          coletas={PROMs.list(paciente.id)}
          visitas={pront?.maturacao?.historico || []}
          logs={pront?.atleta360?.treinos || []}
          hrv={[]}
          onVoltar={() => setModo("escolher")}
          prontuario={pront}
          secoes={secoes}
        />
      </div>
    );
  }

  return (
    <div className="content">
      <button className="link-back" onClick={() => navigate(`/clientes/${paciente.id}`)}>← voltar à ficha</button>
      <div className="topbar" style={{ marginBottom: 10 }}>
        <div>
          <h1 style={{ fontSize: 21 }}>Criador de laudos</h1>
          <p>{paciente.name} · {paciente.code}</p>
        </div>
      </div>

      {carregando && <Card><p style={{ fontSize: 13, color: "#64748b" }}>Montando o prontuário…</p></Card>}
      {erro && <Card><div className="alert-box alert-red">{erro}</div></Card>}

      {pront && (
        <>
          <Card>
            <p className="sec-title">O que existe neste prontuário</p>
            <div className="laudo-grid">
              <div className="lg-item">
                <b>{pront.atleta360.carga.sessoes}</b>
                <span>treinos registrados</span>
                <small>{pront.atleta360.carga.primeira || "—"} a {pront.atleta360.carga.ultima || "—"}</small>
              </div>
              <div className="lg-item">
                <b>{pront.atleta360.vfc.n || 0}</b>
                <span>medições de VFC</span>
                <small>média {f1(pront.atleta360.vfc.media)} ms</small>
              </div>
              <div className="lg-item">
                <b>{nColetas}</b>
                <span>coletas de PROM</span>
                <small>{comDados.length} instrumentos</small>
              </div>
              <div className="lg-item">
                <b>{veioMat ? pront.maturacao.avaliacoes : 0}</b>
                <span>avaliações de maturação</span>
                <small>{veioMat ? `${f1(pront.maturacao.atual.estatura)} cm · prev. ${f1(pront.maturacao.atual.consenso_pah)} cm` : "sem avaliação"}</small>
              </div>
            </div>
          </Card>

          <Card>
            <p className="sec-title">Seções do laudo</p>
            {[
              ["identificacao", "Identificação e diagnóstico", "Nome, idade, diagnóstico, protocolo"],
              ["carga", "Carga de treino", "Sessões, carga média, PSE, ACWR, sono"],
              ["proms", "Questionários de função", "Evolução por domínio de cada instrumento"],
              ["maturacao", "Maturação e crescimento", "Estatura prevista, PHV, bio-banding"],
              ["itens", "Detalhe item a item", "Cada pergunta do questionário (laudo longo)"],
            ].map(([k, titulo, desc]) => (
              <label key={k} className="secao-opt">
                <input type="checkbox" checked={secoes[k]} style={{ width: 17, height: 17, accentColor: "#0e7490" }}
                  onChange={(e) => setSecoes((s) => ({ ...s, [k]: e.target.checked }))} />
                <span>
                  <b>{titulo}</b>
                  <small>{desc}</small>
                </span>
              </label>
            ))}
          </Card>

          {comDados.length > 0 && (
            <Card>
              <p className="sec-title">Instrumentos com dados</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {comDados.map((k) => {
                  const i = instrs[k];
                  return (
                    <span key={k} className="chip-instr">
                      <b>{i.sigla}</b>
                      <span>{i.coletas}× · {f1(i.total?.ultimo)}</span>
                    </span>
                  );
                })}
              </div>
            </Card>
          )}

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Button variant="primary" onClick={() => setModo("laudo")} style={{ flex: 2, padding: 13 }}>
              Gerar laudo
            </Button>
            <Button variant="outline" onClick={() => baixarJson(pront, nomeArquivo(pront.paciente))} style={{ flex: 1, padding: 13 }}>
              ⬇ Exportar prontuário
            </Button>
          </div>
          <p style={{ fontSize: 10.5, color: "#94a3b8", lineHeight: 1.5, padding: "0 4px" }}>
            O JSON traz tudo: treinos, VFC, todas as coletas de PROM com as respostas item a item,
            domínios calculados e o histórico de maturação. Serve de backup e de insumo para
            análise — inclusive por IA.
          </p>
        </>
      )}
    </div>
  );
}
