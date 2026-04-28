// app.js
// Main application controller, UI management, and event orchestration.

import { PDFProcessor } from './pdfProcessor.js';
import { SmartExtractor } from './extractor.js';
import { ExcelExporter } from './exportUtils.js';

class App {
  constructor() {
    this.pdfProcessor = new PDFProcessor();
    this.extractor = new SmartExtractor();
    this.exporter = new ExcelExporter();
    
    this.files = []; // Array of File objects
    this.headers = ['Dealer Name', 'Invoice Number', 'Date', 'Amount']; // Default headers
    this.extractedData = []; // Array of row objects
    
    this.initDOM();
    this.bindEvents();
    this.renderHeaders();
    this.loadTemplateFromStorage();
  }

  initDOM() {
    this.dropZone = document.getElementById('dropZone');
    this.fileInput = document.getElementById('fileInput');
    this.fileList = document.getElementById('fileList');
    this.progressContainer = document.getElementById('progressContainer');
    this.progressBar = document.getElementById('progressBar');
    this.progressText = document.getElementById('progressText');
    this.headersContainer = document.getElementById('headersContainer');
    this.addHeaderBtn = document.getElementById('addHeaderBtn');
    this.saveTemplateBtn = document.getElementById('saveTemplateBtn');
    this.loadTemplateBtn = document.getElementById('loadTemplateBtn');
    this.processBtn = document.getElementById('processBtn');
    this.exportBtn = document.getElementById('exportBtn');
    this.clearDataBtn = document.getElementById('clearDataBtn');
    this.tableHeaderRow = document.getElementById('tableHeaderRow');
    this.tableBody = document.getElementById('tableBody');
    this.statusMessage = document.getElementById('statusMessage');
  }

  bindEvents() {
    // Drag & Drop
    this.dropZone.addEventListener('click', () => this.fileInput.click());
    this.dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      this.dropZone.classList.add('border-blue-500', 'bg-blue-50');
    });
    this.dropZone.addEventListener('dragleave', () => {
      this.dropZone.classList.remove('border-blue-500', 'bg-blue-50');
    });
    this.dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      this.dropZone.classList.remove('border-blue-500', 'bg-blue-50');
      const droppedFiles = Array.from(e.dataTransfer.files).filter(f => f.type === 'application/pdf');
      this.addFiles(droppedFiles);
    });
    
    this.fileInput.addEventListener('change', (e) => {
      const selectedFiles = Array.from(e.target.files).filter(f => f.type === 'application/pdf');
      this.addFiles(selectedFiles);
      this.fileInput.value = '';
    });

    // Header management
    this.addHeaderBtn.addEventListener('click', () => this.addHeader());
    this.saveTemplateBtn.addEventListener('click', () => this.saveTemplate());
    this.loadTemplateBtn.addEventListener('click', () => this.loadTemplate());

    // Processing & Export
    this.processBtn.addEventListener('click', () => this.processAllFiles());
    this.exportBtn.addEventListener('click', () => this.exportData());
    this.clearDataBtn.addEventListener('click', () => this.clearData());
  }

  addFiles(newFiles) {
    newFiles.forEach(file => {
      if (!this.files.find(f => f.name === file.name && f.size === file.size)) {
        this.files.push(file);
      }
    });
    this.renderFileList();
  }

  removeFile(index) {
    this.files.splice(index, 1);
    this.renderFileList();
  }

  renderFileList() {
    this.fileList.innerHTML = this.files.map((file, index) => `
      <div class="flex justify-between items-center bg-gray-100 p-2 rounded">
        <span class="truncate flex-1"><i class="far fa-file-pdf text-red-500 mr-2"></i>${file.name}</span>
        <button onclick="app.removeFile(${index})" class="text-red-500 hover:text-red-700 ml-2"><i class="fas fa-times"></i></button>
      </div>
    `).join('');
  }

  // Header Management
  renderHeaders() {
    this.headersContainer.innerHTML = this.headers.map((header, index) => `
      <div class="flex items-center gap-2">
        <input type="text" value="${header}" data-index="${index}" class="header-input flex-1 border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400" placeholder="Header name">
        <button onclick="app.removeHeader(${index})" class="text-red-500 hover:text-red-700"><i class="fas fa-trash"></i></button>
      </div>
    `).join('');
    
    // Bind input change events
    document.querySelectorAll('.header-input').forEach(input => {
      input.addEventListener('change', (e) => {
        const index = parseInt(e.target.dataset.index);
        this.headers[index] = e.target.value.trim();
      });
    });
  }

  addHeader(headerName = 'New Field') {
    this.headers.push(headerName);
    this.renderHeaders();
  }

  removeHeader(index) {
    if (this.headers.length > 1) {
      this.headers.splice(index, 1);
      this.renderHeaders();
    }
  }

  saveTemplate() {
    localStorage.setItem('pdfExtractorHeaders', JSON.stringify(this.headers));
    this.showStatus('Template saved to local storage.', 'success');
  }

  loadTemplateFromStorage() {
    const saved = localStorage.getItem('pdfExtractorHeaders');
    if (saved) {
      try {
        this.headers = JSON.parse(saved);
        this.renderHeaders();
      } catch (e) {
        console.error('Failed to load template', e);
      }
    }
  }

  loadTemplate() {
    this.loadTemplateFromStorage();
    this.showStatus('Template loaded from storage.', 'info');
  }

  // Processing
  async processAllFiles() {
    if (this.files.length === 0) {
      alert('Please upload at least one PDF file.');
      return;
    }

    this.progressContainer.classList.remove('hidden');
    this.extractedData = [];
    this.processBtn.disabled = true;
    
    const totalFiles = this.files.length;
    let processedCount = 0;

    for (const file of this.files) {
      try {
        this.progressText.textContent = `Processing ${file.name}...`;
        const pdfData = await this.pdfProcessor.extractText(file, (progress) => {
          this.progressBar.style.width = `${progress}%`;
        });
        
        const extractedRow = this.extractor.extractFields(pdfData.fullText, this.headers);
        extractedRow['_fileName'] = file.name;
        extractedRow['_status'] = 'Processed';
        
        // Attempt table detection for additional insights
        const tables = this.extractor.detectTable(pdfData.fullText);
        if (tables.length > 0) {
          // Merge first detected table row if headers match potential
          // This is a basic merge; production logic could be more sophisticated
        }
        
        this.extractedData.push(extractedRow);
        processedCount++;
      } catch (error) {
        console.error(`Error processing ${file.name}:`, error);
        this.extractedData.push({
          '_fileName': file.name,
          '_status': 'Error: ' + error.message
        });
        // Ensure headers are still represented
        this.headers.forEach(h => { if (!this.extractedData[this.extractedData.length-1][h]) this.extractedData[this.extractedData.length-1][h] = 'Error'; });
      }
      
      // Update overall progress
      const overallProgress = Math.round((processedCount / totalFiles) * 100);
      this.progressBar.style.width = `${overallProgress}%`;
    }

    this.progressText.textContent = `Processed ${processedCount}/${totalFiles} files.`;
    this.processBtn.disabled = false;
    this.renderTable();
    setTimeout(() => {
      this.progressContainer.classList.add('hidden');
    }, 3000);
  }

  renderTable() {
    const allHeaders = [...this.headers, '_fileName', '_status'];
    
    // Render table header
    this.tableHeaderRow.innerHTML = allHeaders.map(h => `<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">${h}</th>`).join('');
    
    // Render table body
    this.tableBody.innerHTML = this.extractedData.map(row => `
      <tr class="hover:bg-gray-50">
        ${allHeaders.map(header => `
          <td class="px-4 py-2 whitespace-nowrap text-sm text-gray-700 border-r border-gray-100">
            <input type="text" value="${row[header] || ''}" class="w-full bg-transparent focus:outline-none focus:bg-blue-50 rounded px-1" 
                   data-row="${this.extractedData.indexOf(row)}" data-header="${header}">
          </td>
        `).join('')}
      </tr>
    `).join('');
    
    // Bind edit events
    document.querySelectorAll('#tableBody input').forEach(input => {
      input.addEventListener('change', (e) => {
        const rowIndex = parseInt(e.target.dataset.row);
        const header = e.target.dataset.header;
        this.extractedData[rowIndex][header] = e.target.value;
      });
    });

    this.showStatus(`Displaying ${this.extractedData.length} rows.`);
  }

  exportData() {
    if (this.extractedData.length === 0) {
      alert('No data to export. Please process files first.');
      return;
    }
    const exportHeaders = [...this.headers, '_fileName', '_status'];
    this.exporter.exportToExcel(this.extractedData, exportHeaders);
    this.showStatus('Excel file downloaded successfully!', 'success');
  }

  clearData() {
    this.extractedData = [];
    this.renderTable();
    this.showStatus('Data cleared.');
  }

  showStatus(message, type = 'info') {
    this.statusMessage.textContent = message;
    this.statusMessage.className = 'text-sm mt-2';
    if (type === 'success') this.statusMessage.classList.add('text-green-600');
    else if (type === 'error') this.statusMessage.classList.add('text-red-600');
    else this.statusMessage.classList.add('text-gray-500');
  }
}

// Initialize application
window.app = new App();
