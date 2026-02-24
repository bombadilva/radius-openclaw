// ── Channel abstraction ─────────────────────────────────────────────
// Each channel (email, Telegram, Discord, Matrix, etc.) implements this
// interface so the paywall processor remains channel-agnostic.

export interface Message {
  id: string;
  senderId: string;
  senderName?: string;
  content: string;
  channel: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

export interface Channel {
  name: string;
  fetchMessages(): Promise<Message[]>;
  deliverMessage(msg: Message): Promise<void>;
  sendPaymentRequest(senderId: string, address: string, amount: string, asset: string): Promise<void>;
  quarantineMessage(msg: Message): Promise<void>;
}
