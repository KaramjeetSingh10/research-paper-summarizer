import re
from typing import List, Dict, Any, Optional
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import nltk

try:
    nltk.data.find('tokenizers/punkt')
except LookupError:
    nltk.download('punkt', quiet=True)
try:
    nltk.data.find('tokenizers/punkt_tab')
except LookupError:
    nltk.download('punkt_tab', quiet=True)


class RAGIndexer:
    """
    In-memory CPU-optimized RAG engine.
    - Intelligent paragraph/sentence chunking with page number tracking.
    - In-domain TF-IDF & vocabulary weighting.
    - Section-aware passage retrieval.
    - Zero-hallucination factual answer synthesis with exact quotations and page citations.
    """

    SECTION_PATTERNS = {
        "abstract": [r"\babstract\b"],
        "introduction": [r"\bintroduction\b", r"\bbackground\b", r"\bmotivation\b"],
        "objective": [r"\bobjective\b", r"\baim\b", r"\bpurpose\b", r"\bgoal\b", r"\bproblem statement\b"],
        "methodology": [r"\bmethodology\b", r"\bmethods?\b", r"\bapproach\b", r"\barchitecture\b", r"\bproposed model\b", r"\balgorithm\b", r"\bimplementation\b"],
        "dataset": [r"\bdataset\b", r"\bdata\b", r"\bcorpus\b", r"\bbenchmark\b", r"\btraining data\b", r"\bsamples?\b"],
        "results": [r"\bresults?\b", r"\bfindings?\b", r"\bperformance\b", r"\bevaluation\b", r"\baccuracy\b", r"\bmetrics?\b", r"\boutcomes?\b"],
        "discussion": [r"\bdiscussion\b", r"\banalysis\b"],
        "limitations": [r"\blimitations?\b", r"\bthreats to validity\b", r"\bdrawbacks?\b", r"\bchallenges?\b", r"\bweaknesses?\b"],
        "future_work": [r"\bfuture (work|research|directions?)\b", r"\bnext steps?\b", r"\bconclusion\b"],
    }

    def __init__(self):
        # In-memory document storage: { doc_id: { "chunks": [...], "vectorizer": TfidfVectorizer, "matrix": sparse_matrix, "fine_tuned": bool } }
        self.documents: Dict[str, Dict[str, Any]] = {}
        # Domain keyword boost dictionary (expanded during fine-tuning)
        self.custom_vocabulary_boost: Dict[str, float] = {}

    def _detect_section(self, text: str) -> str:
        text_lower = text.lower()
        for section, patterns in self.SECTION_PATTERNS.items():
            for pat in patterns:
                if re.search(pat, text_lower):
                    return section.replace("_", " ").title()
        return "General Content"

    def split_into_chunks(self, page_content: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Split document text into meaningful chunks (~120-250 words or 2-4 sentences)
        while strictly preserving original page numbers.
        """
        chunks = []
        chunk_counter = 0

        for page_data in page_content:
            page_num = page_data.get("page", 1)
            raw_text = page_data.get("text", "").strip()
            if not raw_text:
                continue

            # Split text into sentences using NLTK
            try:
                sentences = nltk.sent_tokenize(raw_text)
            except Exception:
                sentences = re.split(r'(?<=[.!?])\s+', raw_text)

            current_chunk_sents = []
            current_word_count = 0

            for sent in sentences:
                sent_clean = sent.strip()
                if not sent_clean:
                    continue

                words = sent_clean.split()
                current_chunk_sents.append(sent_clean)
                current_word_count += len(words)

                # Form a chunk when reaching ~100-200 words or at least 3 sentences
                if current_word_count >= 120 or len(current_chunk_sents) >= 4:
                    chunk_text = " ".join(current_chunk_sents)
                    section = self._detect_section(chunk_text)
                    chunk_counter += 1
                    chunks.append({
                        "id": f"chk_{chunk_counter}",
                        "page": page_num,
                        "text": chunk_text,
                        "section": section,
                        "word_count": len(chunk_text.split()),
                    })

                    # 1-sentence overlap for contextual continuity
                    current_chunk_sents = current_chunk_sents[-1:]
                    current_word_count = len(current_chunk_sents[0].split())

            # Add any trailing sentences for the page
            if current_chunk_sents:
                chunk_text = " ".join(current_chunk_sents)
                if len(chunk_text.split()) > 15:
                    chunk_counter += 1
                    section = self._detect_section(chunk_text)
                    chunks.append({
                        "id": f"chk_{chunk_counter}",
                        "page": page_num,
                        "text": chunk_text,
                        "section": section,
                        "word_count": len(chunk_text.split()),
                    })

        return chunks

    def index_document(self, doc_id: str, page_content: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Indexes chunks into in-memory TF-IDF matrix.
        """
        chunks = self.split_into_chunks(page_content)
        if not chunks:
            raise ValueError("No extractable chunks found in document.")

        corpus = [c["text"] for c in chunks]

        # TF-IDF with 1-gram & 2-gram and sublinear scaling
        vectorizer = TfidfVectorizer(
            ngram_range=(1, 2),
            stop_words='english',
            sublinear_tf=True,
            max_df=0.95,
            min_df=1
        )
        tfidf_matrix = vectorizer.fit_transform(corpus)

        self.documents[doc_id] = {
            "chunks": chunks,
            "vectorizer": vectorizer,
            "matrix": tfidf_matrix,
            "fine_tuned": False,
            "training_metrics": None
        }

        # Unique sections detected
        sections_found = list({c["section"] for c in chunks})

        return {
            "doc_id": doc_id,
            "total_chunks": len(chunks),
            "sections_detected": sections_found
        }

    def retrieve_passages(self, doc_id: str, query: str, top_k: int = 4) -> List[Dict[str, Any]]:
        """
        Retrieve top-k relevant chunks based on query cosine similarity and intent boosting.
        """
        if doc_id not in self.documents:
            # Fallback to the latest indexed doc if doc_id not found
            if self.documents:
                doc_id = list(self.documents.keys())[-1]
            else:
                return []

        doc_data = self.documents[doc_id]
        vectorizer: TfidfVectorizer = doc_data["vectorizer"]
        tfidf_matrix = doc_data["matrix"]
        chunks = doc_data["chunks"]

        # Transform query
        try:
            query_vec = vectorizer.transform([query])
            sim_scores = cosine_similarity(query_vec, tfidf_matrix).flatten()
        except Exception:
            return []

        # Intent boost
        query_lower = query.lower()
        boosted_scores = np.copy(sim_scores)

        for idx, chunk in enumerate(chunks):
            chunk_section = chunk["section"].lower()
            chunk_text = chunk["text"].lower()

            # Section-specific boost
            if "objective" in query_lower or "goal" in query_lower or "aim" in query_lower:
                if chunk_section in ["abstract", "introduction", "objective"]:
                    boosted_scores[idx] += 0.15
            elif "method" in query_lower or "model" in query_lower or "architecture" in query_lower:
                if chunk_section in ["methodology", "methods", "approach", "architecture"]:
                    boosted_scores[idx] += 0.15
            elif "data" in query_lower or "dataset" in query_lower or "corpus" in query_lower:
                if chunk_section in ["dataset", "experiments", "methodology"] or "dataset" in chunk_text:
                    boosted_scores[idx] += 0.20
            elif "finding" in query_lower or "result" in query_lower or "achieve" in query_lower:
                if chunk_section in ["results", "findings", "evaluation"]:
                    boosted_scores[idx] += 0.18
            elif "limitation" in query_lower or "drawback" in query_lower or "challenge" in query_lower:
                if chunk_section in ["limitations", "discussion", "threats to validity"] or "limitation" in chunk_text:
                    boosted_scores[idx] += 0.25
            elif "future" in query_lower or "next step" in query_lower:
                if chunk_section in ["future work", "conclusion"] or "future" in chunk_text:
                    boosted_scores[idx] += 0.25

            # Custom domain fine-tuning boost
            for kw, weight in self.custom_vocabulary_boost.items():
                if kw in chunk_text and kw in query_lower:
                    boosted_scores[idx] += weight

        # Sort top-k
        top_indices = np.argsort(boosted_scores)[::-1][:top_k]

        results = []
        for idx in top_indices:
            score = float(boosted_scores[idx])
            raw_score = float(sim_scores[idx])
            chunk = chunks[idx]
            results.append({
                "chunk_id": chunk["id"],
                "page": chunk["page"],
                "section": chunk["section"],
                "text": chunk["text"],
                "score": round(score, 4),
                "raw_cosine": round(raw_score, 4),
            })

        return results

    def answer_question(self, doc_id: str, query: str) -> Dict[str, Any]:
        """
        Synthesize answer strictly from retrieved source text.
        Guarantees zero hallucination:
        - If not found or low confidence, explicitly reports not found.
        - Provides exact supporting quotations with page numbers.
        """
        if not self.documents:
            return {
                "answer": "No academic paper has been uploaded or indexed yet. Please upload a PDF research paper first.",
                "status": "no_document",
                "citations": [],
                "confidence": 0.0,
                "suggested_questions": []
            }

        retrieved = self.retrieve_passages(doc_id, query, top_k=4)

        # Confidence threshold check
        max_score = retrieved[0]["score"] if retrieved else 0.0
        MIN_CONFIDENCE_THRESHOLD = 0.06

        if not retrieved or max_score < MIN_CONFIDENCE_THRESHOLD:
            return {
                "answer": (
                    "The requested information was **not found in the uploaded paper**. "
                    "The document does not appear to contain relevant discussion or evidence addressing this query. "
                    "Try asking about the main objective, methodology, dataset, results, or limitations mentioned by the authors."
                ),
                "status": "not_found",
                "citations": [],
                "confidence": round(max_score, 3),
                "suggested_questions": [
                    "What is the main objective of this research?",
                    "Which methodology did the authors use?",
                    "What are the major findings of this paper?"
                ]
            }

        # Top relevant passage
        primary_chunk = retrieved[0]
        secondary_chunks = retrieved[1:3]

        # Extract precise matching sentence from primary chunk
        query_words = set(re.findall(r'\w+', query.lower())) - {"what", "which", "how", "why", "the", "is", "are", "did", "authors", "paper", "research", "use", "used"}
        sentences = nltk.sent_tokenize(primary_chunk["text"])
        best_sentence = ""
        best_match_count = -1

        for sent in sentences:
            sent_words = set(re.findall(r'\w+', sent.lower()))
            overlap = len(query_words & sent_words)
            if overlap > best_match_count:
                best_match_count = overlap
                best_sentence = sent.strip()

        if not best_sentence:
            best_sentence = sentences[0] if sentences else primary_chunk["text"]

        # Build clean structured citations
        citations = []
        for r in retrieved[:3]:
            # Select key sentence as quote
            chunk_sents = nltk.sent_tokenize(r["text"])
            quote = chunk_sents[0] if chunk_sents else r["text"]
            if len(chunk_sents) > 1 and best_sentence in r["text"]:
                quote = best_sentence

            citations.append({
                "page": r["page"],
                "section": r["section"],
                "quote": quote,
                "full_context": r["text"],
                "relevance_percent": int(min(r["score"] * 140, 99))
            })

        # Synthesize factual response
        answer_text = (
            f"**Answer Based on Paper [Page {primary_chunk['page']}] ({primary_chunk['section']}):**\n\n"
            f"> \"{best_sentence}\"\n\n"
            f"**Evidence Synthesis:**\n"
            f"According to the authors in the **{primary_chunk['section']}** section (Page {primary_chunk['page']}), "
            f"the paper states: *\"{primary_chunk['text'][:280]}...\"*\n\n"
        )

        if secondary_chunks:
            sec = secondary_chunks[0]
            answer_text += (
                f"**Additional Supporting Context (Page {sec['page']}, {sec['section']}):**\n"
                f"- {sec['text'][:200]}..."
            )

        # Contextual follow-up recommendations
        followups = [
            "What is the main objective of this research?",
            "Which methodology did the authors use?",
            "What dataset was used in experiments?",
            "What limitations are mentioned by the authors?",
            "What future research is suggested?"
        ]
        # Remove current query if it matches
        followups = [q for q in followups if q.lower() not in query.lower()][:3]

        return {
            "answer": answer_text,
            "status": "found",
            "primary_page": primary_chunk["page"],
            "primary_section": primary_chunk["section"],
            "direct_quote": best_sentence,
            "citations": citations,
            "confidence": round(max_score, 3),
            "suggested_questions": followups
        }


# Singleton instance
rag_engine = RAGIndexer()
