import { NextResponse } from "next/server";
import { mutarArbol, registrar } from "@/lib/store";
import { ErrorDeDatos, normalizar, sanearPersona } from "@/lib/validar";
import { bloquearSiNoEsAdmin } from "@/lib/permisos";
import type { Persona } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * POST /api/importar — restaura un respaldo exportado desde Ajustes.
 * Reemplaza el árbol entero; los ids del archivo se conservan para que los
 * vínculos sigan apuntando a donde apuntaban.
 */
export async function POST(req: Request) {
  const rechazo = bloquearSiNoEsAdmin(req);
  if (rechazo) return rechazo;

  try {
    const cuerpo = await req.json();
    const entrada = cuerpo?.personas;
    if (!Array.isArray(entrada)) {
      return NextResponse.json({ error: "El archivo no tiene una lista `personas`." }, { status: 400 });
    }
    if (entrada.length > 5000) {
      return NextResponse.json({ error: "Demasiadas personas (máximo 5000)." }, { status: 400 });
    }

    const personas: Persona[] = entrada.map((p: Record<string, unknown>) => {
      const saneada = sanearPersona(p, null, cuerpo.autor);
      // sanearPersona trata cada persona como nueva: para un respaldo hay que
      // devolverle su identidad y su autoría originales, si no toda la familia
      // queda figurando como cargada por quien restauró.
      if (typeof p.id === "string" && p.id) saneada.id = p.id;
      if (typeof p.creadoEn === "string") saneada.creadoEn = p.creadoEn;
      if (typeof p.creadoPor === "string") saneada.creadoPor = p.creadoPor;
      if (typeof p.actualizadoPor === "string") saneada.actualizadoPor = p.actualizadoPor;
      if (typeof p.actualizadoEn === "string") saneada.actualizadoEn = p.actualizadoEn;
      return saneada;
    });

    const arbol = await mutarArbol((a) => {
      a.personas = personas;
      a.esEjemplo = false;
      normalizar(a);
    });

    await registrar({ accion: "importar", cuantas: personas.length, quien: cuerpo.autor });
    return NextResponse.json({ rev: arbol.rev, personas: arbol.personas });
  } catch (err) {
    if (err instanceof ErrorDeDatos) {
      return NextResponse.json({ error: `Archivo inválido: ${err.message}` }, { status: 400 });
    }
    console.error("[importar]", err);
    return NextResponse.json({ error: "No se pudo importar." }, { status: 500 });
  }
}
