// netlify/functions/send-push.js
//
// Sends a Web Push notification to one or more users by email. Looks up
// each user's stored subscription(s) in the push_subscriptions table and
// sends via the web-push library using the VAPID keypair.
//
// Requires these environment variables to be set in Netlify:
//   VAPID_PUBLIC_KEY   — same value as VITE_VAPID_PUBLIC_KEY on the frontend
//   VAPID_PRIVATE_KEY  — kept server-side only, never exposed to the client
//   VAPID_SUBJECT       — e.g. "mailto:you@yourdomain.com" (required by the push spec)
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY — service role, so this function can read all
//                               subscriptions regardless of RLS policy
//
// Requires the `web-push` npm package: run `npm install web-push` in the
// project root before deploying.

const webpush = require('web-push');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;

  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY || !VAPID_SUBJECT) {
    return { statusCode: 500, body: JSON.stringify({ error: 'VAPID environment variables are not configured' }) };
  }
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Supabase service role environment variables are not configured' }) };
  }

  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON body' }) };
  }

  const { recipients, title, message, url } = body;
  if (!Array.isArray(recipients) || !recipients.length) {
    return { statusCode: 400, body: JSON.stringify({ error: 'recipients must be a non-empty array of emails' }) };
  }
  if (!title || !message) {
    return { statusCode: 400, body: JSON.stringify({ error: 'title and message are required' }) };
  }

  try {
    // Fetch subscriptions for the requested recipients.
    const emailFilter = recipients.map(e => encodeURIComponent(e)).join(',');
    const subsResp = await fetch(
      SUPABASE_URL + '/rest/v1/push_subscriptions?user_email=in.(' + emailFilter + ')&select=user_email,endpoint,p256dh,auth',
      {
        headers: {
          'apikey': SUPABASE_SERVICE_ROLE_KEY,
          'Authorization': 'Bearer ' + SUPABASE_SERVICE_ROLE_KEY,
        },
      }
    );
    if (!subsResp.ok) {
      const errText = await subsResp.text();
      return { statusCode: 502, body: JSON.stringify({ error: 'Failed to fetch subscriptions: ' + errText.slice(0, 200) }) };
    }
    const subs = await subsResp.json();

    if (!subs.length) {
      return { statusCode: 200, body: JSON.stringify({ sent: 0, failed: 0, note: 'No push subscriptions found for the given recipients.' }) };
    }

    const payload = JSON.stringify({
      title,
      body: message,
      url: url || '/play',
      tag: 'equiprix-' + Date.now(),
    });

    let sent = 0;
    let failed = 0;
    const staleEndpoints = [];
    const errors = [];

    await Promise.all(subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          payload
        );
        sent++;
      } catch (err) {
        failed++;
        errors.push({ statusCode: err.statusCode, body: err.body, message: err.message });
        // 404/410 means the subscription is no longer valid (user
        // uninstalled, cleared data, etc.) — mark for cleanup.
        if (err.statusCode === 404 || err.statusCode === 410) {
          staleEndpoints.push(sub.endpoint);
        }
      }
    }));

    // Clean up dead subscriptions so future sends don't keep failing on them.
    if (staleEndpoints.length) {
      const endpointFilter = staleEndpoints.map(e => encodeURIComponent(e)).join(',');
      await fetch(
        SUPABASE_URL + '/rest/v1/push_subscriptions?endpoint=in.(' + endpointFilter + ')',
        {
          method: 'DELETE',
          headers: {
            'apikey': SUPABASE_SERVICE_ROLE_KEY,
            'Authorization': 'Bearer ' + SUPABASE_SERVICE_ROLE_KEY,
          },
        }
      ).catch(() => {});
    }

    return { statusCode: 200, body: JSON.stringify({ sent, failed, errors }) };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};