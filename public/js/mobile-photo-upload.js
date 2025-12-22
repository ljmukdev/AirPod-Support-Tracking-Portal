function setStatus(message, type = '') {
    const statusEl = document.getElementById('uploadStatus');
    if (!statusEl) return;
    statusEl.textContent = message;
    statusEl.className = `upload-status ${type}`.trim();
}

function getSessionId() {
    const params = new URLSearchParams(window.location.search);
    return params.get('session');
}

async function uploadPhonePhotos(sessionId, files) {
    const formData = new FormData();
    Array.from(files).forEach(file => {
        formData.append('photos', file);
    });

    const response = await fetch(`/api/photo-upload/${encodeURIComponent(sessionId)}`, {
        method: 'POST',
        body: formData
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to upload photos.');
    }

    return data.photos || [];
}

document.addEventListener('DOMContentLoaded', () => {
    const sessionId = getSessionId();
    const uploadButton = document.getElementById('uploadPhonePhotos');
    const fileInput = document.getElementById('phonePhotos');
    const cameraInput = document.getElementById('phonePhotosCamera');
    const selectedPhotosInfo = document.getElementById('selectedPhotosInfo');
    const selectedCount = document.getElementById('selectedCount');

    // Combined files array to store all selected files
    let allFiles = [];

    if (!sessionId) {
        setStatus('Missing upload session. Please scan the QR code again.', 'error');
        if (uploadButton) uploadButton.disabled = true;
        return;
    }

    function updateSelectedCount(count) {
        if (selectedCount) selectedCount.textContent = count;
        if (selectedPhotosInfo) {
            selectedPhotosInfo.style.display = count > 0 ? 'block' : 'none';
        }
    }

    // Update selected count when files are chosen from library
    if (fileInput) {
        fileInput.addEventListener('change', () => {
            // Add new files to allFiles array
            const newFiles = Array.from(fileInput.files);
            newFiles.forEach(file => {
                // Check if file already exists
                const exists = allFiles.some(f => f.name === file.name && f.size === file.size);
                if (!exists) {
                    allFiles.push(file);
                }
            });
            updateSelectedCount(allFiles.length);
        });
    }

    // Update selected count when photos are taken with camera
    if (cameraInput) {
        cameraInput.addEventListener('change', () => {
            // Add new files to allFiles array
            const newFiles = Array.from(cameraInput.files);
            newFiles.forEach(file => {
                // Check if file already exists
                const exists = allFiles.some(f => f.name === file.name && f.size === file.size);
                if (!exists) {
                    allFiles.push(file);
                }
            });
            updateSelectedCount(allFiles.length);
        });
    }

    if (uploadButton) {
        uploadButton.addEventListener('click', async () => {
            if (allFiles.length === 0) {
                setStatus('Select at least one photo to upload.', 'error');
                return;
            }

            uploadButton.disabled = true;
            setStatus('Uploading photos...', '');

            try {
                // Create FileList-like object from allFiles array
                const dt = new DataTransfer();
                allFiles.forEach(file => dt.items.add(file));
                
                const uploaded = await uploadPhonePhotos(sessionId, dt.files);
                setStatus(`Uploaded ${uploaded.length} photo(s). You can return to your laptop and click "Load Phone Photos".`, 'success');
                
                // Clear all files and reset inputs
                allFiles = [];
                if (fileInput) fileInput.value = '';
                if (cameraInput) cameraInput.value = '';
                updateSelectedCount(0);
            } catch (error) {
                setStatus(error.message, 'error');
            } finally {
                uploadButton.disabled = false;
            }
        });
    }
});
