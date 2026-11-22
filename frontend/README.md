# SkillTree frontend

React and Vite provide the learner workspace. The adjacent integrated FastAPI server owns the graph, lessons, assessment records, adaptive concepts and XP.

## Run on Windows

From the SkillTree-Integrated directory, open three PowerShell terminals.

1. In the first terminal, run `ollama serve` if the Ollama desktop service is not already running.
2. In the second terminal, use the existing backend Python environment and run:

   ```powershell
   ollama pull mxbai-embed-large
   ollama pull qwen3.5:4b
   Set-Location .\backend
   python -m pip install -r requirements.txt
   python -m uvicorn main:app --host 127.0.0.1 --port 8000
   ```

3. In the third terminal, use Node.js 22:

   ```powershell
   Set-Location .\frontend
   npm ci
   npm run dev
   ```

Open http://localhost:5173. Use `npm run build` for a production build. Vite forwards `/api` to port 8000. For a separate backend machine, set `SKILLTREE_BACKEND` in the frontend's local environment and restart Vite. For a separately hosted API, set `VITE_API_BASE` at build time and configure the deployment to allow the frontend origin.

Docker Desktop uses the included Nginx proxy:

```powershell
docker build -t skilltree-frontend .
docker run --rm -p 5173:80 -e BACKEND_ORIGIN=http://host.docker.internal:8000 skilltree-frontend
```

## Learning workflow

Choose Create tree and submit a topic. Generation status follows you across the workspace. The current tab keeps the job ID across reloads. Open Tree takes you to the completed map. If the backend loses a running worker, its last reported status may remain running.

Tree cards open the prerequisite map. Select an available concept to study it, a completed one to revise it, or a locked one to see the prerequisites. The dashboard previews the most recently accessed tree. Each lesson includes a collapsible map.

Assessment results show the returned score, XP award, level-up and any follow-up concepts. The full tree highlights those concepts when opened from results. Historical reviews reload the saved answers and added concepts. The backend only returns the XP award, level-up and generation error at submission time.

The dashboard, achievements and profile read the shared learner's XP from the API. Deleting a tree also deletes its quiz history, which can lower the backend XP total. The backend creates a reserved example with ID `demo` at startup. The workspace filters that ID from the tree collection. Global XP always reflects the server's full learner record.

## Code guide

| File | Responsibility |
| --- | --- |
| src/main.jsx | Routes, workspace refresh, grading updates and confirmed deletion |
| src/api.js | API configuration, requests and loading tree graphs and histories |
| src/useTreeJob.js | Creation request, status polling, retries and job recovery |
| src/ConceptMap.jsx | Shared vertical DAG and accessible concept actions |
| src/ui.jsx | Shared tree cards, Create tree action, XP panel and navigation helpers |
| src/pages/Overview.jsx | Dashboard, tree library, analytics and achievements |
| src/pages/CreateTree.jsx | Topic, goal and optional reference text |
| src/pages/Learning.jsx | Source search, lesson content, lesson map and citations |
| src/pages/Assessment.jsx | Quiz drafts, submission, results and follow-up concepts |
| src/pages/KnowledgeGaps.jsx | Aggregated missed concepts and answer review |
| src/pages/Profile.jsx | XP, browser-local display name and settings |
| src/learningPath.js | Next eligible lesson after an assessment |
