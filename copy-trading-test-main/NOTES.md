# Copy Trading Simulator - Implementation Notes

## ✅ Tasks Completed

### 1. Trading Engine (backend/src/copyEngine.ts)

The copy trading engine is fully implemented with comprehensive business logic:

- **Copy Ratio Scaling**: Follower quantity = leader quantity × follower's copy ratio
- **BUY/SELL Slippage**:
  - BUY: Price increases (worse fill, costs more)
  - SELL: Price decreases (worse fill, get less)
  - Configurable via `applySlippage()` function
- **Exchange Quantity Step Size**: Quantities rounded down to nearest valid step (0.001 for BTC, 0.01 for ETH, 0.1 for SOL)
- **Follower Max Leverage**: Rejects trades if leader's leverage exceeds follower's max leverage
- **Follower Allowed Symbols**: Only copies trades in follower's allowed symbol list
- **Follower Max Notional Per Trade**: Rejects trades exceeding max notional value limit
- **Available Margin Checks**: Verifies margin required ≤ available balance
- **Clear Rejection Reasons**: 8 specific rejection messages for debugging

### 2. API Endpoint (/api/simulate-copy)

The endpoint includes:

- **Input Validation**: Zod schema validates symbol, side, quantity, price, and leverage
- **Error Response**: Returns 400 with detailed field errors on validation failure
- **Realistic Data**: Generates unique trade IDs and ISO timestamps
- **Proper Response Shape**: Returns both the leader trade and array of copied orders

### 3. React UI (frontend/src/App.tsx)

The UI provides clear visibility into copy trading results:

- **Follower Names**: Displays `name` field instead of just IDs
- **Input Validation Feedback**: Shows error messages for invalid inputs
- **Summary Section**: Displays:
  - Accepted/Rejected order counts
  - Total notional value (sum of accepted orders)
  - Total margin required (sum of accepted orders)
- **Order Status Badges**: Visual distinction (green=accepted, red=rejected)
- **Rejection Breakdown**: Lists rejection reasons with counts
- **Follower Cards**: Shows each follower's balance, copy ratio, leverage limits, and max trade size
- **Slippage Explanation**: Label explains "Basis points applied to fill price"

### 4. Backend Tests (backend/src/copyEngine.test.ts)

10 comprehensive tests covering:

- ✅ Slippage calculation (BUY increases price, SELL decreases)
- ✅ Step size rounding (rounds down to exchange requirements)
- ✅ Accepted order with correct calculations (quantity, price, margin)
- ✅ Symbol allowlist validation
- ✅ Leverage limit checking
- ✅ Margin availability validation
- ✅ Notional limit checking
- ✅ Minimum quantity thresholds
- ✅ Full order acceptance with all limits
- ✅ BUY/SELL slippage directional correctness

## Key Trading Knowledge Applied

| Concept             | Implementation                                                     |
| ------------------- | ------------------------------------------------------------------ |
| **Notional Value**  | `quantity × fill price` (lines 37 in copyEngine.ts)                |
| **Margin Required** | `notional ÷ leverage` (line 39)                                    |
| **Slippage**        | BUY: `price × (1 + bps/10000)`, SELL: `price × (1 - bps/10000)`    |
| **Step Size**       | Round down using `Math.floor(quantity / step) × step`              |
| **Risk Checks**     | Sequential checks prevent invalid trades before margin calculation |

## Assumptions Made

1. **Leverage Check Comes First**: If leader leverage exceeds follower max, the trade is rejected even if follower has sufficient balance. This prevents the follower from being forced into a higher-leverage position than their risk tolerance.

2. **Margin Calculation Uses Leader Leverage**: After passing the leverage check, margin is calculated using the leader's leverage level, assuming the follower will copy at the same leverage.

3. **Copy Ratio Applies to All Quantities**: The follower's copy ratio scales the entire position size; there's no partial filling at reduced quantities if it would still violate other limits.

4. **Quantities Round Down**: Exchange step size violations are handled by rounding DOWN (not up), preventing order sizes that exceed actual exchange capabilities.

5. **Slippage Basis Points**: Default 15 bps (~0.15%) is applied to all fill prices. This is configurable per simulation.

6. **No Dynamic Balance Updates**: Each order evaluation is independent; rejected trades don't affect available balance for subsequent orders.

## What Would Be Improved in Production

### Completed Bug Fixes

1. ✅ **Slippage Parameter Integration**: Frontend now sends slippage value to API, which uses it in fill price calculations
   - Backend validates slippage is non-negative
   - Defaults to 15 bps if not provided
   - Frontend properly passes user input to API

### Immediate Priorities

1. **Better Error Messages**: "Invalid trade parameters" could be more specific about which field failed
3. **API Rate Limiting**: No protection against rapid fire requests
4. **Input Sanitization**: Basic validation exists but no XSS or injection protection for production use

### Risk Management

5. **Aggregate Position Limits**: Across all follower trades, limit total notional/margin exposure
6. **Order Queueing**: Implement proper order queue instead of instant simulation
7. **Partial Order Fills**: Support reduced quantity copying when full quantity violates limits
8. **Historical Tracking**: Persist trades to database for compliance and analysis
9. **Position Timeout**: Cancel unfilled orders after X seconds to prevent stale fills

### UI/UX Improvements

10. **Real-time Updates**: WebSocket integration for live follower balance changes
11. **Simulation History**: Remember recent trades and their results
12. **Risk Dashboard**: Show aggregate exposure across all followers
13. **Slippage Visibility**: Show impact of slippage vs leader's actual fill
14. **Mobile Responsiveness**: The 2-column layout breaks on smaller screens

### System Design

15. **Database Schema**: Store followers, trades, orders, and audit logs
16. **Asynchronous Processing**: Queue trade processing through background workers
17. **Monitoring/Alerts**: Alert on unusual rejection patterns or follower balance anomalies
18. **Multi-Asset Support**: Extend beyond crypto to futures, forex, stocks

## Testing Notes

- All 10 unit tests pass ✅
- API integration tested manually with curl ✅
- UI renders correctly with dynamic follower data ✅
- Frontend communicates with backend at `http://localhost:4000/api` ✅

## Running Locally

```bash
# Backend (port 4000)
cd backend && npm install && npm run dev

# Frontend (port 5173)
cd frontend && npm install && npm run dev

# Run tests
cd backend && npm test
```

Visit `http://localhost:5173` in your browser.
