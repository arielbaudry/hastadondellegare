import { NextResponse } from "next/server";
import { leerArbol, registrar } from "@/lib/store";
import { enviarEnlaceDeAcceso } from "@/lib/correo";
import { accesoRestringido, crearEnlace, normalizarEmail } from "@/lib/sesion";

export const dynamic = "force-dynamic";

/**
 * POST /api/acceso/solicitar — { email }
 *
 * Manda el enlace **sólo si ese correo está cargado en alguna ficha del árbol**.
 * La respuesta es siempre la misma, exista o no: si dijera "ese correo no está"
 * cualquiera podría averiguar quién figura en el árbol probando direcciones.
 * Quien no lo reciba tiene el contacto de Ariel en la misma pantalla.
 */
export async function POST(req: Request) {
  if (!accesoRestringido()) {
    return NextResponse.json({ error: "El acceso por enlace no está configurado." }, { status: 409 });
  }

  const { email } = await req.json().catch(() => ({ email: "" }));
  const buscado = normalizarEmail(String(email ?? ""));
  const respuesta = NextResponse.json({
    ok: true,
    mensaje:
      "Si ese correo está cargado en el árbol, en un minuto te llega el enlace. Revisá también el correo no deseado.",
  });

  if (!buscado.includes("@")) return respuesta;

  const arbol = await leerArbol();
  const persona = arbol.personas.find((p) => p.email && normalizarEmail(p.email) === buscado);
  if (!persona) {
    await registrar({ accion: "acceso:desconocido", email: buscado });
    return respuesta;
  }

  const base = process.env.SITIO_URL ?? new URL(req.url).origin;
  const enlace = `${base}/api/acceso/entrar?t=${encodeURIComponent(crearEnlace(buscado))}`;

  try {
    await enviarEnlaceDeAcceso(persona.email!, persona.nombres.split(" ")[0], enlace);
    await registrar({ accion: "acceso:enviado", email: buscado });
  } catch (err) {
    console.error("[acceso] no se pudo enviar el correo", err);
    return NextResponse.json(
      { error: "No pudimos mandar el correo. Probá de nuevo en un rato." },
      { status: 500 },
    );
  }
  return respuesta;
}
