import { CopiedOrder, FollowerAccount, LeaderTrade } from "./types.js";

const SYMBOL_STEP_SIZE: Record<string, number> = {
  BTCUSDT: 0.001,
  ETHUSDT: 0.01,
  SOLUSDT: 0.1,
};

export function applySlippage(
  price: number,
  side: LeaderTrade["side"],
  slippageBps: number,
): number {
  const multiplier =
    side === "BUY" ? 1 + slippageBps / 10_000 : 1 - slippageBps / 10_000;
  return Number((price * multiplier).toFixed(2));
}

export function roundDownToStep(quantity: number, stepSize: number): number {
  return Math.floor(quantity / stepSize) * stepSize;
}

export function buildCopiedOrder(
  trade: LeaderTrade,
  follower: FollowerAccount,
  slippageBps = 15,
): CopiedOrder {
  const estimatedFillPrice = applySlippage(
    trade.price,
    trade.side,
    slippageBps,
  );
  const rawQuantity = trade.quantity * follower.copyRatio;
  const quantity = Number(
    roundDownToStep(rawQuantity, SYMBOL_STEP_SIZE[trade.symbol]).toFixed(8),
  );
  const notional = Number((quantity * estimatedFillPrice).toFixed(2));
  // Margin required = notional / leverage. Higher leverage = less margin needed.
  const marginRequired = Number((notional / trade.leverage).toFixed(2));

  // Check 1: Symbol must be allowed for this follower (no point copying otherwise)
  if (!follower.allowedSymbols.includes(trade.symbol)) {
    return reject(
      trade,
      follower,
      quantity,
      estimatedFillPrice,
      notional,
      marginRequired,
      "Symbol is not enabled for follower",
    );
  }

  // Check 2: Quantity must be positive (prerequisite for notional/margin checks)
  if (quantity <= 0) {
    return reject(
      trade,
      follower,
      quantity,
      estimatedFillPrice,
      notional,
      marginRequired,
      "Quantity is below exchange minimum step",
    );
  }

  // Check 3: Leader leverage must not exceed follower's risk tolerance
  if (trade.leverage > follower.maxLeverage) {
    return reject(
      trade,
      follower,
      quantity,
      estimatedFillPrice,
      notional,
      marginRequired,
      "Leader leverage exceeds follower risk limit",
    );
  }

  // Check 4: Trade notional value cannot exceed follower's per-trade limit
  if (notional > follower.maxNotionalPerTrade) {
    return reject(
      trade,
      follower,
      quantity,
      estimatedFillPrice,
      notional,
      marginRequired,
      "Trade notional exceeds follower limit",
    );
  }

  // Check 5: Required margin cannot exceed available balance
  if (marginRequired > follower.availableBalance) {
    return reject(
      trade,
      follower,
      quantity,
      estimatedFillPrice,
      notional,
      marginRequired,
      "Insufficient available margin",
    );
  }

  return {
    followerId: follower.id,
    leaderTradeId: trade.id,
    symbol: trade.symbol,
    side: trade.side,
    quantity,
    estimatedFillPrice,
    notional,
    marginRequired,
    status: "ACCEPTED",
  };
}

function reject(
  trade: LeaderTrade,
  follower: FollowerAccount,
  quantity: number,
  estimatedFillPrice: number,
  notional: number,
  marginRequired: number,
  rejectionReason: string,
): CopiedOrder {
  return {
    followerId: follower.id,
    leaderTradeId: trade.id,
    symbol: trade.symbol,
    side: trade.side,
    quantity,
    estimatedFillPrice,
    notional,
    marginRequired,
    status: "REJECTED",
    rejectionReason,
  };
}

export function buildOrdersForTrade(
  trade: LeaderTrade,
  followers: FollowerAccount[],
): CopiedOrder[] {
  return followers.map((follower) => buildCopiedOrder(trade, follower));
}
