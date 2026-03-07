import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { sendFCMToRole, sendFCMToUser, type FCMRole } from '@/lib/fcm-send-server';

const ROLES = ['central', 'rider', 'restaurant', 'user'] as const;
type NotificationTarget = (typeof ROLES)[number];

function isValidTarget(t: string): t is NotificationTarget {
  return ROLES.includes(t as NotificationTarget);
}

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
    const { target, uid, title, body: bodyText, data: dataPayload } = body as {
      target?: string;
      uid?: string;
      title?: string;
      body?: string;
      data?: Record<string, string>;
    };
    const targetStr = target ?? '';
    if (!isValidTarget(targetStr)) {
      return NextResponse.json(
        { error: 'target inválido (central, rider, restaurant, user)' },
        { status: 400 }
      );
    }
    if (auth.rol === 'cliente' && targetStr !== 'user') {
      return NextResponse.json({ error: 'Los clientes solo pueden enviar notificaciones al target user' }, { status: 403 });
    }
    if (typeof title !== 'string' || typeof bodyText !== 'string') {
      return NextResponse.json({ error: 'title y body requeridos' }, { status: 400 });
    }
    const data = dataPayload && typeof dataPayload === 'object' ? dataPayload : {};
    let effectiveUid = typeof uid === 'string' && uid.trim() ? uid.trim() : null;
    if (targetStr === 'user' && !effectiveUid && auth.rol === 'cliente') {
      effectiveUid = auth.uid;
    }
    let sent = 0;
    if (targetStr === 'user' && effectiveUid) {
      const ok = await sendFCMToUser(effectiveUid, title, bodyText, data);
      sent = ok ? 1 : 0;
    } else {
      sent = await sendFCMToRole(targetStr as FCMRole, title, bodyText, data);
    }
    return NextResponse.json({ ok: true, sent });
  } catch (e) {
    console.error('POST /api/fcm/send', e);
    return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  }
}
