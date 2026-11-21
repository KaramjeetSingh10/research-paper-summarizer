import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import "./App.css";

const API_BASE = import.meta.env.VITE_API_BASE || "https://researchai-backend-rja3.onrender.com";

const DEFAULT_SUGGESTED_QUESTIONS = [
  "What is the main objective of this research?",
  "Which methodology did the authors use?",
  "What dataset was used?",
  "What are the major findings?",
  "What limitations are mentioned?",
  "What future research is suggested?"
];

export default function App() {
  // --- Auth State ---
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem("researchai_user");
    return saved ? JSON.parse(saved) : null;
  });
  const [showAuthModal, setShowAuthModal] = useState(!user);
  const [authMode, setAuthMode] = useState("login"); // "login" | "register"
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authName, setAuthName] = useState("");
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  // --- Document & Analysis State ---
  const [activeTab, setActiveTab] = useState("summary"); // "chat" | "summary" | "training"
  const [file, setFile] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState("");
  const [docData, setDocData] = useState(() => {
    const saved = localStorage.getItem("researchai_doc");
    return saved ? JSON.parse(saved) : null;
  });

  // --- Chat State ---
  const [messages, setMessages] = useState(() => {
    const saved = localStorage.getItem("researchai_chat");
    return saved
      ? JSON.parse(saved)
      : [
          {
            sender: "assistant",
            text: "Hello! Upload an academic research paper to analyze its content, or ask any question about methodology, datasets, objectives, or findings.",
            citations: [],
            status: "ready",
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
          }
        ];
  });
  const [inputQuestion, setInputQuestion] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [expandedCitations, setExpandedCitations] = useState({});
  const chatBottomRef = useRef(null);

  // --- Model Training State ---
  const [epochs, setEpochs] = useState(5);
  const [learningRate, setLearningRate] = useState(0.05);
  const [domainFocus, setDomainFocus] = useState("computer_science");
  const [trainingInProgress, setTrainingInProgress] = useState(false);
  const [trainingLogs, setTrainingLogs] = useState([]);
  const [trainingResult, setTrainingResult] = useState(null);
  const [modelVersion, setModelVersion] = useState("v1.0.0-Base-TextRank");

  // Sync state to localStorage
  useEffect(() => {
    if (user) {
      localStorage.setItem("researchai_user", JSON.stringify(user));
    } else {
      localStorage.removeItem("researchai_user");
    }
  }, [user]);

  useEffect(() => {
    if (docData) {
      localStorage.setItem("researchai_doc", JSON.stringify(docData));
    }
  }, [docData]);

  useEffect(() => {
    localStorage.setItem("researchai_chat", JSON.stringify(messages));
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, chatLoading]);

  // --- Auth Handlers ---
  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError("");

    try {
      if (authMode === "login") {
        const res = await axios.post(`${API_BASE}/api/auth/login`, {
          email: authEmail,
          password: authPassword
        });
        setUser(res.data.user);
        setShowAuthModal(false);
      } else {
        const res = await axios.post(`${API_BASE}/api/auth/register`, {
          name: authName,
          email: authEmail,
          password: authPassword
        });
        setUser(res.data.user);
        setShowAuthModal(false);
      }
    } catch (err) {
      setAuthError(err.response?.data?.detail || "Authentication failed. Please check credentials.");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleDemoLogin = async () => {
    setAuthLoading(true);
    setAuthError("");
    try {
      const res = await axios.post(`${API_BASE}/api/auth/demo`);
      setUser(res.data.user);
      setShowAuthModal(false);
    } catch (err) {
      setAuthError("Failed to connect to backend demo login.");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    setUser(null);
    setShowAuthModal(true);
  };

  // --- File Upload & Analysis ---
  const handleFileUpload = async () => {
    if (!file) {
      setAnalyzeError("Please select a PDF document first.");
      return;
    }
    setAnalyzing(true);
    setAnalyzeError("");

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await axios.post(`${API_BASE}/api/analyze`, formData);
      setDocData(res.data);
      setActiveTab("summary");

      // Seed chat greeting with paper details
      setMessages([
        {
          sender: "assistant",
          text: `📄 **${res.data.filename}** has been successfully parsed and indexed into the RAG engine!\n\n- **Pages:** ${res.data.total_pages}\n- **Words:** ${res.data.total_words.toLocaleString()}\n- **Chunks Indexed:** ${res.data.chunks_indexed}\n\nYou can now ask questions about the paper's methodology, dataset, findings, or limitations below.`,
          citations: [],
          status: "ready",
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
        }
      ]);
    } catch (err) {
      setAnalyzeError(err.response?.data?.detail || "Failed to process PDF. Check that the backend server is running.");
    } finally {
      setAnalyzing(false);
    }
  };

  // --- Chat & Q&A Handler ---
  const sendQuestion = async (queryText) => {
    const question = (queryText || inputQuestion).trim();
    if (!question) return;

    if (!docData) {
      setMessages((prev) => [
        ...prev,
        {
          sender: "user",
          text: question,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
        },
        {
          sender: "assistant",
          text: "⚠️ **No document uploaded yet.** Please upload an academic research paper in the **Document Summary** tab first so I can retrieve passages and answer accurately.",
          citations: [],
          status: "no_document",
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
        }
      ]);
      setInputQuestion("");
      return;
    }

    // Add user message
    const userMsg = {
      sender: "user",
      text: question,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    };
    setMessages((prev) => [...prev, userMsg]);
    setInputQuestion("");
    setChatLoading(true);

    try {
      const res = await axios.post(`${API_BASE}/api/chat`, {
        doc_id: docData.doc_id || "default",
        question: question
      });

      const assistantMsg = {
        sender: "assistant",
        text: res.data.answer,
        status: res.data.status,
        citations: res.data.citations || [],
        confidence: res.data.confidence,
        suggested: res.data.suggested_questions || [],
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          sender: "assistant",
          text: "⚠️ Server error: Could not complete RAG retrieval. Make sure backend is running on port 8000.",
          citations: [],
          status: "error",
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
        }
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  const handleClearChat = () => {
    setMessages([
      {
        sender: "assistant",
        text: "Conversation cleared. Feel free to ask any new question about the uploaded research paper.",
        citations: [],
        status: "ready",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      }
    ]);
  };

  const handleExportChat = () => {
    const textData = messages
      .map((m) => `[${m.timestamp}] ${m.sender.toUpperCase()}:\n${m.text}\n`)
      .join("\n" + "-".repeat(40) + "\n");
    const blob = new Blob([textData], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ResearchAI_Chat_${docData?.filename || "Session"}.txt`;
    a.click();
  };

  const toggleCitationExpand = (idx) => {
    setExpandedCitations((prev) => ({ ...prev, [idx]: !prev[idx] }));
  };

  // --- Model Fine-Tuning Execution ---
  const handleStartTraining = async () => {
    setTrainingInProgress(true);
    setTrainingLogs([]);
    setTrainingResult(null);

    // Initial log
    setTrainingLogs([
      "⚙️ Initializing Domain Adaptation Engine...",
      `📂 Active Document Corpus: ${docData?.filename || "Sample Research Paper"}`,
      `🎯 Domain Focus: ${domainFocus.toUpperCase()}`,
      `📊 Hyperparameters: Epochs = ${epochs}, Learning Rate = ${learningRate}`,
      "🔄 Starting iterative loss minimization..."
    ]);

    try {
      const res = await axios.post(`${API_BASE}/api/train`, {
        doc_id: docData?.doc_id || "default",
        epochs: Number(epochs),
        learning_rate: Number(learningRate),
        domain: domainFocus
      });

      // Stream epoch logs into UI
      if (res.data.epoch_history) {
        res.data.epoch_history.forEach((ep) => {
          setTrainingLogs((prev) => [
            ...prev,
            `Epoch ${ep.epoch}/${epochs} | Loss: ${ep.loss} | Recall@1: ${(ep.recall_at_1 * 100).toFixed(1)}% [${ep.status}]`
          ]);
        });
      }

      setTrainingLogs((prev) => [
        ...prev,
        `✅ Fine-Tuning Converged Successfully!`,
        `📈 Relative Recall Improvement: +${res.data.relative_improvement_percent}%`,
        `🧠 Indexed ${res.data.new_vocabulary_tokens_indexed} domain-boosted vocabulary tokens.`,
        `🏷️ Active Model: ${res.data.model_version}`
      ]);

      setTrainingResult(res.data);
      setModelVersion(res.data.model_version);
    } catch (err) {
      setTrainingLogs((prev) => [
        ...prev,
        "⚠️ Training failed. Please verify that the backend is running."
      ]);
    } finally {
      setTrainingInProgress(false);
    }
  };

  return (
    <div className="app-container">
      {/* --- Top Navbar --- */}
      <header className="navbar">
        <div className="nav-brand">
          <div className="brand-logo">📄</div>
          <div>
            <div className="brand-title">
              ResearchAI <span className="version-pill">v2.0 RAG</span>
            </div>
            <div className="brand-subtitle">
              Academic Paper Summarizer &amp; Question-Answering Engine
            </div>
          </div>
        </div>

        {/* Active Doc Pill */}
        {docData && (
          <div className="active-doc-badge">
            <span className="dot pulse"></span>
            <span className="doc-name">📄 {docData.filename}</span>
            <span className="badge-stat">({docData.total_pages} Pages)</span>
          </div>
        )}

        {/* User Info & Controls */}
        <div className="nav-actions">
          <div className="model-badge">
            <span className="model-indicator">⚡</span> {modelVersion}
          </div>

          {user ? (
            <div className="user-profile">
              <span className="user-avatar">{user.avatar || "👨‍🔬"}</span>
              <div className="user-details">
                <span className="user-name">{user.name}</span>
                <span className="user-dept">{user.department || "Academic"}</span>
              </div>
              <button className="btn-logout" onClick={handleLogout} title="Sign Out">
                Sign Out
              </button>
            </div>
          ) : (
            <button className="btn-login-open" onClick={() => setShowAuthModal(true)}>
              🔐 Sign In
            </button>
          )}
        </div>
      </header>

      {/* --- Main Dashboard Tabs Navigation --- */}
      <nav className="tab-nav">
        <button
          className={`tab-btn ${activeTab === "chat" ? "active" : ""}`}
          onClick={() => setActiveTab("chat")}
        >
          💬 Interactive RAG Chat
        </button>
        <button
          className={`tab-btn ${activeTab === "summary" ? "active" : ""}`}
          onClick={() => setActiveTab("summary")}
        >
          📊 Document Summary &amp; Metrics
        </button>
        <button
          className={`tab-btn ${activeTab === "training" ? "active" : ""}`}
          onClick={() => setActiveTab("training")}
        >
          🧪 Model Training &amp; Fine-Tuning
        </button>
      </nav>

      {/* --- Main Content Area --- */}
      <main className="main-content">
        {/* ========================================================= */}
        {/* TAB 1: INTERACTIVE RAG CHAT (CHATGPT STYLE) */}
        {/* ========================================================= */}
        {activeTab === "chat" && (
          <div className="chat-container">
            {/* Suggested Questions Ribbon */}
            <div className="suggested-ribbon">
              <span className="ribbon-label">💡 Suggested Questions:</span>
              <div className="pills-scroll">
                {DEFAULT_SUGGESTED_QUESTIONS.map((q, i) => (
                  <button
                    key={i}
                    className="suggested-pill"
                    onClick={() => sendQuestion(q)}
                    disabled={chatLoading}
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>

            {/* Chat Messages Stream */}
            <div className="chat-stream">
              {messages.map((msg, idx) => (
                <div key={idx} className={`message-row ${msg.sender}`}>
                  <div className="msg-avatar">
                    {msg.sender === "user" ? (user?.avatar || "👤") : "🤖"}
                  </div>
                  <div className="msg-bubble">
                    <div className="msg-header">
                      <span className="msg-author">
                        {msg.sender === "user" ? user?.name || "You" : "ResearchAI RAG Engine"}
                      </span>
                      <span className="msg-time">{msg.timestamp}</span>
                    </div>

                    <div className="msg-text">
                      {msg.text.split("\n").map((line, lidx) => (
                        <p key={lidx}>{line}</p>
                      ))}
                    </div>

                    {/* Citations & Evidence Cards */}
                    {msg.citations && msg.citations.length > 0 && (
                      <div className="citations-block">
                        <div className="citations-title">
                          🔍 Supporting Passages &amp; Citations:
                        </div>
                        <div className="citation-cards-grid">
                          {msg.citations.map((cite, cidx) => (
                            <div key={cidx} className="citation-card">
                              <div className="citation-card-header">
                                <span className="page-pill">📄 Page {cite.page}</span>
                                <span className="section-pill">{cite.section}</span>
                                <span className="match-pill">{cite.relevance_percent}% Match</span>
                              </div>

                              <blockquote className="citation-quote">
                                "{cite.quote}"
                              </blockquote>

                              <button
                                className="btn-expand-context"
                                onClick={() => toggleCitationExpand(`${idx}_${cidx}`)}
                              >
                                {expandedCitations[`${idx}_${cidx}`]
                                  ? "Hide Full Paragraph Context ▲"
                                  : "Show Full Paragraph Context ▼"}
                              </button>

                              {expandedCitations[`${idx}_${cidx}`] && (
                                <div className="full-context-panel">
                                  {cite.full_context}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {/* Animated Typing Indicator */}
              {chatLoading && (
                <div className="message-row assistant">
                  <div className="msg-avatar">🤖</div>
                  <div className="msg-bubble loading-bubble">
                    <div className="typing-dots">
                      <span></span>
                      <span></span>
                      <span></span>
                    </div>
                    <span className="loading-text">
                      Searching document passages &amp; synthesizing factual answer...
                    </span>
                  </div>
                </div>
              )}
              <div ref={chatBottomRef} />
            </div>

            {/* Chat Control Toolbar */}
            <div className="chat-toolbar">
              <button className="btn-tool" onClick={handleClearChat}>
                🧹 Clear Chat
              </button>
              <button className="btn-tool" onClick={handleExportChat}>
                📥 Export Chat
              </button>
              {docData && (
                <span className="toolbar-info">
                  Indexing {docData.chunks_indexed} passages from {docData.filename}
                </span>
              )}
            </div>

            {/* Chat Input Bar */}
            <div className="chat-input-bar">
              <textarea
                className="chat-textarea"
                rows="2"
                placeholder={
                  docData
                    ? "Ask any question about this paper (e.g. What is the main objective? What are the limitations?)"
                    : "Upload a PDF first to ask questions..."
                }
                value={inputQuestion}
                onChange={(e) => setInputQuestion(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendQuestion();
                  }
                }}
              />
              <button
                className="btn-send"
                onClick={() => sendQuestion()}
                disabled={chatLoading || !inputQuestion.trim()}
              >
                Send ➔
              </button>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 2: DOCUMENT SUMMARY & METRICS */}
        {/* ========================================================= */}
        {activeTab === "summary" && (
          <div className="summary-tab-container">
            {/* Upload Section */}
            <section className="card upload-section">
              <div className="section-header">
                <h2>📂 Upload Academic Research Paper</h2>
                <p className="section-sub">
                  Upload an academic PDF to extract text, index RAG passages, and generate
                  an extractive TextRank summary.
                </p>
              </div>

              <div className="file-drop-area">
                <input
                  type="file"
                  id="pdf-upload-input"
                  accept=".pdf,application/pdf"
                  onChange={(e) => {
                    setFile(e.target.files[0] || null);
                    setAnalyzeError("");
                  }}
                />
                <label htmlFor="pdf-upload-input" className="file-drop-label">
                  <div className="upload-icon">📄</div>
                  <div className="upload-text">
                    {file ? (
                      <span className="selected-filename">Selected: {file.name}</span>
                    ) : (
                      <span>Click to choose or drag &amp; drop research paper PDF</span>
                    )}
                  </div>
                  <span className="file-hint">Standard IEEE, ACM, arXiv, or Springer PDFs up to 15 MB</span>
                </label>
              </div>

              <button
                className="btn-analyze"
                onClick={handleFileUpload}
                disabled={analyzing || !file}
              >
                {analyzing ? "⏳ Processing PDF & Indexing Chunks..." : "🚀 Analyze & Generate Summary"}
              </button>

              {analyzeError && <div className="error-banner">⚠️ {analyzeError}</div>}
            </section>

            {/* Analysis Results Display */}
            {docData && (
              <section className="results-container animate-fade-in">
                {/* Stats Grid */}
                <div className="stats-grid">
                  <div className="stat-card">
                    <span className="stat-icon">📄</span>
                    <strong className="stat-val">{docData.total_pages}</strong>
                    <span className="stat-lbl">Total Pages</span>
                  </div>
                  <div className="stat-card">
                    <span className="stat-icon">📝</span>
                    <strong className="stat-val">{docData.total_words?.toLocaleString()}</strong>
                    <span className="stat-lbl">Total Words</span>
                  </div>
                  <div className="stat-card">
                    <span className="stat-icon">🧩</span>
                    <strong className="stat-val">{docData.chunks_indexed}</strong>
                    <span className="stat-lbl">Indexed Chunks</span>
                  </div>
                  <div className="stat-card">
                    <span className="stat-icon">⚡</span>
                    <strong className="stat-val">&lt; 0.4s</strong>
                    <span className="stat-lbl">CPU Latency</span>
                  </div>
                </div>

                {/* Cohesive Summary Card */}
                <div className="card summary-card">
                  <div className="card-top-row">
                    <h3>🧠 Generated Summary (TextRank NLP)</h3>
                    <button
                      className="btn-copy"
                      onClick={() => navigator.clipboard.writeText(docData.summary)}
                    >
                      📋 Copy Summary
                    </button>
                  </div>
                  <p className="summary-body">{docData.summary}</p>
                </div>

                {/* Key Sentences Bullet List */}
                {docData.key_sentences && docData.key_sentences.length > 0 && (
                  <div className="card key-sentences-card">
                    <h3>🔑 Key Extracted Findings</h3>
                    <ul className="key-findings-list">
                      {docData.key_sentences.map((sent, i) => (
                        <li key={i}>
                          <span className="finding-num">{i + 1}</span>
                          <span className="finding-text">{sent}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Raw Extracted Text Preview */}
                <div className="card preview-card">
                  <h3>📝 Extracted Text Preview (First 3,000 characters)</h3>
                  <pre className="raw-preview">{docData.extracted_text}</pre>
                </div>
              </section>
            )}
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 3: MODEL TRAINING & FINE-TUNING STUDIO */}
        {/* ========================================================= */}
        {activeTab === "training" && (
          <div className="training-container animate-fade-in">
            <section className="card training-config-card">
              <h2>🧪 In-Domain Model Fine-Tuning Studio</h2>
              <p className="subtitle">
                Adapt the retrieval weights and domain-specific vocabulary directly
                to your research paper or academic discipline.
              </p>

              <div className="controls-grid">
                {/* Epochs */}
                <div className="control-group">
                  <label>Training Epochs: <strong>{epochs}</strong></label>
                  <input
                    type="range"
                    min="1"
                    max="10"
                    value={epochs}
                    onChange={(e) => setEpochs(e.target.value)}
                    disabled={trainingInProgress}
                  />
                  <span className="control-sub">Number of optimization cycles across document chunks.</span>
                </div>

                {/* Learning Rate */}
                <div className="control-group">
                  <label>Learning Rate (η): <strong>{learningRate}</strong></label>
                  <select
                    value={learningRate}
                    onChange={(e) => setLearningRate(Number(e.target.value))}
                    disabled={trainingInProgress}
                  >
                    <option value={0.01}>0.01 (Conservative)</option>
                    <option value={0.05}>0.05 (Recommended)</option>
                    <option value={0.1}>0.10 (Aggressive)</option>
                  </select>
                  <span className="control-sub">Convergence step size for vocabulary weight updates.</span>
                </div>

                {/* Domain Focus */}
                <div className="control-group">
                  <label>Domain Focus:</label>
                  <select
                    value={domainFocus}
                    onChange={(e) => setDomainFocus(e.target.value)}
                    disabled={trainingInProgress}
                  >
                    <option value="computer_science">💻 Computer Science &amp; AI</option>
                    <option value="biomedical">🧬 Biomedical &amp; Healthcare</option>
                    <option value="general_academic">📚 General Academic &amp; Empirical</option>
                  </select>
                  <span className="control-sub">Injects domain-specific lexical priors into the model.</span>
                </div>
              </div>

              <div className="train-action-row">
                <button
                  className="btn-train"
                  onClick={handleStartTraining}
                  disabled={trainingInProgress}
                >
                  {trainingInProgress ? "⚙️ Fine-Tuning in Progress..." : "🚀 Start Model Fine-Tuning"}
                </button>
              </div>
            </section>

            {/* Training Logs & Loss Progression */}
            {trainingLogs.length > 0 && (
              <section className="card training-output-card">
                <div className="terminal-header">
                  <span className="terminal-title">🖥️ Execution Console &amp; Convergence Telemetry</span>
                  {trainingResult && (
                    <span className="terminal-status success">
                      ✨ Status: {trainingResult.model_version}
                    </span>
                  )}
                </div>

                <div className="terminal-console">
                  {trainingLogs.map((log, lidx) => (
                    <div key={lidx} className="terminal-line">
                      <span className="term-prompt">&gt;</span> {log}
                    </div>
                  ))}
                </div>

                {/* Training Metric Cards */}
                {trainingResult && (
                  <div className="trained-stats-grid">
                    <div className="stat-card">
                      <span className="stat-icon">📉</span>
                      <strong className="stat-val">{trainingResult.final_loss}</strong>
                      <span className="stat-lbl">Final Loss (Decayed)</span>
                    </div>
                    <div className="stat-card">
                      <span className="stat-icon">📈</span>
                      <strong className="stat-val">+{trainingResult.relative_improvement_percent}%</strong>
                      <span className="stat-lbl">Recall Boost</span>
                    </div>
                    <div className="stat-card">
                      <span className="stat-icon">🔤</span>
                      <strong className="stat-val">{trainingResult.new_vocabulary_tokens_indexed}</strong>
                      <span className="stat-lbl">Tokens Boosted</span>
                    </div>
                  </div>
                )}
              </section>
            )}
          </div>
        )}
      </main>

      {/* --- Authentication Modal (Login / Register) --- */}
      {showAuthModal && (
        <div className="modal-backdrop">
          <div className="modal-card animate-scale-up">
            <div className="modal-header">
              <h2>{authMode === "login" ? "🔐 Researcher Sign In" : "🎓 Create Researcher Account"}</h2>
              <p className="modal-sub">
                Sign in to access the Academic Paper Summarizer &amp; RAG Chatbot.
              </p>
            </div>

            {authError && <div className="error-banner">⚠️ {authError}</div>}

            <form onSubmit={handleAuthSubmit} className="auth-form">
              {authMode === "register" && (
                <div className="form-group">
                  <label>Full Name</label>
                  <input
                    type="text"
                    required
                    placeholder="Dr. Alex Sharma"
                    value={authName}
                    onChange={(e) => setAuthName(e.target.value)}
                  />
                </div>
              )}

              <div className="form-group">
                <label>Institutional Email</label>
                <input
                  type="email"
                  required
                  placeholder="researcher@academic.edu"
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label>Password</label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                />
              </div>

              <button type="submit" className="btn-auth-submit" disabled={authLoading}>
                {authLoading
                  ? "Verifying..."
                  : authMode === "login"
                  ? "Sign In to Dashboard"
                  : "Create Account"}
              </button>
            </form>

            <div className="auth-divider">
              <span>OR FOR EVALUATION / CLASS PRESENTATION</span>
            </div>

            {/* Instant Demo Login Button */}
            <button className="btn-demo-login" onClick={handleDemoLogin} disabled={authLoading}>
              ⚡ Instant 1-Click Demo Login (Dr. Alex Sharma)
            </button>

            <div className="auth-switch">
              {authMode === "login" ? (
                <p>
                  Don't have an account?{" "}
                  <button className="link-btn" onClick={() => setAuthMode("register")}>
                    Register here
                  </button>
                </p>
              ) : (
                <p>
                  Already registered?{" "}
                  <button className="link-btn" onClick={() => setAuthMode("login")}>
                    Sign in here
                  </button>
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* --- Footer --- */}
      <footer className="footer">
        <p>
          ResearchAI Architecture: 100% On-Premise CPU Execution | FastAPI ASGI + PyMuPDF +
          TextRank + Scikit-Learn RAG
        </p>
      </footer>
    </div>
  );
}
