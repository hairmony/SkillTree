# SKILLTREE
An adaptive AI learning platform for skill-building.

---

## Requirements
- Python 3.11+
- Ollama

## Running the program

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

3. Run the app. Open `start.bat` to run both the backend and frontend. Open either the LOCAL or NETWORK address in the Vite terminal to see the app.
