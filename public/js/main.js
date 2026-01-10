// Main JavaScript for LJM AirPod Support

// API base URL - use existing window.API_BASE if available (e.g., from admin.js)
if (typeof window.API_BASE === 'undefined') {
    window.API_BASE = '';
}
var API_BASE = window.API_BASE;

// Utility functions
function showError(message) {
    const errorDiv = document.getElementById('errorMessage');
    if (errorDiv) {
        errorDiv.textContent = message;
        errorDiv.classList.add('show');
        setTimeout(() => {
            errorDiv.classList.remove('show');
        }, 5000);
    }
}

function showSuccess(message) {
    const successDiv = document.getElementById('successMessage');
    if (successDiv) {
        successDiv.textContent = message;
        successDiv.classList.add('show');
        setTimeout(() => {
            successDiv.classList.remove('show');
        }, 5000);
    }
}

function showSpinner() {
    const spinner = document.getElementById('spinner');
    if (spinner) {
        spinner.classList.add('active');
    }
}

function hideSpinner() {
    const spinner = document.getElementById('spinner');
    if (spinner) {
        spinner.classList.remove('active');
    }
}

// Barcode verification form
const barcodeForm = document.getElementById('barcodeForm');
if (barcodeForm) {
    barcodeForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const barcodeInput = document.getElementById('securityBarcode');
        const submitButton = document.getElementById('submitButton');
        if (barcodeInput) {
            barcodeInput.addEventListener('input', () => {
                barcodeInput.value = barcodeInput.value.toUpperCase();
            });
        }
        // Convert to uppercase automatically
        const securityBarcode = barcodeInput.value.trim().toUpperCase();
        
        // Update the input field to show uppercase
        barcodeInput.value = securityBarcode;
        
        if (!securityBarcode) {
            showError('Please enter a security code');
            return;
        }
        
        // Disable button and show spinner
        submitButton.disabled = true;
        showSpinner();
        
        try {
            const response = await fetch(`${API_BASE}/api/verify-barcode`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ security_barcode: securityBarcode })
            });
            
            const data = await response.json();
            
            if (response.ok && data.success) {
                // Store barcode in sessionStorage
                sessionStorage.setItem('securityBarcode', securityBarcode);
                sessionStorage.setItem('partType', data.part_type);
                
                // Redirect directly to warranty registration/choice page
                window.location.href = `warranty-registration.html?barcode=${encodeURIComponent(securityBarcode)}`;
            } else {
                showError(data.error || 'Invalid security code. Please check and try again.');
                barcodeInput.focus();
            }
        } catch (error) {
            console.error('Error:', error);
            showError('Network error. Please check your connection and try again.');
        } finally {
            submitButton.disabled = false;
            hideSpinner();
        }
    });
}

// Confirmation page functionality
// Check if user has valid barcode before showing confirmation page
if (window.location.pathname.includes('confirmation.html')) {
    const securityBarcode = sessionStorage.getItem('securityBarcode');
    if (!securityBarcode) {
        // Redirect to home if no barcode found
        window.location.href = 'index.html';
    }
}

const confirmationForm = document.getElementById('confirmationForm');
const confirmationCheckbox = document.getElementById('confirmCheckbox');
const viewInstructionsButton = document.getElementById('viewInstructionsButton');

if (confirmationCheckbox && viewInstructionsButton) {
    // Disable button initially
    viewInstructionsButton.disabled = true;
    
    // Enable/disable button based on checkbox
    confirmationCheckbox.addEventListener('change', (e) => {
        viewInstructionsButton.disabled = !e.target.checked;
    });
    
    // Load part type from sessionStorage or API
    const partTypeElement = document.getElementById('partType');
    const securityBarcode = sessionStorage.getItem('securityBarcode');
    
    if (partTypeElement && securityBarcode) {
        // Try to get from sessionStorage first
        const partType = sessionStorage.getItem('partType');
        if (partType) {
            const partTypeMap = {
                'left': 'Left AirPod',
                'right': 'Right AirPod',
                'case': 'Charging Case'
            };
            partTypeElement.textContent = partTypeMap[partType] || 'replacement part';
        } else {
            // Fetch from API
            fetch(`${API_BASE}/api/product-info/${securityBarcode}`)
                .then(res => res.json())
                .then(data => {
                    const partTypeMap = {
                        'left': 'Left AirPod',
                        'right': 'Right AirPod',
                        'case': 'Charging Case'
                    };
                    partTypeElement.textContent = partTypeMap[data.part_type] || 'replacement part';
                    sessionStorage.setItem('partType', data.part_type);
                })
                .catch(err => {
                    console.error('Error fetching part type:', err);
                    partTypeElement.textContent = 'replacement part';
                });
        }
    }
    
    // Handle form submission
    if (confirmationForm) {
        confirmationForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            if (!confirmationCheckbox.checked) {
                showError('Please confirm that you understand the pairing process');
                return;
            }
            
            const securityBarcode = sessionStorage.getItem('securityBarcode');
            if (!securityBarcode) {
                showError('Session expired. Please start over.');
                window.location.href = 'index.html';
                return;
            }
            
            viewInstructionsButton.disabled = true;
            showSpinner();
            
            try {
                // Log confirmation
                const response = await fetch(`${API_BASE}/api/confirm-understanding`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ security_barcode: securityBarcode })
                });
                
                const data = await response.json();
                
                if (response.ok && data.success) {
                    // Redirect to appropriate instruction page
                    const partType = sessionStorage.getItem('partType');
                    let redirectUrl = 'left-airpod.html';
                    
                    if (partType === 'right') {
                        redirectUrl = 'right-airpod.html';
                    } else if (partType === 'case') {
                        redirectUrl = 'case.html';
                    }
                    
                    window.location.href = redirectUrl;
                } else {
                    showError(data.error || 'Failed to log confirmation. Please try again.');
                    viewInstructionsButton.disabled = false;
                }
            } catch (error) {
                console.error('Error:', error);
                showError('Network error. Please check your connection and try again.');
                viewInstructionsButton.disabled = false;
            } finally {
                hideSpinner();
            }
        });
    }
}

// Instruction pages - check if user has confirmed before viewing
if (window.location.pathname.includes('airpod.html') || window.location.pathname.includes('case.html')) {
    const securityBarcode = sessionStorage.getItem('securityBarcode');
    // Note: We don't redirect here because the confirmation is logged in the database
    // But we can add a visual indicator if needed
}

// Support/Suggestions Bubble (all pages except login)
function initSupportBubble() {
    if (document.getElementById('supportBubble')) {
        return;
    }

    // Don't show on login page
    if (window.location.pathname.includes('login')) {
        return;
    }

    const bubbleButton = document.createElement('button');
    bubbleButton.id = 'supportBubble';
    bubbleButton.className = 'support-bubble';
    bubbleButton.type = 'button';
    bubbleButton.setAttribute('aria-label', 'Support or suggestions');
    bubbleButton.innerHTML = `
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M21 15C21 15.5304 20.7893 16.0391 20.4142 16.4142C20.0391 16.7893 19.5304 17 19 17H7L3 21V5C3 4.46957 3.21071 3.96086 3.58579 3.58579C3.96086 3.21071 4.46957 3 5 3H19C19.5304 3 20.0391 3.21071 20.4142 3.58579C20.7893 3.96086 21 4.46957 21 5V15Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <span>Support</span>
    `;

    const modal = document.createElement('div');
    modal.id = 'supportModal';
    modal.className = 'support-modal';
    modal.innerHTML = `
        <div class="support-modal-content" role="dialog" aria-modal="true" aria-labelledby="supportModalTitle">
            <button type="button" class="support-modal-close" aria-label="Close support form">×</button>
            <h3 id="supportModalTitle">Support / Suggestions</h3>
            <p>Send a fault report, suggestion, or feature request to our team.</p>
            <form id="supportForm" class="support-form">
                <label for="supportType">Type</label>
                <select id="supportType" name="supportType" required>
                    <option value="fault">Fault / Issue</option>
                    <option value="suggestion">Suggestion</option>
                    <option value="feature">Feature Request</option>
                </select>
                <label for="supportMessage">Message</label>
                <textarea id="supportMessage" name="supportMessage" rows="4" placeholder="Describe the issue, suggestion, or feature request..." required></textarea>
                <label>Screenshots (optional)</label>
                <div class="screenshot-upload-area" id="screenshotUploadArea">
                    <div class="screenshot-actions">
                        <button type="button" class="screenshot-capture-btn" id="captureScreenBtn">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/>
                                <circle cx="12" cy="13" r="4"/>
                            </svg>
                            Capture Screen & Annotate
                        </button>
                    </div>
                    <input type="file" id="supportScreenshots" name="screenshots" accept="image/*" multiple style="display: none;">
                    <div class="screenshot-drop-zone" id="screenshotDropZone">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/>
                        </svg>
                        <span>Or drag & drop images here (max 5)</span>
                    </div>
                    <div class="screenshot-preview-list" id="screenshotPreviewList"></div>
                </div>
                <label for="supportEmail">Your Email (optional)</label>
                <input type="email" id="supportEmail" name="supportEmail" placeholder="name@example.com">
                <button type="submit" class="button button-primary">Submit Request</button>
                <div class="support-form-status" id="supportFormStatus" role="status" aria-live="polite"></div>
            </form>
        </div>
    `;

    // Create annotation overlay
    const annotationOverlay = document.createElement('div');
    annotationOverlay.id = 'annotationOverlay';
    annotationOverlay.className = 'annotation-overlay';
    annotationOverlay.innerHTML = `
        <div class="annotation-container">
            <div class="annotation-toolbar">
                <div class="annotation-tools">
                    <button type="button" class="annotation-tool active" data-tool="pen" title="Draw">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M12 19l7-7 3 3-7 7-3-3z"/>
                            <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/>
                            <path d="M2 2l7.586 7.586"/>
                        </svg>
                    </button>
                    <button type="button" class="annotation-tool" data-tool="highlight" title="Highlight">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M9 11l-6 6v3h9l3-3"/>
                            <path d="M22 12l-4.6 4.6a2 2 0 01-2.8 0l-5.2-5.2a2 2 0 010-2.8L14 4"/>
                        </svg>
                    </button>
                    <button type="button" class="annotation-tool" data-tool="arrow" title="Arrow">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M5 12h14M12 5l7 7-7 7"/>
                        </svg>
                    </button>
                    <button type="button" class="annotation-tool" data-tool="rectangle" title="Rectangle">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                        </svg>
                    </button>
                    <button type="button" class="annotation-tool" data-tool="circle" title="Circle">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <circle cx="12" cy="12" r="10"/>
                        </svg>
                    </button>
                </div>
                <div class="annotation-colors">
                    <button type="button" class="annotation-color active" data-color="#ef4444" style="background: #ef4444;" title="Red"></button>
                    <button type="button" class="annotation-color" data-color="#f59e0b" style="background: #f59e0b;" title="Orange"></button>
                    <button type="button" class="annotation-color" data-color="#22c55e" style="background: #22c55e;" title="Green"></button>
                    <button type="button" class="annotation-color" data-color="#3b82f6" style="background: #3b82f6;" title="Blue"></button>
                    <button type="button" class="annotation-color" data-color="#000000" style="background: #000000;" title="Black"></button>
                </div>
                <div class="annotation-actions">
                    <button type="button" class="annotation-action" id="undoAnnotation" title="Undo">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M3 7v6h6"/>
                            <path d="M21 17a9 9 0 00-9-9 9 9 0 00-6 2.3L3 13"/>
                        </svg>
                    </button>
                    <button type="button" class="annotation-action" id="clearAnnotation" title="Clear All">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
                        </svg>
                    </button>
                </div>
            </div>
            <div class="annotation-canvas-wrapper">
                <canvas id="annotationCanvas"></canvas>
            </div>
            <div class="annotation-footer">
                <button type="button" class="annotation-btn annotation-btn-cancel" id="cancelAnnotation">Cancel</button>
                <button type="button" class="annotation-btn annotation-btn-save" id="saveAnnotation">Add Screenshot</button>
            </div>
        </div>
    `;

    document.body.appendChild(bubbleButton);
    document.body.appendChild(modal);
    document.body.appendChild(annotationOverlay);

    const closeButton = modal.querySelector('.support-modal-close');
    const form = modal.querySelector('#supportForm');
    const status = modal.querySelector('#supportFormStatus');
    const fileInput = modal.querySelector('#supportScreenshots');
    const dropZone = modal.querySelector('#screenshotDropZone');
    const previewList = modal.querySelector('#screenshotPreviewList');
    const captureBtn = modal.querySelector('#captureScreenBtn');

    // Track selected files
    let selectedFiles = [];

    // Annotation state
    let annotationCanvas = null;
    let annotationCtx = null;
    let isDrawing = false;
    let currentTool = 'pen';
    let currentColor = '#ef4444';
    let drawHistory = [];
    let backgroundImage = null;
    let startX, startY;

    const openModal = () => {
        modal.classList.add('open');
    };
    const closeModal = () => {
        modal.classList.remove('open');
    };

    // Load html2canvas dynamically
    const loadHtml2Canvas = () => {
        return new Promise((resolve, reject) => {
            if (typeof html2canvas !== 'undefined') {
                resolve(html2canvas);
                return;
            }
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
            script.onload = () => resolve(window.html2canvas);
            script.onerror = () => reject(new Error('Failed to load html2canvas'));
            document.head.appendChild(script);
        });
    };

    // Screen capture and annotation functions
    const captureScreen = async () => {
        try {
            // Hide the support modal temporarily
            modal.style.display = 'none';
            bubbleButton.style.display = 'none';

            // Show loading indicator
            const loadingDiv = document.createElement('div');
            loadingDiv.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:rgba(0,0,0,0.8);color:white;padding:20px 40px;border-radius:10px;z-index:10002;font-size:16px;';
            loadingDiv.textContent = 'Capturing screen...';
            document.body.appendChild(loadingDiv);

            try {
                // Try to load and use html2canvas
                const html2canvasLib = await loadHtml2Canvas();
                const canvas = await html2canvasLib(document.body, {
                    useCORS: true,
                    allowTaint: true,
                    scrollX: 0,
                    scrollY: -window.scrollY,
                    windowWidth: document.documentElement.scrollWidth,
                    windowHeight: window.innerHeight
                });
                loadingDiv.remove();
                openAnnotationEditor(canvas.toDataURL('image/png'));
            } catch (html2canvasErr) {
                console.warn('html2canvas failed, trying getDisplayMedia:', html2canvasErr);
                loadingDiv.remove();

                // Fallback: use screen capture API
                try {
                    const stream = await navigator.mediaDevices.getDisplayMedia({
                        video: { mediaSource: 'screen' }
                    });
                    const video = document.createElement('video');
                    video.srcObject = stream;
                    await video.play();

                    // Wait a bit for the video to be ready
                    await new Promise(resolve => setTimeout(resolve, 100));

                    const captureCanvas = document.createElement('canvas');
                    captureCanvas.width = video.videoWidth;
                    captureCanvas.height = video.videoHeight;
                    const ctx = captureCanvas.getContext('2d');
                    ctx.drawImage(video, 0, 0);

                    stream.getTracks().forEach(track => track.stop());
                    openAnnotationEditor(captureCanvas.toDataURL('image/png'));
                } catch (mediaErr) {
                    console.error('Screen capture not supported:', mediaErr);
                    modal.style.display = '';
                    bubbleButton.style.display = '';
                    alert('Screen capture is not supported in this browser. Please use the drag & drop area to upload a screenshot instead.');
                    return;
                }
            }
        } catch (err) {
            console.error('Screen capture error:', err);
            modal.style.display = '';
            bubbleButton.style.display = '';
            document.querySelector('[style*="Capturing screen"]')?.remove();
            alert('Failed to capture screen. Please try uploading a screenshot instead.');
        }
    };

    const openAnnotationEditor = (imageDataUrl) => {
        annotationOverlay.classList.add('open');

        annotationCanvas = document.getElementById('annotationCanvas');
        annotationCtx = annotationCanvas.getContext('2d');

        // Load the captured image
        const img = new Image();
        img.onload = () => {
            backgroundImage = img;

            // Set canvas size to fit the container while maintaining aspect ratio
            const container = annotationOverlay.querySelector('.annotation-canvas-wrapper');
            const maxWidth = container.clientWidth - 20;
            const maxHeight = container.clientHeight - 20;

            let width = img.width;
            let height = img.height;

            if (width > maxWidth) {
                height = (maxWidth / width) * height;
                width = maxWidth;
            }
            if (height > maxHeight) {
                width = (maxHeight / height) * width;
                height = maxHeight;
            }

            annotationCanvas.width = width;
            annotationCanvas.height = height;

            // Draw the background
            annotationCtx.drawImage(img, 0, 0, width, height);

            // Store initial state
            drawHistory = [annotationCanvas.toDataURL()];
        };
        img.src = imageDataUrl;

        // Set up event listeners for drawing
        setupAnnotationListeners();
    };

    const closeAnnotationEditor = () => {
        annotationOverlay.classList.remove('open');
        modal.style.display = '';
        bubbleButton.style.display = '';
        drawHistory = [];
        backgroundImage = null;
    };

    const setupAnnotationListeners = () => {
        // Tool selection
        annotationOverlay.querySelectorAll('.annotation-tool').forEach(btn => {
            btn.onclick = () => {
                annotationOverlay.querySelectorAll('.annotation-tool').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                currentTool = btn.dataset.tool;
            };
        });

        // Color selection
        annotationOverlay.querySelectorAll('.annotation-color').forEach(btn => {
            btn.onclick = () => {
                annotationOverlay.querySelectorAll('.annotation-color').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                currentColor = btn.dataset.color;
            };
        });

        // Undo
        document.getElementById('undoAnnotation').onclick = () => {
            if (drawHistory.length > 1) {
                drawHistory.pop();
                const img = new Image();
                img.onload = () => {
                    annotationCtx.clearRect(0, 0, annotationCanvas.width, annotationCanvas.height);
                    annotationCtx.drawImage(img, 0, 0);
                };
                img.src = drawHistory[drawHistory.length - 1];
            }
        };

        // Clear all
        document.getElementById('clearAnnotation').onclick = () => {
            if (backgroundImage && drawHistory.length > 1) {
                annotationCtx.clearRect(0, 0, annotationCanvas.width, annotationCanvas.height);
                annotationCtx.drawImage(backgroundImage, 0, 0, annotationCanvas.width, annotationCanvas.height);
                drawHistory = [annotationCanvas.toDataURL()];
            }
        };

        // Cancel
        document.getElementById('cancelAnnotation').onclick = closeAnnotationEditor;

        // Save
        document.getElementById('saveAnnotation').onclick = () => {
            // Convert canvas to blob and add to files
            annotationCanvas.toBlob((blob) => {
                const file = new File([blob], `screenshot-${Date.now()}.png`, { type: 'image/png' });
                if (selectedFiles.length < 5) {
                    selectedFiles.push(file);
                    updatePreviewList();
                }
                closeAnnotationEditor();
            }, 'image/png');
        };

        // Drawing events
        annotationCanvas.onmousedown = startDrawing;
        annotationCanvas.onmousemove = draw;
        annotationCanvas.onmouseup = stopDrawing;
        annotationCanvas.onmouseleave = stopDrawing;

        // Touch support
        annotationCanvas.ontouchstart = (e) => {
            e.preventDefault();
            const touch = e.touches[0];
            const rect = annotationCanvas.getBoundingClientRect();
            startDrawing({ offsetX: touch.clientX - rect.left, offsetY: touch.clientY - rect.top });
        };
        annotationCanvas.ontouchmove = (e) => {
            e.preventDefault();
            const touch = e.touches[0];
            const rect = annotationCanvas.getBoundingClientRect();
            draw({ offsetX: touch.clientX - rect.left, offsetY: touch.clientY - rect.top });
        };
        annotationCanvas.ontouchend = stopDrawing;
    };

    function startDrawing(e) {
        isDrawing = true;
        startX = e.offsetX;
        startY = e.offsetY;

        if (currentTool === 'pen' || currentTool === 'highlight') {
            annotationCtx.beginPath();
            annotationCtx.moveTo(startX, startY);
        }
    }

    function draw(e) {
        if (!isDrawing) return;

        const x = e.offsetX;
        const y = e.offsetY;

        if (currentTool === 'pen') {
            annotationCtx.lineCap = 'round';
            annotationCtx.lineJoin = 'round';
            annotationCtx.strokeStyle = currentColor;
            annotationCtx.lineWidth = 3;
            annotationCtx.lineTo(x, y);
            annotationCtx.stroke();
        } else if (currentTool === 'highlight') {
            annotationCtx.lineCap = 'round';
            annotationCtx.lineJoin = 'round';
            annotationCtx.strokeStyle = currentColor + '60'; // 60 = 37.5% opacity
            annotationCtx.lineWidth = 20;
            annotationCtx.lineTo(x, y);
            annotationCtx.stroke();
        } else if (currentTool === 'rectangle' || currentTool === 'circle' || currentTool === 'arrow') {
            // Redraw background and history for shape preview
            const lastState = new Image();
            lastState.onload = () => {
                annotationCtx.clearRect(0, 0, annotationCanvas.width, annotationCanvas.height);
                annotationCtx.drawImage(lastState, 0, 0);
                drawShape(startX, startY, x, y);
            };
            lastState.src = drawHistory[drawHistory.length - 1];
        }
    }

    function drawShape(x1, y1, x2, y2) {
        annotationCtx.strokeStyle = currentColor;
        annotationCtx.lineWidth = 3;
        annotationCtx.lineCap = 'round';
        annotationCtx.lineJoin = 'round';

        if (currentTool === 'rectangle') {
            annotationCtx.strokeRect(x1, y1, x2 - x1, y2 - y1);
        } else if (currentTool === 'circle') {
            const radiusX = Math.abs(x2 - x1) / 2;
            const radiusY = Math.abs(y2 - y1) / 2;
            const centerX = x1 + (x2 - x1) / 2;
            const centerY = y1 + (y2 - y1) / 2;
            annotationCtx.beginPath();
            annotationCtx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, 2 * Math.PI);
            annotationCtx.stroke();
        } else if (currentTool === 'arrow') {
            const headLen = 15;
            const angle = Math.atan2(y2 - y1, x2 - x1);
            annotationCtx.beginPath();
            annotationCtx.moveTo(x1, y1);
            annotationCtx.lineTo(x2, y2);
            annotationCtx.lineTo(x2 - headLen * Math.cos(angle - Math.PI / 6), y2 - headLen * Math.sin(angle - Math.PI / 6));
            annotationCtx.moveTo(x2, y2);
            annotationCtx.lineTo(x2 - headLen * Math.cos(angle + Math.PI / 6), y2 - headLen * Math.sin(angle + Math.PI / 6));
            annotationCtx.stroke();
        }
    }

    function stopDrawing(e) {
        if (!isDrawing) return;
        isDrawing = false;

        if (currentTool === 'pen' || currentTool === 'highlight') {
            annotationCtx.closePath();
        }

        // Save state for undo
        drawHistory.push(annotationCanvas.toDataURL());
    }

    // Capture screen button
    captureBtn.addEventListener('click', captureScreen);

    // Screenshot handling functions
    const updatePreviewList = () => {
        previewList.innerHTML = '';
        selectedFiles.forEach((file, index) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const previewItem = document.createElement('div');
                previewItem.className = 'screenshot-preview-item';
                previewItem.innerHTML = `
                    <img src="${e.target.result}" alt="Screenshot ${index + 1}">
                    <button type="button" class="screenshot-remove-btn" data-index="${index}" aria-label="Remove screenshot">×</button>
                    <span class="screenshot-filename">${file.name}</span>
                `;
                previewList.appendChild(previewItem);

                // Add remove handler
                previewItem.querySelector('.screenshot-remove-btn').addEventListener('click', () => {
                    selectedFiles.splice(index, 1);
                    updatePreviewList();
                });
            };
            reader.readAsDataURL(file);
        });

        // Update drop zone visibility
        if (selectedFiles.length >= 5) {
            dropZone.style.display = 'none';
        } else {
            dropZone.style.display = 'flex';
            dropZone.querySelector('span').textContent = selectedFiles.length > 0
                ? `Add more (${5 - selectedFiles.length} remaining)`
                : 'Click or drag to add screenshots (max 5)';
        }
    };

    const addFiles = (files) => {
        const remaining = 5 - selectedFiles.length;
        const filesToAdd = Array.from(files).slice(0, remaining);

        for (const file of filesToAdd) {
            if (file.type.startsWith('image/')) {
                selectedFiles.push(file);
            }
        }
        updatePreviewList();
    };

    // Click to upload
    dropZone.addEventListener('click', () => {
        fileInput.click();
    });

    fileInput.addEventListener('change', (e) => {
        addFiles(e.target.files);
        fileInput.value = ''; // Reset to allow same file selection
    });

    // Drag and drop
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('dragover');
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('dragover');
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        addFiles(e.dataTransfer.files);
    });

    bubbleButton.addEventListener('click', openModal);
    closeButton.addEventListener('click', closeModal);
    modal.addEventListener('click', (event) => {
        if (event.target === modal) {
            closeModal();
        }
    });

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        status.textContent = '';

        const message = form.supportMessage.value.trim();

        if (!message) {
            status.textContent = 'Please enter a message.';
            status.classList.add('error');
            return;
        }

        // Use FormData for file uploads
        const formData = new FormData();
        formData.append('type', form.supportType.value);
        formData.append('message', message);
        formData.append('userEmail', form.supportEmail.value.trim() || '');
        formData.append('page', window.location.pathname);

        // Add screenshots
        selectedFiles.forEach(file => {
            formData.append('screenshots', file);
        });

        try {
            const response = await fetch(`${API_BASE}/api/support`, {
                method: 'POST',
                body: formData
            });
            const data = await response.json();
            if (!response.ok || !data.success) {
                throw new Error(data.error || 'Failed to send message');
            }
            status.textContent = 'Message sent. Thanks for the feedback!';
            status.classList.remove('error');
            status.classList.add('success');
            form.reset();
            selectedFiles = [];
            updatePreviewList();
        } catch (error) {
            status.textContent = error.message || 'Failed to send message.';
            status.classList.remove('success');
            status.classList.add('error');
        }
    });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSupportBubble);
} else {
    initSupportBubble();
}

// Troubleshooting accordion
const troubleshootingQuestions = document.querySelectorAll('.troubleshooting-question');
troubleshootingQuestions.forEach(question => {
    question.addEventListener('click', () => {
        const answer = question.nextElementSibling;
        const isActive = question.classList.contains('active');
        
        // Close all other items
        troubleshootingQuestions.forEach(q => {
            q.classList.remove('active');
            q.nextElementSibling.classList.remove('active');
        });
        
        // Toggle current item
        if (!isActive) {
            question.classList.add('active');
            answer.classList.add('active');
        }
    });
});
