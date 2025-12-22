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
    const chooseFromLibraryBtn = document.getElementById('chooseFromLibraryBtn');
    const takePhotoBtn = document.getElementById('takePhotoBtn');
    const selectedPhotosInfo = document.getElementById('selectedPhotosInfo');
    const selectedCount = document.getElementById('selectedCount');

    if (!sessionId) {
        setStatus('Missing upload session. Please scan the QR code again.', 'error');
        if (uploadButton) uploadButton.disabled = true;
        return;
    }

    // Handle "Choose from Library" button
    if (chooseFromLibraryBtn && fileInput) {
        chooseFromLibraryBtn.addEventListener('click', () => {
            fileInput.click();
        });
    }

    // Handle "Take Photo" button
    if (takePhotoBtn && cameraInput) {
        takePhotoBtn.addEventListener('click', () => {
            cameraInput.click();
        });
    }

    // Update selected count when files are chosen from library
    if (fileInput) {
        fileInput.addEventListener('change', () => {
            updateSelectedCount(fileInput.files.length);
        });
    }

    // Update selected count when photos are taken with camera
    if (cameraInput && fileInput) {
        cameraInput.addEventListener('change', () => {
            // Transfer files from camera to main input
            const dt = new DataTransfer();
            Array.from(cameraInput.files).forEach(file => dt.items.add(file));
            
            // If there are existing files in main input, add them too
            Array.from(fileInput.files).forEach(file => dt.items.add(file));
            
            fileInput.files = dt.files;
            updateSelectedCount(fileInput.files.length);
        });
    }

    function updateSelectedCount(count) {
        if (selectedCount) selectedCount.textContent = count;
        if (selectedPhotosInfo) {
            selectedPhotosInfo.style.display = count > 0 ? 'block' : 'none';
        }
    }

    if (uploadButton) {
        uploadButton.addEventListener('click', async () => {
            if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
                setStatus('Select at least one photo to upload.', 'error');
                return;
            }

            uploadButton.disabled = true;
            setStatus('Uploading photos...', '');

            try {
                const uploaded = await uploadPhonePhotos(sessionId, fileInput.files);
                setStatus(`Uploaded ${uploaded.length} photo(s). You can return to your laptop and click "Load Phone Photos".`, 'success');
                fileInput.value = '';
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
