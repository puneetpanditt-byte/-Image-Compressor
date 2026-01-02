class ImageCompressor {
    constructor() {
        this.images = [];
        this.maxFiles = 20;
        this.maxFileSize = 10 * 1024 * 1024; // 10MB
        this.init();
    }

    init() {
        this.setupEventListeners();
    }

    setupEventListeners() {
        const dropZone = document.getElementById('dropZone');
        const fileInput = document.getElementById('fileInput');
        const clearQueue = document.getElementById('clearQueue');
        const compressAll = document.getElementById('compressAll');
        const downloadAll = document.getElementById('downloadAll');

        // Drop zone events
        dropZone.addEventListener('click', () => fileInput.click());
        dropZone.addEventListener('dragover', this.handleDragOver.bind(this));
        dropZone.addEventListener('dragleave', this.handleDragLeave.bind(this));
        dropZone.addEventListener('drop', this.handleDrop.bind(this));

        // File input event
        fileInput.addEventListener('change', this.handleFileSelect.bind(this));

        // Button events
        clearQueue.addEventListener('click', this.clearQueue.bind(this));
        compressAll.addEventListener('click', this.compressAll.bind(this));
        downloadAll.addEventListener('click', this.downloadAll.bind(this));
    }

    handleDragOver(e) {
        e.preventDefault();
        e.stopPropagation();
        document.getElementById('dropZone').classList.add('dragover');
    }

    handleDragLeave(e) {
        e.preventDefault();
        e.stopPropagation();
        document.getElementById('dropZone').classList.remove('dragover');
    }

    handleDrop(e) {
        e.preventDefault();
        e.stopPropagation();
        document.getElementById('dropZone').classList.remove('dragover');
        
        const files = Array.from(e.dataTransfer.files);
        this.processFiles(files);
    }

    handleFileSelect(e) {
        const files = Array.from(e.target.files);
        this.processFiles(files);
    }

    processFiles(files) {
        const imageFiles = files.filter(file => this.isValidImage(file));
        
        if (imageFiles.length === 0) {
            this.showNotification('Please select valid image files (JPEG, PNG, GIF)', 'error');
            return;
        }

        if (this.images.length + imageFiles.length > this.maxFiles) {
            this.showNotification(`Maximum ${this.maxFiles} files allowed`, 'error');
            return;
        }

        imageFiles.forEach(file => {
            if (file.size > this.maxFileSize) {
                this.showNotification(`File ${file.name} is too large (max 10MB)`, 'error');
                return;
            }

            const reader = new FileReader();
            reader.onload = (e) => {
                const imageData = {
                    id: Date.now() + Math.random(),
                    name: file.name,
                    size: file.size,
                    type: file.type,
                    dataURL: e.target.result,
                    compressedDataURL: null,
                    compressedSize: null,
                    quality: 80,
                    status: 'pending'
                };
                this.images.push(imageData);
                this.updateQueue();
            };
            reader.readAsDataURL(file);
        });
    }

    isValidImage(file) {
        const validTypes = ['image/jpeg', 'image/png', 'image/gif'];
        return validTypes.includes(file.type);
    }

    updateQueue() {
        const queueSection = document.getElementById('imageQueue');
        const queueContainer = document.getElementById('queueContainer');
        const queueCount = document.getElementById('queueCount');

        if (this.images.length > 0) {
            queueSection.classList.remove('hidden');
            queueCount.textContent = this.images.length;
            
            queueContainer.innerHTML = this.images.map(image => this.createQueueItem(image)).join('');
            
            // Add event listeners to queue items
            this.images.forEach(image => {
                const qualitySlider = document.getElementById(`quality-${image.id}`);
                const compressBtn = document.getElementById(`compress-${image.id}`);
                const removeBtn = document.getElementById(`remove-${image.id}`);

                if (qualitySlider) {
                    qualitySlider.addEventListener('input', (e) => {
                        image.quality = parseInt(e.target.value);
                        document.getElementById(`quality-value-${image.id}`).textContent = `${image.quality}%`;
                    });
                }

                if (compressBtn) {
                    compressBtn.addEventListener('click', () => this.compressImage(image));
                }

                if (removeBtn) {
                    removeBtn.addEventListener('click', () => this.removeFromQueue(image.id));
                }
            });
        } else {
            queueSection.classList.add('hidden');
        }
    }

    createQueueItem(image) {
        return `
            <div class="image-preview bg-gray-50 rounded-lg p-4 border border-gray-200" id="queue-item-${image.id}">
                <div class="relative mb-3">
                    <img src="${image.dataURL}" alt="${image.name}" class="w-full h-32 object-cover rounded">
                    <button id="remove-${image.id}" class="absolute top-2 right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center hover:bg-red-600 transition">
                        <i class="fas fa-times text-xs"></i>
                    </button>
                </div>
                <h4 class="font-semibold text-sm text-gray-800 mb-1 truncate">${image.name}</h4>
                <p class="text-xs text-gray-500 mb-3">${this.formatFileSize(image.size)}</p>
                
                <div class="space-y-2">
                    <div class="flex items-center justify-between">
                        <label class="text-xs text-gray-600">Quality:</label>
                        <span id="quality-value-${image.id}" class="text-xs font-semibold text-blue-600">${image.quality}%</span>
                    </div>
                    <input type="range" id="quality-${image.id}" min="10" max="100" value="${image.quality}" 
                           class="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600">
                    
                    <button id="compress-${image.id}" 
                            class="w-full bg-blue-600 text-white py-2 rounded text-sm hover:bg-blue-700 transition">
                        <i class="fas fa-compress mr-1"></i>Compress
                    </button>
                </div>
                
                <div id="status-${image.id}" class="mt-2 text-xs text-center"></div>
            </div>
        `;
    }

    async compressImage(image) {
        const statusEl = document.getElementById(`status-${image.id}`);
        const compressBtn = document.getElementById(`compress-${image.id}`);
        
        statusEl.innerHTML = '<div class="loading-spinner mx-auto"></div>';
        compressBtn.disabled = true;

        try {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                
                // Resize large images for better compression
                let { width, height } = this.calculateOptimalSize(img.width, img.height, image.quality);
                
                canvas.width = width;
                canvas.height = height;
                
                // Fill with white background for better JPEG compression
                if (image.type === 'image/jpeg') {
                    ctx.fillStyle = '#FFFFFF';
                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                }
                
                // Use better image scaling
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';
                ctx.drawImage(img, 0, 0, width, height);
                
                // Use JPEG for better compression, PNG for transparency
                let mimeType = 'image/jpeg';
                if (image.type === 'image/png' && this.hasTransparency(img, canvas, ctx)) {
                    mimeType = 'image/png';
                }
                
                const quality = Math.max(0.1, Math.min(1.0, image.quality / 100));
                
                canvas.toBlob((blob) => {
                    // If PNG compression didn't reduce size, try JPEG
                    if (mimeType === 'image/png' && blob.size >= image.size * 0.95) {
                        canvas.toBlob((jpegBlob) => {
                            this.processCompressedImage(image, jpegBlob, statusEl, compressBtn);
                        }, 'image/jpeg', quality);
                    } else {
                        this.processCompressedImage(image, blob, statusEl, compressBtn);
                    }
                }, mimeType, quality);
            };
            img.src = image.dataURL;
        } catch (error) {
            console.error('Compression error:', error);
            statusEl.innerHTML = '<div class="text-red-600"><i class="fas fa-exclamation-circle mr-1"></i>Error</div>';
            compressBtn.disabled = false;
        }
    }

    calculateOptimalSize(originalWidth, originalHeight, quality) {
        // For lower quality, we can reduce dimensions more aggressively
        const maxDimension = quality >= 80 ? 2048 : quality >= 60 ? 1920 : 1600;
        
        let width = originalWidth;
        let height = originalHeight;
        
        if (width > maxDimension || height > maxDimension) {
            if (width > height) {
                height = (height * maxDimension) / width;
                width = maxDimension;
            } else {
                width = (width * maxDimension) / height;
                height = maxDimension;
            }
        }
        
        return { width: Math.round(width), height: Math.round(height) };
    }

    hasTransparency(img, canvas, ctx) {
        // Simple check for transparency - sample a few pixels
        const imageData = ctx.getImageData(0, 0, Math.min(10, canvas.width), Math.min(10, canvas.height));
        const data = imageData.data;
        
        for (let i = 3; i < data.length; i += 4) {
            if (data[i] < 255) {
                return true;
            }
        }
        return false;
    }

    processCompressedImage(image, blob, statusEl, compressBtn) {
        const reader = new FileReader();
        reader.onload = () => {
            image.compressedDataURL = reader.result;
            image.compressedSize = blob.size;
            image.status = 'compressed';
            
            const compressionRatio = ((image.size - blob.size) / image.size * 100).toFixed(1);
            
            if (blob.size < image.size) {
                statusEl.innerHTML = `
                    <div class="text-green-600 font-semibold">
                        <i class="fas fa-check-circle mr-1"></i>
                        Saved ${compressionRatio}% (${this.formatFileSize(blob.size)})
                    </div>
                `;
            } else {
                statusEl.innerHTML = `
                    <div class="text-yellow-600 font-semibold">
                        <i class="fas fa-info-circle mr-1"></i>
                        Already optimized (${this.formatFileSize(blob.size)})
                    </div>
                `;
            }
            
            compressBtn.innerHTML = '<i class="fas fa-redo mr-1"></i>Recompress';
            compressBtn.disabled = false;
            
            this.updateResults();
        };
        reader.readAsDataURL(blob);
    }

    async compressAll() {
        const pendingImages = this.images.filter(img => img.status !== 'compressed');
        
        for (const image of pendingImages) {
            await this.compressImage(image);
            await new Promise(resolve => setTimeout(resolve, 100)); // Small delay between compressions
        }
    }

    updateResults() {
        const resultsSection = document.getElementById('results');
        const resultsContainer = document.getElementById('resultsContainer');
        const compressedImages = this.images.filter(img => img.status === 'compressed');

        if (compressedImages.length > 0) {
            resultsSection.classList.remove('hidden');
            resultsContainer.innerHTML = compressedImages.map(image => this.createResultItem(image)).join('');
            
            // Add download event listeners
            compressedImages.forEach(image => {
                const downloadBtn = document.getElementById(`download-${image.id}`);
                if (downloadBtn) {
                    downloadBtn.addEventListener('click', () => this.downloadImage(image));
                }
            });
        }
    }

    createResultItem(image) {
        const compressionRatio = ((image.size - image.compressedSize) / image.size * 100).toFixed(1);
        
        return `
            <div class="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <div class="grid grid-cols-2 gap-2 mb-3">
                    <div>
                        <p class="text-xs text-gray-500 mb-1">Original</p>
                        <img src="${image.dataURL}" alt="Original" class="w-full h-24 object-cover rounded">
                        <p class="text-xs text-gray-600 mt-1">${this.formatFileSize(image.size)}</p>
                    </div>
                    <div>
                        <p class="text-xs text-gray-500 mb-1">Compressed</p>
                        <img src="${image.compressedDataURL}" alt="Compressed" class="w-full h-24 object-cover rounded">
                        <p class="text-xs text-green-600 mt-1">${this.formatFileSize(image.compressedSize)}</p>
                    </div>
                </div>
                
                <div class="text-center mb-3">
                    <div class="inline-flex items-center bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm">
                        <i class="fas fa-arrow-down mr-1"></i>
                        ${compressionRatio}% smaller
                    </div>
                </div>
                
                <button id="download-${image.id}" 
                        class="w-full bg-green-600 text-white py-2 rounded text-sm hover:bg-green-700 transition">
                    <i class="fas fa-download mr-1"></i>Download
                </button>
            </div>
        `;
    }

    downloadImage(image) {
        const link = document.createElement('a');
        link.href = image.compressedDataURL;
        
        const originalName = image.name.split('.').slice(0, -1).join('.');
        const extension = image.type.split('/')[1];
        link.download = `${originalName}_compressed.${extension}`;
        
        link.click();
    }

    downloadAll() {
        const compressedImages = this.images.filter(img => img.status === 'compressed');
        compressedImages.forEach(image => this.downloadImage(image));
    }

    removeFromQueue(imageId) {
        this.images = this.images.filter(img => img.id !== imageId);
        this.updateQueue();
        this.updateResults();
    }

    clearQueue() {
        this.images = [];
        this.updateQueue();
        document.getElementById('results').classList.add('hidden');
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `fixed top-4 right-4 px-6 py-3 rounded-lg shadow-lg z-50 fade-in ${
            type === 'error' ? 'bg-red-500 text-white' : 'bg-blue-500 text-white'
        }`;
        notification.innerHTML = `
            <div class="flex items-center">
                <i class="fas ${type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle'} mr-2"></i>
                ${message}
            </div>
        `;
        
        document.body.appendChild(notification);
        
        // Remove after 3 seconds
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }
}

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    new ImageCompressor();
});

// Add smooth scrolling for navigation links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    });
});
