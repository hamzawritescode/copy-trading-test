import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

type Side = "BUY" | "SELL";
type SymbolCode = "BTCUSDT" | "ETHUSDT" | "SOLUSDT";

type Order = {
  followerId: string;
  leaderTradeId: string;
  symbol: SymbolCode;
  side: Side;
  quantity: number;
  estimatedFillPrice: number;
  notional: number;
  marginRequired: number;
  status: "ACCEPTED" | "REJECTED";
  rejectionReason?: string;
};

type Follower = {
  id: string;
  name: string;
  equity: number;
  availableBalance: number;
  copyRatio: number;
  maxLeverage: number;
  maxNotionalPerTrade: number;
  allowedSymbols: SymbolCode[];
};

const API_URL = "http://localhost:4000/api";

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);

const formatQuantity = (value: number) => Number(value.toFixed(8)).toString();

function App() {
  const [followers, setFollowers] = useState<Follower[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [form, setForm] = useState({
    symbol: "BTCUSDT" as SymbolCode,
    side: "BUY" as Side,
    quantity: 0.5,
    price: 68000,
    leverage: 5,
    slippage: 15,
  });
  const [error, setError] = useState("");
  const [followerMap, setFollowerMap] = useState<Record<string, string>>({});

  useEffect(() => {
    fetch(`${API_URL}/followers`)
      .then((res) => res.json())
      .then((data: Follower[]) => {
        setFollowers(data);
        setFollowerMap(Object.fromEntries(data.map((f) => [f.id, f.name])));
      });
  }, []);

  async function simulateTrade(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    const response = await fetch(`${API_URL}/simulate-copy`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        symbol: form.symbol,
        side: form.side,
        quantity: form.quantity,
        price: form.price,
        leverage: form.leverage,
        slippage: form.slippage,
      }),
    });
    const payload = await response.json();
    if (!response.ok) {
      setError(payload.error || "Please check quantity, price, and leverage.");
      return;
    }
    setOrders(payload.orders);
  }

  const acceptedCount = orders.filter((o) => o.status === "ACCEPTED").length;
  const rejectedCount = orders.filter((o) => o.status === "REJECTED").length;
  const totalNotional = orders
    .filter((o) => o.status === "ACCEPTED")
    .reduce((sum, o) => sum + o.notional, 0);
  const totalMargin = orders
    .filter((o) => o.status === "ACCEPTED")
    .reduce((sum, o) => sum + o.marginRequired, 0);
  const rejectionReasons: Record<string, number> = {};
  orders
    .filter((o) => o.status === "REJECTED")
    .forEach((o) => {
      if (o.rejectionReason)
        rejectionReasons[o.rejectionReason] =
          (rejectionReasons[o.rejectionReason] || 0) + 1;
    });

  return (
    <main className="page">
      <section className="hero">
        <p className="eyebrow">Demo</p>
        <h1>Copy Trading Simulator</h1>
        <p className="subtitle prose prose-2xl">
          Run a leader order and review copied follower orders with risk checks.
        </p>
      </section>

      <section className="grid">
        <form className="card" onSubmit={simulateTrade}>
          <h2>Leader trade</h2>
          <label>
            Symbol
            <select
              value={form.symbol}
              onChange={(e) =>
                setForm({ ...form, symbol: e.target.value as SymbolCode })
              }
            >
              <option>BTCUSDT</option>
              <option>ETHUSDT</option>
              <option>SOLUSDT</option>
            </select>
          </label>
          <label>
            Side
            <select
              value={form.side}
              onChange={(e) =>
                setForm({ ...form, side: e.target.value as Side })
              }
            >
              <option>BUY</option>
              <option>SELL</option>
            </select>
          </label>
          <label>
            Quantity
            <input
              type="number"
              step="0.001"
              value={form.quantity}
              onChange={(e) =>
                setForm({ ...form, quantity: Number(e.target.value) })
              }
            />
          </label>
          <label>
            Price
            <input
              type="number"
              step="0.01"
              value={form.price}
              onChange={(e) =>
                setForm({ ...form, price: Number(e.target.value) })
              }
            />
          </label>
          <label>
            Leverage
            <input
              type="number"
              value={form.leverage}
              onChange={(e) =>
                setForm({ ...form, leverage: Number(e.target.value) })
              }
            />
          </label>
          <label>
            Slippage (bps)
            <input
              type="number"
              value={form.slippage}
              onChange={(e) =>
                setForm({ ...form, slippage: Number(e.target.value) })
              }
            />
            <small>Basis points applied to fill price</small>
          </label>
          <button>Run simulation</button>
          {error && <p className="error">{error}</p>}
        </form>

        <section className="card">
          <h2>Followers</h2>
          <div className="followers">
            {followers.map((follower) => (
              <article key={follower.id} className="follower">
                <strong>{follower.name}</strong>
                <span>
                  {formatCurrency(follower.availableBalance)} · Ratio{" "}
                  {follower.copyRatio}x
                </span>
                <span>
                  Max lev {follower.maxLeverage}x · Max trade{" "}
                  {formatCurrency(follower.maxNotionalPerTrade)}
                </span>
              </article>
            ))}
          </div>
        </section>
      </section>

      <section className="card table-card">
        <h2>Copied orders</h2>
        <table>
          <thead>
            <tr>
              <th>Follower</th>
              <th>Symbol</th>
              <th>Side</th>
              <th>Qty</th>
              <th>Fill price</th>
              <th>Notional</th>
              <th>Margin</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <tr
                key={`${order.followerId}-${order.leaderTradeId}`}
                className={`order-row order-${order.status.toLowerCase()}`}
              >
                <td>{followerMap[order.followerId] || order.followerId}</td>
                <td>{order.symbol}</td>
                <td>{order.side}</td>
                <td>{formatQuantity(order.quantity)}</td>
                <td>${order.estimatedFillPrice}</td>
                <td>{formatCurrency(order.notional)}</td>
                <td>{formatCurrency(order.marginRequired)}</td>
                <td>
                  <span
                    className={
                      order.status === "ACCEPTED" ? "accepted" : "rejected"
                    }
                  >
                    {order.status}
                  </span>
                  {order.rejectionReason && (
                    <small title={order.rejectionReason}>
                      {order.rejectionReason}
                    </small>
                  )}
                </td>
              </tr>
            ))}
            {orders.length === 0 && (
              <tr>
                <td colSpan={8} className="empty">
                  No results yet. Run a simulation.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      {orders.length > 0 && (
        <section className="card summary-card">
          <h2>Summary</h2>
          <div className="summary-grid">
            <div className="summary-item">
              <span className="label">Accepted</span>
              <span className="value">
                {acceptedCount}/{orders.length}
              </span>
            </div>
            <div className="summary-item">
              <span className="label">Rejected</span>
              <span className="value">
                {rejectedCount}/{orders.length}
              </span>
            </div>
            <div className="summary-item">
              <span className="label">Total notional</span>
              <span className="value">{formatCurrency(totalNotional)}</span>
            </div>
            <div className="summary-item">
              <span className="label">Total margin</span>
              <span className="value">{formatCurrency(totalMargin)}</span>
            </div>
          </div>
          {Object.keys(rejectionReasons).length > 0 && (
            <div className="rejection-reasons">
              <h3>Rejection breakdown</h3>
              <ul>
                {Object.entries(rejectionReasons).map(([reason, count]) => (
                  <li key={reason}>
                    {reason}: {count}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
