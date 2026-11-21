# Academic Research Paper Summarizer

A full-stack NLP application to upload, extract, and summarize academic research papers.

## Tech Stack
| Layer | Technology |
|-------|-----------|
| Frontend | React + Vite |
| Styling | Custom CSS (Navy/Blue theme) |
| Backend | FastAPI (Python) |
| PDF Extraction | PyMuPDF (fitz) |
| Summarization | Sumy (TextRank) |
| NLP Tokenizer | NLTK |

## Project Structure
```
research-paper-summarizer/
├── backend/
│   ├── app/
│   │   ├── main.py              ← FastAPI app + routes
│   │   ├── services/
│   │   │   ├── pdf_service.py   ← PDF text extraction
│   │   │   └── summarizer.py    ← TextRank summarization
│   │   └── models/
│   ├── venv/                    ← Python virtual environment
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── App.jsx              ← Main React component
│   │   └── App.css              ← Styling
│   └── package.json
└── uploads/                     ← (for future file storage)
```

## Setup & Run

### 🚀 One-Click Run (Recommended)
Double-click **`run.bat`** in the project root!  
It automatically:
1. Starts the FastAPI backend on `http://127.0.0.1:8000`
2. Starts the React Vite frontend on `http://localhost:5173`
3. Opens `http://localhost:5173` in your default browser

To stop all servers at once, double-click **`stop.bat`**.

### Manual Run

#### Backend
```powershell
cd backend
.\venv\Scripts\Activate.ps1
uvicorn app.main:app --reload
```
Runs at: http://127.0.0.1:8000
API Docs: http://127.0.0.1:8000/docs

#### Frontend
```powershell
cd frontend
npm run dev
```
Runs at: http://localhost:5173

## First-Time Setup (run once)

### Backend dependencies
```powershell
cd backend
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install fastapi "uvicorn[standard]" python-multipart pymupdf sumy nltk
python -c "import nltk; nltk.download('punkt'); nltk.download('punkt_tab')"
pip freeze > requirements.txt
```

### Frontend dependencies
```powershell
cd frontend
npm create vite@latest . -- --template react
npm install
npm install axios
```

## Upcoming Features
- [ ] BART / LED abstractive summarization
- [ ] Keyword extraction
- [ ] Research methodology detection
- [ ] SQLite paper history
- [ ] RAG chatbot for paper Q&A
- [ ] OCR support for scanned PDFs
- [ ] Paper comparison mode
