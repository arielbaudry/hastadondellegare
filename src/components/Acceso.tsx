"use client";

import { useState } from "react";

/**
 * Puerta de entrada cuando el árbol está restringido. No hay registro ni
 * contraseñas: se pide el enlace al correo que ya figura en la ficha de cada
 * uno. Quien todavía no tenga ficha —o la tenga sin correo— no puede entrar
 * solo, y para eso está el contacto de Ariel bien a la vista.
 */
export default function Acceso({
  contacto,
  vencido,
}: {
  contacto: { email: string; telefono: string };
  vencido: boolean;
}) {
  const [email, setEmail] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function pedir(e: React.FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setError(null);
    setMensaje(null);
    try {
      const res = await fetch("/api/acceso/solicitar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const datos = await res.json().catch(() => ({}));
      if (!res.ok) setError(datos.error ?? "No se pudo pedir el enlace.");
      else setMensaje(datos.mensaje);
    } catch {
      setError("No se pudo pedir el enlace. Probá de nuevo.");
    } finally {
      setEnviando(false);
    }
  }

  const telefono = contacto.telefono.replace(/[^+\d]/g, "");

  return (
    <div className="acceso">
      <div className="acceso-caja">
        <span className="logo" aria-hidden="true">
          <svg viewBox="0 0 32 32" width="34" height="34">
            <g stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none">
              <path d="M16 25v-4M9 17v-2h14v2M9 15v-3M23 15v-3M16 21v-6" />
            </g>
            <g fill="currentColor">
              <circle cx="9" cy="9" r="3" />
              <circle cx="23" cy="9" r="3" />
              <circle cx="16" cy="27" r="3" />
            </g>
          </svg>
        </span>

        <h1>Hasta dónde llegaré</h1>
        <p className="prosa">
          El árbol de la familia. Para entrar te mandamos un enlace al correo — no hay
          contraseñas que recordar.
        </p>

        {vencido && (
          <div className="error" style={{ marginBottom: 16 }}>
            Ese enlace ya venció. Pedí uno nuevo, tarda un minuto.
          </div>
        )}

        <form onSubmit={pedir} className="acceso-form">
          <input
            className="campo-texto"
            type="email"
            required
            autoFocus
            placeholder="tu correo"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <button className="btn primario" type="submit" disabled={enviando || !email}>
            {enviando ? "Enviando…" : "Mandame el enlace"}
          </button>
        </form>

        {mensaje && <div className="acceso-ok">{mensaje}</div>}
        {error && <div className="error">{error}</div>}

        <div className="acceso-ayuda prosa">
          <strong>¿No te llega?</strong> Sólo entra quien ya tiene su ficha cargada con el
          correo. Si todavía no estás, escribile a Ariel y te suma:
          <div className="acceso-contacto">
            <a href={`mailto:${contacto.email}?subject=Acceso al árbol de la familia`}>
              {contacto.email}
            </a>
            {contacto.telefono && (
              <a href={`https://wa.me/${telefono.replace("+", "")}`}>{contacto.telefono}</a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
