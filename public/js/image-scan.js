// Image OCR and Barcode Scanning

let barcodeScanningActive = false;

// Initialize OCR button
const imageUpload = document.getElementById('imageUpload');
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

// Show image preview when file is selected
if (imageUpload) {
    imageUpload.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                previewImg.src = event.target.result;
                imagePreview.style.display = 'block';
            };
            reader.readAsDataURL(file);
        }
    });
}

// OCR Image Processing
if (scanImageButton) {
    scanImageButton.addEventListener('click', async () => {
        const file = imageUpload.files[0];
        if (!file) {
            showOCRStatus('Please select an image first', 'error');
            return;
        }
        
        scanImageButton.disabled = true;
        scanImageButton.textContent = 'Processing...';
        ocrStatus.style.display = 'block';
        ocrStatus.textContent = 'Extracting text from image...';
        ocrStatus.style.background = '#fff3cd';
        ocrStatus.style.color = '#856404';
        
        try {
            // Use Tesseract.js for OCR
            const { data: { text } } = await Tesseract.recognize(file, 'eng', {
                logger: m => {
                    if (m.status === 'recognizing text') {
                        ocrStatus.textContent = `Processing: ${Math.round(m.progress * 100)}%`;
                    }
                }
            });
            
            console.log('OCR Text:', text);
            
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
                showOCRStatus('⚠️ Could not extract serial or part number. Please check the image quality or enter manually.', 'error');
                // Show OCR text for debugging
                console.log('OCR Text for manual review:', text);
            }
            
        } catch (error) {
            console.error('OCR Error:', error);
            showOCRStatus('❌ Error extracting text. Please enter manually.', 'error');
        } finally {
            scanImageButton.disabled = false;
            scanImageButton.textContent = 'Extract Data from Image';
        }
    });
}

// Parse OCR text to extract serial numbers and part numbers
function parseOCRText(text) {
    const extracted = {
        serialNumber: null,
        partNumber: null
    };
    
    // Clean up text - remove extra whitespace
    const cleanText = text.replace(/\s+/g, ' ').trim();
    
    // Common patterns for serial numbers (Apple serials are typically 12 characters, alphanumeric)
    const serialPatterns = [
        // Explicit serial number labels
        /Serial\s*(?:Number|No|#)?\s*:?\s*([A-Z0-9]{10,20})/i,
        /S\/N\s*:?\s*([A-Z0-9]{10,20})/i,
        /SN\s*:?\s*([A-Z0-9]{10,20})/i,
        /Serial\s*:?\s*([A-Z0-9]{10,20})/i,
        // Apple serial number format (typically 12 chars, like: GTCJ85TF18JQ, C8K9L2M3N4P5)
        /([A-Z0-9]{12})\b/g, // 12 character alphanumeric (Apple standard)
        // Generic long alphanumeric sequences (likely serials)
        /([A-Z0-9]{15,20})\b/g // Longer sequences
    ];
    
    // Common patterns for part/model numbers (Apple part numbers start with A)
    const partPatterns = [
        // Explicit part/model number labels
        /(?:Part|Model|P\/N|PN|Part\s*Number|Model\s*Number)\s*(?:Number|No|#)?\s*:?\s*([A-Z0-9\-]+)/i,
        // Apple part numbers like A1523, A1722, A2031, A2968, A2968-L, etc.
        /\b(A\d{4}(?:[-/]\w+)?)\b/,
        // Service kit numbers like 661-17164
        /\b(661-\d{5})\b/,
        // Model numbers starting with M
        /\b(M[A-Z0-9]{5,})\b/i,
        // Any A#### pattern (Apple part number)
        /(A\d{4})/g
    ];
    
    // Try to find serial number - prioritize explicit labels first
    for (const pattern of serialPatterns) {
        const matches = [...cleanText.matchAll(pattern)];
        for (const match of matches) {
            const candidate = match[1] || match[0];
            if (candidate && candidate.length >= 10) {
                // Apple serials are typically 12 chars, but can vary
                // Filter out common false positives
                if (!candidate.includes('A') || candidate.length === 12) {
                    extracted.serialNumber = candidate.trim();
                    break;
                }
            }
        }
        if (extracted.serialNumber) break;
    }
    
    // Try to find part number - prioritize explicit labels first
    for (const pattern of partPatterns) {
        const matches = [...cleanText.matchAll(pattern)];
        for (const match of matches) {
            const candidate = match[1] || match[0];
            if (candidate) {
                // Apple part numbers are typically A#### or A####-X format
                if (candidate.match(/^A\d{4}/) || candidate.match(/^661-/)) {
                    extracted.partNumber = candidate.trim();
                    break;
                }
            }
        }
        if (extracted.partNumber) break;
    }
    
    // If no structured match for part number, look for any A#### pattern
    if (!extracted.partNumber) {
        const applePartMatches = cleanText.match(/\b(A\d{4}(?:[-/]\w+)?)\b/g);
        if (applePartMatches && applePartMatches.length > 0) {
            // Filter out if it's likely a serial (too long or doesn't match Apple part format)
            const bestMatch = applePartMatches.find(m => m.length <= 10 || m.includes('-'));
            if (bestMatch) {
                extracted.partNumber = bestMatch.trim();
            }
        }
    }
    
    // Clean up extracted values
    if (extracted.serialNumber) {
        extracted.serialNumber = extracted.serialNumber.replace(/[^A-Z0-9]/g, '').substring(0, 20);
    }
    if (extracted.partNumber) {
        extracted.partNumber = extracted.partNumber.trim();
    }
    
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

