import pymupdf


def extract_pdf_text(file_content: bytes) -> dict:
    """
    Extract text from a PDF file given as bytes.
    Returns a dict with text, page count, word count, and per-page content.
    """
    pdf_document = None
    try:
        pdf_document = pymupdf.open(stream=file_content, filetype="pdf")

        if pdf_document.page_count == 0:
            raise ValueError("The PDF is empty.")

        extracted_pages = []
        for page_number, page in enumerate(pdf_document):
            page_text = page.get_text("text")
            extracted_pages.append({
                "page": page_number + 1,
                "text": page_text.strip()
            })

        full_text = "\n\n".join(
            page["text"] for page in extracted_pages if page["text"]
        )

        if not full_text.strip():
            raise ValueError(
                "No readable text found. This may be a scanned PDF."
            )

        word_count = len(full_text.split())

        return {
            "text": full_text,
            "pages": pdf_document.page_count,
            "word_count": word_count,
            "page_content": extracted_pages
        }

    except pymupdf.FileDataError:
        raise ValueError("Invalid or corrupted PDF file.")
    finally:
        if pdf_document:
            pdf_document.close()
