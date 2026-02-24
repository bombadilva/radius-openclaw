import { createAgentWallet, type AgentWalletKit } from '@bombadilva/agent-wallet';
import { createSendPaymentTool } from './tools/send-payment.js';
import { createCheckBalanceTool } from './tools/check-balance.js';
import { createGetAddressTool } from './tools/get-address.js';
import { createMonitorPaymentsTool } from './tools/monitor-payments.js';
import { createRequestPaymentTool } from './tools/request-payment.js';
import { createRefundTool } from './tools/refund.js';
import { createSwapTool } from './tools/swap.js';
import { PaymentWatcherService } from './services/payment-watcher.js';

// Plugin-scoped state
let kit: AgentWalletKit | null = null;

const TOOL_NAMES = [
  'radius_send_payment',
  'radius_check_balance',
  'radius_get_address',
  'radius_monitor_payments',
  'radius_request_payment',
  'radius_refund',
  'radius_swap',
];

const radiusPlugin = {
  id: 'radius-payments',
  name: 'Radius Payments',
  description: 'Radius stablecoin payment tools for OpenClaw agents',
  version: '0.1.0',

  configSchema: {
    jsonSchema: {
      type: 'object',
      properties: {
        masterKey: { type: 'string', description: '0x-prefixed 32-byte hex master key' },
        agentId: { type: 'string', description: 'Unique agent deployment identifier' },
        network: { type: 'string', enum: ['testnet', 'mainnet'], default: 'testnet' },
        rpcUrl: { type: 'string', description: 'Custom RPC URL (optional)' },
        dataDir: { type: 'string', default: './data' },
        walletIndex: { type: 'number', default: 0 },
        pollInterval: { type: 'number', default: 2000 },
      },
      required: ['masterKey', 'agentId'],
    },
    uiHints: {
      masterKey: { sensitive: true, label: 'Master Key', help: 'HD wallet root secret' },
      agentId: { label: 'Agent ID' },
      network: { label: 'Network' },
    },
  },

  register(api: any) {
    const cfg = api.pluginConfig ?? {};
    const masterKey = (cfg.masterKey ?? process.env.MASTER_KEY) as `0x${string}`;
    const agentId = (cfg.agentId ?? process.env.RADIUS_AGENT_ID) as string;
    const network = (cfg.network ?? process.env.RADIUS_NETWORK ?? 'testnet') as 'testnet' | 'mainnet';
    const walletIndex = (cfg.walletIndex ?? 0) as number;

    if (!masterKey) {
      api.logger.error('Radius plugin: masterKey is required (set in config or MASTER_KEY env)');
      return;
    }
    if (!agentId) {
      api.logger.error('Radius plugin: agentId is required (set in config or RADIUS_AGENT_ID env)');
      return;
    }

    // Initialize the wallet kit
    kit = createAgentWallet({
      masterKey,
      agentId,
      network,
      rpcUrl: cfg.rpcUrl as string | undefined,
      dataDir: (cfg.dataDir as string) ?? './data',
      pollInterval: (cfg.pollInterval as number) ?? 2000,
    });

    // Register wallet in database
    const address = kit.wallet.deriveAddress(walletIndex);
    kit.db.upsertWallet(agentId, walletIndex, address);
    api.logger.info(`Radius wallet: ${address} on ${kit.chainClient.chain.name}`);

    // Register all tools via factory
    api.registerTool(
      () => [
        createSendPaymentTool(kit!, walletIndex),
        createCheckBalanceTool(kit!, walletIndex),
        createGetAddressTool(kit!, walletIndex),
        createMonitorPaymentsTool(kit!, walletIndex),
        createRequestPaymentTool(kit!, walletIndex),
        createRefundTool(kit!, walletIndex),
        createSwapTool(kit!, walletIndex),
      ],
      { names: TOOL_NAMES },
    );

    // Register payment watcher service
    const watcher = new PaymentWatcherService(kit, walletIndex, {
      emitEvent: () => {},
      log: (level, msg) => api.logger[level]?.(msg) ?? api.logger.info(msg),
    });

    api.registerService({
      id: 'radius-payment-watcher',
      start: () => watcher.start(),
      stop: () => watcher.stop(),
    });

    // Hook: log payment info on agent start
    api.on('before_agent_start', async () => {
      if (!kit) return;
      try {
        const balance = await kit.operations.getBalance(address);
        api.logger.info(`Radius balance: ${balance.usd} USD, ${balance.sbc} SBC`);
      } catch {
        // Silently skip if RPC is unreachable during startup
      }
    });

    api.logger.info('Radius payment plugin loaded');
  },
};

export default radiusPlugin;
