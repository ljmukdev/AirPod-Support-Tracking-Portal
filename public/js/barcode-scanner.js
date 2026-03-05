/**
 * Universal Barcode Scanner Component
 *
 * Adds a camera barcode scanning button to any input field.
 *
 * Usage:
 *   Add data-barcode-scannable to any <input> element:
 *     <input type="text" id="trackingNumber" data-barcode-scannable>
 *
 *   Or attach programmatically:
 *     BarcodeScanner.attach(document.getElementById('myInput'));
 */
(function() {
    'use strict';

    let activeScanner = null;
    let overlay = null;

    function createOverlay() {
        if (overlay) return overlay;

        overlay = document.createElement('div');
        overlay.className = 'barcode-overlay';
        overlay.innerHTML = `
            <div class="barcode-overlay-content">
                <div class="barcode-overlay-header">
                    <span class="barcode-overlay-title">Scan Barcode</span>
                    <button type="button" class="barcode-overlay-close" aria-label="Close scanner">&times;</button>
                </div>
                <div class="barcode-overlay-body">
                    <div id="barcode-scanner-viewport" class="barcode-scanner-viewport">
                        <video id="barcode-scanner-video" autoplay playsinline muted></video>
                        <div class="barcode-scan-line"></div>
                        <div class="barcode-scan-corners"></div>
                    </div>
                    <p class="barcode-scanner-hint">Point your camera at a barcode</p>
                    <div class="barcode-scanner-status" id="barcode-scanner-status"></div>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        overlay.querySelector('.barcode-overlay-close').addEventListener('click', stopScanning);
        overlay.addEventListener('click', function(e) {
            if (e.target === overlay) stopScanning();
        });

        return overlay;
    }

    function startScanning(targetInput) {
        if (activeScanner) {
            stopScanning();
        }

        const ol = createOverlay();
        ol.classList.add('active');
        document.body.style.overflow = 'hidden';
        activeScanner = { targetInput: targetInput };

        const video = document.getElementById('barcode-scanner-video');
        const statusEl = document.getElementById('barcode-scanner-status');
        statusEl.textContent = '';

        navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
        }).then(function(stream) {
            if (!activeScanner) {
                stream.getTracks().forEach(function(t) { t.stop(); });
                return;
            }
            activeScanner.stream = stream;
            video.srcObject = stream;
            video.play();

            initQuagga(targetInput);
        }).catch(function(err) {
            console.error('Camera access error:', err);
            statusEl.textContent = 'Camera access denied. Please allow camera permissions and try again.';
            statusEl.className = 'barcode-scanner-status error';
        });
    }

    function initQuagga(targetInput) {
        if (typeof Quagga === 'undefined') {
            var statusEl = document.getElementById('barcode-scanner-status');
            statusEl.textContent = 'Loading barcode library...';
            statusEl.className = 'barcode-scanner-status';

            var script = document.createElement('script');
            script.src = 'https://unpkg.com/quagga@0.12.1/dist/quagga.min.js';
            script.onload = function() { runQuagga(targetInput); };
            script.onerror = function() {
                statusEl.textContent = 'Failed to load barcode scanner library.';
                statusEl.className = 'barcode-scanner-status error';
            };
            document.head.appendChild(script);
        } else {
            runQuagga(targetInput);
        }
    }

    function runQuagga(targetInput) {
        var viewport = document.getElementById('barcode-scanner-viewport');
        var statusEl = document.getElementById('barcode-scanner-status');

        // Stop any previous Quagga instance
        try { Quagga.stop(); } catch(e) {}
        try { Quagga.offDetected(); } catch(e) {}

        Quagga.init({
            inputStream: {
                name: "Live",
                type: "LiveStream",
                target: viewport,
                constraints: {
                    width: { min: 640, ideal: 1280 },
                    height: { min: 480, ideal: 720 },
                    facingMode: "environment"
                }
            },
            locator: {
                patchSize: "medium",
                halfSample: true
            },
            numOfWorkers: navigator.hardwareConcurrency ? Math.min(navigator.hardwareConcurrency, 4) : 2,
            decoder: {
                readers: [
                    "code_128_reader",
                    "ean_reader",
                    "ean_8_reader",
                    "code_39_reader",
                    "code_39_vin_reader",
                    "codabar_reader",
                    "upc_reader",
                    "upc_e_reader",
                    "i2of5_reader"
                ]
            },
            locate: true
        }, function(err) {
            if (err) {
                console.error('Quagga init error:', err);
                statusEl.textContent = 'Scanner initialization failed. Please try again.';
                statusEl.className = 'barcode-scanner-status error';
                return;
            }
            if (!activeScanner) return;
            activeScanner.quaggaRunning = true;
            Quagga.start();
        });

        // Use a confidence buffer to reduce false positives
        var detectionBuffer = [];
        var REQUIRED_MATCHES = 2;

        Quagga.onDetected(function(result) {
            if (!activeScanner) return;
            var code = result.codeResult.code;
            if (!code) return;

            detectionBuffer.push(code);
            if (detectionBuffer.length > 10) detectionBuffer.shift();

            // Check if the same code appeared enough times
            var count = detectionBuffer.filter(function(c) { return c === code; }).length;
            if (count >= REQUIRED_MATCHES) {
                var value = code.toUpperCase();
                targetInput.value = value;
                targetInput.dispatchEvent(new Event('input', { bubbles: true }));
                targetInput.dispatchEvent(new Event('change', { bubbles: true }));

                statusEl.textContent = 'Scanned: ' + value;
                statusEl.className = 'barcode-scanner-status success';

                setTimeout(function() { stopScanning(); }, 600);
            }
        });
    }

    function stopScanning() {
        if (activeScanner) {
            if (activeScanner.quaggaRunning) {
                try { Quagga.stop(); } catch(e) {}
                try { Quagga.offDetected(); } catch(e) {}
            }
            if (activeScanner.stream) {
                activeScanner.stream.getTracks().forEach(function(t) { t.stop(); });
            }
            activeScanner = null;
        }

        // Remove Quagga-injected video elements from viewport
        var viewport = document.getElementById('barcode-scanner-viewport');
        if (viewport) {
            var quaggaVideos = viewport.querySelectorAll('video:not(#barcode-scanner-video)');
            quaggaVideos.forEach(function(v) { v.remove(); });
            var canvases = viewport.querySelectorAll('canvas');
            canvases.forEach(function(c) { c.remove(); });
        }

        var video = document.getElementById('barcode-scanner-video');
        if (video) {
            video.srcObject = null;
        }

        if (overlay) {
            overlay.classList.remove('active');
        }
        document.body.style.overflow = '';
    }

    function createScanButton(targetInput) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'barcode-scan-btn';
        btn.setAttribute('aria-label', 'Scan barcode with camera');
        btn.title = 'Scan barcode';
        btn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>';

        btn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            startScanning(targetInput);
        });

        return btn;
    }

    function attachToInput(input) {
        if (input._barcodeScannerAttached) return;
        input._barcodeScannerAttached = true;

        var btn = createScanButton(input);

        // Wrap input and button in a flex container if not already wrapped
        var parent = input.parentElement;

        // Check if the parent is already a flex wrapper we created
        if (parent && parent.classList.contains('barcode-input-wrapper')) return;

        var wrapper = document.createElement('div');
        wrapper.className = 'barcode-input-wrapper';

        input.parentNode.insertBefore(wrapper, input);
        wrapper.appendChild(input);
        wrapper.appendChild(btn);
    }

    function init() {
        var inputs = document.querySelectorAll('[data-barcode-scannable]');
        inputs.forEach(function(input) {
            attachToInput(input);
        });
    }

    // Auto-initialize on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // Expose API for programmatic use
    window.BarcodeScanner = {
        attach: attachToInput,
        scan: startScanning,
        stop: stopScanning,
        init: init
    };
})();
