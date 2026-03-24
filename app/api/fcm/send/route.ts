import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { sendFCMToRole, sendFCMToUser, sendFCMToRider, type FCMRole } from '@/lib/fcm-send-server';
import { fcmSendPostSchema } from '@/lib/schemas/fcmSend';

export async function POST(request: Request) {
  let auth: { uid: string; rol: string };
  try {
    auth = await requireAuth(request, ['central', 'maestro', 'rider', 'local', 'cliente']);
  } catch (r) {
    if (r instanceof Response) return r;
    throw r;
  }
  try {
    const body = await request.json();
    const parse = fcmSendPostSchema.safeParse(body);
    if (!parse.success) {
      const flat = parse.error.flatten().fieldErrors;
      const firstMessage = Object.values(flat).flat().find(Boolean) || 'Datos inválidos';
      return NextResponse.json({ error: String(firstMessage), fieldErrors: flat }, { status: 400 });
    }
    const { target: targetStr, uid, title, body: bodyText } = parse.data;
    if (auth.rol === 'cliente' && targetStr !== 'user') {
      return NextResponse.json({ error: 'Los clientes solo pueden enviar notificaciones al target user' }, { status: 403 });
    }
    // Rider y local no pueden enviar FCM a usuarios arbitrarios ni hacer broadcast a roles
    if (auth.rol === 'rider' || auth.rol === 'local') {
      return NextResponse.json({ error: 'No autorizado para enviar notificaciones' }, { status: 403 });
    }
    const data = (parse.data.data ?? {}) as Record<string, string>;
    let effectiveUid = typeof uid === 'string' && uid.trim() ? uid.trim() : null;
    // Un cliente nunca puede enviar notificaciones a otro usuario: forzar siempre su propio uid
    if (auth.rol === 'cliente') {
      effectiveUid = auth.uid;
    } else if (targetStr === 'user' && !effectiveUid) {
      effectiveUid = auth.uid;
    }
    let sent = 0;
    if (targetStr === 'user' && effectiveUid) {
      const ok = await sendFCMToUser(effectiveUid, title, bodyText, data);
      sent = ok ? 1 : 0;
    } else if (targetStr === 'rider' && effectiveUid) {
      const ok = await sendFCMToRider(effectiveUid, title, bodyText, data);
      sent = ok ? 1 : 0;
    } else {
      sent = await sendFCMToRole(targetStr as FCMRole, title, bodyText, data);
    }
    return NextResponse.json({ ok: true, sent });
  } catch (e) {
    console.error('POST /api/fcm/send', e);
    return NextResponse.json({ error: 'Solicitud inválida' }, { status: 400 });
  }
}
