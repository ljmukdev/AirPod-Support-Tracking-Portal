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
            // If photoPath already starts with /, use it directly, otherwise add API_BASE
            const imageUrl = photoPath.startsWith('/') 
                ? (API_BASE || '') + photoPath 
                : (API_BASE || '') + '/' + photoPath;
            
            const photoItem = document.createElement('div');
            photoItem.className = 'photo-item';
            photoItem.onclick = () => openPhotoModal(photoPath);
            
            const img = document.createElement('img');
            img.src = imageUrl;
            img.alt = `Product photo ${index + 1}`;
            img.loading = 'lazy';
            
            // Add error handling for image loading
            img.onerror = function() {
                console.error('Failed to load image:', imageUrl);
                this.style.display = 'none';
                // Optionally show a placeholder or error message
                const errorMsg = document.createElement('div');
                errorMsg.style.padding = '20px';
                errorMsg.style.textAlign = 'center';
                errorMsg.style.color = '#999';
                errorMsg.textContent = 'Image not available';
                photoItem.appendChild(errorMsg);
            };
            
            // Log for debugging
            console.log('Loading photo:', imageUrl);
            
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
    const imageUrl = photoPath.startsWith('/') 
        ? (API_BASE || '') + photoPath 
        : (API_BASE || '') + '/' + photoPath;
    
    modalImage.src = imageUrl;
    modalImage.onerror = function() {
        console.error('Failed to load modal image:', imageUrl);
        this.alt = 'Image not available';
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

