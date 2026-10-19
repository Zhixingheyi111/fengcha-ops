/* Vercel Node function. Set relay credentials in Vercel environment settings only. */
module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ok:false,error:'POST required.'}); }
  const allowed = new Set(['https://fengcha-ops.vercel.app']);
  if (process.env.VERCEL_ENV === 'preview' && process.env.VERCEL_URL) allowed.add('https://' + process.env.VERCEL_URL);
  if (!process.env.VERCEL_ENV) allowed.add('http://127.0.0.1:4181');
  if (!allowed.has(req.headers.origin)) return res.status(403).json({ok:false,error:'Request origin not allowed.'});
  let body = req.body;
  try { if (typeof body === 'string') body = JSON.parse(body); } catch (_) { return res.status(400).json({ok:false,error:'Invalid report.'}); }
  if (!body || !['Heights','SP'].includes(body.store) || typeof body.id !== 'string' || !/^[a-zA-Z0-9_-]{8,160}$/.test(body.id)
    || typeof body.subject !== 'string' || body.subject.length > 180 || /[\r\n]/.test(body.subject)
    || typeof body.message !== 'string' || !body.message.trim() || body.message.length > 50000) {
    return res.status(400).json({ok:false,error:'Invalid report.'});
  }
  const hook = process.env.GMAIL_REPORT_RELAY_URL;
  const token = process.env.GMAIL_REPORT_RELAY_TOKEN;
  if (!hook || !token) return res.status(503).json({ok:false,error:'Gmail report delivery is awaiting setup. Your inventory is saved.'});
  if (!/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(hook)) return res.status(503).json({ok:false,error:'Report relay configuration needs attention.'});
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const reply = await fetch(hook, {method:'POST',redirect:'follow',signal:controller.signal,
      headers:{'Content-Type':'text/plain;charset=utf-8'},
      body:JSON.stringify({token:token,id:body.id,store:body.store,subject:body.subject,message:body.message})});
    if (!reply.ok) throw new Error('Relay unavailable');
    const data = await reply.json();
    if (!data.ok) return res.status(502).json({ok:false,error:data.code === 'AUTH' ? 'Google and Vercel connection codes do not match. Ask your manager to check both saved values.' : data.code === 'INVALID' ? 'The Gmail relay rejected the report format.' : data.code === 'QUOTA' ? 'Gmail sending limit reached. Retry this saved report later.' : data.code === 'RATE_LIMIT' ? 'Store report limit reached. Retry later or contact your manager.' : 'Gmail did not confirm delivery. Retry the saved report later.'});
    return res.status(200).json({ok:true,duplicate:!!data.duplicate});
  } catch (_) { return res.status(502).json({ok:false,error:'Email delivery not confirmed. Retry the saved report later.'}); }
  finally { clearTimeout(timer); }
};
