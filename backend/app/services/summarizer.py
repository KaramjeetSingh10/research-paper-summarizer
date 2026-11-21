from sumy.parsers.plaintext import PlaintextParser
from sumy.nlp.tokenizers import Tokenizer
from sumy.summarizers.text_rank import TextRankSummarizer


def generate_summary(text: str, sentence_count: int = 5) -> str:
    """
    Generate an extractive summary using TextRank algorithm.
    Returns a string containing the most important sentences.
    """
    if not text or not text.strip():
        return ""

    parser = PlaintextParser.from_string(text, Tokenizer("english"))
    total_sentences = len(parser.document.sentences)

    if total_sentences == 0:
        return ""

    # If document is shorter than requested summary, return full text
    if total_sentences <= sentence_count:
        return " ".join(
            str(sentence) for sentence in parser.document.sentences
        )

    summarizer = TextRankSummarizer()
    summary_sentences = summarizer(parser.document, sentence_count)

    return " ".join(str(sentence) for sentence in summary_sentences)


def get_key_sentences(text: str, count: int = 10) -> list:
    """
    Return top key sentences as a list (useful for bullet-point view).
    """
    if not text or not text.strip():
        return []

    parser = PlaintextParser.from_string(text, Tokenizer("english"))
    total_sentences = len(parser.document.sentences)

    if total_sentences == 0:
        return []

    actual_count = min(count, total_sentences)
    summarizer = TextRankSummarizer()
    sentences = summarizer(parser.document, actual_count)

    return [str(s) for s in sentences]
