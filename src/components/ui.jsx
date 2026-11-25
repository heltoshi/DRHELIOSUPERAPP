// Componentes visuais compartilhados (sem Tailwind: CSS próprio).
import React from "react";

export function Card({ children, className = "", ...rest }) {
  return (
    <div className={`card ${className}`} {...rest}>
      {children}
    </div>
  );
}

export function CardTitle({ children, sub }) {
  return (
    <div className="card-title">
      <h3>{children}</h3>
      {sub && <p>{sub}</p>}
    </div>
  );
}

export function Badge({ children, tone = "neutral" }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

export function Button({ children, variant = "primary", size = "md", as: As = "button", ...rest }) {
  return (
    <As className={`btn btn-${variant} btn-${size}`} {...rest}>
      {children}
    </As>
  );
}

export function Stat({ label, value, sub, tone = "blue" }) {
  return (
    <div className="card stat">
      <div>
        <p className="stat-label">{label}</p>
        <p className="stat-value">{value}</p>
        {sub && <p className="stat-sub">{sub}</p>}
      </div>
      <div className={`stat-dot tone-${tone}`} />
    </div>
  );
}

export function Field({ label, hint, children }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  );
}

export function Modal({ open, onClose, title, children, footer, wide }) {
  if (!open) return null;
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className={`modal ${wide ? "modal-wide" : ""}`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Fechar">
            ✕
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

export function Empty({ title, hint, action }) {
  return (
    <div className="empty">
      <p className="empty-title">{title}</p>
      {hint && <p className="empty-hint">{hint}</p>}
      {action}
    </div>
  );
}

export function Bar({ value, max = 100, tone }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className="bar">
      <div className={`bar-fill tone-${tone || "blue"}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Avatar({ name, size = 40 }) {
  const initial = (name || "?").trim()[0]?.toUpperCase();
  return (
    <div className="avatar" style={{ width: size, height: size, fontSize: size * 0.42 }}>
      {initial}
    </div>
  );
}
