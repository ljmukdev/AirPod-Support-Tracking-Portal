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

    if (!sessionId) {
        setStatus('Missing upload session. Please scan the QR code again.', 'error');
        if (uploadButton) uploadButton.disabled = true;
        return;
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
            } catch (error) {
                setStatus(error.message, 'error');
            } finally {
                uploadButton.disabled = false;
            }
        });
    }
});
