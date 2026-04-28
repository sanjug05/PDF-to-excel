// app.js - Main application controller

import { PDFProcessor } from './pdfProcessor.js';
import { SmartExtractor } from './extractor.js';
import { ExcelExporter } from './exportUtils.js';

class App {
  constructor() {
    console.log('App initializing...');
    this.pdfProcessor = new PDFProcessor();
    this.extractor = new SmartExtractor();
    this.exporter = new ExcelExporter();
    
    this.files = [];
    this.headers = ['Dealer Name', 'Invoice Number', 'Date', 'Amount'];
    this.extractedData = [];
    
    this.initDOM();
    this.bindEvents();
    this.renderHeaders();
    this.loadTemplateFromStorage();
    console.log('App initialized successfully');
  }

  initDOM() {
    console.log('Initializing DOM elements...');
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
    this.sampleBtn = document.getElementById('sampleBtn');
    this.clearDataBtn = document.getElementById('clearDataBtn');
    this.tableHeaderRow = document.getElementById('tableHeaderRow');
    this.tableBody = document.getElementById('tableBody');
    this.statusMessage = document.getElementById('statusMessage');
    
    // Verify all elements were found
    if (!this.dropZone) console.error('dropZone not found!');
    if (!this.fileInput) console.error('fileInput not found!');
    console.log('DOM elements initialized');
  }

  bindEvents() {
    console.log('Binding events...');
    
    // Drag & Drop with better error handling
    if (this.dropZone) {
      this.dropZone.addEventListener('click', (e) => {
        console.log('Drop zone clicked');
        if (this.fileInput) {
          this.fileInput.click();
        }
      });
      
      this.dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.dropZone.classList.add('border-blue-500', 'bg-blue-50');
      });
      
      this.dropZone.addEventListener('dragleave', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.dropZone.classList.remove('border-blue-500', 'bg-blue-50');
      });
      
      this.dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        console.log('Files dropped');
        this.dropZone.classList.remove('border-blue-500', 'bg-blue-50');
        
        const droppedFiles = Array.from(e.dataTransfer.files).filter(f => 
          f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf')
        );
        console.log('Dropped PDF files:', droppedFiles.length);
        
        if (droppedFiles.length === 0) {
          alert('Please drop PDF files only.');
          return;
        }
        
        this.addFiles(droppedFiles);
      });
    }

    // File input change
    if (this.fileInput) {
      this.fileInput.addEventListener('change', (e) => {
        console.log('File input changed');
        const selectedFiles = Array.from(e.target.files).filter(f => 
          f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf')
        );
        console.log('Selected PDF files:', selectedFiles.length);
        
        if (selectedFiles.length === 0) {
          alert('Please select PDF files only.');
          return;
        }
        
        this.addFiles(selectedFiles);
        this.fileInput.value = '';
      });
    }

    // Header management
    if (this.addHeaderBtn) {
      this.addHeaderBtn.addEventListener('click', () => {
        console.log('Add header button clicked');
        this.addHeader();
      });
    }
    
    if (this.saveTemplateBtn) {
      this.saveTemplateBtn.addEventListener('click', () => this.saveTemplate());
    }
    
    if (this.loadTemplateBtn) {
      this.loadTemplateBtn.addEventListener('click', () => this.loadTemplate());
    }

    // Processing & Export
    if (this.processBtn) {
      this.processBtn.addEventListener('click', () => this.processAllFiles());
    }
    
    if (this.exportBtn) {
      this.exportBtn.addEventListener('click', () => this.exportData());
    }
    
    if (this.sampleBtn) {
      this.sampleBtn.addEventListener('click', () => this.downloadSample());
    }
    
    if (this.clearDataBtn) {
      this.clearDataBtn.addEventListener('click', () => this.clearData());
    }
    
    console.log('Events bound successfully');
  }

  addFiles(newFiles) {
    console.log('Adding files:', newFiles.length);
    newFiles.forEach(file => {
      if (!this.files.find(f => f.name === file.name && f.size === file.size)) {
        this.files.push(file);
      }
    });
    console.log('Total files:', this.files.length);
    this.renderFileList();
    this.showStatus(`${newFiles.length} file(s) added. Ready to process.`, 'success');
  }

  removeFile(index) {
    console.log('Removing file at index:', index);
    this.files.splice(index, 1);
    this.renderFileList();
  }

  renderFileList() {
    if (this.fileList) {
      this.fileList.innerHTML = this.files.map((file, index) => `
        <div class="flex justify-between items-center bg-gray-100 p-2 rounded">
          <span class="truncate flex-1">
            <i class="far fa-file-pdf text-red-500 mr-2"></i>${file.name}
          </span>
          <button class="remove-file-btn text-red-500 hover:text-red-700 ml-2" data-index="${index}">
            <i class="fas fa-times"></i>
          </button>
        </div>
      `).join('');
      
      // Bind remove buttons
      document.querySelectorAll('.remove-file-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const index = parseInt(e.currentTarget.dataset.index);
          this.removeFile(index);
        });
      });
    }
  }

  renderHeaders() {
    console.log('Rendering headers:', this.headers);
    if (this.headersContainer) {
      this.headersContainer.innerHTML = this.headers.map((header, index) => `
        <div class="flex items-center gap-2">
          <input type="text" value="${header}" data-index="${index}" 
                 class="header-input flex-1 border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400" 
                 placeholder="Header name">
          <button class="remove-header-btn text-red-500 hover:text-red-700" data-index="${index}">
            <i class="fas fa-trash"></i>
          </button>
        </div>
      `).join('');
      
      // Bind header input changes
      document.querySelectorAll('.header-input').forEach(input => {
        input.addEventListener('change', (e) => {
          const index = parseInt(e.target.dataset.index);
          this.headers[index] = e.target.value.trim();
          console.log('Header updated:', this.headers);
        });
      });
      
      // Bind remove header buttons
      document.querySelectorAll('.remove-header-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const index = parseInt(e.currentTarget.dataset.index);
          this.removeHeader(index);
        });
      });
    }
  }

  addHeader(headerName = 'New Field') {
    console.log('Adding header:', headerName);
    this.headers.push(headerName);
    this.renderHeaders();
  }

  removeHeader(index) {
    if (this.headers.length > 1) {
      console.log('Removing header at index:', index);
      this.headers.splice(index, 1);
      this.renderHeaders();
    } else {
      alert('You must have at least one header.');
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
        this.showStatus('Template loaded from storage.', 'info');
      } catch (e) {
        console.error('Failed to load template', e);
      }
    }
  }

  loadTemplate() {
    this.loadTemplateFromStorage();
  }

  async processAllFiles() {
    if (this.files.length === 0) {
      alert('Please upload at least one PDF file first.');
      return;
    }

    console.log('Processing files:', this.files.length);
    this.progressContainer.classList.remove('hidden');
    this.extractedData = [];
    this.processBtn.disabled = true;
    this.processBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Processing...';
    
    const totalFiles = this.files.length;
    let processedCount = 0;

    for (const file of this.files) {
      try {
        console.log('Processing:', file.name);
        this.progressText.textContent = `Processing ${file.name}...`;
        
        const pdfData = await this.pdfProcessor.extractText(file, (progress) => {
          this.progressBar.style.width = `${progress}%`;
        });
        
        console.log('PDF text extracted, length:', pdfData.fullText.length);
        
        const extractedRow = this.extractor.extractFields(pdfData.fullText, this.headers);
        extractedRow['_fileName'] = file.name;
        extractedRow['_status'] = 'Processed';
        
        console.log('Extracted row:', extractedRow);
        this.extractedData.push(extractedRow);
        processedCount++;
        
      } catch (error) {
        console.error(`Error processing ${file.name}:`, error);
        const errorRow = {
          '_fileName': file.name,
          '_status': 'Error: ' + error.message
        };
        this.headers.forEach(h => { 
          errorRow[h] = 'Error'; 
        });
        this.extractedData.push(errorRow);
      }
      
      const overallProgress = Math.round((processedCount / totalFiles) * 100);
      this.progressBar.style.width = `${overallProgress}%`;
    }

    this.progressText.textContent = `Processed ${processedCount}/${totalFiles} files.`;
    this.processBtn.disabled = false;
    this.processBtn.innerHTML = '<i class="fas fa-cogs mr-2"></i>Extract Data';
    this.renderTable();
    this.showStatus(`Successfully processed ${processedCount} file(s).`, 'success');
    
    setTimeout(() => {
      this.progressContainer.classList.add('hidden');
    }, 3000);
  }

  renderTable() {
    const allHeaders = [...this.headers, '_fileName', '_status'];
    
    this.tableHeaderRow.innerHTML = allHeaders.map(h => 
      `<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">${h}</th>`
    ).join('');
    
    this.tableBody.innerHTML = this.extractedData.map((row, rowIndex) => `
      <tr class="hover:bg-gray-50">
        ${allHeaders.map(header => `
          <td class="px-4 py-2 whitespace-nowrap text-sm text-gray-700 border-r border-gray-100">
            <input type="text" value="${row[header] || ''}" 
                   class="w-full bg-transparent focus:outline-none focus:bg-blue-50 rounded px-1" 
                   data-row="${rowIndex}" data-header="${header}">
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

  downloadSample() {
    if (this.headers.length === 0) {
      alert('Please add at least one header.');
      return;
    }
    this.exporter.downloadSampleTemplate(this.headers);
    this.showStatus('Sample Excel template downloaded!', 'success');
  }

  clearData() {
    this.extractedData = [];
    this.files = [];
    this.renderFileList();
    this.renderTable();
    this.showStatus('All data cleared.');
  }

  showStatus(message, type = 'info') {
    if (this.statusMessage) {
      this.statusMessage.textContent = message;
      this.statusMessage.className = 'text-sm mt-2';
      if (type === 'success') this.statusMessage.classList.add('text-green-600');
      else if (type === 'error') this.statusMessage.classList.add('text-red-600');
      else this.statusMessage.classList.add('text-gray-500');
    }
  }
}

// Initialize application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM loaded, creating App instance');
  window.app = new App();
});
