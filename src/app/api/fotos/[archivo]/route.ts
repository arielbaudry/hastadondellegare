import { NextResponse } from "next/server";
import { leerFoto } from "@/lib/fotos";

/** GET /api/fotos/:archivo — sirve la foto, esté en disco o en Upstash. */
export async function GET(_req: Request, { params }: { params: Promise<{ archivo: string }> }) {
  const { archivo } = await params;
  const foto = await leerFoto(archivo);
  if (!foto) return new NextResponse("No encontrada", { status: 404 });

  return new NextResponse(new Uint8Array(foto.bytes), {
    headers: {
      "Content-Type": foto.tipo,
      // El nombre es un uuid: si cambia la foto cambia la URL, se puede cachear fuerte.
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
