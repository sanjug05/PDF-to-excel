// extractor.js - Specialized Extractor for AIS Windows Dealer Reports

export class SmartExtractor {
  constructor() {
    // Pre-defined patterns for standard fields in AIS documents
    this.standardPatterns = {
      'opportunity': {
        keywords: ['opportunity code', 'opportunity no', 'opportunity number', 'opp code'],
        pattern: /(?:opportunity\s*(?:code|no|number)?[:\s]*)([A-Z]{2,5}[- ]?[A-Z]{2}[- ]?\d+)/i,
        fallback: /([A-Z]{2,5}[- ]?OP[- ]?\d+)/i
      },
      'quote': {
        keywords: ['quote code', 'quote no', 'quote number', 'quotation no'],
        pattern: /(?:quote\s*(?:code|no|number)?[:\s]*)([A-Z]{2,5}[- ]?[A-Z]{2}[- ]?\d+)/i,
        fallback: /([A-Z]{2,5}[- ]?QT[- ]?\d+)/i
      },
      'date': {
        keywords: ['quote date', 'date', 'dated'],
        pattern: /(?:quote\s*)?(?:date|dated)[:\s]*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i,
        fallback: /(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/
      },
      'salesperson': {
        keywords: ['salesperson', 'sales person', 'dealer', 'sold to'],
        pattern: /(?:salesperson|sales\s*person|dealer)[:\s]*([A-Za-z0-9\s\.\,\-]+?)(?=\s{2,}|\n|$)/i,
        fallback: null
      },
      'responsible': {
        keywords: ['responsible', 'contact person', 'handler'],
        pattern: /(?:responsible|contact\s*person)[:\s]*([A-Za-z\s]+?)(?=\s{2,}|\n|$)/i,
        fallback: null
      },
      'gstin': {
        keywords: ['gstin', 'gst no', 'gst number'],
        pattern: /(?:GSTIN|GST\s*No)[:\s]*(\d{2}[A-Z]{5}\d{4}[A-Z]\d[Z])/i,
        fallback: null
      },
      'amount': {
        keywords: ['grand total', 'total', 'amount'],
        pattern: /(?:Grand\s*Total|Total\s*Amount)[:\s]*Rs\.?\s*([\d,]+)/i,
        fallback: null
      }
    };
  }

  /**
   * Main extraction method - optimized for AIS Dealer Reports
   */
  extractFields(fullText, headers) {
    const result = {};
    const lines = fullText.split(/\n/).map(line => line.trim()).filter(line => line);
    
    // First, try to find the "header row" that contains all field labels
    const headerRow = this._findHeaderRow(lines);
    const dataRow = headerRow ? this._findDataRow(lines, headerRow.index) : null;
    
    for (const header of headers) {
      if (!header.trim()) continue;
      const cleanHeader = header.trim();
      
      // Try specialized extraction first, then fallback to generic
      let value = this._extractWithStandardPattern(cleanHeader, fullText, lines);
      
      if (!value && headerRow && dataRow) {
        value = this._extractFromTableStructure(cleanHeader, headerRow.text, dataRow.text);
      }
      
      if (!value) {
        value = this._extractGeneric(cleanHeader, fullText, lines);
      }
      
      result[cleanHeader] = value || 'Not Found';
    }
    
    return result;
  }

  /**
   * Find the header row containing field labels (Opportunity Code, Quote Code, etc.)
   */
  _findHeaderRow(lines) {
    const headerIndicators = ['opportunity', 'quote', 'date', 'salesperson', 'responsible'];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].toLowerCase();
      const matchCount = headerIndicators.filter(ind => line.includes(ind)).length;
      
      // If line contains multiple header indicators, it's likely the header row
      if (matchCount >= 2) {
        return { index: i, text: lines[i] };
      }
    }
    
    return null;
  }

  /**
   * Find the data row corresponding to the header row
   */
  _findDataRow(lines, headerIndex) {
    // Look at the next few lines after the header
    for (let i = headerIndex + 1; i < Math.min(headerIndex + 5, lines.length); i++) {
      const line = lines[i].trim();
      // Data row typically contains codes, dates, names - not labels
      if (line && !this._looksLikeHeader(line) && line.length > 10) {
        return { index: i, text: line };
      }
    }
    return null;
  }

  /**
   * Check if a line looks like a header/label row
   */
  _looksLikeHeader(line) {
    const headerWords = ['code', 'no', 'number', 'date', 'name', 'person', 'amount', 'total'];
    const lowerLine = line.toLowerCase();
    return headerWords.some(word => {
      const regex = new RegExp(`\\b${word}\\b`, 'i');
      return regex.test(lowerLine) && lowerLine.length < 50;
    });
  }

  /**
   * Extract value from table structure (header row + data row)
   */
  _extractFromTableStructure(header, headerRow, dataRow) {
    const headerLower = header.toLowerCase();
    
    // Try to find the header's position in the header row
    const headerWords = headerLower.split(/\s+/);
    
    // Find where in the header row this field appears
    let headerPos = -1;
    for (const word of headerWords) {
      const pos = headerRow.toLowerCase().indexOf(word);
      if (pos !== -1) {
        headerPos = pos;
        break;
      }
    }
    
    if (headerPos === -1) return null;
    
    // Extract the corresponding value from the same position in data row
    // Split data row into segments based on multiple spaces or tabs
    const dataSegments = dataRow.split(/\s{2,}|\t/).filter(s => s.trim());
    const headerSegments = headerRow.split(/\s{2,}|\t/).filter(s => s.trim());
    
    // Count which segment number our header falls into
    let segmentIndex = -1;
    let charCount = 0;
    
    for (let i = 0; i < headerSegments.length; i++) {
      const segStart = headerRow.indexOf(headerSegments[i], charCount);
      if (headerPos >= segStart && headerPos <= segStart + headerSegments[i].length) {
        segmentIndex = i;
        break;
      }
      charCount = segStart + headerSegments[i].length;
    }
    
    // Return the corresponding data segment
    if (segmentIndex !== -1 && segmentIndex < dataSegments.length) {
      let value = dataSegments[segmentIndex].trim();
      
      // Clean up the value (remove any remaining label artifacts)
      value = value.replace(/^(code|no|number|date|name)[:\s]*/i, '').trim();
      
      if (value && value.length > 1) {
        return value;
      }
    }
    
    return null;
  }

  /**
   * Extract using pre-defined standard patterns
   */
  _extractWithStandardPattern(header, fullText, lines) {
    const lowerHeader = header.toLowerCase();
    
    // Check against standard patterns
    for (const [key, config] of Object.entries(this.standardPatterns)) {
      const keywordMatch = config.keywords.some(keyword => lowerHeader.includes(keyword));
      
      if (keywordMatch || this._fuzzyMatchHeader(lowerHeader, key)) {
        // Try primary pattern
        if (config.pattern) {
          const match = fullText.match(config.pattern);
          if (match && match[1]) {
            return match[1].trim();
          }
        }
        
        // Try fallback pattern
        if (config.fallback) {
          const match = fullText.match(config.fallback);
          if (match && match[1]) {
            return match[1].trim();
          }
        }
        
        // Manual line-by-line search
        const value = this._manualSearch(header, lines);
        if (value) return value;
      }
    }
    
    return null;
  }

  /**
   * Manual search for header-value pairs
   */
  _manualSearch(header, lines) {
    const headerLower = header.toLowerCase();
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lowerLine = line.toLowerCase();
      
      // Check if this line contains our header
      if (lowerLine.includes(headerLower)) {
        // Extract value after the header
        const value = this._extractValueFromLine(line, header);
        if (value) return value;
        
        // Check next line for value
        if (i + 1 < lines.length) {
          const nextLine = lines[i + 1].trim();
          if (nextLine && !this._looksLikeHeader(nextLine) && nextLine.length < 100) {
            return nextLine;
          }
        }
      }
    }
    
    return null;
  }

  /**
   * Extract value from a line containing a header
   */
  _extractValueFromLine(line, header) {
    const headerIndex = line.toLowerCase().indexOf(header.toLowerCase());
    if (headerIndex === -1) return null;
    
    // Get everything after the header
    const afterHeader = line.substring(headerIndex + header.length);
    
    // Try different separators
    const separators = [':', '-', '–', '\t', '  '];
    
    for (const sep of separators) {
      const sepIndex = afterHeader.indexOf(sep);
      if (sepIndex !== -1 && sepIndex < 10) {
        let value = afterHeader.substring(sepIndex + 1).trim();
        // Clean up
        value = value.replace(/^[:\s\-]+/, '').trim();
        if (value && value.length > 1) {
          return value;
        }
      }
    }
    
    // If no separator found, try to get the first word/phrase
    const cleaned = afterHeader.trim();
    if (cleaned && cleaned.length > 1 && cleaned.length < 50) {
      // Take until next multiple spaces or newline
      const valueMatch = cleaned.match(/^([^\n]{1,40}?)(?:\s{2,}|$)/);
      if (valueMatch) {
        return valueMatch[1].trim();
      }
    }
    
    return null;
  }

  /**
   * Generic extraction as last resort
   */
  _extractGeneric(header, fullText, lines) {
    // Try regex pattern
    const escapedHeader = this._escapeRegExp(header);
    const patterns = [
      new RegExp(`${escapedHeader}\\s*[:\\-]\\s*([^\\n]{1,50})`, 'i'),
      new RegExp(`${escapedHeader}\\s{2,}([^\\n]{1,50})`, 'i'),
    ];
    
    for (const pattern of patterns) {
      const match = fullText.match(pattern);
      if (match && match[1]) {
        return match[1].trim().replace(/^[:\s\-]+/, '');
      }
    }
    
    // Try proximity search
    const headerIndex = fullText.toLowerCase().indexOf(header.toLowerCase());
    if (headerIndex !== -1) {
      const surrounding = fullText.substring(headerIndex + header.length, headerIndex + header.length + 60);
      const valueMatch = surrounding.match(/^[:\s]*([^\n]{1,40})/);
      if (valueMatch) {
        const value = valueMatch[1].trim().replace(/^[:\s\-]+/, '');
        if (value && !this._looksLikeHeader(value)) {
          return value;
        }
      }
    }
    
    return null;
  }

  /**
   * Detect smart tables in PDF
   */
  detectTable(fullText) {
    const lines = fullText.split(/\n/).filter(line => line.trim());
    const tables = [];
    let currentTable = [];
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      // Check if line contains tabular data
      const hasTableStructure = (trimmed.match(/\s{2,}/) || trimmed.includes('\t')) && 
                                trimmed.split(/\s{2,}|\t/).length >= 3;
      
      if (hasTableStructure) {
        const columns = trimmed.split(/\s{2,}|\t/).filter(col => col.trim());
        if (columns.length >= 3) {
          currentTable.push(columns);
        }
      } else if (currentTable.length > 0) {
        // End of table
        if (currentTable.length >= 2) {
          tables.push([...currentTable]);
        }
        currentTable = [];
      }
    }
    
    // Don't forget last table
    if (currentTable.length >= 2) {
      tables.push(currentTable);
    }
    
    return tables;
  }

  _fuzzyMatchHeader(header, standardField) {
    const variations = {
      'opportunity': ['opp', 'opportunity', 'opp code'],
      'quote': ['quote', 'qt', 'quotation'],
      'date': ['date', 'dated'],
      'salesperson': ['sales', 'dealer', 'sold'],
      'responsible': ['responsible', 'contact', 'handler']
    };
    
    const allowedVariations = variations[standardField] || [];
    return allowedVariations.some(v => header.includes(v));
  }

  _escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}
