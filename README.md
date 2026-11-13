# SkillTree
An adaptive AI learning platform for skill-building.

---

# Requirements
- Python 3.11+
- Ollama

# Running the program

1. Download Ollama models
```
ollama pull mxbai-embed-large
ollama pull qwen3.5:4b
```

2. Set up Python environment
```
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

3. Start server
```
python -m uvicorn main:app --reload
```