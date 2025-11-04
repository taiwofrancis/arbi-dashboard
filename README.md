# Arbitrage Dashboard (Capstone)

This project monitors the same crypto asset across multiple global exchanges (spot and futures), in real time, and surfaces price differences that can be used for arbitrage / basis trades.

## Key Features
- Live best bid / best ask from:
  - Binance Spot
  - Binance USDT Perpetual Futures
  - Bybit Spot
  - Bybit USDT Perpetual Futures
  - Coinbase Spot (USD pairs)
  - Kraken Futures Perpetuals (USD pairs)
- WebSocket connections to each exchange (no polling).
- All quotes normalized into a unified format like `BTC-USDT` or `BTC-USD`.
- Backend computes:
  - Cross-exchange spot spreads (buy cheap here, sell high there)
  - Futures vs spot premium (basis)
- Frontend React dashboard auto-updates ~2x per second using Socket.IO.
- Table sorts each symbol group by **highest bid first** so you instantly see who will currently pay the most.

## Architecture
### Backend (`/backend`)
- Node.js + Express for API
- Socket.IO for pushing live updates to frontend
- `ws` for exchange WebSocket feeds
- `priceStore.js` keeps latest quotes in memory and calculates spreads

### Frontend (`/frontend`)
- React + Vite
- socket.io-client subscribes to server updates
- `LiveTable` shows the per-exchange prices, sorted (best bidders first)
- `SpreadPanel` shows calculated arbitrage spreads and futures/spot premiums

## Running Locally

### 1. Backend
```bash
cd arbi-dashboard/backend
npm install
npm run start
# backend runs on http://localhost:4000
