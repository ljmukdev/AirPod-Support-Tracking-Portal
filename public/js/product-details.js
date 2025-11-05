// Product Details Page JavaScript

var API_BASE = window.API_BASE || '';

// Get security barcode from sessionStorage or URL
function getSecurityBarcode() {
    // Try sessionStorage first
    const fromStorage = sessionStorage.getItem('securityBarcode');
    if (fromStorage) return fromStorage;
    
    // Try URL parameter
    const urlParams = new URLSearchParams(window.location.search);
    const fromUrl = urlParams.get('barcode');
    if (fromUrl) return fromUrl;
    
    // Redirect to home if no barcode found
    window.location.href = 'index.html';
    return null;
}

// Load product details
async function loadProductDetails() {
    const securityBarcode = getSecurityBarcode();
    if (!securityBarcode) return;
    
    const loadingMessage = document.getElementById('loadingMessage');
    const productDetails = document.getElementById('productDetails');
    const errorMessage = document.getElementById('errorMessage');
    
    try {
        const response = await fetch(`${API_BASE}/api/product-info/${encodeURIComponent(securityBarcode)}`);
        const data = await response.json();
        
        if (response.ok) {
            // Hide loading, show details
            loadingMessage.style.display = 'none';
            productDetails.style.display = 'block';
            
            // Populate product info
            populateProductInfo(data, securityBarcode);
        } else {
            loadingMessage.style.display = 'none';
            errorMessage.textContent = data.error || 'Product not found';
            errorMessage.style.display = 'block';
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 3000);
        }
    } catch (error) {
        console.error('Error loading product details:', error);
        loadingMessage.style.display = 'none';
        errorMessage.textContent = 'Error loading product details. Please try again.';
        errorMessage.style.display = 'block';
    }
}

// Populate product information
function populateProductInfo(data, securityBarcode) {
    // Product type
    const partTypeMap = {
        'left': 'Left AirPod',
        'right': 'Right AirPod',
        'case': 'Charging Case'
    };
    const productType = partTypeMap[data.part_type] || 'AirPod Part';
    document.getElementById('productType').textContent = productType;
    
    // Product info cards
    document.getElementById('serialNumber').textContent = data.serial_number || 'N/A';
    document.getElementById('partModelNumber').textContent = data.part_model_number || 'N/A';
    document.getElementById('generation').textContent = data.generation || 'N/A';
    document.getElementById('securityCode').textContent = securityBarcode;
    
    // Certificate details
    document.getElementById('certPartType').textContent = productType;
    document.getElementById('certSerialNumber').textContent = data.serial_number || 'N/A';
    document.getElementById('certPartModel').textContent = data.part_model_number || 'N/A';
    document.getElementById('certGeneration').textContent = data.generation || 'N/A';
    
    // Format dates
    if (data.date_added) {
        const testDate = new Date(data.date_added);
        document.getElementById('certTestDate').textContent = testDate.toLocaleDateString('en-GB', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        });
        document.getElementById('certDateAdded').textContent = `Tested on ${testDate.toLocaleDateString('en-GB', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        })}`;
    } else {
        document.getElementById('certTestDate').textContent = new Date().toLocaleDateString('en-GB', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        });
        document.getElementById('certDateAdded').textContent = `Tested on ${new Date().toLocaleDateString('en-GB', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        })}`;
    }
    
    // Display photos if available
    console.log('Photos data received:', data.photos);
    if (data.photos && data.photos.length > 0) {
        const photosSection = document.getElementById('photosSection');
        const photosGrid = document.getElementById('photosGrid');
        
        photosSection.style.display = 'block';
        photosGrid.innerHTML = '';
        
        data.photos.forEach((photoPath, index) => {
            // Ensure photoPath is a string and properly formatted
            if (!photoPath || typeof photoPath !== 'string') {
                console.warn('Invalid photo path:', photoPath);
                return;
            }
            
            // Construct full image URL
            // Photos are stored as /uploads/filename.jpg in database
            // Express serves static files from 'public', so /uploads/file.jpg resolves to public/uploads/file.jpg
            let imageUrl = photoPath;
            
            // If photoPath doesn't start with /, add it
            if (!photoPath.startsWith('/')) {
                imageUrl = '/' + photoPath;
            }
            
            // If API_BASE is set (for proxied deployments), prepend it
            if (API_BASE && API_BASE.trim() !== '') {
                imageUrl = API_BASE + imageUrl;
            }
            
            console.log(`Photo ${index + 1}: Original path: "${photoPath}", Final URL: "${imageUrl}"`);
            
            const photoItem = document.createElement('div');
            photoItem.className = 'photo-item';
            photoItem.onclick = () => openPhotoModal(photoPath);
            
            const img = document.createElement('img');
            img.src = imageUrl;
            img.alt = `Product photo ${index + 1}`;
            img.loading = 'lazy';
            
            // Add success handler to verify image loaded
            img.onload = function() {
                console.log('Successfully loaded image:', imageUrl);
            };
            
            // Add error handling for image loading
            img.onerror = function() {
                console.error('Failed to load image:', imageUrl);
                console.error('Tried to load from:', this.src);
                console.error('Photo path from database:', photoPath);
                
                // Hide the broken image
                this.style.display = 'none';
                
                // Show placeholder instead of error message
                const placeholder = document.createElement('div');
                placeholder.style.padding = '40px 20px';
                placeholder.style.textAlign = 'center';
                placeholder.style.color = '#999';
                placeholder.style.backgroundColor = '#f5f5f5';
                placeholder.style.borderRadius = '4px';
                placeholder.style.display = 'flex';
                placeholder.style.flexDirection = 'column';
                placeholder.style.alignItems = 'center';
                placeholder.style.justifyContent = 'center';
                placeholder.style.minHeight = '200px';
                placeholder.innerHTML = `
                    <div style="font-size: 48px; margin-bottom: 10px;">📷</div>
                    <p style="margin: 0; font-size: 0.9rem;">Photo unavailable</p>
                    <small style="color: #bbb; font-size: 0.75rem; margin-top: 5px;">File may have been removed</small>
                `;
                photoItem.innerHTML = '';
                photoItem.appendChild(placeholder);
            };
            
            photoItem.appendChild(img);
            photosGrid.appendChild(photoItem);
        });
    } else {
        console.log('No photos found for product. Photos array:', data.photos);
    }
}

// Open photo modal
function openPhotoModal(photoPath) {
    const modal = document.getElementById('photoModal');
    const modalImage = document.getElementById('modalImage');
    
    // Construct full image URL (same logic as above)
    let imageUrl = photoPath;
    if (!photoPath.startsWith('/')) {
        imageUrl = '/' + photoPath;
    }
    if (API_BASE && API_BASE.trim() !== '') {
        imageUrl = API_BASE + imageUrl;
    }
    
    console.log('Opening modal with image URL:', imageUrl);
    modalImage.src = imageUrl;
    modalImage.onerror = function() {
        console.error('Failed to load modal image:', imageUrl);
        this.alt = 'Image not available';
    };
    modalImage.onload = function() {
        console.log('Modal image loaded successfully:', imageUrl);
    };
    modal.classList.add('active');
}

// Close photo modal
function closePhotoModal() {
    const modal = document.getElementById('photoModal');
    modal.classList.remove('active');
}

// Close modal on background click
document.getElementById('photoModal').addEventListener('click', (e) => {
    if (e.target.id === 'photoModal') {
        closePhotoModal();
    }
});

// Close modal on Escape key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closePhotoModal();
    }
});

// Load product details when page loads
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadProductDetails);
} else {
    loadProductDetails();
}

