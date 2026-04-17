# dpsim-web

Next.js 15 + TypeScript + Tailwind CSS v4 frontend for the DPsim service stack.

Consumes the REST surface exposed by [`hj801js/dpsim-api`](https://github.com/hj801js/dpsim-api) (see repo docs 13 – 18 for the backend story). Background jobs run in the Python worker at `examples/service-stack/worker.py` — this package only ships the UI.

## Prerequisites

1. Node.js ≥ 20 (Next.js 15 requirement).
2. The backend stack running locally — see `../docs/00_HANDOFF.md` for the Homebrew path.
   - Redis on 6379, RabbitMQ on 5672
   - `file_service_stub.py` on 18080
   - `worker.py` consuming `dpsim-worker-queue`
   - `dpsim-api` on 8000

## First run

```bash
cd /Users/hk/DPsim_hk/dpsim-web
cp .env.local.example .env.local    # edit DPSIM_API_URL if different
npm install
npm run dev                         # http://localhost:3000
```

Open the dashboard, submit a job (defaults: `wscc9`, `DP`, `MNA`, timestep=1, finaltime=2), then click through to its detail page. The chart appears once the worker's CSV upload completes (~1–2 s for the demo topology).

## Scripts

| Command | What |
|---|---|
| `npm run dev` | Next.js dev server on :3000 |
| `npm run build` | Production build |
| `npm start` | Run the production server after build |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | Next.js ESLint |

## Backend wiring

`next.config.ts` rewrites `/api/dpsim/*` → `$DPSIM_API_URL/*`. Set `DPSIM_API_URL` in `.env.local` (default `http://localhost:8000`).

This way the browser only ever talks to the Next.js origin, so no CORS is needed on the Rust backend.

## Layout

```
src/
├── app/
│   ├── layout.tsx
│   ├── globals.css
│   ├── page.tsx                         # dashboard + submit form
│   └── simulations/[id]/page.tsx        # detail + time-series chart
├── components/
│   ├── QueryProvider.tsx                # React Query setup
│   └── TimeSeriesPlot.tsx               # Recharts line chart
└── lib/
    ├── api.ts                           # fetch wrapper + CSV parser
    └── types.ts                         # SimulationForm / Simulation types
```

## Types and OpenAPI

Types in `src/lib/types.ts` currently mirror the Rust structs in `hj801js/dpsim-api:src/routes.rs` by hand. Once the fork is stable, regenerate:

```bash
npx openapi-typescript http://localhost:8000/openapi.json \
  -o src/lib/types.gen.ts
```

## Roadmap pointers

- `docs/19_gui-extension-plan.md` — full direction, backend work needed per milestone
- `docs/17_improvement-backlog.md` — the non-GUI backend work that this frontend naturally pulls forward
- `docs/00_HANDOFF.md` — top-level entry point for the whole project
