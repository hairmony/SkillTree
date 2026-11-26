# SKILLTREE
**An gamified adaptive learning platform.**

Pick a topic and a learning goal and SkillTree searches videos, research papers, and web pages and builds your skill tree of concepts in order from basic to advanced. Each node contains a lesson summary, a collection of links to the sources to learn from, and a quiz. Get questions wrong and your skill tree grows to accommodate the concepts you missed. Earn XP and achievements along your journey.

## Features
1. **Data ingestion:** Collects data from multiple sources – YouTube, research papers, Wikipedia, Wikibooks.
2. **Structured Plan:** Structures the topic into a directed acyclic graph connecting concepts together.
3. **RAG Lessons:** Creates a summary using RAG with clickable links to the original source text/videos.
4. **Evaluation Loop:** Quizzes can be created for each node in the tree, with varying difficulty levels for each question.
5. **Adaptive Growth:** The tree is dynamically updated for each wrong answer, to cover the user’s knowledge gaps.

---

## Requirements
- Python 3.11+
- [Ollama](https://ollama.com)
- Node.js 22

## Setting Up

1. Download Ollama models. Use the following commands in a terminal.
```
ollama pull mxbai-embed-large
ollama pull qwen3.5:4b
```
This only needs to be done once.

2. Set up Python environment. Open terminal in the project folder and enter the following.
```
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

3. Set up the frontend, from the project folder:
```
cd frontend
npm install
```

## Running the App

1. Check if Ollama is running (usually starts with Windows).

2. Run the app. Open `start.bat` to run both the backend and frontend. Open either the LOCAL or NETWORK address in the Vite terminal to see the app.

3. Open [http://localhost:5173](http://localhost:5173).

---

## References

**Research that informed the design**
- J. M. Arana et al., "PathBuilder: A Quality-Controlled LLM System for Personalized Learning Pathways," ACL, 2026.
- Z. Sheng et al., "LearnerCoMPASS: Intelligent Tutoring System with Dynamic Cognitive Diagnosis," ACL, 2026.
- P. Lewis et al., "Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks," NeurIPS, 2020.

**Software**
- [Adaptive Knowledge Graph](https://github.com/MysterionRise/adaptive-knowledge-graph)
- [OpenTutor](https://github.com/zijinz456/OpenTutor)

## Authors

[Hariharan Vallath](https://github.com/hairmony/)
[Varshithreddy Ramidi](https://github.com/Varshith09y)

for
COMP-5112 Research Methodology
Lakehead University

## Licences

MIT. See [LICENSE](LICENSE).
