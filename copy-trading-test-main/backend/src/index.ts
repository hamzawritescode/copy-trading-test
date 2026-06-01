import cors from "cors";
import express from "express";
import { z } from "zod";
import { buildCopiedOrder } from "./copyEngine.js";
import { followers, leaderTrades } from "./fixtures.js";
import { LeaderTrade } from "./types.js";

const app = express();
app.use(cors());
app.use(express.json());

const tradeSchema = z.object({
  symbol: z.enum(["BTCUSDT", "ETHUSDT", "SOLUSDT"]),
  side: z.enum(["BUY", "SELL"]),
  quantity: z.number().positive("Quantity must be greater than zero"),
  price: z.number().positive("Price must be greater than zero"),
  leverage: z
    .number()
    .int()
    .min(1, "Leverage must be at least 1x")
    .max(125, "Leverage cannot exceed 125x"),
  slippage: z.number().nonnegative("Slippage must be non-negative").optional().default(15),
});

app.get("/api/leader-trades", (_req, res) => res.json(leaderTrades));
app.get("/api/followers", (_req, res) => res.json(followers));

app.post("/api/simulate-copy", (req, res) => {
  const parsed = tradeSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: "Invalid trade parameters",
      details: parsed.error.flatten().fieldErrors,
    });
  }

  const { slippage, ...tradeData } = parsed.data;
  const trade: LeaderTrade = {
    id: `lt_${Date.now()}`,
    timestamp: new Date().toISOString(),
    ...tradeData,
  };

  const orders = followers.map((follower) =>
    buildCopiedOrder(trade, follower, slippage),
  );
  return res.json({ trade, orders });
});

const port = Number(process.env.PORT ?? 4000);
app.listen(port, () =>
  console.log(`Copy trading test API running on http://localhost:${port}`),
);
