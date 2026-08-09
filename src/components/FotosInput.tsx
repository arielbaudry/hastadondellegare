"use client";

import { useRef, useState } from "react";
import { subirFoto } from "@/lib/cliente";

const LADO_MAX = 1400;

/**
 * Reduce la imagen en el navegador antes de subirla. Una foto de celular pesa
 * 4-8 MB; acá sale en unos cientos de kB, así el servidor no procesa nada y la
 * carga anda incluso con datos móviles.
 */
async function redimensionar(archivo: File): Promise<Blob> {
  const bitmap = await createImageBitmap(archivo);
  const escala = Math.min(1, LADO_MAX / Math.max(bitmap.width, bitmap.height));
  const ancho = Math.round(bitmap.width * escala);
  const alto = Math.round(bitmap.height * escala);

  const lienzo = document.createElement("canvas");
  lienzo.width = ancho;
  lienzo.height = alto;
  const ctx = lienzo.getContext("2d");
  if (!ctx) throw new Error("El navegador no pudo procesar la imagen.");
  ctx.drawImage(bitmap, 0, 0, ancho, alto);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolver) =>
    lienzo.toBlob(resolver, "image/jpeg", 0.85),
  );
  if (!blob) throw new Error("El navegador no pudo procesar la imagen.");
  return blob;
}

/**
 * Galería de fotos de una persona. Se suman, no se reemplazan: cada pariente
 * puede subir la que tiene, y la primera de la lista es la que se usa de
 * retrato en el árbol y en las tarjetas.
 */
export default function FotosInput({
  fotos,
  onCambio,
}: {
  fotos: string[];
  onCambio: (fotos: string[]) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [subiendo, setSubiendo] = useState(0);
  const [error, setError] = useState<string | null>(null);

  async function agregar(archivos: File[]) {
    setError(null);
    setSubiendo(archivos.length);
    const subidas: string[] = [];
    for (const archivo of archivos) {
      try {
        subidas.push(await subirFoto(await redimensionar(archivo)));
      } catch (err) {
        setError(err instanceof Error ? err.message : "No se pudo subir una de las fotos.");
      } finally {
        setSubiendo((n) => n - 1);
      }
    }
    if (subidas.length) onCambio([...fotos, ...subidas]);
    if (input.current) input.current.value = "";
  }

  return (
    <div className="galeria">
      <div className="galeria-fotos">
        {fotos.map((url, i) => (
          <figure key={url} className={`galeria-foto${i === 0 ? " principal" : ""}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt={`Foto ${i + 1}`} />
            {i === 0 && <figcaption>retrato</figcaption>}
            <div className="acciones">
              {i > 0 && (
                <button
                  type="button"
                  title="Usar esta como retrato"
                  onClick={() => onCambio([url, ...fotos.filter((f) => f !== url)])}
                >
                  ★
                </button>
              )}
              <button
                type="button"
                title="Quitar esta foto"
                onClick={() => onCambio(fotos.filter((f) => f !== url))}
              >
                ✕
              </button>
            </div>
          </figure>
        ))}

        <button
          type="button"
          className="galeria-agregar"
          disabled={subiendo > 0}
          onClick={() => input.current?.click()}
        >
          {subiendo > 0 ? `Subiendo ${subiendo}…` : "+ Agregar fotos"}
        </button>
      </div>

      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        hidden
        onChange={(e) => {
          const archivos = [...(e.target.files ?? [])];
          if (archivos.length) void agregar(archivos);
        }}
      />
      <span className="ayuda">
        Se pueden subir varias. La primera es el retrato; con ★ se cambia cuál. Ninguna pisa
        a las anteriores.
      </span>
      {error && <span style={{ color: "var(--alerta)", fontSize: 12 }}>{error}</span>}
    </div>
  );
}
