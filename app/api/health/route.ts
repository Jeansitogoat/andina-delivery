/**
 * Health check para monitoreo (Vercel, UptimeRobot, etc.).
 */
export async function GET() {
  return Response.json({ ok: true, ts: Date.now() });
}
