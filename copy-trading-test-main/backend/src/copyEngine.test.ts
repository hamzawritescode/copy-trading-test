import { describe, expect, it } from "vitest";
import {
  applySlippage,
  buildCopiedOrder,
  roundDownToStep,
} from "./copyEngine.js";
import { FollowerAccount, LeaderTrade } from "./types.js";

const follower: FollowerAccount = {
  id: "f_test",
  name: "Test Follower",
  equity: 10000,
  availableBalance: 5000,
  copyRatio: 0.5,
  maxLeverage: 5,
  maxNotionalPerTrade: 10000,
  allowedSymbols: ["BTCUSDT", "ETHUSDT"],
};

const trade: LeaderTrade = {
  id: "lt_test",
  symbol: "BTCUSDT",
  side: "BUY",
  quantity: 0.1234,
  price: 68000,
  leverage: 5,
  timestamp: new Date().toISOString(),
};

describe("copy trading engine", () => {
  it("applies worse price slippage for BUY and SELL", () => {
    expect(applySlippage(100, "BUY", 50)).toBe(100.5);
    expect(applySlippage(100, "SELL", 50)).toBe(99.5);
  });

  it("rounds quantities down to exchange step size", () => {
    expect(roundDownToStep(0.1239, 0.001)).toBe(0.123);
    expect(roundDownToStep(5.678, 0.1)).toBe(5.6000000000000005);
  });

  it("creates an accepted copied order with proportional quantity and margin", () => {
    const order = buildCopiedOrder(trade, follower, 10);
    expect(order.status).toBe("ACCEPTED");
    expect(order.quantity).toBe(0.061);
    expect(order.estimatedFillPrice).toBe(68068);
    expect(order.marginRequired).toBeCloseTo(830.43, 2);
  });

  it("rejects trades where the symbol is not allowed", () => {
    const order = buildCopiedOrder({ ...trade, symbol: "SOLUSDT" }, follower);
    expect(order.status).toBe("REJECTED");
    expect(order.rejectionReason).toContain("Symbol");
  });

  it("rejects trades above follower leverage limits", () => {
    const order = buildCopiedOrder({ ...trade, leverage: 20 }, follower);
    expect(order.status).toBe("REJECTED");
    expect(order.rejectionReason).toContain("leverage");
  });

  it("rejects trades requiring more margin than available balance", () => {
    const lowBalanceFollower = { ...follower, availableBalance: 10 };
    const order = buildCopiedOrder(trade, lowBalanceFollower);
    expect(order.status).toBe("REJECTED");
    expect(order.rejectionReason).toContain("margin");
  });

  it("rejects trades with notional exceeding follower limit", () => {
    const lowNotionalFollower = { ...follower, maxNotionalPerTrade: 1000 };
    const order = buildCopiedOrder(trade, lowNotionalFollower);
    expect(order.status).toBe("REJECTED");
    expect(order.rejectionReason).toContain("notional");
  });

  it("rejects trades with quantity below exchange minimum step", () => {
    const tinyQuantityFollower = { ...follower, copyRatio: 0.00001 };
    const order = buildCopiedOrder(trade, tinyQuantityFollower);
    expect(order.status).toBe("REJECTED");
    expect(order.rejectionReason).toContain("step");
  });

  it("accepts orders within all limits with proper calculations", () => {
    const aggressiveFollower = {
      id: "f_aggressive",
      name: "Aggressive",
      equity: 100000,
      availableBalance: 80000,
      copyRatio: 2.0,
      maxLeverage: 10,
      maxNotionalPerTrade: 500000,
      allowedSymbols: ["BTCUSDT", "ETHUSDT", "SOLUSDT"],
    };
    const order = buildCopiedOrder(trade, aggressiveFollower, 10);
    expect(order.status).toBe("ACCEPTED");
    expect(order.quantity).toBe(0.246); // 0.1234 * 2.0 = 0.2468, rounded down to 0.001 step = 0.246
    expect(order.notional).toBeGreaterThan(0);
    expect(order.marginRequired).toBeGreaterThan(0);
  });

  it("applies correct slippage in fill price for both BUY and SELL", () => {
    const buyTrade = { ...trade, side: "BUY" as const };
    const sellTrade = { ...trade, side: "SELL" as const };
    const buyOrder = buildCopiedOrder(buyTrade, follower, 10);
    const sellOrder = buildCopiedOrder(sellTrade, follower, 10);

    expect(buyOrder.estimatedFillPrice).toBeGreaterThan(trade.price);
    expect(sellOrder.estimatedFillPrice).toBeLessThan(trade.price);
  });
});
