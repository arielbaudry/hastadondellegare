import { fotoPrincipal } from "@/lib/tree";
import type { Persona } from "@/lib/types";

export function iniciales(p: Persona): string {
  const n = p.nombres.trim()[0] ?? "";
  const a = p.apellidos.trim()[0] ?? "";
  return (n + a).toUpperCase() || "?";
}

/** Foto principal de la persona, o sus iniciales si todavía no hay ninguna. */
export default function Retrato({
  persona,
  clase = "retrato",
}: {
  persona: Persona;
  clase?: string;
}) {
  const foto = fotoPrincipal(persona);
  if (foto) {
    // eslint-disable-next-line @next/next/no-img-element -- las fotos son locales o del CDN de Blob
    return (
      <img
        className={clase}
        src={foto}
        alt={`Foto de ${persona.nombres} ${persona.apellidos}`}
        loading="lazy"
      />
    );
  }
  return (
    <span className={clase} aria-hidden="true">
      {iniciales(persona)}
    </span>
  );
}
