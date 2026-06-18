export default async (req, context) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_API_KEY) return new Response(JSON.stringify({ error: 'RESEND_API_KEY not set' }), {
    status: 500, headers: { 'Content-Type': 'application/json' }
  });

  let body;
  try { body = await req.json(); } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }

  const { email, roomName, prize, eventName, eventFlag, joinUrl, managerName } = body;

  if (!email || !roomName || !joinUrl) return new Response(JSON.stringify({ error: 'Missing required fields' }), {
    status: 400, headers: { 'Content-Type': 'application/json' }
  });

  const html = `
<div style="background-color:#0f0e0a;padding:40px 20px;font-family:Georgia,serif;">
  <div style="max-width:480px;margin:0 auto;background-color:#14130e;border:1px solid rgba(180,149,48,0.25);border-radius:8px;overflow:hidden;">
    <div style="padding:40px 32px 28px;text-align:center;border-bottom:1px solid rgba(180,149,48,0.15);">
      <img src="https://playequiprix.com/icons/equiprix_logo_email.png" alt="EquiPrix" width="280" style="width:280px;display:block;margin:0 auto;" />
    </div>
    <div style="padding:36px 32px;">
      <p style="font-size:24px;color:#e8e0cc;margin:0 0 14px;font-style:italic;text-align:center;">You've been invited.</p>
      <p style="font-size:14px;color:#b49530;line-height:1.7;margin:0 0 24px;">
        ${managerName ? `<strong style="color:#c8b86a;">${managerName}</strong> has invited you to join` : 'You have been invited to join'}
        <strong style="color:#c8b86a;"> ${roomName}</strong> — a private fantasy room on EquiPrix${eventName ? ` for the <strong style="color:#c8b86a;">${eventFlag || ''} ${eventName}</strong>` : ''}.
      </p>
      ${prize ? `
      <div style="background:rgba(180,149,48,0.08);border:1px solid rgba(180,149,48,0.2);border-radius:6px;padding:12px 16px;margin:0 0 24px;text-align:center;">
        <div style="font-size:10px;color:#8a7a4a;letter-spacing:0.15em;margin-bottom:4px;">PRIZE</div>
        <div style="font-size:14px;color:#c8b86a;font-style:italic;">🏆 ${prize}</div>
      </div>` : ''}
      <div style="text-align:center;margin:32px 0;">
        <a href="${joinUrl}" style="display:inline-block;background-color:#b49530;color:#0f0e0a;text-decoration:none;padding:16px 40px;border-radius:4px;font-size:12px;font-weight:bold;letter-spacing:0.15em;font-family:Georgia,serif;">JOIN THE ROOM</a>
      </div>
      <p style="font-size:12px;color:#5a5040;line-height:1.6;margin:0;text-align:center;">
        If you don't have an EquiPrix account yet, you'll be prompted to create one — it's free.
      </p>
    </div>
    <div style="padding:16px 32px;border-top:1px solid rgba(180,149,48,0.1);text-align:center;">
      <p style="font-size:11px;color:#5a5040;margin:0;">© 2026 EquiPrix · <a href="https://playequiprix.com" style="color:#8a7a4a;text-decoration:none;">playequiprix.com</a></p>
    </div>
  </div>
</div>`;

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'EquiPrix <noreply@playequiprix.com>',
        to: [email],
        subject: `You've been invited to ${roomName} on EquiPrix 🏇`,
        html,
      }),
    });

    if (res.ok) {
      return new Response(JSON.stringify({ success: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    } else {
      const err = await res.json();
      return new Response(JSON.stringify({ error: err?.message || 'Send failed' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};

export const config = { path: '/api/send-room-invite' };