export default async (req, context) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  const SUPABASE_URL = 'https://tkqupuppxjuaxafocmsq.supabase.co';
  const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;

  let body;
  try { body = await req.json(); } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }

  const { requestorEmail, requestorName, eventName, maxMembers, roomName, prizeIdea, notes } = body;

  // 1. Save to Supabase
  // NOTE: this previously failed silently whenever SUPABASE_ANON_KEY
  // (the unprefixed, server-side env var — distinct from the frontend's
  // VITE_SUPABASE_ANON_KEY) wasn't set in Netlify's environment, since
  // the whole block is gated behind `if (SUPABASE_KEY)` with no warning
  // surfaced anywhere if it's missing. Make sure SUPABASE_ANON_KEY is
  // set in Netlify env vars (Production scope, Functions/Runtime) or
  // every request silently never gets written to room_requests.
  let dbSaveFailed = false;
  let dbSaveError = null;
  if (SUPABASE_KEY) {
    try {
      const dbRes = await fetch(`${SUPABASE_URL}/rest/v1/room_requests`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify({
          requestor_email: requestorEmail,
          requestor_name: requestorName,
          event_name: eventName,
          room_name: roomName || null,
          max_members: maxMembers,
          prize_idea: prizeIdea || null,
          notes: notes || null,
          status: 'pending',
        }),
      });
      if (!dbRes.ok) {
        dbSaveFailed = true;
        dbSaveError = `Supabase ${dbRes.status}: ${(await dbRes.text().catch(() => '')).slice(0, 200)}`;
        console.warn('DB save failed:', dbSaveError);
      }
    } catch (e) {
      dbSaveFailed = true;
      dbSaveError = e.message;
      console.warn('DB save failed:', e.message);
    }
  } else {
    dbSaveFailed = true;
    dbSaveError = 'SUPABASE_ANON_KEY not set in function environment';
    console.warn(dbSaveError);
  }

  // 2. Send email notification
  if (!RESEND_API_KEY) {
    return new Response(JSON.stringify({
      success: !dbSaveFailed,
      warn: 'No RESEND_API_KEY' + (dbSaveFailed ? ' — also: ' + dbSaveError : ''),
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }

  const html = `
<div style="background-color:#0f0e0a;padding:40px 20px;font-family:Georgia,serif;">
  <div style="max-width:480px;margin:0 auto;background-color:#14130e;border:1px solid rgba(180,149,48,0.25);border-radius:8px;overflow:hidden;">
    <div style="padding:32px 32px 20px;border-bottom:1px solid rgba(180,149,48,0.15);">
      <div style="font-size:11px;color:#8a7a4a;letter-spacing:0.2em;margin-bottom:6px;">EQUIPRIX ADMIN</div>
      <div style="font-size:22px;color:#e8e0cc;font-style:italic;">New Room Request</div>
    </div>
    <div style="padding:28px 32px;">
      <table style="width:100%;border-collapse:collapse;">
        <tr><td style="padding:8px 0;border-bottom:1px solid rgba(42,40,32,0.4);">
          <div style="font-size:10px;color:#8a7a4a;letter-spacing:0.12em;margin-bottom:2px;">FROM</div>
          <div style="font-size:14px;color:#e8e0cc;">${requestorName} &lt;${requestorEmail}&gt;</div>
        </td></tr>
        <tr><td style="padding:8px 0;border-bottom:1px solid rgba(42,40,32,0.4);">
          <div style="font-size:10px;color:#8a7a4a;letter-spacing:0.12em;margin-bottom:2px;">EVENT</div>
          <div style="font-size:14px;color:#e8e0cc;">${eventName}</div>
        </td></tr>
        <tr><td style="padding:8px 0;border-bottom:1px solid rgba(42,40,32,0.4);">
          <div style="font-size:10px;color:#8a7a4a;letter-spacing:0.12em;margin-bottom:2px;">ROOM NAME</div>
          <div style="font-size:14px;color:#e8e0cc;">${roomName || '(not specified)'}</div>
        </td></tr>
        <tr><td style="padding:8px 0;border-bottom:1px solid rgba(42,40,32,0.4);">
          <div style="font-size:10px;color:#8a7a4a;letter-spacing:0.12em;margin-bottom:2px;">MAX MEMBERS</div>
          <div style="font-size:14px;color:#e8e0cc;">${maxMembers}</div>
        </td></tr>
        ${prizeIdea ? `<tr><td style="padding:8px 0;border-bottom:1px solid rgba(42,40,32,0.4);">
          <div style="font-size:10px;color:#8a7a4a;letter-spacing:0.12em;margin-bottom:2px;">PRIZE IDEA</div>
          <div style="font-size:14px;color:#e8e0cc;">${prizeIdea}</div>
        </td></tr>` : ''}
        ${notes ? `<tr><td style="padding:8px 0;">
          <div style="font-size:10px;color:#8a7a4a;letter-spacing:0.12em;margin-bottom:2px;">NOTES</div>
          <div style="font-size:14px;color:#e8e0cc;">${notes}</div>
        </td></tr>` : ''}
      </table>
      <div style="margin-top:24px;padding:12px 16px;background:rgba(180,149,48,0.06);border:1px solid rgba(180,149,48,0.2);border-radius:4px;">
        <div style="font-size:11px;color:#8a7a4a;letter-spacing:0.1em;margin-bottom:4px;">NEXT STEP</div>
        <div style="font-size:13px;color:#b49530;">Approve or deny in the admin panel → Rooms tab → Pending Requests</div>
      </div>
    </div>
  </div>
</div>`;

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'EquiPrix <noreply@send.playequiprix.com>',
        to: ['info@playequiprix.com'],
        reply_to: requestorEmail,
        subject: `🏇 Room Request: ${roomName || eventName} from ${requestorName}`,
        html,
      }),
    });

    // PREVIOUSLY: this branch wasn't checked at all — a failed Resend
    // call (bad/unverified sender domain, invalid API key format, rate
    // limit, anything) was indistinguishable from success, since the
    // response body was never read on failure. Now a non-2xx Resend
    // response surfaces in `warn` instead of silently reporting success.
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      console.warn('Resend send failed:', res.status, errText);
      return new Response(JSON.stringify({
        success: !dbSaveFailed,
        warn: `Email failed: Resend ${res.status}: ${errText.slice(0, 200)}` + (dbSaveFailed ? ' — also: ' + dbSaveError : ''),
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({
      success: !dbSaveFailed,
      ...(dbSaveFailed ? { warn: dbSaveError } : {}),
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    console.warn('Resend send failed:', e.message);
    return new Response(JSON.stringify({
      success: !dbSaveFailed,
      warn: `Email failed: ${e.message}` + (dbSaveFailed ? ' — also: ' + dbSaveError : ''),
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }
};

export const config = { path: '/api/send-room-request' };