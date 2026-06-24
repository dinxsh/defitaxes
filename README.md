# DeFiTaxes

Complete DeFi tax accounting application combining on-chain activity, CEX imports, manual entry, and IRS-compliant tax exports (Form 8949, Schedule D, PDF reports).

## Features

### Data Collection
- **On-chain activity** — Real-time blockchain transactions via GoldRush API
- **CEX imports** — Auto-detect & parse CSV from Coinbase, Binance, Kraken, Gemini
- **Manual entry** — Off-chain transactions, missed events, income entries
- **Multi-wallet** — Consolidate up to 5 wallet addresses into a single tax report

### Tax Calculation
- **FIFO/LIFO/HIFO/ACB** — Selectable cost basis accounting methods
- **Gas fee pro-ration** — Distributed across buy/sell transfers per transaction
- **Wash-sale detection** — IRC §1091 compliance (±30 day window)
- **LP token basis** — FMV-based cost at ADD_LIQUIDITY time
- **Liquidation tracking** — Collateral seizures from lending protocols

### Classification
- **BORROW/REPAY** — Via protocol hints
- **COMPOUND detection** — Yield-bearing receipt tokens
- **Spam filtering** — GoldRush heuristic + is_spam field
- **STAKE detection** — ETH→rETH, MATIC→stMATIC patterns
- **Category overrides** — Per-tx customization with localStorage persistence

### Exports
- **Form 8949 Part I/II** — Short-term & long-term gains/losses
- **Schedule D** — Structured CSV with IRS line numbers
- **PDF report** — Self-contained print-ready summary
- **CSV exports** — Complete transaction ledger with all metadata

### UX
- **Multi-currency** — USD, EUR, GBP, CAD, AUD, CHF, JPY
- **localStorage caching** — 24h TTL with manual refresh
- **Unknown-basis warnings** — Flag zero-cost proceeds
- **Zero-rate warnings** — Flag missing price data
- **Filter & drill-down** — By category, chain, wallet, warning type

## Tech Stack

- **React 19** + TypeScript + Vite
- **GoldRush API** — getAddressActivity, getTokenPrices, balances_v2
- **localStorage** — Result caching, category overrides, manual entries
- **IRS compliance** — Form 8949/Schedule D export formatters

## Supported Chains (12)

Ethereum, Arbitrum, Optimism, Base, Polygon, Avalanche, Gnosis, Fantom, Linea, Scroll, zkSync, BSC

## Getting Started

### Prerequisites
- Node.js 18+
- npm (or pnpm)
- GoldRush API key (get one at https://goldrush.dev/platform/apikey)

### Setup

```bash
npm install
cp .env.example .env
# Edit .env with your GoldRush API key
npm run dev
```

### Commands

```bash
npm run dev      # Start dev server (port 5174)
npm run build    # Production build
npm run preview  # Preview production build
```

## Environment Variables

```env
VITE_GOLDRUSH_API_KEY=your_api_key_here
```

## Project Structure

```
src/
├── components/          # UI components
├── hooks/              # React hooks (processing, caching, imports)
├── lib/
│   ├── taxCalc.ts      # FIFO/LIFO/HIFO/ACB calculation
│   ├── classifier.ts   # Transaction classification logic
│   ├── cexParsers.ts   # CEX CSV format detection
│   ├── exporters.ts    # Form 8949/Schedule D/PDF export
│   ├── protocols.ts    # 40+ DeFi protocol registry
│   ├── stablecoins.ts  # 12-chain stablecoin registry
│   └── utils.ts        # Helpers (formatting, validation, etc)
├── App.tsx             # Main orchestrator
├── style.css           # Global styles + design tokens
└── tokens.css          # Muted brutalist design tokens
api/
└── covalent-proxy.ts   # GoldRush API auth wrapper
```

## Notes

- Results are cached in localStorage with 24h TTL
- Category overrides are persisted per session
- Manual entries and imported lots are stored locally
- No server-side data storage — all processing is client-side

## License

MIT

---

Built with GoldRush API by [Covalent](https://covalenthq.com)
