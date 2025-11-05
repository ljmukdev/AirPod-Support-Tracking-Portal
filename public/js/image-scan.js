// Image OCR and Barcode Scanning

let barcodeScanningActive = false;

// Check if Tesseract is available when script loads
window.addEventListener('load', () => {
    if (typeof Tesseract === 'undefined') {
        console.error('❌ Tesseract.js failed to load. OCR will not work.');
        const ocrStatus = document.getElementById('ocrStatus');
        if (ocrStatus) {
            ocrStatus.style.display = 'block';
            ocrStatus.style.background = '#f8d7da';
            ocrStatus.style.color = '#721c24';
            ocrStatus.textContent = '❌ OCR library failed to load. Please refresh the page.';
        }
    } else {
        console.log('✅ Tesseract.js loaded successfully');
    }
});

// Initialize OCR button
const imageUpload = document.getElementById('imageUpload');
const cameraCapture = document.getElementById('cameraCapture');
const takePhotoButton = document.getElementById('takePhotoButton');
const scanImageButton = document.getElementById('scanImageButton');
const imagePreview = document.getElementById('imagePreview');
const previewImg = document.getElementById('previewImg');
const ocrStatus = document.getElementById('ocrStatus');

// Initialize barcode scanning
const barcodeScan = document.getElementById('barcodeScan');
const startBarcodeScanButton = document.getElementById('startBarcodeScan');
const stopBarcodeScanButton = document.getElementById('stopBarcodeScan');
const barcodeScanner = document.getElementById('barcodeScanner');
const barcodeVideo = document.getElementById('barcodeVideo');

// Function to show image preview
function showImagePreview(file) {
    if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
            previewImg.src = event.target.result;
            imagePreview.style.display = 'block';
        };
        reader.readAsDataURL(file);
    }
}

// Show image preview when file is selected via upload
if (imageUpload) {
    imageUpload.addEventListener('change', (e) => {
        const file = e.target.files[0];
        showImagePreview(file);
        // Also update camera capture input if it exists
        if (cameraCapture && file) {
            // Transfer the file to camera capture input for consistency
            const dataTransfer = new DataTransfer();
            dataTransfer.items.add(file);
            cameraCapture.files = dataTransfer.files;
        }
    });
}

// Handle camera capture button click
if (takePhotoButton && cameraCapture) {
    takePhotoButton.addEventListener('click', () => {
        cameraCapture.click();
    });
    
    cameraCapture.addEventListener('change', (e) => {
        const file = e.target.files[0];
        showImagePreview(file);
        // Also update regular upload input if it exists
        if (imageUpload && file) {
            const dataTransfer = new DataTransfer();
            dataTransfer.items.add(file);
            imageUpload.files = dataTransfer.files;
        }
    });
}

// OCR Image Processing
if (scanImageButton) {
    scanImageButton.addEventListener('click', async () => {
        // Try to get file from either input (upload or camera)
        const file = imageUpload?.files[0] || cameraCapture?.files[0];
        if (!file) {
            showOCRStatus('Please upload an image or take a photo first', 'error');
            return;
        }
        
        // Check if Tesseract is loaded - wait a bit if still loading
        if (typeof Tesseract === 'undefined') {
            // Wait up to 2 seconds for Tesseract to load
            let waited = 0;
            while (typeof Tesseract === 'undefined' && waited < 2000) {
                await new Promise(resolve => setTimeout(resolve, 100));
                waited += 100;
            }
            
            if (typeof Tesseract === 'undefined') {
                showOCRStatus('❌ OCR library not loaded. Please refresh the page or check your internet connection.', 'error');
                console.error('Tesseract.js not found. Check browser console for script loading errors.');
                if (window.tesseractError) {
                    console.error('Tesseract loading error:', window.tesseractError);
                }
                return;
            }
        }
        
        scanImageButton.disabled = true;
        scanImageButton.textContent = 'Processing...';
        ocrStatus.style.display = 'block';
        ocrStatus.textContent = 'Loading OCR engine...';
        ocrStatus.style.background = '#fff3cd';
        ocrStatus.style.color = '#856404';
        
        try {
            console.log('Starting OCR with Tesseract.js...');
            console.log('File details:', {
                name: file.name,
                type: file.type,
                size: file.size + ' bytes',
                lastModified: new Date(file.lastModified).toISOString()
            });
            
            // Validate file type
            if (!file.type.startsWith('image/')) {
                throw new Error('File is not an image. Please select an image file.');
            }
            
            // Validate file size (max 10MB)
            if (file.size > 10 * 1024 * 1024) {
                throw new Error('Image is too large. Please use an image smaller than 10MB.');
            }
            
            ocrStatus.textContent = 'Preprocessing image...';
            
            // Preprocess image to improve OCR accuracy
            const processedFile = await preprocessImage(file);
            
            ocrStatus.textContent = 'Initializing OCR engine...';
            
            // Use Tesseract.js for OCR with better error handling and optimized settings
            // Add timeout wrapper to catch hanging requests
            const ocrPromise = Tesseract.recognize(processedFile, 'eng', {
                logger: m => {
                    console.log('Tesseract progress:', m);
                    if (m.status === 'loading tesseract core') {
                        ocrStatus.textContent = 'Loading OCR engine...';
                    } else if (m.status === 'initializing tesseract') {
                        ocrStatus.textContent = 'Initializing OCR...';
                    } else if (m.status === 'loading language traineddata') {
                        ocrStatus.textContent = 'Loading language data...';
                    } else if (m.status === 'initializing api') {
                        ocrStatus.textContent = 'Preparing OCR...';
                    } else if (m.status === 'recognizing text') {
                        ocrStatus.textContent = `Processing image: ${Math.round(m.progress * 100)}%`;
                    }
                }
            });
            
            // Add timeout (60 seconds max)
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('OCR processing timed out after 60 seconds. Please try a smaller or clearer image.')), 60000);
            });
            
            const { data: { text } } = await Promise.race([ocrPromise, timeoutPromise]);
            
            console.log('OCR Text extracted:', text);
            
            if (!text || text.trim().length === 0) {
                showOCRStatus('⚠️ No text found in image. Try a clearer photo or better lighting.', 'error');
                return;
            }
            
            // Parse extracted text
            const extractedData = parseOCRText(text);
            
            console.log('Extracted data:', extractedData);
            console.log('Full OCR text:', text);
            
            // Auto-fill form fields
            let filledFields = [];
            
            if (extractedData.serialNumber) {
                document.getElementById('serialNumber').value = extractedData.serialNumber;
                filledFields.push('Serial Number');
            }
            
            if (extractedData.partNumber) {
                document.getElementById('partModelNumber').value = extractedData.partNumber;
                filledFields.push('Part Number');
            }
            
            // Try to match part number to existing parts
            if (extractedData.partNumber) {
                await tryMatchPartNumber(extractedData.partNumber);
            }
            
            // Show success message with what was found
            if (filledFields.length > 0) {
                showOCRStatus(`✅ Extracted: ${filledFields.join(', ')}`, 'success');
            } else {
                showOCRStatus('⚠️ Could not extract serial or part number. Check browser console for OCR text.', 'error');
                // Show OCR text for debugging
                console.log('=== Full OCR Text (for manual review) ===');
                console.log(text);
                console.log('=== End OCR Text ===');
            }
            
        } catch (error) {
            console.error('OCR Error:', error);
            console.error('Error details:', {
                message: error.message,
                stack: error.stack,
                name: error.name,
                file: file ? file.name : 'no file',
                fileType: file ? file.type : 'no file',
                fileSize: file ? file.size : 'no file'
            });
            
            let errorMessage = '❌ Error extracting text. ';
            
            // More specific error messages
            if (error.message && error.message.includes('Failed to fetch')) {
                errorMessage += 'Could not load OCR engine. Check your internet connection and try again.';
            } else if (error.message && error.message.includes('Tesseract')) {
                errorMessage += 'OCR engine error. Please refresh the page and try again.';
            } else if (error.message && error.message.includes('network')) {
                errorMessage += 'Network error. Please check your internet connection.';
            } else if (error.message && error.message.includes('Worker')) {
                errorMessage += 'OCR worker failed to initialize. Please refresh the page.';
            } else if (error.message) {
                errorMessage += `Error: ${error.message}. Check browser console for details.`;
            } else {
                errorMessage += 'Unknown error occurred. Check browser console (F12) for details.';
            }
            
            // Show full error in console for debugging
            console.error('=== FULL OCR ERROR ===');
            console.error('Error object:', error);
            console.error('Error message:', error.message);
            console.error('Error stack:', error.stack);
            console.error('File info:', file ? {
                name: file.name,
                type: file.type,
                size: file.size + ' bytes'
            } : 'No file');
            console.error('Tesseract available:', typeof Tesseract !== 'undefined');
            console.error('=====================');
            
            showOCRStatus(errorMessage, 'error');
        } finally {
            scanImageButton.disabled = false;
            scanImageButton.textContent = 'Extract Data from Image';
        }
    });
}

// Preprocess image to improve OCR accuracy with advanced techniques
async function preprocessImage(file) {
    return new Promise((resolve) => {
        const img = new Image();
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        img.onload = () => {
            // Scale up small images (OCR works better on larger images)
            const minSize = 1000; // Minimum dimension for better OCR
            let scale = 1;
            if (img.width < minSize || img.height < minSize) {
                scale = Math.max(minSize / img.width, minSize / img.height);
            }
            
            canvas.width = Math.floor(img.width * scale);
            canvas.height = Math.floor(img.height * scale);
            
            // Use high-quality image rendering
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            
            // Draw scaled image
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            
            // Get image data
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imageData.data;
            const width = canvas.width;
            const height = canvas.height;
            
            // Step 1: Convert to grayscale with better algorithm
            const grayscale = new Uint8Array(width * height);
            for (let i = 0; i < data.length; i += 4) {
                const r = data[i];
                const g = data[i + 1];
                const b = data[i + 2];
                // Luminance-based grayscale (better than simple average)
                const gray = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
                grayscale[i / 4] = gray;
            }
            
            // Step 2: Apply adaptive histogram equalization (improves contrast locally)
            const equalized = applyAdaptiveHistogramEqualization(grayscale, width, height);
            
            // Step 3: Apply sharpening filter (enhances edges for better OCR)
            const sharpened = applySharpening(equalized, width, height);
            
            // Step 4: Apply adaptive thresholding (better than simple threshold)
            const thresholded = applyAdaptiveThreshold(sharpened, width, height);
            
            // Step 5: Denoise (remove small artifacts)
            const denoised = applyDenoise(thresholded, width, height);
            
            // Step 6: Final contrast enhancement
            const enhanced = applyContrastEnhancement(denoised, width, height);
            
            // Write back to image data
            for (let i = 0; i < data.length; i += 4) {
                const gray = enhanced[i / 4];
                data[i] = gray;     // R
                data[i + 1] = gray; // G
                data[i + 2] = gray; // B
                // Alpha stays the same
            }
            
            // Put processed image data back
            ctx.putImageData(imageData, 0, 0);
            
            // Convert canvas to blob
            canvas.toBlob((blob) => {
                resolve(blob || file); // Fallback to original file if conversion fails
            }, file.type || 'image/jpeg', 0.98); // Higher quality
        };
        
        img.onerror = () => {
            // If image processing fails, use original file
            resolve(file);
        };
        
        // Load image from file
        const reader = new FileReader();
        reader.onload = (e) => {
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    });
}

// Apply adaptive histogram equalization for better local contrast
function applyAdaptiveHistogramEqualization(gray, width, height) {
    const result = new Uint8Array(gray.length);
    const tileSize = 8; // Size of local neighborhood
    
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const idx = y * width + x;
            
            // Get local histogram
            const hist = new Array(256).fill(0);
            let count = 0;
            
            for (let dy = -tileSize; dy <= tileSize; dy++) {
                for (let dx = -tileSize; dx <= tileSize; dx++) {
                    const ny = y + dy;
                    const nx = x + dx;
                    if (ny >= 0 && ny < height && nx >= 0 && nx < width) {
                        hist[gray[ny * width + nx]]++;
                        count++;
                    }
                }
            }
            
            // Calculate cumulative distribution
            let sum = 0;
            const cdf = new Array(256);
            for (let i = 0; i < 256; i++) {
                sum += hist[i];
                cdf[i] = sum / count;
            }
            
            // Apply transformation
            result[idx] = Math.round(cdf[gray[idx]] * 255);
        }
    }
    
    return result;
}

// Apply sharpening filter to enhance edges
function applySharpening(gray, width, height) {
    const result = new Uint8Array(gray.length);
    const kernel = [
        0, -1, 0,
        -1, 5, -1,
        0, -1, 0
    ];
    
    for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
            let sum = 0;
            let ki = 0;
            
            for (let ky = -1; ky <= 1; ky++) {
                for (let kx = -1; kx <= 1; kx++) {
                    const idx = (y + ky) * width + (x + kx);
                    sum += gray[idx] * kernel[ki++];
                }
            }
            
            const idx = y * width + x;
            result[idx] = Math.max(0, Math.min(255, sum));
        }
    }
    
    // Copy edges
    for (let y = 0; y < height; y++) {
        result[y * width] = gray[y * width];
        result[y * width + width - 1] = gray[y * width + width - 1];
    }
    for (let x = 0; x < width; x++) {
        result[x] = gray[x];
        result[(height - 1) * width + x] = gray[(height - 1) * width + x];
    }
    
    return result;
}

// Apply adaptive thresholding (better than global threshold)
function applyAdaptiveThreshold(gray, width, height) {
    const result = new Uint8Array(gray.length);
    const blockSize = 15; // Neighborhood size
    const C = 10; // Constant subtracted from mean
    
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const idx = y * width + x;
            
            // Calculate local mean
            let sum = 0;
            let count = 0;
            
            for (let dy = -blockSize; dy <= blockSize; dy++) {
                for (let dx = -blockSize; dx <= blockSize; dx++) {
                    const ny = y + dy;
                    const nx = x + dx;
                    if (ny >= 0 && ny < height && nx >= 0 && nx < width) {
                        sum += gray[ny * width + nx];
                        count++;
                    }
                }
            }
            
            const mean = sum / count;
            const threshold = mean - C;
            
            // Apply threshold
            result[idx] = gray[idx] > threshold ? 255 : 0;
        }
    }
    
    return result;
}

// Apply denoising (remove small artifacts)
function applyDenoise(gray, width, height) {
    const result = new Uint8Array(gray.length);
    
    for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
            const idx = y * width + x;
            
            // Median filter (better than mean for removing noise)
            const neighbors = [
                gray[(y - 1) * width + (x - 1)],
                gray[(y - 1) * width + x],
                gray[(y - 1) * width + (x + 1)],
                gray[y * width + (x - 1)],
                gray[idx],
                gray[y * width + (x + 1)],
                gray[(y + 1) * width + (x - 1)],
                gray[(y + 1) * width + x],
                gray[(y + 1) * width + (x + 1)]
            ];
            
            neighbors.sort((a, b) => a - b);
            result[idx] = neighbors[4]; // Median value
        }
    }
    
    // Copy edges
    for (let y = 0; y < height; y++) {
        result[y * width] = gray[y * width];
        result[y * width + width - 1] = gray[y * width + width - 1];
    }
    for (let x = 0; x < width; x++) {
        result[x] = gray[x];
        result[(height - 1) * width + x] = gray[(height - 1) * width + x];
    }
    
    return result;
}

// Apply final contrast enhancement
function applyContrastEnhancement(gray, width, height) {
    const result = new Uint8Array(gray.length);
    const contrast = 2.0; // Strong contrast enhancement
    const brightness = 0; // No brightness adjustment
    
    for (let i = 0; i < gray.length; i++) {
        let value = gray[i];
        // Apply contrast and brightness
        value = ((value / 255 - 0.5) * contrast + 0.5 + brightness) * 255;
        result[i] = Math.max(0, Math.min(255, value));
    }
    
    return result;
}

// Parse OCR text to extract serial numbers and part numbers
function parseOCRText(text) {
    const extracted = {
        serialNumber: null,
        partNumber: null
    };
    
    // Clean up text - remove extra whitespace and common OCR errors
    let cleanText = text.replace(/\s+/g, ' ').trim();
    
    // Common OCR character substitutions (fix common mistakes)
    // O/0, I/1, S/5, Z/2, etc.
    // Note: We'll keep original and cleaned versions
    const originalText = cleanText;
    
    // Normalize common OCR errors for better matching
    // But keep original for exact matches
    const normalizedText = cleanText
        .replace(/[Oo]/g, (m, i) => {
            // If surrounded by digits, likely a 0
            const before = cleanText[i - 1];
            const after = cleanText[i + 1];
            if ((/\d/.test(before) && /\d/.test(after)) || 
                (i === 0 && /\d/.test(after)) || 
                (i === cleanText.length - 1 && /\d/.test(before))) {
                return '0';
            }
            return m;
        })
        .replace(/[Il1]/g, (m, i) => {
            // If surrounded by digits or in serial context, likely 1
            const before = cleanText[i - 1];
            const after = cleanText[i + 1];
            if (/\d/.test(before) || /\d/.test(after)) {
                return '1';
            }
            return m;
        });
    
    // Common patterns for serial numbers (Apple serials are typically 12 characters, alphanumeric)
    // Note: All patterns must have 'g' flag for matchAll() to work
    const serialPatterns = [
        // Explicit serial number labels
        /Serial\s*(?:Number|No|#)?\s*:?\s*([A-Z0-9]{10,20})/gi,
        /S\/N\s*:?\s*([A-Z0-9]{10,20})/gi,
        /SN\s*:?\s*([A-Z0-9]{10,20})/gi,
        /Serial\s*:?\s*([A-Z0-9]{10,20})/gi,
        // Apple serial number format (typically 12 chars, like: GTCJ85TF18JQ, C8K9L2M3N4P5)
        /([A-Z0-9]{12})\b/g, // 12 character alphanumeric (Apple standard)
        // Generic long alphanumeric sequences (likely serials)
        /([A-Z0-9]{15,20})\b/g // Longer sequences
    ];
    
    // Common patterns for part/model numbers (Apple part numbers start with A)
    // Note: All patterns must have 'g' flag for matchAll() to work
    const partPatterns = [
        // Explicit part/model number labels
        /(?:Part|Model|P\/N|PN|Part\s*Number|Model\s*Number)\s*(?:Number|No|#)?\s*:?\s*([A-Z0-9\-]+)/gi,
        // Apple part numbers like A1523, A1722, A2031, A2968, A2968-L, etc.
        /\b(A\d{4}(?:[-/]\w+)?)\b/g,
        // Service kit numbers like 661-17164
        /\b(661-\d{5})\b/g,
        // Model numbers starting with M
        /\b(M[A-Z0-9]{5,})\b/gi,
        // Any A#### pattern (Apple part number)
        /(A\d{4})/g
    ];
    
    // Try to find serial number - prioritize explicit labels first
    // Try both original and normalized text
    const textsToSearch = [originalText, normalizedText];
    
    for (const searchText of textsToSearch) {
        for (const pattern of serialPatterns) {
            try {
                const matches = [...searchText.matchAll(pattern)];
                for (const match of matches) {
                    const candidate = match[1] || match[0];
                    if (candidate && candidate.length >= 10) {
                        // Clean candidate (remove non-alphanumeric except hyphens)
                        const cleaned = candidate.replace(/[^A-Z0-9]/g, '').toUpperCase();
                        
                        // Apple serials are typically 12 chars, but can vary
                        // Filter out common false positives (like part numbers starting with A)
                        if (cleaned.length >= 10 && cleaned.length <= 20) {
                            // If it starts with A and is exactly 12 chars, might be serial (not part number)
                            // Part numbers are typically A#### (5 chars) or A####-X (7-10 chars)
                            if (cleaned.startsWith('A') && cleaned.length === 12) {
                                extracted.serialNumber = cleaned;
                                break;
                            } else if (!cleaned.startsWith('A')) {
                                // Doesn't start with A, likely a serial
                                extracted.serialNumber = cleaned;
                                break;
                            } else if (cleaned.length > 12) {
                                // Longer than part number, likely serial
                                extracted.serialNumber = cleaned;
                                break;
                            }
                        }
                    }
                }
                if (extracted.serialNumber) break;
            } catch (e) {
                console.warn('Error matching serial pattern:', e);
            }
        }
        if (extracted.serialNumber) break;
    }
    
    // Try to find part number - prioritize explicit labels first
    // Try both original and normalized text
    for (const searchText of textsToSearch) {
        for (const pattern of partPatterns) {
            try {
                const matches = [...searchText.matchAll(pattern)];
                for (const match of matches) {
                    const candidate = match[1] || match[0];
                    if (candidate) {
                        // Clean and normalize candidate
                        let cleaned = candidate.trim().toUpperCase();
                        // Fix common OCR errors: O->0, I->1, S->5 in part numbers
                        cleaned = cleaned.replace(/^A([Oo])/g, 'A0') // A0### pattern
                                         .replace(/^A(\d{3})([Oo])/g, 'A$10') // A###0 pattern
                                         .replace(/^A(\d{4})([Oo])/g, 'A$10'); // A####0 pattern
                        
                        // Apple part numbers are typically A#### or A####-X format
                        if (cleaned.match(/^A\d{4}/) || cleaned.match(/^661-/)) {
                            // Validate it's actually a part number (not a serial)
                            // Part numbers are typically 5-10 chars (A#### or A####-X)
                            if (cleaned.length >= 5 && cleaned.length <= 12) {
                                extracted.partNumber = cleaned;
                                break;
                            }
                        }
                    }
                }
                if (extracted.partNumber) break;
            } catch (e) {
                console.warn('Error matching part pattern:', e);
            }
        }
        if (extracted.partNumber) break;
    }
    
    // If no structured match for part number, look for any A#### pattern in both texts
    if (!extracted.partNumber) {
        for (const searchText of textsToSearch) {
            const applePartMatches = searchText.match(/\b(A\d{4}(?:[-/]\w+)?)\b/g);
            if (applePartMatches && applePartMatches.length > 0) {
                // Filter out if it's likely a serial (too long or doesn't match Apple part format)
                const bestMatch = applePartMatches.find(m => {
                    const cleaned = m.trim().toUpperCase();
                    return (cleaned.length >= 5 && cleaned.length <= 12) && cleaned.match(/^A\d{4}/);
                });
                if (bestMatch) {
                    extracted.partNumber = bestMatch.trim().toUpperCase();
                    break;
                }
            }
        }
    }
    
    // More aggressive search for noisy OCR - look for A followed by 4 digits anywhere
    if (!extracted.partNumber) {
        // Remove all non-alphanumeric and search for A#### pattern
        let onlyAlphanumeric = originalText.replace(/[^A-Z0-9]/gi, '');
        
        // Try original text first
        let partMatch = onlyAlphanumeric.match(/A\d{4}/i);
        
        // If not found, try with OCR error corrections (O->0, I->1)
        if (!partMatch) {
            const corrected = onlyAlphanumeric
                .replace(/A[Oo]/gi, 'A0')  // A followed by O becomes A0
                .replace(/A\d[Oo]/gi, (m) => m.replace(/[Oo]/gi, '0'))  // A#O becomes A#0
                .replace(/A\d{2}[Oo]/gi, (m) => m.replace(/[Oo]/gi, '0'))  // A##O becomes A##0
                .replace(/A\d{3}[Oo]/gi, (m) => m.replace(/[Oo]/gi, '0')); // A###O becomes A###0
            partMatch = corrected.match(/A\d{4}/i);
        }
        
        if (partMatch) {
            extracted.partNumber = partMatch[0].toUpperCase();
        }
    }
    
    // More aggressive search for serial - look for 10-20 char alphanumeric sequences
    if (!extracted.serialNumber) {
        let onlyAlphanumeric = originalText.replace(/[^A-Z0-9]/gi, '');
        
        // Find sequences of 10-20 alphanumeric characters
        let serialMatch = onlyAlphanumeric.match(/[A-Z0-9]{10,20}/gi);
        
        // Also try looking specifically for 12-character sequences (Apple standard)
        if (!serialMatch || serialMatch.length === 0) {
            serialMatch = onlyAlphanumeric.match(/[A-Z0-9]{12}/gi);
        }
        
        if (serialMatch && serialMatch.length > 0) {
            // Filter out if it looks like a part number (starts with A and is short)
            // Prefer 12-character sequences that don't start with A
            const candidates = serialMatch.map(m => m.toUpperCase());
            
            // First try to find a 12-char sequence that doesn't start with A
            let candidate = candidates.find(c => c.length === 12 && !c.startsWith('A'));
            
            // If not found, take the longest one that's not a part number
            if (!candidate) {
                candidate = candidates.find(c => 
                    !(c.startsWith('A') && c.length <= 12 && c.match(/^A\d{4}/))
                );
            }
            
            // If still nothing, take the first 12-character match
            if (!candidate) {
                candidate = candidates.find(c => c.length === 12) || candidates[0];
            }
            
            if (candidate) {
                extracted.serialNumber = candidate;
            }
        }
    }
    
    // Clean up extracted values
    if (extracted.serialNumber) {
        extracted.serialNumber = extracted.serialNumber.replace(/[^A-Z0-9]/g, '').substring(0, 20).toUpperCase();
    }
    if (extracted.partNumber) {
        extracted.partNumber = extracted.partNumber.replace(/[^A-Z0-9\-]/g, '').trim().toUpperCase();
    }
    
    // Log what we found for debugging
    console.log('Parsed results:', {
        serialNumber: extracted.serialNumber,
        partNumber: extracted.partNumber,
        textLength: originalText.length,
        textPreview: originalText.substring(0, 200)
    });
    
    return extracted;
}

// Try to match extracted part number to existing parts
async function tryMatchPartNumber(partNumber) {
    try {
        // Get all parts from API
        const response = await fetch(`${API_BASE}/api/admin/parts`);
        const data = await response.json();
        
        if (response.ok && data.parts) {
            // Try to find matching part
            const matchingPart = data.parts.find(part => 
                part.part_model_number.includes(partNumber) || 
                partNumber.includes(part.part_model_number)
            );
            
            if (matchingPart) {
                // Auto-fill generation and part selection
                const generationSelect = document.getElementById('generation');
                if (generationSelect) {
                    generationSelect.value = matchingPart.generation;
                    // Trigger change event to populate part selection
                    generationSelect.dispatchEvent(new Event('change'));
                    
                    // Wait a bit for part selection to populate, then select the matching part
                    setTimeout(() => {
                        const partSelectionSelect = document.getElementById('partSelection');
                        if (partSelectionSelect) {
                            const option = Array.from(partSelectionSelect.options).find(
                                opt => opt.value === matchingPart.part_name
                            );
                            if (option) {
                                partSelectionSelect.value = option.value;
                                partSelectionSelect.dispatchEvent(new Event('change'));
                            }
                        }
                    }, 500);
                }
            }
        }
    } catch (error) {
        console.error('Error matching part number:', error);
    }
}

// Show OCR status message
function showOCRStatus(message, type) {
    ocrStatus.textContent = message;
    ocrStatus.style.display = 'block';
    
    if (type === 'success') {
        ocrStatus.style.background = '#d4edda';
        ocrStatus.style.color = '#155724';
    } else if (type === 'error') {
        ocrStatus.style.background = '#f8d7da';
        ocrStatus.style.color = '#721c24';
    } else {
        ocrStatus.style.background = '#fff3cd';
        ocrStatus.style.color = '#856404';
    }
    
    setTimeout(() => {
        if (type === 'success' || type === 'error') {
            ocrStatus.style.display = 'none';
        }
    }, 5000);
}

// Barcode Scanning
if (startBarcodeScanButton) {
    startBarcodeScanButton.addEventListener('click', () => {
        startBarcodeScanning();
    });
}

if (stopBarcodeScanButton) {
    stopBarcodeScanButton.addEventListener('click', () => {
        stopBarcodeScanning();
    });
}

// Start barcode scanning
async function startBarcodeScanning() {
    if (barcodeScanningActive) return;
    
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: 'environment' } 
        });
        
        barcodeVideo.srcObject = stream;
        barcodeVideo.play();
        barcodeVideo.style.display = 'block';
        barcodeScanner.style.display = 'block';
        barcodeScanningActive = true;
        
        // Use QuaggaJS for barcode scanning
        Quagga.init({
            inputStream: {
                name: "Live",
                type: "LiveStream",
                target: barcodeVideo,
                constraints: {
                    width: 640,
                    height: 480,
                    facingMode: "environment"
                }
            },
            decoder: {
                readers: ["code_128_reader", "ean_reader", "ean_8_reader", "code_39_reader", "code_39_vin_reader", "codabar_reader", "upc_reader", "upc_e_reader", "i2of5_reader"]
            }
        }, (err) => {
            if (err) {
                console.error('Quagga initialization error:', err);
                showOCRStatus('❌ Camera access error. Please scan manually.', 'error');
                stopBarcodeScanning();
                return;
            }
            Quagga.start();
        });
        
        Quagga.onDetected((result) => {
            const code = result.codeResult.code;
            if (code) {
                barcodeScan.value = code;
                showOCRStatus(`✅ Barcode scanned: ${code}`, 'success');
                stopBarcodeScanning();
            }
        });
        
    } catch (error) {
        console.error('Camera access error:', error);
        showOCRStatus('❌ Camera access denied. Please enter barcode manually.', 'error');
    }
}

// Stop barcode scanning
function stopBarcodeScanning() {
    if (barcodeScanningActive) {
        Quagga.stop();
        if (barcodeVideo.srcObject) {
            barcodeVideo.srcObject.getTracks().forEach(track => track.stop());
            barcodeVideo.srcObject = null;
        }
        barcodeVideo.style.display = 'none';
        barcodeScanner.style.display = 'none';
        barcodeScanningActive = false;
    }
}

// Allow manual barcode entry
if (barcodeScan) {
    barcodeScan.addEventListener('input', (e) => {
        // When barcode is entered, auto-fill security barcode field
        const securityBarcodeField = document.getElementById('securityBarcode');
        if (securityBarcodeField && e.target.value) {
            securityBarcodeField.value = e.target.value;
        }
    });
}

