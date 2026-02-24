import express, { type Request, type Response } from 'express';
import type { AgentWalletKit } from '@bombadilva/agent-wallet';
import type { PaywallProcessor, PaywallConfig } from './processor.js';

// ── Dashboard HTML ──────────────────────────────────────────────────

const DASHBOARD_HTML = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><title>Paywall Agent</title>
<style>
  body{font-family:system-ui,sans-serif;max-width:800px;margin:2rem auto;padding:0 1rem}
  h1{color:#333}table{width:100%;border-collapse:collapse;margin:1rem 0}
  th,td{padding:.5rem;border:1px solid #ddd;text-align:left}th{background:#f5f5f5}
  .badge{display:inline-block;padding:2px 8px;border-radius:4px;font-size:.85em}
  .paid{background:#d4edda;color:#155724}.pending{background:#fff3cd;color:#856404}
  pre{background:#f5f5f5;padding:1rem;overflow-x:auto;border-radius:4px}
</style></head><body>
<h1>Paywall Agent Dashboard</h1>
<div id="info"></div><h2>Senders</h2><div id="senders"></div>
<h2>Quarantined Messages</h2><div id="quarantined"></div>
<script>
async function load(){
  const info=await(await fetch('/api/info')).json();
  document.getElementById('info').innerHTML=
    '<pre>'+JSON.stringify(info,null,2)+'</pre>';
  const senders=await(await fetch('/api/senders')).json();
  let t='<table><tr><th>Sender</th><th>Status</th><th>Queued</th><th>Actions</th></tr>';
  for(const s of senders){
    const badge=s.whitelisted?'<span class="badge paid">Paid</span>':'<span class="badge pending">Pending</span>';
    const btn=s.whitelisted
      ?'<button onclick="wl(\\''+s.senderId+'\\',\\'DELETE\\')">Remove</button>'
      :'<button onclick="wl(\\''+s.senderId+'\\',\\'POST\\')">Whitelist</button>';
    t+='<tr><td>'+s.senderId+'</td><td>'+badge+'</td><td>'+s.quarantinedCount+'</td><td>'+btn+'</td></tr>';
  }
  t+='</table>';document.getElementById('senders').innerHTML=t;
  const q=await(await fetch('/api/quarantined')).json();
  document.getElementById('quarantined').innerHTML='<pre>'+JSON.stringify(q,null,2)+'</pre>';
}
async function wl(id,method){await fetch('/api/whitelist/'+encodeURIComponent(id),{method});load();}
load();
</script></body></html>`;

// ── Server factory ──────────────────────────────────────────────────

export function createServer(
  kit: AgentWalletKit,
  processor: PaywallProcessor,
  config: PaywallConfig,
): express.Express {
  const app = express();
  app.use(express.json());

  // Dashboard
  app.get('/', (_req: Request, res: Response) => {
    res.type('html').send(DASHBOARD_HTML);
  });

  // Paywall config info
  app.get('/api/info', (_req: Request, res: Response) => {
    res.json({
      agentId: config.agentId,
      paywallAmount: config.paywallAmount,
      asset: config.asset,
      channel: processor['channel']?.name ?? 'unknown',
      network: kit.chainClient.chain.name,
      chainId: kit.chainClient.chain.id,
    });
  });

  // Aggregate stats
  app.get('/api/stats', (_req: Request, res: Response) => {
    const dbStats = kit.db.getStats(config.agentId);
    const quarantined = processor.getQuarantineEntries();
    const senders = processor.getSenders();
    res.json({
      totalReceived: dbStats.totalReceived,
      uniqueCounterparties: dbStats.uniqueCounterparties,
      quarantinedMessages: quarantined.length,
      whitelistedSenders: senders.filter((s) => s.whitelisted).length,
      pendingSenders: senders.filter((s) => !s.whitelisted).length,
    });
  });

  // List quarantined messages
  app.get('/api/quarantined', (_req: Request, res: Response) => {
    res.json(processor.getQuarantineEntries());
  });

  // List all known senders with status
  app.get('/api/senders', (_req: Request, res: Response) => {
    res.json(processor.getSenders());
  });

  // Manually whitelist a sender
  app.post('/api/whitelist/:senderId', (req: Request, res: Response) => {
    const senderId = req.params.senderId as string;
    processor.whitelist(senderId, 0, '');
    console.log(`[paywall] Manually whitelisted: ${senderId}`);
    res.json({ success: true, senderId, whitelisted: true });
  });

  // Remove from whitelist
  app.delete('/api/whitelist/:senderId', (req: Request, res: Response) => {
    const senderId = req.params.senderId as string;
    processor.removeWhitelist(senderId);
    console.log(`[paywall] Removed from whitelist: ${senderId}`);
    res.json({ success: true, senderId, whitelisted: false });
  });

  // Refund a payment
  app.post('/api/refund/:txHash', async (req: Request, res: Response) => {
    const txHash = req.params.txHash as string;
    try {
      const result = await kit.operations.refund(0, txHash as `0x${string}`);
      kit.db.markRefunded(txHash, result.refundHash);
      console.log(`[paywall] Refunded ${txHash} -> ${result.refundHash}`);
      res.json({ success: true, refundHash: result.refundHash, amount: result.amount });
    } catch (err) {
      const msg = err instanceof Error ? err.message.slice(0, 100) : 'Unknown error';
      console.error(`[paywall] Refund failed for ${txHash}: ${msg}`);
      res.status(500).json({ error: 'Refund failed' });
    }
  });

  return app;
}
