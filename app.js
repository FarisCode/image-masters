// State Management
const state = {
    images: [],
    processedImages: [],
    settings: {
        format: 'webp',
        quality: 85,
        maxWidth: null,
        maxHeight: null
    }
};

// DOM Elements (will be initialized after DOM loads)
let elements = {};

// Initialize App
function init() {
    // Initialize DOM elements
    elements = {
        dropZone: document.getElementById('dropZone'),
        fileInput: document.getElementById('fileInput'),
        controlsSection: document.getElementById('controlsSection'),
        imagesSection: document.getElementById('imagesSection'),
        emptyState: document.getElementById('emptyState'),
        imageGrid: document.getElementById('imageGrid'),
        imageCount: document.getElementById('imageCount'),
        formatSelect: document.getElementById('format'),
        qualitySlider: document.getElementById('quality'),
        qualityValue: document.getElementById('qualityValue'),
        maxWidthInput: document.getElementById('maxWidth'),
        maxHeightInput: document.getElementById('maxHeight'),
        processBtn: document.getElementById('processBtn'),
        clearBtn: document.getElementById('clearBtn'),
        downloadAllBtn: document.getElementById('downloadAllBtn')
    };
    
    setupEventListeners();
}

// Event Listeners
function setupEventListeners() {
    // Drop Zone
    elements.dropZone.addEventListener('click', () => elements.fileInput.click());
    elements.dropZone.addEventListener('dragover', handleDragOver);
    elements.dropZone.addEventListener('dragleave', handleDragLeave);
    elements.dropZone.addEventListener('drop', handleDrop);
    
    // File Input
    elements.fileInput.addEventListener('change', handleFileSelect);
    
    // Controls
    elements.formatSelect.addEventListener('change', (e) => {
        state.settings.format = e.target.value;
    });
    
    elements.qualitySlider.addEventListener('input', (e) => {
        state.settings.quality = parseInt(e.target.value);
        elements.qualityValue.textContent = e.target.value;
    });
    
    elements.maxWidthInput.addEventListener('change', (e) => {
        state.settings.maxWidth = e.target.value ? parseInt(e.target.value) : null;
    });
    
    elements.maxHeightInput.addEventListener('change', (e) => {
        state.settings.maxHeight = e.target.value ? parseInt(e.target.value) : null;
    });
    
    // Buttons
    elements.processBtn.addEventListener('click', processImages);
    elements.clearBtn.addEventListener('click', clearAll);
    elements.downloadAllBtn.addEventListener('click', downloadAll);
}

// Drag & Drop Handlers
function handleDragOver(e) {
    e.preventDefault();
    elements.dropZone.classList.add('drag-over');
}

function handleDragLeave(e) {
    e.preventDefault();
    elements.dropZone.classList.remove('drag-over');
}

function handleDrop(e) {
    e.preventDefault();
    elements.dropZone.classList.remove('drag-over');
    
    const files = Array.from(e.dataTransfer.files).filter(file => 
        file.type.match(/image\/(jpeg|png|webp)/)
    );
    
    if (files.length > 0) {
        addFiles(files);
    }
}

// File Selection Handler
function handleFileSelect(e) {
    const files = Array.from(e.target.files);
    if (files.length > 0) {
        addFiles(files);
    }
}

// Add Files to State
async function addFiles(files) {
    for (const file of files) {
        const id = generateId();
        const dataUrl = await readFileAsDataURL(file);
        
        state.images.push({
            id,
            file,
            name: file.name,
            size: file.size,
            type: file.type,
            dataUrl
        });
    }
    
    updateUI();
}

// Process Images
async function processImages() {
    if (state.images.length === 0) return;
    
    elements.processBtn.disabled = true;
    elements.processBtn.innerHTML = '<span class="spinner"></span> Processing...';
    
    state.processedImages = [];
    
    for (let i = 0; i < state.images.length; i++) {
        const image = state.images[i];
        try {
            const processed = await optimizeImage(image);
            state.processedImages.push(processed);
            
            // Replace the image in state
            state.images[i] = {
                ...image,
                processed: processed,
                isProcessed: true
            };
            
            // Update the specific card in the UI
            updateImageCard(image.id, processed);
        } catch (error) {
            console.error('Error processing image:', error);
        }
    }
    
    // Show download all button
    elements.downloadAllBtn.style.display = 'inline-flex';
    
    elements.processBtn.disabled = false;
    elements.processBtn.innerHTML = `
        <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 12a9 9 0 1 1-6.219-8.56"></path>
        </svg>
        Process Images
    `;
}

// Optimize Image
async function optimizeImage(image) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        
        img.onload = () => {
            try {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                
                // Calculate dimensions
                let { width, height } = calculateDimensions(
                    img.width,
                    img.height,
                    state.settings.maxWidth,
                    state.settings.maxHeight
                );
                
                canvas.width = width;
                canvas.height = height;
                
                // Draw image
                ctx.drawImage(img, 0, 0, width, height);
                
                // Convert to target format
                const mimeType = getMimeType(state.settings.format);
                const quality = state.settings.quality / 100;
                
                canvas.toBlob(
                    (blob) => {
                        if (blob) {
                            const reader = new FileReader();
                            reader.onloadend = () => {
                                resolve({
                                    id: image.id,
                                    originalName: image.name,
                                    name: getNewFileName(image.name, state.settings.format),
                                    originalSize: image.size,
                                    size: blob.size,
                                    width,
                                    height,
                                    dataUrl: reader.result,
                                    blob,
                                    format: state.settings.format
                                });
                            };
                            reader.readAsDataURL(blob);
                        } else {
                            reject(new Error('Failed to create blob'));
                        }
                    },
                    mimeType,
                    quality
                );
            } catch (error) {
                reject(error);
            }
        };
        
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = image.dataUrl;
    });
}

// Calculate Dimensions
function calculateDimensions(originalWidth, originalHeight, maxWidth, maxHeight) {
    let width = originalWidth;
    let height = originalHeight;
    
    if (maxWidth && width > maxWidth) {
        height = (maxWidth / width) * height;
        width = maxWidth;
    }
    
    if (maxHeight && height > maxHeight) {
        width = (maxHeight / height) * width;
        height = maxHeight;
    }
    
    return { width: Math.round(width), height: Math.round(height) };
}

// Update Image Card with Processed Data
function updateImageCard(imageId, processedData) {
    const card = document.querySelector(`[data-image-id="${imageId}"]`);
    if (!card) return;
    
    const savings = ((1 - processedData.size / processedData.originalSize) * 100).toFixed(1);
    
    card.className = 'image-card processed';
    card.innerHTML = `
        ${savings > 0 ? `<div class="compression-badge">-${savings}%</div>` : ''}
        <div class="status-badge">Optimized</div>
        <img src="${processedData.dataUrl}" alt="${processedData.name}" class="image-preview">
        <div class="image-info">
            <div class="image-name" title="${processedData.name}">${processedData.name}</div>
            <div class="comparison">
                <div class="comparison-item">
                    <div class="comparison-label">Before</div>
                    <div class="comparison-value">${formatFileSize(processedData.originalSize)}</div>
                </div>
                <div class="comparison-item">
                    <div class="comparison-label">After</div>
                    <div class="comparison-value">${formatFileSize(processedData.size)}</div>
                </div>
                <div class="comparison-item">
                    <div class="comparison-label">Size</div>
                    <div class="comparison-value">${processedData.width}×${processedData.height}</div>
                </div>
            </div>
        </div>
        <button class="btn btn-primary btn-small download-btn" data-id="${imageId}">
            Download
        </button>
    `;
    
    card.querySelector('.download-btn').addEventListener('click', () => {
        downloadImage(processedData);
    });
}

// Update UI
function updateUI() {
    const hasImages = state.images.length > 0;
    
    elements.controlsSection.style.display = hasImages ? 'block' : 'none';
    elements.imagesSection.style.display = hasImages ? 'block' : 'none';
    elements.emptyState.style.display = hasImages ? 'none' : 'flex';
    elements.imageCount.textContent = `(${state.images.length})`;
    
    renderImagePreviews();
}

// Render Image Previews
function renderImagePreviews() {
    elements.imageGrid.innerHTML = '';
    
    state.images.forEach(image => {
        const card = createImageCard(image);
        elements.imageGrid.appendChild(card);
    });
}

// Create Image Card
function createImageCard(image) {
    const card = document.createElement('div');
    card.className = 'image-card';
    card.setAttribute('data-image-id', image.id);
    
    if (image.isProcessed && image.processed) {
        // Show processed version
        const processed = image.processed;
        const savings = ((1 - processed.size / processed.originalSize) * 100).toFixed(1);
        
        card.classList.add('processed');
        card.innerHTML = `
            ${savings > 0 ? `<div class="compression-badge">-${savings}%</div>` : ''}
            <div class="status-badge">Optimized</div>
            <img src="${processed.dataUrl}" alt="${processed.name}" class="image-preview">
            <div class="image-info">
                <div class="image-name" title="${processed.name}">${processed.name}</div>
                <div class="comparison">
                    <div class="comparison-item">
                        <div class="comparison-label">Before</div>
                        <div class="comparison-value">${formatFileSize(processed.originalSize)}</div>
                    </div>
                    <div class="comparison-item">
                        <div class="comparison-label">After</div>
                        <div class="comparison-value">${formatFileSize(processed.size)}</div>
                    </div>
                    <div class="comparison-item">
                        <div class="comparison-label">Size</div>
                        <div class="comparison-value">${processed.width}×${processed.height}</div>
                    </div>
                </div>
            </div>
            <button class="btn btn-primary btn-small download-btn" data-id="${image.id}">
                Download
            </button>
        `;
        
        card.querySelector('.download-btn').addEventListener('click', () => {
            downloadImage(processed);
        });
    } else {
        // Show original version
        card.innerHTML = `
            <div class="status-badge status-pending">Pending</div>
            <img src="${image.dataUrl}" alt="${image.name}" class="image-preview">
            <div class="image-info">
                <div class="image-name" title="${image.name}">${image.name}</div>
                <div class="image-size">
                    <span>${formatFileSize(image.size)}</span>
                    <span>${image.type.split('/')[1].toUpperCase()}</span>
                </div>
            </div>
            <button class="btn btn-small remove-btn" data-id="${image.id}">Remove</button>
        `;
        
        card.querySelector('.remove-btn').addEventListener('click', () => {
            removeImage(image.id);
        });
    }
    
    return card;
}

// Remove Image
function removeImage(id) {
    state.images = state.images.filter(img => img.id !== id);
    state.processedImages = state.processedImages.filter(img => img.id !== id);
    updateUI();
    
    if (state.images.length === 0) {
        elements.downloadAllBtn.style.display = 'none';
    }
}

// Clear All
function clearAll() {
    state.images = [];
    state.processedImages = [];
    elements.fileInput.value = '';
    elements.downloadAllBtn.style.display = 'none';
    updateUI();
}

// Download Image
function downloadImage(image) {
    const link = document.createElement('a');
    link.href = image.dataUrl;
    link.download = image.name;
    link.click();
}

// Download All
function downloadAll() {
    state.processedImages.forEach(image => {
        setTimeout(() => downloadImage(image), 100);
    });
}

// Utility Functions
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

function getMimeType(format) {
    const mimeTypes = {
        webp: 'image/webp',
        jpeg: 'image/jpeg',
        png: 'image/png'
    };
    return mimeTypes[format] || 'image/webp';
}

function getNewFileName(originalName, format) {
    const nameWithoutExt = originalName.replace(/\.[^/.]+$/, '');
    return `${nameWithoutExt}.${format}`;
}

// Initialize on DOM Load
document.addEventListener('DOMContentLoaded', init);
