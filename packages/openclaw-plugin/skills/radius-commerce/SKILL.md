# Radius Commerce

You can participate in agent-to-agent commerce on Radius Network. This skill teaches you how to negotiate, verify payments, and build trust with other agents.

## Agent-to-Agent Commerce

### Offering a Service
When you have a capability another agent wants to pay for:

1. **Advertise your price:** State what you offer and the cost (e.g., "Code review: $0.01 per file")
2. **Generate a payment request:** Use `radius_request_payment` with the agreed amount
3. **Wait for payment:** Use `radius_monitor_payments` to verify receipt
4. **Deliver the service:** Only deliver after payment is confirmed on-chain
5. **Provide proof:** Share the transaction hash for the record

### Purchasing a Service
When you need to pay another agent:

1. **Check the price:** Confirm what you're paying for and how much
2. **Verify your balance:** Use `radius_check_balance`
3. **Send payment:** Use `radius_send_payment` to the agent's address
4. **Share proof:** Provide the transaction hash to the other agent
5. **Receive the service:** Wait for the agent to deliver

## Payment Verification

Before delivering a service, always verify:
- The payment transaction hash exists on-chain
- The amount matches the agreed price
- The payment was sent to YOUR address (not a different one)
- The payment is for the correct asset (USD vs SBC)

Use `radius_monitor_payments` to check your recent incoming transactions.

## Micropayment Patterns

### Pay-per-query
For cheap, frequent interactions ($0.001 or less):
- Accept payment and deliver immediately — the cost of fraud is lower than the cost of verification delay
- Track counterparty reliability over time

### Metered access
For ongoing services:
- Charge a small amount per unit of work (per message, per API call, per minute)
- Use `radius_send_payment` for each unit
- Both parties track the running total

### Streaming payments
For continuous services:
- Send periodic small payments (e.g., $0.001 every 30 seconds)
- Service continues as long as payments flow
- Either party can stop at any time

## Trust and Cooperation Strategies

### Tit-for-tat
Mirror the other agent's behavior:
- If they cooperate (deliver after payment), continue buying
- If they defect (don't deliver), stop buying from them
- Simple, effective, forgiving

### Cautious
Gradually increase trust:
- Start with the smallest possible transaction
- Increase amounts as trust builds
- Never risk more than you can afford to lose

### Generous
Build goodwill:
- Occasionally tip above the asking price
- Be the first to cooperate in new relationships
- Reputation is valuable for future commerce

## x402 Compatibility

The x402 protocol uses HTTP 402 Payment Required responses. When you encounter a 402 response:

1. Read the payment requirements from the response headers
2. Use `radius_send_payment` to pay the required amount
3. Retry the request with the payment proof
4. The server verifies payment and delivers the content

## Best Practices

1. **Start small:** Begin relationships with micropayments to establish trust
2. **Track counterparties:** Remember which agents deliver and which don't
3. **Be transparent:** Always disclose costs before charging
4. **Handle refunds gracefully:** Use `radius_refund` if you can't deliver
5. **Log transactions:** Keep records for dispute resolution
