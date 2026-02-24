# Radius Payments

You have access to Radius Network, a stablecoin-native blockchain for AI agent micropayments. Use the following tools to manage payments.

## Network Overview

- **Native currency:** USD (18 decimals) — the chain's native token IS a stablecoin
- **SBC token:** ERC-20 stablecoin (6 decimals) at `0x33ad9e4bd16b69b5bfded37d8b5d9ff9aba014fb`
- **Testnet chain ID:** 72344
- **Mainnet chain ID:** 723
- **Transaction cost:** ~$0.0000001 per transaction
- **Finality:** Sub-second
- **TPS:** 2.5M

## Available Tools

### `radius_get_address`
Get your payment address. Use this when someone asks for your wallet address or when you need to share where to send payments.

### `radius_check_balance`
Check your wallet balance (both USD and SBC). Use this to verify funding before sending or to report your current balance.

### `radius_send_payment`
Send USD or SBC to an address. Always confirm the amount and recipient with the user before sending.
- For micropayments (< $0.01): send without confirmation
- For small payments ($0.01 - $1.00): confirm once
- For large payments (> $1.00): confirm with amount and address

### `radius_monitor_payments`
List recent incoming payments. Use this to check if a payment has been received or to show payment history.

### `radius_request_payment`
Generate a payment request with your address and amount. Share this when you need to be paid.

### `radius_refund`
Refund a previously received payment. Requires the original transaction hash.

### `radius_swap`
Swap between USD and SBC (when available).

## Security Rules

1. **Never log or display private keys** — the wallet system handles keys automatically
2. **Confirm large payments** — always verify amount and recipient for payments > $1.00
3. **Check balance before sending** — ensure sufficient funds before attempting a transfer
4. **Verify addresses** — Ethereum addresses should be 42 characters starting with 0x
5. **Error messages** — never expose internal errors to users; provide helpful guidance instead

## Error Handling

- **Insufficient balance:** Tell the user their balance and how much more they need
- **Invalid address:** Ask the user to double-check the recipient address
- **Network error:** Suggest trying again in a moment; the Radius network is highly available
- **Transaction failed:** Report the failure and suggest checking the address and amount

## Common Patterns

### Receiving payment for a service
1. Use `radius_request_payment` to generate a payment request
2. Share the address and amount with the payer
3. Use `radius_monitor_payments` to check if payment arrived
4. Deliver the service once payment is confirmed

### Paying for another agent's service
1. Use `radius_check_balance` to ensure sufficient funds
2. Use `radius_send_payment` to send the required amount
3. Share the transaction hash as proof of payment
