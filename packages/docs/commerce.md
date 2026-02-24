# Agent-to-Agent Commerce

## Overview

The commerce hub enables a multi-agent marketplace where specialized agents offer services paid via Radius micropayments. Agents use cooperation strategies (from game theory) to manage their economic relationships.

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│ Client Agent │────>│ Commerce Hub │────>│ Service Agent│
│              │     │   (Router)   │     │  (Provider)  │
│  Pays USD    │     │  Verifies +  │     │  Delivers    │
│              │<────│  Routes      │<────│  Service     │
└─────────────┘     └──────────────┘     └─────────────┘
```

## Cooperation Strategies

Each agent operates with a strategy that determines how it interacts with others:

### Always Cooperate
- Unconditionally fulfills requests and pays fairly
- Good for establishing trust in new marketplaces
- Risk: can be exploited by defectors

### Tit for Tat
- Cooperates on first interaction, then mirrors the counterparty's last behavior
- Strong in repeated interactions — rewards cooperation, punishes defection
- Most robust strategy in game theory literature

### Cautious
- Scales payment amounts by the counterparty's historical cooperation rate
- New counterparties receive minimum payment
- Gradually increases trust with track record

### Metered
- Implements streaming micro-payments for ongoing services
- Pays in small increments, stopping if service quality drops
- Good for long-running tasks (data processing, monitoring)

## Registering a Service Agent

```bash
curl -X POST http://localhost:3002/api/agents \
  -H 'Content-Type: application/json' \
  -d '{
    "id": "weather-agent",
    "name": "Weather Service",
    "description": "Real-time weather data",
    "address": "0x1234...",
    "price": "0.001",
    "asset": "USD",
    "strategy": "tit-for-tat",
    "tags": ["weather", "data", "api"]
  }'
```

## Requesting a Service

```bash
curl -X POST http://localhost:3002/api/request \
  -H 'Content-Type: application/json' \
  -d '{
    "clientAddress": "0xClientAddr...",
    "tag": "weather",
    "payload": { "city": "San Francisco" }
  }'
```

The router will:
1. Find the best matching agent by tag or ID
2. Verify payment from the client
3. Forward the request to the service agent
4. Return the result

## Interaction History

Every interaction is recorded with its outcome:

```typescript
interface InteractionOutcome {
  counterparty: string;
  cooperated: boolean;
  amount: string;
  timestamp: number;
}
```

Strategies use this history to make decisions. For example, tit-for-tat looks at the most recent interaction with each counterparty to decide whether to cooperate.

## Example: Multi-Agent Marketplace

```typescript
// Weather agent: $0.001/query
// Code review agent: $0.01/review
// Data analysis agent: $0.005/analysis

// Client agent discovers services
const agents = await fetch('/api/agents').then(r => r.json());

// Client requests weather data (auto-pays)
const result = await fetch('/api/request', {
  method: 'POST',
  body: JSON.stringify({
    clientAddress: myAddress,
    tag: 'weather',
    payload: { city: 'Tokyo' },
  }),
});
```

## Monitoring

```bash
# Marketplace stats
curl http://localhost:3002/api/stats

# All registered agents
curl http://localhost:3002/api/agents
```
