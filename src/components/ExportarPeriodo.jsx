import React from "react";
import { montarProntuario, baixarJson, nomeArquivo } from "../lib/prontuario";
import { Modal, Button, Field } from "./ui";

const hojeISO = () => {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};
const menosDias = (dias) => {
  const d = new Date();
  d.setDate(d.getDate() - dias);
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};
const br = (iso) => (iso ? `${String(iso).slice(8, 10)}/${String(iso).slice(5, 7)}/${String(iso).slice(0, 4)}` : "—");

const OPCOES = [
  { id: "7", rotulo: "1 semana", dias: 7 },
  { id: "14", rotulo: "2 semanas", dias: 14 },
  { id: "21", rotulo: "3 semanas", dias: 21 },
  { id: "28", rotulo: "4 semanas", dias: 28 },
  { id: "custom", rotulo: "Escolher período", dias: null },
  { id: "tudo", rotulo: "Tudo", dias: null },
];

/**
 * EXPORTAÇÃO POR PERÍODO
 * Escolhe a janela, mostra o que vai sair e baixa o JSON do prontuário
 * recortado — o formato serve para montar laudo interpretativo.
 */
export default function ExportarPeriodo({ paciente, onClose }) {
  const [opcao, setOpcao] = React.useState("28");
  const [de, setDe] = React.useState(menosDias(28));
  const [ate, setAte] = React.useState(hojeISO());
  const [prev, setPrev] = React.useState(null);
  const [ocupado, setOcupado] = React.useState(false);
  const [err, setErr] = React.useState("");
  const [baixado, setBaixado] = React.useState(null);

  const janela = React.useMemo(() => {
    if (opcao === "tudo") return { de: null, ate: null };
    if (opcao === "custom") return { de, ate };
    const o = OPCOES.find((x) => x.id === opcao);
    return { de: menosDias(o.dias), ate: hojeISO() };
  }, [opcao, de, ate]);

  // prévia: quantos registros caem na janela
  React.useEffect(() => {
    let vivo = true;
    setOcupado(true); setErr("");
    montarProntuario(paciente.id, janela)
      .then((pr) => {
        if (!vivo) return;
        setPrev({
          treinos: pr.atleta360.carga.sessoes,
          vfc: pr.atleta360.vfc.n || 0,
          promColetas: pr.orthoflow.coletas_brutas.length,
          instrumentos: Object.keys(pr.orthoflow.instrumentos).length,
          maturacao: pr.maturacao?.avaliacoes || 0,
          inventario: pr.inventario_completo,
        });
      })
      .catch((e) => vivo && setErr(e.message))
      .finally(() => vivo && setOcupado(false));
    return () => { vivo = false; };
  }, [paciente.id, janela.de, janela.ate]);

  const exportar = async () => {
    setErr(""); setOcupado(true);
    try {
      const pr = await montarProntuario(paciente.id, janela);
      const sufixo = janela.de ? `_${janela.de}_a_${janela.ate}` : "_completo";
      const nome = `${nomeArquivo(pr.paciente)}${sufixo}`;
      baixarJson(pr, nome);
      setBaixado(nome);
    } catch (e) { setErr(e.message); }
    setOcupado(false);
  };

  const vazio = prev && prev.treinos === 0 && prev.promColetas === 0 && prev.maturacao === 0 && prev.vfc === 0;

  return (
    <Modal open onClose={onClose} title={`Exportar dados — ${paciente.name}`}
      footer={<Button variant="outline" onClick={onClose}>Fechar</Button>}>

      <p style={{ fontSize: 12, color: "#64748b", background: "#f8fafc", padding: "9px 11px", borderRadius: 9, marginTop: 0 }}>
        Escolha o período. O arquivo leva treinos, VFC, todas as respostas de questionário
        e as avaliações de maturação dentro da janela — é o insumo para o laudo interpretativo.
      </p>

      <p style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: ".06em", textTransform: "uppercase", color: "#0e7490", margin: "10px 0 7px" }}>
        Período
      </p>
      <div className="per-opcoes">
        {OPCOES.map((o) => (
          <button key={o.id} className={`per-op${opcao === o.id ? " on" : ""}`} onClick={() => setOpcao(o.id)}>
            {o.rotulo}
          </button>
        ))}
      </div>

      {opcao === "custom" && (
        <div className="form-grid" style={{ marginTop: 10 }}>
          <Field label="De"><input type="date" value={de} max={ate} onChange={(e) => setDe(e.target.value)} /></Field>
          <Field label="Até"><input type="date" value={ate} min={de} onChange={(e) => setAte(e.target.value)} /></Field>
        </div>
      )}

      <div className="per-janela">
        {janela.de ? <>janela de <b>{br(janela.de)}</b> a <b>{br(janela.ate)}</b></> : <>todo o histórico</>}
      </div>

      {err && <div className="alert-box alert-red">{err}</div>}

      {ocupado && !prev && <p style={{ fontSize: 12, color: "#94a3b8" }}>Contando registros…</p>}

      {prev && (
        <>
          <div className="per-previa">
            <div><b>{prev.treinos}</b><span>treinos</span></div>
            <div><b>{prev.vfc}</b><span>VFC</span></div>
            <div><b>{prev.promColetas}</b><span>coletas PROM</span></div>
            <div><b>{prev.maturacao}</b><span>maturação</span></div>
          </div>
          {vazio ? (
            <div className="alert-box alert-amber">
              Nenhum registro neste período. Escolha uma janela maior.
            </div>
          ) : (
            <p style={{ fontSize: 10.5, color: "#94a3b8", lineHeight: 1.5, margin: "8px 0 0" }}>
              {prev.instrumentos} instrumentos com resultado no recorte.
              No histórico completo existem {prev.inventario.treinos} treinos,
              {" "}{prev.inventario.coletas_prom} coletas e {prev.inventario.avaliacoes_maturacao} avaliações.
            </p>
          )}
        </>
      )}

      {baixado && (
        <div className="alert-box alert-green" style={{ marginTop: 10 }}>
          ✓ Exportado: <b>{baixado}.json</b> — envie o arquivo para a análise.
        </div>
      )}

      <Button variant="primary" onClick={exportar} disabled={ocupado || vazio}
        style={{ width: "100%", marginTop: 12, padding: 12 }}>
        {ocupado ? "Gerando…" : "⬇ Exportar JSON do período"}
      </Button>
    </Modal>
  );
}
