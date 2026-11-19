# SkillTree frontend

A React learning workspace for the supplied SkillTree FastAPI server. Keep the extracted frontend folder beside the existing backend folder.

## Run on Windows

Install Node.js 22 and use the Python environment from the backend setup. Start Ollama and make the two backend models available once:

```powershell
ollama pull mxbai-embed-large
ollama pull qwen3.5:4b
```

Start the server from the backend directory with its dependencies installed:

```powershell
python -m uvicorn main:app --port 8000
```

In a second terminal, from the project directory:

```powershell
cd frontend
npm ci
npm run dev
```

Open http://localhost:5173. The frontend automatically uses the configured API. If the API is unavailable, the existing Linear Algebra sample is available for browsing.

## Use two computers

On the backend computer, start the server with `python -m uvicorn main:app --host 0.0.0.0 --port 8000`. Both computers need network access to that port. In the frontend folder create a file named `.env.local` containing `SKILLTREE_BACKEND=http://YOUR_BACKEND_IP:8000`. Restart the frontend. The browser talks to the frontend's /api proxy, so the backend's existing CORS settings work as supplied.

## Production build and Docker

Run `npm run build` to create dist. For Docker Desktop, run these commands in the frontend folder:

```powershell
docker build -t skilltree-frontend .
docker run --rm -p 5173:80 -e BACKEND_ORIGIN=http://host.docker.internal:8000 skilltree-frontend
```

For a separate backend computer, replace host.docker.internal with its reachable address. Nginx forwards /api requests to BACKEND_ORIGIN. A static-only host can show the sample or use VITE_API_BASE at build time to connect to an independently hosted HTTPS API gateway that allows the frontend origin. The supplied server uses one shared learner and has no account authentication. Use a private network or authenticated gateway for a real workspace.

## Explain the code

| File | Responsibility |
| --- | --- |
| src/main.jsx | Opens the workspace, picks a page from the URL, and keeps the current tree data in React state. |
| src/api.js | Sends JSON requests and loads the graph and quiz history for each tree. |
| src/ui.jsx | Contains shared navigation helpers, icons, tree cards, and status messages. |
| src/pages/Overview.jsx | Builds dashboard totals, searchable tree cards, assessment history, knowledge gaps, and six milestones from the workspace data. |
| src/pages/CreateTree.jsx | Sends the topic, goal, and optional reference text. Polls the returned job ID and opens the finished map. |
| src/pages/Learning.jsx | Arranges concepts by prerequisite depth, draws the edges, loads lessons, and searches retrieved passages. |
| src/pages/Assessment.jsx | Requests questions, saves in-progress choices in the current tab, submits option IDs, and displays graded feedback. |
| src/style.css | Defines the layout, navigation, map, forms, and mobile breakpoints. |
| vite.config.js | Connects the development frontend to the existing API. |

## Walk through the learning loop

1. Open My trees and choose Create tree. The server searches its enabled sources and reports generation progress.
2. Open a node in the map. Locked nodes list prerequisites. Available lessons show objectives, explanations, examples, and the sources returned by the server.
3. Choose three to six questions and submit all answers. The backend grades them, records mastery, and decides which concepts to unlock or add.
4. Read the answer explanations and open a follow-up concept. Scores below 75% may add required review. Higher scores with missed concepts may add optional branches. The server limits branch depth and may skip duplicates.
5. Open Analytics to inspect scored assessments and missed concepts. Achievements are computed from actual progress and results.

The presentation's future-work items, including document uploading and question-by-question difficulty adjustment, are outside this implementation.


## Student experience

The header and sidebar share one display name. My Profile shows it and Settings edits it. The name is saved in this browser under studentName. It does not create a backend account or isolate progress.

Knowledge gaps are grouped by tree, assessed node and missed concept. Hover or focus for lesson context. Expand a row for missed answers available from the latest assessment. Review Topic opens the matching review node or the lesson where the question was assessed.

After grading, the answer review uses the returned graph. Continue prioritizes unlocked required review, then unlocked core concepts along the prerequisite path, then other available branches. Historical reviews use the latest stored answers for that node. The server only returns the pass flag on submission.

| Changed file | Responsibility |
| --- | --- |
| src/main.jsx | Application navigation, shared profile and graded quiz state |
| src/pages/Profile.jsx | Profile dropdown, student identity, name editor |
| src/pages/Overview.jsx | Supplies filtered assessment history to knowledge gaps |
| src/pages/KnowledgeGaps.jsx | Accessible accordion, topic summaries, missed-answer details and review links |
| src/pages/Assessment.jsx | Submission, evaluation feedback and continuation |
| src/learningPath.js | Selects eligible lessons from graph edges, node status and kind |
| src/pages/CreateTree.jsx and src/pages/Learning.jsx | Student-facing unavailable states |
| src/style.css | Responsive profile, tooltip and accordion styles |
| README.md | Setup instructions and a guide to the changes |
