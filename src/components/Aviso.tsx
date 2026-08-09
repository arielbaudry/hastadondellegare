"use client";

import { useEffect, useState } from "react";

const HASTA = process.env.NEXT_PUBLIC_MODO_ABIERTO_HASTA ?? "";

function textoFecha(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("es-AR", { day: "numeric", month: "long" });
}

/**
 * Cartel de "modo abierto". Mientras no haya login, cualquiera que tenga el
 * link puede cargar y editar: hay que decirlo en la cara, no en la letra chica.
 */
export default function Aviso({ restringido }: { restringido: boolean }) {
  const [oculto, setOculto] = useState(true);
  const [abierto, setAbierto] = useState(false);

  // Sólo tras montar, para que servidor y cliente rendericen lo mismo.
  useEffect(() => {
    setOculto(window.sessionStorage.getItem("hdll:aviso") === "visto");
  }, []);

  if (oculto) return null;

  // Con el acceso por enlace encendido, el cartel de "modo abierto" ya no
  // corresponde: entra sólo quien tiene ficha con correo.
  if (restringido) {
    return (
      <div className="aviso">
        <span aria-hidden="true">🔒</span>
        <p className="prosa" style={{ margin: 0 }}>
          <strong>Árbol privado.</strong> Entra sólo quien tiene su ficha con el correo
          cargado.
          <span className="aviso-detalle">
            {" "}
            Cualquiera puede sumar personas y corregir datos; borrar, sólo el administrador.
            Aun así, pedí permiso antes de publicar el teléfono o la dirección de otra
            persona.
          </span>
        </p>
        <button
          className="btn chico fantasma cerrar"
          onClick={() => {
            window.sessionStorage.setItem("hdll:aviso", "visto");
            setOculto(true);
          }}
        >
          Entendido
        </button>
      </div>
    );
  }

  const fecha = HASTA ? textoFecha(HASTA) : "";

  return (
    <div className={`aviso${abierto ? " abierto" : ""}`}>
      <span aria-hidden="true">🔓</span>
      <p className="prosa" style={{ margin: 0 }}>
        <strong>Modo abierto, sin contraseña.</strong> Cualquiera que tenga este link puede
        agregar y corregir personas{fecha ? `, hasta el ${fecha}` : " por unos días"}.
        <span className="aviso-detalle">
          {" "}
          Es a propósito: así la familia carga lo que sabe sin trámite. Después vamos a
          cerrarlo y mandar accesos personales por <em>magic link</em> al correo de cada uno.
          Por eso conviene <strong>no cargar datos sensibles</strong> (documentos, datos
          bancarios) y pedir permiso antes de publicar el teléfono o la dirección de otra
          persona.
        </span>{" "}
        {!abierto && (
          <button className="btn chico fantasma ver-mas" onClick={() => setAbierto(true)}>
            Ver más
          </button>
        )}
      </p>
      <button
        className="btn chico fantasma cerrar"
        onClick={() => {
          window.sessionStorage.setItem("hdll:aviso", "visto");
          setOculto(true);
        }}
      >
        Entendido
      </button>
    </div>
  );
}
