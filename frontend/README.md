# SkillTree Frontend

The web client for SkillTree, built with React 18, TypeScript, Vite, Tailwind CSS, Zustand, and React Flow (@xyflow/react).

---

## Prerequisites

- **Node.js**: v18.0.0 or higher
- **npm**: v9.0.0 or higher
- **SkillTree Backend**: Running on `http://localhost:8000` (FastAPI)

---

## Installation & Quick Start

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

4. Open your browser and navigate to:
   ```text
   http://localhost:5173
   ```

---

## Available Scripts

| Command | Action |
| :--- | :--- |
| `npm run dev` | Start the Vite local development server with Hot Module Replacement (HMR). |
| `npm run build` | Perform TypeScript typechecking (`tsc -b`) and bundle production assets to `dist/`. |
| `npm run preview` | Locally preview the production build from `dist/`. |
| `npm run lint` | Run ESLint across the codebase. |
| `npm run test` | Run the test suite with Vitest. |
| `npm run test:watch` | Run Vitest in interactive watch mode. |
| `npm run test:coverage` | Run tests and generate code coverage reports. |

---

## Backend API Connection

- By default, the development server proxies requests from `/api` to the FastAPI backend running at `http://localhost:8000` (configured in `vite.config.ts`).
- Ensure the FastAPI backend server is started in the `backend/` directory:
  ```bash
  cd ../backend
  python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
  ```
- If running on a different port or host, update the proxy target in `vite.config.ts` or set `VITE_API_BASE_URL` in a local `.env` file.

---

## Project Structure

```text
frontend/
├── public/              # Static assets and brand icons
├── src/
│   ├── api/             # Axios HTTP client and backend API modules
│   ├── app/             # Application entry and route declarations
│   ├── components/      # Shared UI primitives and layout shells
│   ├── features/        # Feature domain pages (Dashboard, Trees, Quiz, Analytics, Achievements, Settings)
│   ├── hooks/           # TanStack React Query custom hooks
│   ├── lib/             # Utility helpers and Tailwind styling merge
│   ├── stores/          # Zustand persistent state stores
│   ├── styles/          # Global Tailwind CSS styles and themes
│   ├── tests/           # Unit and component test suites (Vitest)
│   └── types/           # TypeScript interfaces matching backend models
├── index.html           # HTML entry point
├── package.json         # Dependencies and scripts
├── tailwind.config.js   # Tailwind theme tokens
├── tsconfig.json        # TypeScript configuration
└── vite.config.ts       # Vite bundler and API proxy configuration
```
