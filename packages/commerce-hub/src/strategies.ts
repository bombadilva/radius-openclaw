import { randomInt } from 'node:crypto';

// ── Types ──────────────────────────────────────────────────────────

export interface InteractionOutcome {
  counterparty: string;
  cooperated: boolean;
  amount: string;
  timestamp: number;
}

export interface Strategy {
  name: string;
  shouldCooperate(counterparty: string, history: InteractionOutcome[]): boolean;
  paymentAmount(basePrice: string, counterparty: string, history: InteractionOutcome[]): string;
}

// ── Helpers ────────────────────────────────────────────────────────

function historyWith(counterparty: string, history: InteractionOutcome[]): InteractionOutcome[] {
  return history.filter((h) => h.counterparty === counterparty);
}

function cooperationRate(outcomes: InteractionOutcome[]): number {
  if (outcomes.length === 0) return 1;
  return outcomes.filter((o) => o.cooperated).length / outcomes.length;
}

// ── Strategies ─────────────────────────────────────────────────────

/** Always cooperates regardless of history. */
export const AlwaysCooperate: Strategy = {
  name: 'always-cooperate',
  shouldCooperate: () => true,
  paymentAmount: (basePrice) => basePrice,
};

/** Mirrors the counterparty's last action. Cooperates on first encounter. */
export const TitForTat: Strategy = {
  name: 'tit-for-tat',
  shouldCooperate(counterparty, history) {
    const past = historyWith(counterparty, history);
    if (past.length === 0) return true;
    return past[past.length - 1].cooperated;
  },
  paymentAmount(basePrice, counterparty, history) {
    const past = historyWith(counterparty, history);
    if (past.length === 0) return basePrice;
    const last = past[past.length - 1];
    return last.cooperated ? basePrice : '0';
  },
};

/** Only cooperates when the counterparty has >60% cooperation rate. */
export const Cautious: Strategy = {
  name: 'cautious',
  shouldCooperate(counterparty, history) {
    const past = historyWith(counterparty, history);
    if (past.length < 2) return true;
    return cooperationRate(past) > 0.6;
  },
  paymentAmount(basePrice, counterparty, history) {
    const past = historyWith(counterparty, history);
    const rate = cooperationRate(past);
    const base = parseFloat(basePrice);
    return (base * Math.max(rate, 0.5)).toFixed(2);
  },
};

/** Cooperates probabilistically based on past cooperation rate. */
export const Metered: Strategy = {
  name: 'metered',
  shouldCooperate(counterparty, history) {
    const past = historyWith(counterparty, history);
    const rate = cooperationRate(past);
    return randomInt(100) < rate * 100;
  },
  paymentAmount(basePrice, counterparty, history) {
    const past = historyWith(counterparty, history);
    const rate = cooperationRate(past);
    const base = parseFloat(basePrice);
    return (base * rate).toFixed(2);
  },
};

// ── Registry ───────────────────────────────────────────────────────

const strategies = new Map<string, Strategy>([
  [AlwaysCooperate.name, AlwaysCooperate],
  [TitForTat.name, TitForTat],
  [Cautious.name, Cautious],
  [Metered.name, Metered],
]);

export function getStrategy(name: string): Strategy {
  return strategies.get(name) ?? AlwaysCooperate;
}
