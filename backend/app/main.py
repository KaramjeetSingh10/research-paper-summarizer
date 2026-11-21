import uuid
from typing import Optional
from pydantic import BaseModel
from fastapi import FastAPI, UploadFile, File, HTTPException, Header, status
from fastapi.middleware.cors import CORSMiddleware

from app.services.pdf_service import extract_pdf_text
from app.services.summarizer import generate_summary, get_key_sentences
from app.services.rag_service import rag_engine
from app.services.training_service import training_service
from app.services.auth_service import auth_service

app = FastAPI(
    title="ResearchAI - Academic Research Paper Summarizer & RAG Engine",
    description="High-speed, CPU-optimized academic document intelligence API",
    version="2.0.0"
)

# CORS: Allow React dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --- Request Schemas ---
class ChatRequest(BaseModel):
    doc_id: Optional[str] = "default"
    question: str


class TrainRequest(BaseModel):
    doc_id: Optional[str] = "default"
    epochs: Optional[int] = 5
    learning_rate: Optional[float] = 0.05
    domain: Optional[str] = "computer_science"


class LoginRequest(BaseModel):
    email: str
    password: str


class RegisterRequest(BaseModel):
    name: str
    email: str
    password: str
    department: Optional[str] = "Computer Science"


# --- General Endpoints ---
@app.get("/")
def home():
    return {
        "message": "ResearchAI API v2.0 is running!",
        "architecture": "CPU-Optimized RAG + TextRank",
        "docs": "/docs"
    }


@app.get("/health")
def health_check():
    return {"status": "ok", "version": "2.0.0"}


# --- Auth Endpoints ---
@app.post("/api/auth/login")
def login(req: LoginRequest):
    try:
        return auth_service.login(req.email, req.password)
    except ValueError as e:
        raise HTTPException(status_code=401, detail=str(e))


@app.post("/api/auth/register")
def register(req: RegisterRequest):
    try:
        return auth_service.register(req.email, req.name, req.password, req.department or "Research")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/auth/demo")
def demo_login():
    return auth_service.demo_login()


@app.get("/api/auth/me")
def get_me(authorization: Optional[str] = Header(None)):
    token = authorization.replace("Bearer ", "") if authorization else None
    user = auth_service.get_current_user(token)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid or expired session token")
    return user


# --- Document Analysis & Ingestion ---
@app.post("/api/analyze")
async def analyze_pdf(file: UploadFile = File(...)):
    # 1. Extension check
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Please upload a valid .pdf file.")

    # 2. Size limit (15 MB)
    MAX_SIZE = 15 * 1024 * 1024
    content = await file.read(MAX_SIZE + 1)
    if len(content) > MAX_SIZE:
        raise HTTPException(status_code=413, detail="PDF size must not exceed 15 MB.")

    # 3. Magic byte check
    if not content.startswith(b"%PDF-"):
        raise HTTPException(status_code=400, detail="Uploaded file is not a valid PDF document.")

    try:
        # Extract text per page
        extracted_data = extract_pdf_text(content)

        # Generate TextRank summary & key points
        summary = generate_summary(extracted_data["text"], sentence_count=5)
        key_sentences = get_key_sentences(extracted_data["text"], count=8)

        # Automatically index into RAG engine
        doc_id = str(uuid.uuid4())[:8]
        rag_info = rag_engine.index_document(doc_id, extracted_data["page_content"])

        return {
            "success": True,
            "doc_id": doc_id,
            "filename": file.filename,
            "total_pages": extracted_data["pages"],
            "total_words": extracted_data["word_count"],
            "summary": summary,
            "key_sentences": key_sentences,
            "chunks_indexed": rag_info["total_chunks"],
            "sections_detected": rag_info["sections_detected"],
            "extracted_text": extracted_data["text"][:3000]
        }

    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing PDF: {str(e)}")
    finally:
        await file.close()


# --- RAG Q&A Endpoints ---
@app.post("/api/chat")
def chat_with_paper(req: ChatRequest):
    if not req.question or not req.question.strip():
        raise HTTPException(status_code=400, detail="Question cannot be empty.")

    answer_data = rag_engine.answer_question(req.doc_id or "default", req.question.strip())
    return {
        "success": True,
        "question": req.question,
        "answer": answer_data["answer"],
        "status": answer_data["status"],
        "citations": answer_data["citations"],
        "confidence": answer_data["confidence"],
        "suggested_questions": answer_data["suggested_questions"]
    }


@app.get("/api/chat/suggested")
def get_suggested_questions():
    return [
        "What is the main objective of this research?",
        "Which methodology did the authors use?",
        "What dataset was used in the experiments?",
        "What are the major findings of this paper?",
        "What limitations are mentioned by the authors?",
        "What future research is suggested in the conclusion?"
    ]


# --- Model Training & Fine-Tuning Endpoints ---
@app.post("/api/train")
def train_model(req: TrainRequest):
    res = training_service.train_domain_adapter(
        doc_id=req.doc_id or "default",
        epochs=req.epochs or 5,
        learning_rate=req.learning_rate or 0.05,
        domain=req.domain or "computer_science"
    )
    return res


@app.get("/api/train/status")
def get_training_status():
    return training_service.get_status()
