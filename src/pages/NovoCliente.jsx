import React from "react";
import { useNavigate } from "react-router-dom";
import { Patients, criarAcessoPaciente, gerarSenha } from "../lib/data";
import { Card, CardTitle, Button, Field, Badge } from "../components/ui";

const hoje = () => new Date().toISOString().slice(0, 10);

const VAZIO = {
  name: "", email: "", senha: "", dob: "", gender: "Feminino",
  diagnosis: "", diagnosis_detail: "", whatsapp: "",
  protocol_start: hoje(), modules: { orthoflow: true, atleta360: false, maturacao: false },
  sport: "", team: "",
};

/**
 * Novo cliente — a única porta de entrada de paciente no app.
 * Cria a ficha E o acesso (login + senha) num passo só, e mostra as
 * credenciais para o médico enviar. Não existe cadastro público.
 */
export default function NovoCliente() {
  const navigate = useNavigate();
  const [f, setF] = React.useState(VAZIO);
  const [erro, setErro] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [criado, setCriado] = React.useState(null);
  const [copiado, setCopiado] = React.useState(false);

  React.useEffect(() => { setF((x) => ({ ...x, senha: gerarSenha() })); }, []);

  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const setMod = (k) => (e) =>
    setF((x) => ({ ...x, modules: { ...x.modules, [k]: e.target.checked } }));

  const salvar = async () => {
    setErro("");
    if (!f.name.trim()) return setErro("O nome do cliente é obrigatório.");
    if (!f.email.trim()) return setErro("O e-mail é o login dele — é obrigatório.");
    if (!f.senha || f.senha.length < 6) return setErro("A senha precisa ter ao menos 6 caracteres.");
    const mods = Object.entries(f.modules).filter(([, v]) => v).map(([k]) => k);
    if (!mods.length) return setErro("Escolha pelo menos um módulo.");

    setBusy(true);
    try {
      const p = await Patients.create({
        name: f.name.trim(),
        email: f.email.trim().toLowerCase(),
        dob: f.dob || null,
        gender: f.gender,
        diagnosis: f.diagnosis,
        diagnosis_detail: f.diagnosis_detail,
        whatsapp: f.whatsapp,
        protocol_start: f.protocol_start || null,
        sport: f.sport,
        team: f.team,
        status: "ativo",
        modules: mods,
      });
      const r = await criarAcessoPaciente(p.id, { email: f.email.trim().toLowerCase(), senha: f.senha });
      if (r.error) {
        setErro(`Ficha criada (${p.patient_id}), mas o acesso falhou: ${r.error}. Use o botão "Criar acesso" na lista para tentar de novo.`);
        setBusy(false);
        return;
      }
      setCriado({ ...r, code: p.code || p.patient_id || "(sem código)", nome: f.name.trim(), mods });
    } catch (e) {
      setErro(e.message);
    }
    setBusy(false);
  };

  const copiar = async () => {
    const modTxt = criado.mods.map((m) => ({orthoflow:"OrthoFlow", atleta360:"Atleta 360", maturacao:"Maturação"}[m] || m)).join(" + ");
    const site = window.location.origin + window.location.pathname;
    const txt = `Dr. Hélio — acesso ao seu acompanhamento\n\nSite: ${site}\nAba: Paciente\nE-mail: ${criado.email}\nSenha: ${criado.senha}\n\nSeu módulo: ${modTxt}\n\nNo primeiro acesso, troque a senha em Perfil.`;
    try { await navigator.clipboard.writeText(txt); setCopiado(true); } catch { setCopiado(false); }
  };

  const novo = () => { setCriado(null); setF({ ...VAZIO, senha: gerarSenha() }); setCopiado(false); };

  if (criado) {
    return (
      <>
        <div className="topbar">
          <div>
            <h1>Cliente criado</h1>
            <p>Envie as credenciais abaixo para {criado.nome}</p>
          </div>
        </div>
        <div className="content">
          <Card>
            <CardTitle sub={`Ficha ${criado.code} · módulo ${criado.mods.map((m) => ({orthoflow:"OrthoFlow", atleta360:"Atleta 360", maturacao:"Maturação"}[m] || m)).join(" + ")}`}>
              Credenciais de acesso
            </CardTitle>
            <div style={{ background: "#0b2136", color: "#e2e8f0", borderRadius: 12, padding: 16, fontFamily: "ui-monospace,monospace", fontSize: 13.5, lineHeight: 1.8 }}>
              <div style={{ color: "#8ba3ba", fontSize: 10.5, fontFamily: "system-ui", letterSpacing: .5 }}>SITE</div>
              <div style={{ wordBreak: "break-all" }}>{window.location.origin + window.location.pathname}</div>
              <div style={{ color: "#8ba3ba", fontSize: 10.5, fontFamily: "system-ui", marginTop: 10, letterSpacing: .5 }}>E-MAIL (login)</div>
              <div>{criado.email}</div>
              <div style={{ color: "#8ba3ba", fontSize: 10.5, fontFamily: "system-ui", marginTop: 10, letterSpacing: .5 }}>SENHA</div>
              <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: 2.5, color: "#22d3ee" }}>{criado.senha}</div>
            </div>
            <div className="alert-box alert-green" style={{ marginTop: 12 }}>
              Esta senha aparece <b>só agora</b>. Se perder, use "Criar acesso" na lista de clientes ou redefina.
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
              <Button variant="primary" onClick={copiar}>{copiado ? "Texto copiado ✓" : "Copiar mensagem para enviar"}</Button>
              <Button variant="outline" onClick={novo}>Criar outro paciente</Button>
              <Button variant="outline" onClick={() => navigate("/pacientes")}>
                Ver na lista
              </Button>
            </div>
          </Card>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="topbar">
        <div>
          <h1>Novo cliente</h1>
          <p>Cria a ficha e o acesso de uma vez — é a única porta de entrada</p>
        </div>
      </div>

      <div className="content">
        <Card>
          <CardTitle sub="Dados de identificação">Quem é o cliente</CardTitle>
          <div className="form-grid">
            <div className="span-2">
              <Field label="Nome completo *">
                <input value={f.name} onChange={set("name")} placeholder="Ex.: Maria Aparecida Souza" />
              </Field>
            </div>
            <Field label="E-mail (será o login) *">
              <input type="email" value={f.email} onChange={set("email")} placeholder="email@exemplo.com" />
            </Field>
            <Field label="WhatsApp">
              <input value={f.whatsapp} onChange={set("whatsapp")} placeholder="43999998888" />
            </Field>
            <Field label="Data de nascimento">
              <input type="date" value={f.dob} onChange={set("dob")} />
            </Field>
            <Field label="Sexo">
              <select value={f.gender} onChange={set("gender")}>
                <option>Feminino</option>
                <option>Masculino</option>
                <option>Outro</option>
              </select>
            </Field>
          </div>
        </Card>

        <Card>
          <CardTitle sub="Isso define o que ele vê ao entrar">Módulos e diagnóstico</CardTitle>
          <div style={{ display: "flex", gap: 18, flexWrap: "wrap", marginBottom: 14 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13.5, cursor: "pointer" }}>
              <input type="checkbox" style={{ width: 17, height: 17 }} checked={f.modules.orthoflow} onChange={setMod("orthoflow")} />
              <span><b>OrthoFlow</b> — questionários e reabilitação</span>
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13.5, cursor: "pointer" }}>
              <input type="checkbox" style={{ width: 17, height: 17 }} checked={f.modules.atleta360} onChange={setMod("atleta360")} />
              <span><b>Atleta 360</b> — carga de treino, VFC e saúde do atleta</span>
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13.5, cursor: "pointer" }}>
              <input type="checkbox" style={{ width: 17, height: 17 }} checked={f.modules.maturacao} onChange={setMod("maturacao")} />
              <span><b>Maturação</b> — predição de estatura e bio-banding</span>
            </label>
          </div>
          <div className="form-grid">
            <Field label="Diagnóstico">
              <input value={f.diagnosis} onChange={set("diagnosis")} placeholder="Ex.: Osteoartrite de Joelho" />
            </Field>
            <Field label="Detalhe / lateralidade">
              <input value={f.diagnosis_detail} onChange={set("diagnosis_detail")} placeholder="Ex.: lado direito, grau II" />
            </Field>
            <Field label="Início do protocolo">
              <input type="date" value={f.protocol_start} onChange={set("protocol_start")} />
            </Field>
            {f.modules.atleta360 && (
              <>
                <Field label="Esporte"><input value={f.sport} onChange={set("sport")} placeholder="Ex.: Tênis" /></Field>
                <Field label="Equipe"><input value={f.team} onChange={set("team")} placeholder="Opcional" /></Field>
              </>
            )}
          </div>
        </Card>

        <Card>
          <CardTitle sub="Ele entra com este e-mail e esta senha">Acesso</CardTitle>
          <Field label="Senha inicial" hint="Gerada sem letras ambíguas (sem 0/O, 1/l) para ditar por telefone ou WhatsApp.">
            <div style={{ display: "flex", gap: 7 }}>
              <input value={f.senha} onChange={set("senha")}
                style={{ fontFamily: "ui-monospace,monospace", letterSpacing: 1.5, fontSize: 15 }} />
              <Button variant="outline" size="sm" onClick={() => setF((x) => ({ ...x, senha: gerarSenha() }))}>↻</Button>
            </div>
          </Field>
          {erro && <div className="alert-box alert-red" style={{ marginTop: 10 }}>{erro}</div>}
          <Button variant="primary" onClick={salvar} disabled={busy} style={{ marginTop: 8, padding: "11px 20px" }}>
            {busy ? "Criando ficha e acesso…" : "Criar cliente e acesso"}
          </Button>
        </Card>
      </div>
    </>
  );
}
