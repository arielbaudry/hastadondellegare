import { NextResponse } from "next/server";
import { driver, estadoAlmacenamiento, leerArbol, mutarArbol, puedeGuardar } from "@/lib/store";
import { arbolDeEjemplo } from "@/lib/ejemplo";
import { bloquearSiNoPuedeVer, permisosDe } from "@/lib/permisos";
import { accesoRestringido, ADMIN_EMAIL, smtpConfigurado } from "@/lib/sesion";

export const dynamic = "force-dynamic";

/** GET /api/arbol — todo el árbol. Es un documento chico: se manda entero. */
export async function GET(req: Request) {
  try {
    return await responder(req);
  } catch (err) {
    // Pase lo que pase, sale JSON: un 500 con el cuerpo vacío hacía que el
    // navegador mostrara "Unexpected end of JSON input" y nada más.
    console.error("[arbol GET]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "No se pudo leer el árbol." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}

async function responder(req: Request) {
  const permisos = permisosDe(req);

  // Sin sesión no se manda el árbol: sólo lo justo para pintar la pantalla de
  // acceso. Los datos de contacto de la familia no salen de acá.
  if (!permisos.puedeVer) {
    return NextResponse.json(
      {
        personas: [],
        rev: 0,
        esEjemplo: false,
        actualizadoEn: new Date(0).toISOString(),
        almacenamiento: null,
        permisos: { puedeVer: false, puedeEditar: false, puedeBorrar: false, restringido: true },
        sesion: null,
        contacto: { email: ADMIN_EMAIL, telefono: process.env.CONTACTO_TELEFONO ?? "" },
      },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  let arbol = await leerArbol();

  // Misma regla en cada carga: si el correo de la sesión ya no figura en
  // ninguna ficha, la sesión deja de valer aunque la cookie siga firmada.
  if (permisos.restringido && permisos.sesion) {
    const sigue = arbol.personas.some(
      (p) => p.email && p.email.trim().toLowerCase() === permisos.sesion!.email,
    );
    if (!sigue) {
      return NextResponse.json(
        {
          personas: [],
          rev: 0,
          esEjemplo: false,
          actualizadoEn: new Date(0).toISOString(),
          almacenamiento: null,
          permisos: { puedeVer: false, puedeEditar: false, puedeBorrar: false, restringido: true },
          sesion: null,
          contacto: { email: ADMIN_EMAIL, telefono: process.env.CONTACTO_TELEFONO ?? "" },
        },
        { status: 401, headers: { "Cache-Control": "no-store" } },
      );
    }
  }

  // La familia de ejemplo se siembra **sólo en local**, para poder mirar el
  // micrositio funcionando sin cargar nada. En producción un árbol vacío tiene
  // que abrir vacío: ver quince desconocidos inventados en el sitio de tu
  // familia confunde más de lo que ayuda.
  if (arbol.personas.length === 0 && arbol.rev === 0 && driver === "fs" && puedeGuardar()) {
    const ejemplo = arbolDeEjemplo();
    arbol = await mutarArbol((a) => {
      a.personas = ejemplo.personas;
      a.esEjemplo = true;
    });
  }

  return NextResponse.json(
    {
      ...arbol,
      almacenamiento: estadoAlmacenamiento(),
      permisos: {
        puedeVer: true,
        puedeEditar: permisos.puedeEditar,
        puedeBorrar: permisos.puedeBorrar,
        restringido: permisos.restringido,
      },
      sesion: permisos.sesion,
      contacto: { email: ADMIN_EMAIL, telefono: process.env.CONTACTO_TELEFONO ?? "" },
      configuracion: { accesoRestringido: accesoRestringido(), smtp: smtpConfigurado() },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
