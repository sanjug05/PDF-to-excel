// pdfProcessor.js
// Handles PDF text extraction using PDF.js

export class PDFProcessor {
  constructor() {
    // Initialize PDF.js worker
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  }

  /**
   * Extracts text content from a PDF file, preserving page structure.
   * @param {File} file - The PDF file to process
   * @param {Function} progressCallback - Optional callback for progress (0-100)
   * @returns {Promise<Object>} - { fileName, pages: [{pageNumber, text}] }
   */
  async extractText(file, progressCallback = null) {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const numPages = pdf.numPages;
    const pages = [];

    for (let i = 1; i <= numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      
      // Combine text items maintaining some positional logic
      // Sort by vertical then horizontal position to mimic reading order
      const textItems = textContent.items.map(item => ({
        str: item.str,
        x: item.transform[4],
        y: item.transform[5]
      }));
      
      // Sort items: primarily by Y position (descending, as PDF origin is bottom-left), then by X
      textItems.sort((a, b) => {
        const yDiff = b.y - a.y;
        if (Math.abs(yDiff) > 5) return yDiff; // Different lines
        return a.x - b.x; // Same line, left to right
      });

      const pageText = textItems.map(item => item.str).join(' ');
      
      pages.push({
        pageNumber: i,
        text: pageText
      });

      if (progressCallback) {
        progressCallback(Math.round((i / numPages) * 100));
      }
    }

    return {
      fileName: file.name,
      pages: pages,
      fullText: pages.map(p => p.text).join('\n')
    };
  }
}
