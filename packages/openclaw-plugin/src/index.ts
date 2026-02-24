import { createAgentWallet, type AgentWalletKit } from '@bombadilva/agent-wallet';
import { sendPaymentTool } from './tools/send-payment.js';
import { checkBalanceTool } from './tools/check-balance.js';
import { getAddressTool } from './tools/get-address.js';
import { monitorPaymentsTool } from './tools/monitor-payments.js';
import { requestPaymentTool } from './tools/request-payment.js';
import { refundTool } from './tools/refund.js';
import { swapTool } from './tools/swap.js';
import { PaymentWatcherService } from './services/payment-watcher.js';
import { onAgentStartup, onPaymentReceived } from './hooks/lifecycle.js';

// ── OpenClaw Plugin API types ───────────────────────────────────────

interface OpenClawPluginApi {
  registerTool(tool: {
    name: string;
    description: string;
    parameters: object;
    handler: (params: Record<string, unknown>) => Promise<unknown>;
  }): void;

  registerService(service: {
    name: string;
    start: () => void;
    stop: () => void;
  }): void;

  registerHook(hook: {
    event: string;
    handler: (...args: unknown[]) => void | Promise<void>;
  }): void;

  getConfig(): Record<string, unknown>;

  emitEvent(name: string, data: unknown): void;

  log(level: 'info' | 'warn' | 'error', message: string): void;

  injectMessage(role: 'system' | 'assistant', content: string): void;
}

// ── Plugin registration ─────────────────────────────────────────────

export function register(api: OpenClawPluginApi): void {
  const config = api.getConfig();

  // Validate required config
  const masterKey = config.masterKey as `0x${string}`;
  const agentId = config.agentId as string;
  const network = (config.network as 'testnet' | 'mainnet') || 'testnet';

  if (!masterKey) throw new Error('Radius plugin: masterKey is required');
  if (!agentId) throw new Error('Radius plugin: agentId is required');

  const walletIndex = (config.walletIndex as number) ?? 0;

  // Initialize agent wallet kit
  const kit = createAgentWallet({
    masterKey,
    agentId,
    network,
    rpcUrl: config.rpcUrl as string | undefined,
    dataDir: config.dataDir as string | undefined,
    pollInterval: config.pollInterval as number | undefined,
  });

  // Register tools
  const tools = [
    sendPaymentTool,
    checkBalanceTool,
    getAddressTool,
    monitorPaymentsTool,
    requestPaymentTool,
    refundTool,
    swapTool,
  ];

  for (const tool of tools) {
    api.registerTool({
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
      handler: tool.createHandler(kit, walletIndex) as (params: Record<string, unknown>) => Promise<unknown>,
    });
  }

  // Register payment watcher service
  const watcher = new PaymentWatcherService(kit, walletIndex, {
    emitEvent: (name, data) => api.emitEvent(name, data),
    log: (level, msg) => api.log(level, msg),
  });

  api.registerService({
    name: 'payment-watcher',
    start: () => watcher.start(),
    stop: () => watcher.stop(),
  });

  // Register lifecycle hooks
  api.registerHook({
    event: 'agent_startup',
    handler: () => onAgentStartup(kit, walletIndex, {
      log: (level, msg) => api.log(level, msg),
      injectMessage: (role, content) => api.injectMessage(role, content),
    }),
  });

  api.registerHook({
    event: 'radius:payment_received',
    handler: (data) => onPaymentReceived(data as {
      from: string; amount: string; asset: string; txHash: string;
    }, {
      log: (level, msg) => api.log(level, msg),
      injectMessage: (role, content) => api.injectMessage(role, content),
    }),
  });

  api.log('info', 'Radius payment plugin registered');
}
