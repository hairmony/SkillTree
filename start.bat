@echo off
start "Backend" cmd /k "cd backend && uvicorn main:app --reload"
start "Frontend" cmd /k "cd frontend && npm run dev"