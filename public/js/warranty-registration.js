// Product Record JavaScript

// Define API_BASE globally if not already defined
if (typeof window.API_BASE === 'undefined') {
    window.API_BASE = '';
}
var API_BASE = window.API_BASE;

// Utility functions
function showError(message) {
    console.error('Error:', message);
    // Could add a visible error display if needed
    alert(message);
}

// Photo carousel and modal functionality
let currentPhotoIndex = 0;
let photos = [];

// Load product info from sessionStorage or URL
function loadProductInfo() {
    const urlParams = new URLSearchParams(window.location.search);
    const barcode = urlParams.get('barcode') || sessionStorage.getItem('securityBarcode');
    
    if (!barcode) {
        showError('No product found. Please start from the home page.');
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 2000);
        return;
    }
    
    // Store barcode in sessionStorage
    sessionStorage.setItem('securityBarcode', barcode);
    
    // Display security code immediately
    const securityCodeEl = document.getElementById('securityCode');
    if (securityCodeEl) {
        securityCodeEl.textContent = barcode;
    }
    
    // Fetch product details
    fetch(`${API_BASE}/api/product-info/${encodeURIComponent(barcode)}`)
        .then(res => {
            if (!res.ok) {
                throw new Error(`HTTP error! status: ${res.status}`);
            }
            return res.json();
        })
        .then(data => {
            console.log('Product data received:', data); // Debug log
            
            if (data.error) {
                showError('Product not found. Please check your security code.');
                return;
            }
            
            // Display product info in the new tile format
            const productTitleEl = document.getElementById('productTitle');
            const productItemEl = document.getElementById('productItem');
            const productNameEl = document.getElementById('productName');
            const productModelEl = document.getElementById('productModel');
            const serialNumberEl = document.getElementById('serialNumber');
            const securityCodeEl = document.getElementById('securityCode');
            const productImageEl = document.getElementById('productImage');
            const productImagePlaceholder = document.getElementById('productImagePlaceholder');
            
            // Build product details
                const partTypeMap = {
                    'left': 'Left AirPod',
                    'right': 'Right AirPod',
                    'case': 'Charging Case'
                };
            const partType = partTypeMap[data.part_type] || data.part_type || 'Unknown';
            const productTitle = `${partType}${data.generation ? ' - ' + data.generation : ''}`;
            
            // Display product title
            if (productTitleEl) {
                productTitleEl.textContent = productTitle;
            }
            
            // Display item (part type)
            if (productItemEl) {
                productItemEl.textContent = partType;
            }
            
            // Display product name (generation)
            if (productNameEl) {
                productNameEl.textContent = data.generation || 'N/A';
            }
            
            // Display product code (model number)
            if (productModelEl) {
                productModelEl.textContent = data.part_model_number || 'N/A';
            }
            
            // Display serial number
            if (serialNumberEl) {
                serialNumberEl.textContent = data.serial_number || 'N/A';
            }
            
            // Display security code
            if (securityCodeEl) {
                securityCodeEl.textContent = barcode;
            }
            
            // Display product image if available
            if (data.photos && data.photos.length > 0) {
                const firstPhoto = data.photos[0];
                // Ensure photo path is correct
                const photoPath = firstPhoto.startsWith('/') ? firstPhoto : `/${firstPhoto}`;
                if (productImageEl) {
                    productImageEl.src = photoPath;
                    productImageEl.style.display = 'block';
                    productImageEl.onerror = function() {
                        // If image fails to load, show placeholder
                        this.style.display = 'none';
                        if (productImagePlaceholder) {
                            productImagePlaceholder.style.display = 'flex';
                        }
                    };
                    if (productImagePlaceholder) {
                        productImagePlaceholder.style.display = 'none';
                    }
                }
            } else {
                // No photos, ensure placeholder is visible
                if (productImageEl) {
                    productImageEl.style.display = 'none';
                }
                if (productImagePlaceholder) {
                    productImagePlaceholder.style.display = 'flex';
                }
            }
            
            // Setup photo carousel
            setupPhotoCarousel(data.photos || []);
        })
        .catch(err => {
            console.error('Error loading product:', err);
            showError('Failed to load product information. Please try again.');
        });
}

function setupPhotoCarousel(photoArray) {
    photos = photoArray || [];
    const carouselSection = document.getElementById('photoCarouselSection');
    const carouselContainer = document.getElementById('carouselContainer');
    const carouselIndicators = document.getElementById('carouselIndicators');
    
    if (!carouselSection || !carouselContainer || !carouselIndicators) {
        return;
    }
    
    // Hide carousel if no photos
    if (photos.length === 0) {
        carouselSection.style.display = 'none';
        return;
    }
    
    // Show carousel
    carouselSection.style.display = 'block';
    
    // Clear existing content
    carouselContainer.innerHTML = '';
    carouselIndicators.innerHTML = '';
    
    // Add photos to carousel
    photos.forEach((photo, index) => {
        const photoPath = photo.startsWith('/') ? photo : `/${photo}`;
        
        // Create photo element
        const photoDiv = document.createElement('div');
        photoDiv.className = 'carousel-photo';
        photoDiv.dataset.index = index;
        
        const img = document.createElement('img');
        img.src = photoPath;
        img.alt = `Product photo ${index + 1}`;
        img.onerror = function() {
            photoDiv.style.display = 'none';
        };
        
        photoDiv.appendChild(img);
        photoDiv.addEventListener('click', () => openModal(index));
        carouselContainer.appendChild(photoDiv);
        
        // Create indicator
        const indicator = document.createElement('div');
        indicator.className = 'carousel-indicator' + (index === 0 ? ' active' : '');
        indicator.dataset.index = index;
        indicator.addEventListener('click', () => scrollToPhoto(index));
        carouselIndicators.appendChild(indicator);
    });
    
    // Setup carousel navigation
    const prevButton = document.getElementById('carouselPrev');
    const nextButton = document.getElementById('carouselNext');
    
    if (prevButton) {
        prevButton.addEventListener('click', () => scrollCarousel(-1));
    }
    
    if (nextButton) {
        nextButton.addEventListener('click', () => scrollCarousel(1));
    }
    
    // Update button states
    updateCarouselButtons();
}

function scrollCarousel(direction) {
    const container = document.getElementById('carouselContainer');
    if (!container) return;
    
    const photoWidth = 150 + 12; // width + gap
    const scrollAmount = photoWidth * direction;
    
    container.scrollBy({
        left: scrollAmount,
        behavior: 'smooth'
    });
    
    // Update active indicator after scroll
    setTimeout(() => {
        updateActiveIndicator();
    }, 300);
}

function scrollToPhoto(index) {
    const container = document.getElementById('carouselContainer');
    if (!container) return;
    
    const photoWidth = 150 + 12; // width + gap
    container.scrollTo({
        left: photoWidth * index,
        behavior: 'smooth'
    });
    
    updateActiveIndicator(index);
}

function updateActiveIndicator(activeIndex) {
    const indicators = document.querySelectorAll('.carousel-indicator');
    const container = document.getElementById('carouselContainer');
    
    if (activeIndex === undefined && container) {
        const scrollLeft = container.scrollLeft;
        const photoWidth = 150 + 12;
        activeIndex = Math.round(scrollLeft / photoWidth);
    }
    
    indicators.forEach((indicator, index) => {
        if (index === activeIndex) {
            indicator.classList.add('active');
        } else {
            indicator.classList.remove('active');
        }
    });
}

function updateCarouselButtons() {
    const prevButton = document.getElementById('carouselPrev');
    const nextButton = document.getElementById('carouselNext');
    const container = document.getElementById('carouselContainer');
    
    if (!container) return;
    
    // Check scroll position
    const isAtStart = container.scrollLeft <= 0;
    const isAtEnd = container.scrollLeft >= container.scrollWidth - container.clientWidth - 10;
    
    if (prevButton) {
        prevButton.disabled = isAtStart;
    }
    if (nextButton) {
        nextButton.disabled = isAtEnd;
    }
}

// Modal functionality
function openModal(index) {
    currentPhotoIndex = index;
    const modal = document.getElementById('imageModal');
    const modalImage = document.getElementById('modalImage');
    
    if (!modal || !modalImage) return;
    
    const photo = photos[index];
    if (!photo) return;
    
    const photoPath = photo.startsWith('/') ? photo : `/${photo}`;
    modalImage.src = photoPath;
    modal.style.display = 'block';
    document.body.style.overflow = 'hidden';
    
    updateModalButtons();
}

function closeModal() {
    const modal = document.getElementById('imageModal');
    if (!modal) return;
    
    modal.style.display = 'none';
    document.body.style.overflow = '';
}

function navigateModal(direction) {
    currentPhotoIndex += direction;
    
    if (currentPhotoIndex < 0) {
        currentPhotoIndex = photos.length - 1;
    } else if (currentPhotoIndex >= photos.length) {
        currentPhotoIndex = 0;
    }
    
    const modalImage = document.getElementById('modalImage');
    if (modalImage) {
        const photo = photos[currentPhotoIndex];
        const photoPath = photo.startsWith('/') ? photo : `/${photo}`;
        modalImage.src = photoPath;
    }
    
    updateModalButtons();
}

function updateModalButtons() {
    const prevButton = document.getElementById('modalPrev');
    const nextButton = document.getElementById('modalNext');
    
    // Buttons are always enabled (circular navigation)
    // Could add visual feedback if needed
}

// Setup modal event listeners
document.addEventListener('DOMContentLoaded', function() {
    const modal = document.getElementById('imageModal');
    const modalClose = document.getElementById('modalClose');
    const modalPrev = document.getElementById('modalPrev');
    const modalNext = document.getElementById('modalNext');
    const modalOverlay = document.querySelector('.modal-overlay');
    
    if (modalClose) {
        modalClose.addEventListener('click', closeModal);
    }
    
    if (modalPrev) {
        modalPrev.addEventListener('click', () => navigateModal(-1));
    }
    
    if (modalNext) {
        modalNext.addEventListener('click', () => navigateModal(1));
    }
    
    if (modalOverlay) {
        modalOverlay.addEventListener('click', closeModal);
    }
    
    // Close on Escape key
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && modal && modal.style.display !== 'none') {
            closeModal();
        }
        if (e.key === 'ArrowLeft' && modal && modal.style.display !== 'none') {
            navigateModal(-1);
        }
        if (e.key === 'ArrowRight' && modal && modal.style.display !== 'none') {
            navigateModal(1);
        }
    });
    
    // Update carousel buttons on scroll
    const carouselContainer = document.getElementById('carouselContainer');
    if (carouselContainer) {
        carouselContainer.addEventListener('scroll', updateCarouselButtons);
    }
});

// Load product info on page load
function initializePage() {
    loadProductInfo();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializePage);
} else {
    initializePage();
}
