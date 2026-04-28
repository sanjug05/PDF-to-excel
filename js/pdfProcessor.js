// pdfProcessor.js - Enhanced PDF Text Extraction

export class PDFProcessor {
  constructor() {
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  }

  async extractText(file, progressCallback = null) {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const numPages = pdf.numPages;
    const pages = [];

    for (let i = 1; i <= numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      
      // Enhanced text extraction with position awareness
      const textItems = textContent.items.map(item => ({
        str: item.str,
        x: Math.round(item.transform[4]),
        y: Math.round(item.transform[5]),
        width: item.width || 0,
        height: item.height || 0
      }));
      
      // Group text items by lines (similar Y coordinates)
      const lines = this._groupIntoLines(textItems);
      
      // Join lines with proper spacing
      const pageText = lines.map(line => line.join(' ')).join('\n');
      
      pages.push({
        pageNumber: i,
        text: pageText,
        rawItems: textItems
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

  /**
   * Group text items into lines based on Y position
   */
  _groupIntoLines(items) {
    if (items.length === 0) return [];
    
    // Sort by Y position (descending) then X position (ascending)
    const sorted = [...items].sort((a, b) => {
      const yDiff = b.y - a.y;
      if (Math.abs(yDiff) > 5) return yDiff; // Different lines
      return a.x - b.x; // Same line, left to right
    });
    
    const lines = [];
    let currentLine = [];
    let currentY = sorted[0].y;
    
    for (const item of sorted) {
      if (Math.abs(item.y - currentY) > 5) {
        // New line
        if (currentLine.length > 0) {
          lines.push(currentLine.map(item => item.str));
        }
        currentLine = [item];
        currentY = item.y;
      } else {
        // Same line, check for column gaps
        if (currentLine.length > 0) {
          const lastItem = currentLine[currentLine.length - 1];
          const gap = item.x - (lastItem.x + lastItem.width);
          
          // If significant gap, add spacing
          if (gap > 20) {
            currentLine.push({ str: '  ', x: 0, y: 0, width: 0, height: 0 });
          }
        }
        currentLine.push(item);
      }
    }
    
    // Don't forget the last line
    if (currentLine.length > 0) {
      lines.push(currentLine.map(item => item.str));
    }
    
    return lines;
  }
}
