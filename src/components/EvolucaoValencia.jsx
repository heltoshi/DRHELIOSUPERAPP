import React from "react";

/**
 * Gráficos de evolução por VALÊNCIA (domínio) de cada PROM.
 * Além da linha do escore total, cada domínio ganha seu próprio gráfico —
 * é o que mostra, por exemplo, que a dor do KOOS melhorou antes do esporte.
 */

const CORES = ["#0e7490", "#dc2626", "#2563eb", "#7c3aed", "#059669", "#d97706", "#0891b2", "#be185d"];
export const NOMES = {
  sintomas: "Sintomas", dor: "Dor", avd: "Atividades da vida diária",
  esporte: "Esporte e lazer", qualidade_vida: "Qualidade de vida",
  funcao: "Função", rigidez: "Rigidez", fisico: "Físico",
  trabalho: "Trabalho", estilo_vida: "Estilo de vida", emocional: "Emocional",
  incapacidade: "Incapacidade", rigidez_matinal: "Rigidez matinal",
};
const nome = (k) => NOMES[k] || k.replace(/_/g, " ");

const f1 = (v) => (v == null || !Number.isFinite(Number(v)) ? "—" : Number(v).toFixed(1).replace(".", ","));
const dt = (s) => `${String(s).slice(8, 10)}/${String(s).slice(5, 7)}`;

/**
 * Um gráfico de linha para UMA valência.
 * Mostra min/max, primeiro e último valor, delta e a direção desejada.
 */
export function GraficoValencia({ titulo, valores, datas, maiorMelhor = true, cor = "#0e7490", h = 92, max = 100 }) {
  const pts = valores.map((v, i) => ({ v: Number(v), d: datas[i] })).filter((p) => Number.isFinite(p.v));
  if (pts.length < 2) {
    return (
      <div className="val-card">
        <p className="val-titulo">{titulo}</p>
        <p className="val-vazio">Precisa de ao menos 2 coletas</p>
      </div>
    );
  }
  const W = 300, H = h, L = 24, R = 8, T = 10, B = 16;
  const iw = W - L - R, ih = H - T - B;
  const vmin = Math.min(...pts.map((p) => p.v));
  const vmax = Math.max(...pts.map((p) => p.v));
  // eixo fixo: num domínio normalizado 0-100, ampliar a faixa distorce a leitura
  // (uma dor que foi de 70 a 80 parecia uma queda brutal). Só usa escala
  // dinâmica quando o instrumento não é 0-100.
  const fixo = max === 100;
  const lo = fixo ? 0 : Math.max(0, vmin - (vmax - vmin || 1) * 0.25);
  const hi = fixo ? 100 : Math.min(100, vmax + (vmax - vmin || 1) * 0.25);
  const x = (i) => L + (pts.length <= 1 ? iw / 2 : (i / (pts.length - 1)) * iw);
  const y = (v) => T + ih - ((v - lo) / (hi - lo || 1)) * ih;

  const d = pts.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.v).toFixed(1)}`).join(" ");
  const area = `${d} L${x(pts.length - 1)},${T + ih} L${L},${T + ih} Z`;
  const pri = pts[0].v, ult = pts[pts.length - 1].v;
  const delta = ult - pri;
  const melhorou = maiorMelhor ? delta >= 0 : delta <= 0;
  const id = `gv${titulo.replace(/\W/g, "")}${pts.length}`;

  return (
    <div className="val-card">
      <div className="val-head">
        <p className="val-titulo">{titulo}</p>
        <span className={`val-delta ${delta === 0 ? "zero" : melhorou ? "bom" : "ruim"}`}>
          {delta > 0 ? "+" : ""}{f1(delta)}
        </span>
      </div>
      <div className="val-num">
        <b style={{ color: cor }}>{f1(ult)}</b>
        <span>de {maiorMelhor ? "100" : "máx"} · início {f1(pri)}</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: "block" }}>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={cor} stopOpacity="0.22" />
            <stop offset="100%" stopColor={cor} stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 0.25, 0.5, 0.75, 1].map((g) => (
          <line key={g} x1={L} x2={W - R} y1={T + ih * g} y2={T + ih * g}
            stroke={g === 0 || g === 1 ? "#e2e8f0" : "#f1f5f9"} strokeWidth="1" />
        ))}
        <path d={area} fill={`url(#${id})`} />
        <path d={d} fill="none" stroke={cor} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {pts.map((p, i) => (
          <circle key={i} cx={x(i)} cy={y(p.v)} r={i === pts.length - 1 ? 3.4 : 2.3}
            fill={i === pts.length - 1 ? cor : "#fff"} stroke={cor} strokeWidth="1.6" />
        ))}
        <text x={L - 4} y={T + 4} fontSize="7" fill="#b6c2d1" textAnchor="end">{Math.round(hi)}</text>
        <text x={L - 4} y={T + ih + 2} fontSize="7" fill="#b6c2d1" textAnchor="end">{Math.round(lo)}</text>
        <text x={L} y={H - 2} fontSize="6.5" fill="#b6c2d1">{dt(pts[0].d)}</text>
        <text x={W - R} y={H - 2} fontSize="6.5" fill="#b6c2d1" textAnchor="end">{dt(pts[pts.length - 1].d)}</text>
      </svg>
    </div>
  );
}

/**
 * Todos os gráficos de um instrumento: o total e cada valência.
 * `coletas` deve vir em ordem cronológica asc.
 */
export function EvolucaoPorValencia({ instrumento, coletas }) {
  const serie = [...coletas].sort((a, b) => String(a.submitted_at).localeCompare(String(b.submitted_at)));
  const datas = serie.map((c) => c.submitted_at);

  const dominios = React.useMemo(() => {
    const out = {};
    for (const c of serie) {
      const subs = c.subscale_scores || {};
      for (const k of Object.keys(subs)) {
        (out[k] ||= []);
        out[k].push(Number(subs[k]));
      }
    }
    return out;
  }, [serie.map((c) => c.id).join()]);

  const temDom = Object.keys(dominios).length > 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <GraficoValencia
        titulo={`${instrumento?.short || "Total"} — escore total`}
        valores={serie.map((c) => c.total_score)}
        datas={datas}
        maiorMelhor={instrumento?.higherIsBetter !== false}
        cor="#0b2545"
        h={104}
        max={Number(instrumento?.scaleMax) > 10 ? Number(instrumento.scaleMax) : 100}
      />

      {temDom && (
        <>
          <div className="val-sep">
            <span>Por valência</span>
            <small>cada domínio tem sua própria curva</small>
          </div>
          <div className="val-grid">
            {Object.entries(dominios).map(([k, vals], i) => (
              <GraficoValencia
                key={k} titulo={nome(k)} valores={vals} datas={datas}
                maiorMelhor cor={CORES[i % CORES.length]}
              />
            ))}
          </div>
        </>
      )}

      {!temDom && (
        <p className="res-nota">
          Este instrumento devolve um escore único — não tem subescalas para separar.
        </p>
      )}

      {/* tabela comparativa domínio × coleta */}
      {temDom && serie.length > 1 && (
        <div className="hist-scroll">
          <table className="table">
            <thead>
              <tr>
                <th>Valência</th>
                {serie.map((c) => <th key={c.id} className="num">{dt(c.submitted_at)}</th>)}
                <th className="num">Total Δ</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(dominios).map(([k, vals], i) => {
                const d = vals[vals.length - 1] - vals[0];
                return (
                  <tr key={k}>
                    <td style={{ fontWeight: 600 }}>
                      <span className="dot" style={{ background: CORES[i % CORES.length] }} />
                      {nome(k)}
                    </td>
                    {vals.map((v, j) => <td key={j} className="num">{f1(v)}</td>)}
                    <td className="num" style={{ fontWeight: 700, color: d >= 0 ? "#059669" : "#dc2626" }}>
                      {d > 0 ? "+" : ""}{f1(d)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}


/**
 * EVOLUÇÃO ITEM A ITEM — cada pergunta de cada PROM, com sua própria curva.
 * O escore do domínio é uma média; aqui dá para ver QUAL item específico
 * não está melhorando (por exemplo, só o item de dor ao subir escadas).
 */
export function EvolucaoItens({ instrumento, coletas, itens }) {
  const [aberto, setAberto] = React.useState(null);
  const [filtro, setFiltro] = React.useState("todos");

  const serie = React.useMemo(
    () => [...coletas].sort((a, b) => String(a.submitted_at).localeCompare(String(b.submitted_at))),
    [coletas],
  );

  // valores normalizados 0-100 por item (o score bruto da opção varia por item)
  const porItem = React.useMemo(() => {
    const out = {};
    for (const it of itens) {
      const opts = it.options || [];
      const scores = opts.map((o) => Number(o.score ?? 0));
      const pior = Math.max(...scores, 1);
      const melhor = Math.min(...scores, 0);
      const vals = serie.map((c) => {
        const v = (c.answers || {})[it.id];
        if (v == null || v === "") return null;
        const idx = Number(v);
        const sc = Number(opts[idx]?.score ?? idx);
        // normaliza para 0-100 onde 100 = melhor estado possível do item
        const base = pior - melhor || 1;
        const pct = ((sc - melhor) / base) * 100;
        return instrumento?.higherIsBetter === false ? 100 - pct : pct;
      });
      const validos = vals.filter((x) => x != null);
      if (validos.length < 2) continue;
      const d = validos[validos.length - 1] - validos[0];
      out[it.id] = { item: it, vals, delta: d, atual: validos[validos.length - 1], inicial: validos[0] };
    }
    return out;
  }, [serie.map((c) => c.id).join(), instrumento?.id]);

  const chaves = Object.keys(porItem);
  const lista = filtro === "pior"
    ? [...chaves].sort((a, b) => porItem[a].atual - porItem[b].atual)
    : filtro === "melhor"
      ? [...chaves].sort((a, b) => porItem[b].delta - porItem[a].delta)
      : chaves;

  if (!chaves.length) {
    return <p className="res-nota">Sem itens com duas ou mais respostas para comparar.</p>;
  }

  const melhoraram = chaves.filter((k) => porItem[k].delta > 5).length;
  const estagnados = chaves.filter((k) => Math.abs(porItem[k].delta) <= 5).length;
  const pioraram = chaves.filter((k) => porItem[k].delta < -5).length;

  return (
    <>
      <div className="item-resumo">
        <div className="ir-item"><b>{chaves.length}</b><span>itens acompanhados</span></div>
        <div className="ir-item bom"><b>{melhoraram}</b><span>melhoraram</span></div>
        <div className="ir-item est"><b>{estagnados}</b><span>estáveis</span></div>
        <div className="ir-item ruim"><b>{pioraram}</b><span>pioraram</span></div>
      </div>

      <div className="seg" style={{ marginTop: 4 }}>
        <button className={filtro === "todos" ? "on" : ""} onClick={() => setFiltro("todos")}>Todos</button>
        <button className={filtro === "melhor" ? "on" : ""} onClick={() => setFiltro("melhor")}>Mais melhora</button>
        <button className={filtro === "pior" ? "on" : ""} onClick={() => setFiltro("pior")}>Mais baixo hoje</button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
        {lista.map((k, i) => {
          const d = porItem[k];
          const abertoAqui = aberto === k;
          const cor = d.delta > 5 ? "#059669" : d.delta < -5 ? "#dc2626" : "#94a3b8";
          return (
            <div key={k} className={`item-card${abertoAqui ? " aberto" : ""}`}>
              <button className="item-head" onClick={() => setAberto(abertoAqui ? null : k)}>
                <span className="item-n">{String(i + 1).padStart(2, "0")}</span>
                <span className="item-txt">{d.item.label || d.item.text}</span>
                <span className="item-val" style={{ color: cor }}>
                  {f1(d.atual)}<em>{d.delta > 0 ? "▲" : d.delta < 0 ? "▼" : "="}{Math.abs(d.delta) > 0.5 ? f1(Math.abs(d.delta)) : ""}</em>
                </span>
              </button>
              <div className="item-spark">
                <SparkVals vals={d.vals} cor={cor} />
              </div>
              {abertoAqui && (
                <div className="item-det">
                  <GraficoValencia
                    titulo={d.item.label || d.item.text}
                    valores={d.vals}
                    datas={serie.map((c) => c.submitted_at)}
                    maiorMelhor
                    cor={cor}
                    h={86}
                  />
                  <p className="res-nota">
                    Normalizado de 0 (pior resposta possível) a 100 (melhor). Valores em % para
                    comparar itens com escalas diferentes. Início {f1(d.inicial)} → hoje {f1(d.atual)}.
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}

/** minigráfico de linha compacto para a lista de itens. */
function SparkVals({ vals, cor }) {
  const pts = vals.map((v, i) => ({ v, i })).filter((p) => p.v != null);
  if (pts.length < 2) return null;
  const W = 88, H = 26;
  const x = (i) => (pts.length <= 1 ? W / 2 : (i / (pts.length - 1)) * W);
  const y = (v) => H - 2 - (Math.max(0, Math.min(100, v)) / 100) * (H - 4);
  const d = pts.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.v).toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} style={{ display: "block" }}>
      <path d={d} fill="none" stroke={cor} strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={x(pts.length - 1)} cy={y(pts[pts.length - 1].v)} r="2.2" fill={cor} />
    </svg>
  );
}
