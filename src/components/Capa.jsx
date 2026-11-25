import React from "react";

/**
 * Capa de entrada (login): marca Dr. Hélio + CEMEP Care.
 * As logos entram como <img> a partir de /img/, que o build copia para dist/.
 */
export function Capa() {
  return (
    <div className="capa">
      <div className="capa-arte">
        <div className="capa-linhas" aria-hidden="true">
          <svg viewBox="0 0 600 800" preserveAspectRatio="none">
            <defs>
              <linearGradient id="g1" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.55" />
                <stop offset="100%" stopColor="#0e7490" stopOpacity="0" />
              </linearGradient>
              <linearGradient id="g2" x1="1" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10b981" stopOpacity="0.45" />
                <stop offset="100%" stopColor="#065f46" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d="M-40 620 C 120 560, 200 700, 340 640 S 560 560, 660 620" stroke="url(#g1)" strokeWidth="2.5" fill="none" />
            <path d="M-40 680 C 140 620, 240 760, 400 690 S 600 620, 700 680" stroke="url(#g2)" strokeWidth="2" fill="none" />
            <path d="M-40 560 C 100 500, 240 640, 380 580 S 580 500, 660 560" stroke="url(#g1)" strokeWidth="1.2" fill="none" opacity="0.6" />
            {/* curva de carga — alusão ao ACWR */}
            <path d="M40 700 L 130 660 L 200 672 L 280 600 L 350 618 L 430 540 L 510 566 L 580 480"
              stroke="#22d3ee" strokeWidth="2.5" fill="none" opacity="0.35" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>

        <div className="capa-marcas">
          <img src="./img/logo-dr-helio.png" alt="Dr. Hélio Okamura" className="capa-logo-dr" />
          <span className="capa-divisor" aria-hidden="true" />
          <img src="./img/logo-cemep.png" alt="CEMEP Care — Saúde e Performance" className="capa-logo-cemep" />
        </div>

        <div className="capa-texto">
          <h2>Monitoramento esportivo<br />e reabilitação</h2>
          <p>Carga de treino · VFC · PROMs · Maturação</p>
        </div>
      </div>

      <div className="capa-form">{null}</div>
    </div>
  );
}
