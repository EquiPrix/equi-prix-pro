export default async (req, context) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_API_KEY) return new Response(JSON.stringify({ error: 'RESEND_API_KEY not set' }), { status: 500, headers: { 'Content-Type': 'application/json' } });

  let body;
  try { body = await req.json(); } catch { return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers: { 'Content-Type': 'application/json' } }); }

  const { type, recipients, eventName, eventFlag, eventDates, lockTime, customMessage, customSubject, sponsorName } = body;

  if (!type || !recipients?.length) return new Response(JSON.stringify({ error: 'Missing type or recipients' }), { status: 400, headers: { 'Content-Type': 'application/json' } });

  const templates = {
    draft_open: {
      subject: `${eventFlag || '🏇'} ${eventName} — Draft is Open!`,
      heading: 'The draft is open.',
      body: `Your picks for <strong style="color:#c8b86a;">${eventName}</strong> are now open. Select your GCL teams and build your roster before the deadline.${lockTime ? `<br><br>⏰ <strong style="color:#c8b86a;">Picks lock: ${lockTime}</strong>` : ''}${customMessage ? `<br><br>${customMessage}` : ''}`,
      cta: 'MAKE YOUR PICKS',
    },
    team_results: {
      subject: `${eventFlag || '🏇'} ${eventName} — Team Results & GP Draft Open`,
      heading: 'Team results are in.',
      body: `The GCL team results for <strong style="color:#c8b86a;">${eventName}</strong> are now posted. Check how your teams performed, then lock in your GP rider picks before the deadline.${lockTime ? `<br><br>⏰ <strong style="color:#c8b86a;">GP picks lock: ${lockTime}</strong>` : ''}${customMessage ? `<br><br>${customMessage}` : ''}`,
      cta: 'VIEW RESULTS & PICK RIDERS',
    },
    final_results: {
      subject: `${eventFlag || '🏇'} ${eventName} — Final Results`,
      heading: 'Final results are in.',
      body: `<strong style="color:#c8b86a;">${eventName}</strong> is complete. Check the leaderboard to see how you finished.${customMessage ? `<br><br>${customMessage}` : ''}`,
      cta: 'VIEW FINAL LEADERBOARD',
    },
    new_event: {
      subject: `New Event: ${eventFlag || '🏇'} ${eventName}${sponsorName ? ` presented by ${sponsorName}` : ''}`,
      heading: `${eventName} is coming.`,
      body: `A new event has been added to the 2026 EquiPrix season${sponsorName ? ` presented by <strong style="color:#c8b86a;">${sponsorName}</strong>` : ''}.${eventDates ? ` <strong style="color:#c8b86a;">${eventDates}</strong>` : ''}${customMessage ? `<br><br>${customMessage}` : ''}<br><br>Stay tuned — picks will open soon.`,
      cta: 'OPEN EQUIPRIX',
    },
    custom: {
      subject: customSubject || 'Message from EquiPrix',
      heading: customSubject || 'A message from EquiPrix.',
      body: customMessage || '',
      cta: 'OPEN EQUIPRIX',
    },
  };

  const tmpl = templates[type];
  if (!tmpl) return new Response(JSON.stringify({ error: 'Unknown type' }), { status: 400, headers: { 'Content-Type': 'application/json' } });

  const html = `
<div style="background-color:#0f0e0a;padding:40px 20px;font-family:Georgia,serif;">
  <div style="max-width:480px;margin:0 auto;background-color:#14130e;border:1px solid rgba(180,149,48,0.25);border-radius:8px;overflow:hidden;">
    <div style="padding:40px 32px 28px;text-align:center;border-bottom:1px solid rgba(180,149,48,0.15);">
      <img src="https://playequiprix.com/icons/equiprix_logo_email.png" alt="EquiPrix" width="280" style="width:280px;display:block;margin:0 auto;" />
    </div>
    <div style="padding:36px 32px;">
      <p style="font-size:24px;color:#e8e0cc;margin:0 0 14px;font-style:italic;text-align:center;">${tmpl.heading}</p>
      <p style="font-size:14px;color:#b49530;line-height:1.7;margin:0 0 32px;">${tmpl.body}</p>
      <div style="text-align:center;margin:32px 0;">
        <a href="https://playequiprix.com/play" style="display:inline-block;background-color:#b49530;color:#0f0e0a;text-decoration:none;padding:16px 40px;border-radius:4px;font-size:12px;font-weight:bold;letter-spacing:0.15em;font-family:Georgia,serif;">${tmpl.cta}</a>
      </div>
    </div>
    <div style="padding:16px 32px;border-top:1px solid rgba(180,149,48,0.1);text-align:center;">
      <p style="font-size:11px;color:#5a5040;margin:0;">© 2026 EquiPrix · <a href="https://playequiprix.com" style="color:#8a7a4a;text-decoration:none;">playequiprix.com</a></p>
    </div>
  </div>
</div>`;

  const results = { sent: 0, failed: 0, errors: [] };
  const batchSize = 50;

  for (let i = 0; i < recipients.length; i += batchSize) {
    const batch = recipients.slice(i, i + batchSize);
    try {
      const res = await fetch('https://api.resend.com/emails/batch', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(batch.map(email => ({
          from: 'EquiPrix <noreply@playequiprix.com>',
          to: [email],
          subject: tmpl.subject,
          html,
        }))),
      });
      if (res.ok) { results.sent += batch.length; }
      else { const err = await res.json(); results.failed += batch.length; results.errors.push(err?.message || 'Batch failed'); }
    } catch (e) { results.failed += batch.length; results.errors.push(e.message); }
  }

  return new Response(JSON.stringify(results), { status: 200, headers: { 'Content-Type': 'application/json' } });
};

export const config = { path: '/api/send-notification' };