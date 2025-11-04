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
            
            // Auto-fill form fields
            if (extractedData.serialNumber) {
                document.getElementById('serialNumber').value = extractedData.serialNumber;
            }
            
            if (extractedData.partNumber) {
                document.getElementById('partModelNumber').value = extractedData.partNumber;
            }
            
            // Try to match part number to existing parts
            if (extractedData.partNumber) {
                await tryMatchPartNumber(extractedData.partNumber);
            }
            
            showOCRStatus('✅ Data extracted successfully!', 'success');
            
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
    
    // Common patterns for serial numbers (alphanumeric, 10-20 chars)
    const serialPatterns = [
        /Serial\s*(?:Number|No|#)?\s*:?\s*([A-Z0-9]{10,20})/i,
        /S\/N\s*:?\s*([A-Z0-9]{10,20})/i,
        /SN\s*:?\s*([A-Z0-9]{10,20})/i,
        /([A-Z0-9]{12,20})/ // Generic long alphanumeric (likely serial)
    ];
    
    // Common patterns for part/model numbers (usually start with A, M, or similar)
    const partPatterns = [
        /(?:Part|Model|P\/N|PN)\s*(?:Number|No|#)?\s*:?\s*([A-Z0-9\-]+)/i,
        /(A\d{4}(?:[-/]\w+)?)/, // Apple part numbers like A1523, A2968-L
        /(M[A-Z0-9]{5,})/i, // Model numbers starting with M
        /(?:Model|Part)\s*:?\s*([A-Z0-9\-]+)/i
    ];
    
    // Try to find serial number
    for (const pattern of serialPatterns) {
        const match = text.match(pattern);
        if (match && match[1]) {
            extracted.serialNumber = match[1].trim();
            break;
        }
    }
    
    // Try to find part number
    for (const pattern of partPatterns) {
        const match = text.match(pattern);
        if (match && match[1]) {
            extracted.partNumber = match[1].trim();
            break;
        }
    }
    
    // If no structured match, look for Apple-style part numbers (A####)
    if (!extracted.partNumber) {
        const applePartMatch = text.match(/(A\d{4}(?:[-/]\w+)?)/);
        if (applePartMatch) {
            extracted.partNumber = applePartMatch[1];
        }
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

