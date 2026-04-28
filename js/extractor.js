// extractor.js
// Smart field extraction using fuzzy matching, regex, and proximity logic.

export class SmartExtractor {
  constructor() {
    // Common regex patterns for business documents
    this.patterns = {
      invoice: /invoice\s*(no|num|number|#)[:\s]*([A-Z0-9\-]+)/i,
      date: /(date)[:\s]*([\d]{1,2}[\/\-\.][\d]{1,2}[\/\-\.][\d]{2,4})/i,
      amount: /(total|amount|sum|grand\s*total)[:\s]*[\$£€]?([\d,]+\.?\d*)/i,
      dealer: /(dealer|vendor|supplier|from)[:\s]*([A-Za-z0-9\s]+)/i
    };
  }

  /**
   * Main extraction method for a single PDF's text content.
   * @param {string} fullText - Combined text from all pages of a PDF
   * @param {string[]} headers - Array of header names to search for
   * @returns {Object} - Key-value pairs of extracted data
   */
  extractFields(fullText, headers) {
    const result = {};
    const lines = fullText.split(/\n/).filter(line => line.trim() !== '');
    
    for (const header of headers) {
      if (!header.trim()) continue;
      const cleanHeader = header.trim();
      result[cleanHeader] = this._findValueForHeader(cleanHeader, fullText, lines);
    }
    
    return result;
  }

  /**
   * Employs multiple strategies to find a value for a given header.
   */
  _findValueForHeader(header, fullText, lines) {
    // Strategy 1: Direct key-value pattern (e.g., "Invoice No: 12345")
    const directPatterns = [
      new RegExp(`${this._escapeRegExp(header)}[:\s]*([^\n]+)`, 'i'),
      new RegExp(`${this._escapeRegExp(header)}[:\s]*([A-Za-z0-9\-\$£€,.]+)`, 'i')
    ];
    
    for (const pattern of directPatterns) {
      const match = fullText.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }

    // Strategy 2: Line-by-line scanning with fuzzy matching
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      // Check if line contains the header keyword
      if (this._fuzzyMatch(line, header)) {
        // Extract value after the colon or from next line
        const colonIndex = line.indexOf(':');
        if (colonIndex !== -1) {
          const value = line.substring(colonIndex + 1).trim();
          if (value) return value;
        }
        // If no value on same line, check next line
        if (i + 1 < lines.length && lines[i+1].trim().length < 100) {
          return lines[i+1].trim();
        }
        // Try to extract any identifiable value after the keyword
        const afterKeyword = line.substring(line.toLowerCase().indexOf(header.toLowerCase()) + header.length).trim();
        if (afterKeyword && afterKeyword.length < 50) {
          return afterKeyword.replace(/^[:\s]+/, '');
        }
      }
    }

    // Strategy 3: Contextual pattern matching for common headers
    const lowerHeader = header.toLowerCase();
    if (lowerHeader.includes('invoice') || lowerHeader.includes('inv no')) {
      const invMatch = fullText.match(this.patterns.invoice);
      if (invMatch) return invMatch[2];
    }
    if (lowerHeader.includes('date')) {
      const dateMatch = fullText.match(this.patterns.date);
      if (dateMatch) return dateMatch[2];
    }
    if (lowerHeader.includes('amount') || lowerHeader.includes('total') || lowerHeader.includes('sum')) {
      const amountMatch = fullText.match(this.patterns.amount);
      if (amountMatch) return amountMatch[2];
    }
    if (lowerHeader.includes('dealer') || lowerHeader.includes('vendor') || lowerHeader.includes('supplier')) {
      const dealerMatch = fullText.match(this.patterns.dealer);
      if (dealerMatch) return dealerMatch[2];
    }

    // Strategy 4: Proximity search - find the header word and grab nearby text block
    const index = fullText.toLowerCase().indexOf(header.toLowerCase());
    if (index !== -1) {
      const surroundingText = fullText.substring(index, index + header.length + 60);
      const afterHeader = surroundingText.substring(header.length).trim();
      const valueMatch = afterHeader.match(/[:\s]*([A-Za-z0-9\-\$£€,.]+)/);
      if (valueMatch) {
        return valueMatch[1];
      }
    }

    return 'Not Found';
  }

  /**
   * Detects tabular structures in PDF text and returns an array of row objects.
   * This is a heuristic approach for semi-structured tables.
   */
  detectTable(fullText) {
    const lines = fullText.split(/\n/).filter(line => line.trim() !== '');
    const tableRows = [];
    
    // Simple heuristic: lines with multiple numbers or consistent delimiters might be table rows
    for (const line of lines) {
      const trimmed = line.trim();
      // Check if line contains multiple numeric values or is separated by tabs/multiple spaces
      if ((trimmed.match(/\d+/g) || []).length >= 2 || trimmed.includes('\t') || trimmed.match(/\s{2,}/)) {
        const columns = trimmed.split(/\s{2,}|\t/).filter(col => col.trim() !== '');
        if (columns.length >= 2) {
          tableRows.push(columns);
        }
      }
    }
    
    return tableRows;
  }

  /**
   * Simple fuzzy matching: checks if two strings are similar enough.
   */
  _fuzzyMatch(line, keyword) {
    const cleanLine = line.toLowerCase().replace(/[^a-z0-9\s]/g, '');
    const cleanKeyword = keyword.toLowerCase().replace(/[^a-z0-9\s]/g, '');
    return cleanLine.includes(cleanKeyword) || 
           this._levenshteinDistance(cleanLine.substring(0, cleanKeyword.length + 5), cleanKeyword) <= 2;
  }

  _levenshteinDistance(a, b) {
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;
    const matrix = [];
    for (let i = 0; i <= b.length; i++) matrix[i] = [i];
    for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i-1) === a.charAt(j-1)) {
          matrix[i][j] = matrix[i-1][j-1];
        } else {
          matrix[i][j] = Math.min(matrix[i-1][j-1] + 1, matrix[i][j-1] + 1, matrix[i-1][j] + 1);
        }
      }
    }
    return matrix[b.length][a.length];
  }

  _escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}
