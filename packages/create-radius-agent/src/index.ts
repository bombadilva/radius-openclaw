#!/usr/bin/env node
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const name = process.argv[2];
if (!name) {
  console.log('Usage: npx create-radius-agent <project-name>');
  process.exit(1);
}

const projectDir = path.resolve(process.cwd(), name);

if (fs.existsSync(projectDir)) {
  console.error(`Error: Directory "${name}" already exists`);
  process.exit(1);
}

console.log(`Creating Radius agent: ${name}\n`);

fs.mkdirSync(projectDir, { recursive: true });

// package.json
fs.writeFileSync(path.join(projectDir, 'package.json'), JSON.stringify({
  name,
  version: '0.1.0',
  private: true,
  type: 'module',
  scripts: {
    build: 'tsc',
    start: 'openclaw gateway run',
    dev: 'tsx src/index.ts',
  },
  dependencies: {
    '@bombadilva/agent-wallet': '^0.1.0',
    '@bombadilva/openclaw-plugin': '^0.1.0',
    dotenv: '^16.4.0',
  },
  devDependencies: {
    '@types/node': '^22.0.0',
    tsx: '^4.19.0',
    typescript: '^5.6.0',
  },
}, null, 2) + '\n');

// tsconfig.json
fs.writeFileSync(path.join(projectDir, 'tsconfig.json'), JSON.stringify({
  compilerOptions: {
    target: 'ES2022',
    module: 'NodeNext',
    moduleResolution: 'NodeNext',
    strict: true,
    esModuleInterop: true,
    outDir: 'dist',
    rootDir: 'src',
    skipLibCheck: true,
  },
  include: ['src/**/*'],
}, null, 2) + '\n');

// .env.example
fs.writeFileSync(path.join(projectDir, '.env.example'), `# Generate a master key: openssl rand -hex 32 | sed 's/^/0x/'
MASTER_KEY=0xYOUR_MASTER_KEY_HERE

# Unique identifier for this agent
AGENT_ID=${name}

# Network: testnet or mainnet
NETWORK=testnet

# Optional: custom RPC URL
# RPC_URL=https://rpc.testnet.radiustech.xyz

# Data directory for SQLite and state
DATA_DIR=./data
`);

// .gitignore
fs.writeFileSync(path.join(projectDir, '.gitignore'), `node_modules/
dist/
data/
.env
*.db
*.db-shm
*.db-wal
`);

// AGENTS.md
fs.writeFileSync(path.join(projectDir, 'AGENTS.md'), `# ${name}

An OpenClaw agent with Radius stablecoin payments.

## Setup

1. \`npm install\`
2. Copy \`.env.example\` to \`.env\` and set your \`MASTER_KEY\`
3. \`npm start\`

## Radius Tools Available

- \`radius_get_address\` — Get your payment address
- \`radius_check_balance\` — Check USD and SBC balance
- \`radius_send_payment\` — Send payments
- \`radius_monitor_payments\` — View incoming payments
- \`radius_request_payment\` — Generate payment requests
- \`radius_refund\` — Refund a payment
- \`radius_swap\` — Swap USD ↔ SBC (when available)

## Skills

This agent has two built-in skills:
- **radius-payments** — How to use Radius payment tools
- **radius-commerce** — Agent-to-agent commerce patterns
`);

// src/index.ts — standalone mode (non-OpenClaw)
fs.mkdirSync(path.join(projectDir, 'src'), { recursive: true });
fs.writeFileSync(path.join(projectDir, 'src', 'index.ts'), `import 'dotenv/config';
import { createAgentWallet } from '@bombadilva/agent-wallet';

const kit = createAgentWallet({
  masterKey: process.env.MASTER_KEY as \`0x\${string}\`,
  agentId: process.env.AGENT_ID || '${name}',
  network: (process.env.NETWORK || 'testnet') as 'testnet' | 'mainnet',
  rpcUrl: process.env.RPC_URL,
  dataDir: process.env.DATA_DIR || './data',
});

async function main() {
  await kit.chainClient.validateChainId();

  const address = kit.wallet.deriveAddress(0);
  const balance = await kit.operations.getBalance(address);

  console.log(\`Agent: \${kit.wallet.agentId}\`);
  console.log(\`Address: \${address}\`);
  console.log(\`Network: \${kit.chainClient.chain.name}\`);
  console.log(\`Balance: \${balance.usd} USD, \${balance.sbc} SBC\`);

  // Start monitoring for payments
  kit.monitor.watch(address, kit.wallet.agentId, 0);
  kit.monitor.on('payment_received', (event) => {
    console.log(\`Payment received: \${event.amount} \${event.asset} from \${event.from}\`);
  });
  kit.monitor.start();

  console.log('Monitoring for payments... (Ctrl+C to stop)');
}

main().catch(console.error);
`);

// openclaw plugin config
fs.writeFileSync(path.join(projectDir, 'openclaw.plugin.json'), JSON.stringify({
  id: name,
  configSchema: {
    type: 'object',
    properties: {
      masterKey: { type: 'string' },
      agentId: { type: 'string' },
      network: { type: 'string', enum: ['testnet', 'mainnet'] },
    },
  },
}, null, 2) + '\n');

console.log(`  Created ${name}/package.json`);
console.log(`  Created ${name}/tsconfig.json`);
console.log(`  Created ${name}/.env.example`);
console.log(`  Created ${name}/.gitignore`);
console.log(`  Created ${name}/AGENTS.md`);
console.log(`  Created ${name}/src/index.ts`);
console.log(`  Created ${name}/openclaw.plugin.json`);
console.log();
console.log('Next steps:');
console.log(`  cd ${name}`);
console.log('  cp .env.example .env');
console.log('  # Edit .env — set MASTER_KEY (openssl rand -hex 32 | sed \'s/^/0x/\')');
console.log('  npm install');
console.log('  npm run dev');
