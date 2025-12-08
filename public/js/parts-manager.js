// Parts Manager JavaScript
console.log('[Parts Manager] Script loading...');

// Define API_BASE globally if not already defined
if (typeof window.API_BASE === 'undefined') {
    window.API_BASE = '';
}
// Reference the global API_BASE
var API_BASE = window.API_BASE;

// Store all parts for autocomplete
let allPartsData = [];
console.log('[Parts Manager] Script loaded, API_BASE:', API_BASE);

// Utility functions
function showError(message, elementId = 'errorMessage') {
    const errorDiv = document.getElementById(elementId);
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

// Load all parts
async function loadParts() {
    const partsList = document.getElementById('partsList');
    if (!partsList) {
        // Still try to load parts data for associated parts even if partsList doesn't exist
        try {
            const response = await fetch(`${API_BASE}/api/admin/parts`);
            const data = await response.json();
            if (response.ok && data.parts) {
                allPartsData = data.parts;
                populateAssociatedPartsCheckboxes();
            }
        } catch (err) {
            console.error('[Parts Manager] Error loading parts:', err);
        }
        return;
    }
    
    try {
        console.log('[Parts Manager] Fetching parts from:', `${API_BASE}/api/admin/parts`);
        const response = await fetch(`${API_BASE}/api/admin/parts`);
        console.log('[Parts Manager] Response status:', response.status, response.statusText);
        const data = await response.json();
        console.log('[Parts Manager] Response data:', data);
        
        if (response.ok && data.parts) {
            // Store all parts for associated parts selection
            allPartsData = data.parts;
            console.log('[Parts Manager] Stored', allPartsData.length, 'parts');
            
            // Populate checkboxes if we're editing a part
            const partId = document.getElementById('partId').value;
            const partModelNumber = document.getElementById('part_model_number').value;
            if (partId && partModelNumber) {
                populateAssociatedPartsCheckboxes(partModelNumber);
            } else {
                // Just populate empty checkboxes for new part
                populateAssociatedPartsCheckboxes();
            }
            
            if (data.parts.length === 0) {
                partsList.innerHTML = '<p style="text-align: center; padding: 40px; color: #666;">No parts found. Add your first part above.</p>';
                return;
            }
            
            // Group parts by generation
            const partsByGeneration = {};
            data.parts.forEach(part => {
                if (!partsByGeneration[part.generation]) {
                    partsByGeneration[part.generation] = [];
                }
                partsByGeneration[part.generation].push(part);
            });
            
            // Render grouped parts
            let html = '';
            Object.keys(partsByGeneration).sort().forEach(generation => {
                html += `<div class="generation-group">`;
                html += `<div class="generation-header">${escapeHtml(generation)}</div>`;
                
                partsByGeneration[generation].forEach(part => {
                    const partTypeMap = {
                        'left': 'Left AirPod',
                        'right': 'Right AirPod',
                        'case': 'Case'
                    };
                    
                    html += `
                        <div class="part-item" data-part-id="${escapeHtml(String(part.id))}">
                            <div class="part-item-header">
                                <div class="part-item-title">${escapeHtml(part.part_name)}</div>
                                <div class="part-item-actions">
                                    <button class="edit-button" data-action="edit" data-part-id="${escapeHtml(String(part.id))}">Edit</button>
                                    <button class="delete-button" data-action="delete" data-part-id="${escapeHtml(String(part.id))}">Delete</button>
                                </div>
                            </div>
                            <div class="part-item-details">
                                <div class="part-detail">
                                    <span class="part-detail-label">Model Number:</span> ${escapeHtml(part.part_model_number)}
                                </div>
                                <div class="part-detail">
                                    <span class="part-detail-label">Part Type:</span> ${partTypeMap[part.part_type] || part.part_type}
                                </div>
                                ${part.notes ? `<div class="part-detail"><span class="part-detail-label">Notes:</span> ${escapeHtml(part.notes)}</div>` : ''}
                                <div class="part-detail">
                                    <span class="part-detail-label">Display Order:</span> ${part.display_order || 0}
                                </div>
                                <div class="part-detail">
                                    <span class="part-detail-label">Example Image:</span> 
                                    ${part.example_image 
                                        ? `<span style="color: #28a745;">✓ Uploaded</span> <a href="${part.example_image}" target="_blank" style="color: #007bff; text-decoration: none; margin-left: 8px;">View</a>` 
                                        : `<span style="color: #dc3545;">✗ Not uploaded</span>`}
                                </div>
                                <div class="part-detail">
                                    <span class="part-detail-label">Authenticity Images:</span> 
                                    ${part.authenticity_case_image || part.authenticity_airpod_image 
                                        ? `<span style="color: #28a745;">✓ Uploaded</span>` 
                                        : `<span style="color: #dc3545;">✗ Not uploaded</span>`}
                                </div>
                            </div>
                        </div>
                    `;
                });
                
                html += `</div>`;
            });
            
            partsList.innerHTML = html;
            
            // Attach event listeners to buttons
            partsList.querySelectorAll('[data-action="edit"]').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const partId = e.target.getAttribute('data-part-id');
                    editPart(partId);
                });
            });
            
            partsList.querySelectorAll('[data-action="delete"]').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const partId = e.target.getAttribute('data-part-id');
                    deletePart(partId);
                });
            });
        } else {
            console.error('[Parts Manager] Error response:', {
                status: response.status,
                statusText: response.statusText,
                data: data
            });
            const errorMsg = data.error || 'Unknown error';
            partsList.innerHTML = `<p style="text-align: center; padding: 40px; color: red;">Error loading parts: ${escapeHtml(errorMsg)}</p>`;
        }
    } catch (error) {
        console.error('[Parts Manager] Load parts error:', error);
        const errorMsg = error.message || 'Network error';
        const partsList = document.getElementById('partsList');
        if (partsList) {
            partsList.innerHTML = `<p style="text-align: center; padding: 40px; color: red;">Network error: ${escapeHtml(errorMsg)}. Please refresh the page.</p>`;
        }
    }
}

// Load generations for autocomplete
async function loadGenerations() {
    try {
        const response = await fetch(`${API_BASE}/api/admin/generations`);
        const data = await response.json();
        
        if (response.ok && data.generations) {
            const datalist = document.getElementById('generations-list');
            if (datalist) {
                datalist.innerHTML = '';
                data.generations.forEach(gen => {
                    const option = document.createElement('option');
                    option.value = gen;
                    datalist.appendChild(option);
                });
            }
        }
    } catch (error) {
        console.error('Load generations error:', error);
    }
}

// Part form
const partForm = document.getElementById('partForm');
const cancelButton = document.getElementById('cancelButton');
const submitButton = document.getElementById('submitButton');
const formTitle = document.getElementById('formTitle');
const submitButtonText = document.getElementById('submitButtonText');

// Image preview handlers
const exampleImageInput = document.getElementById('example_image');
const caseImageInput = document.getElementById('authenticity_case_image');
const airpodImageInput = document.getElementById('authenticity_airpod_image');

if (exampleImageInput) {
    exampleImageInput.addEventListener('change', function(e) {
        const file = e.target.files[0];
        const preview = document.getElementById('exampleImagePreview');
        if (file && preview) {
            const reader = new FileReader();
            reader.onload = function(e) {
                preview.innerHTML = `<img src="${e.target.result}" style="max-width: 200px; max-height: 150px; border-radius: 4px; border: 1px solid #ddd;">`;
            };
            reader.readAsDataURL(file);
        } else if (preview) {
            preview.innerHTML = '';
        }
    });
}

if (caseImageInput) {
    caseImageInput.addEventListener('change', function(e) {
        const file = e.target.files[0];
        const preview = document.getElementById('caseImagePreview');
        if (file && preview) {
            const reader = new FileReader();
            reader.onload = function(e) {
                preview.innerHTML = `<img src="${e.target.result}" style="max-width: 200px; max-height: 150px; border-radius: 4px; border: 1px solid #ddd;">`;
            };
            reader.readAsDataURL(file);
        } else if (preview) {
            preview.innerHTML = '';
        }
    });
}

if (airpodImageInput) {
    airpodImageInput.addEventListener('change', function(e) {
        const file = e.target.files[0];
        const preview = document.getElementById('airpodImagePreview');
        if (file && preview) {
            const reader = new FileReader();
            reader.onload = function(e) {
                preview.innerHTML = `<img src="${e.target.result}" style="max-width: 200px; max-height: 150px; border-radius: 4px; border: 1px solid #ddd;">`;
            };
            reader.readAsDataURL(file);
        } else if (preview) {
            preview.innerHTML = '';
        }
    });
}

if (partForm) {
    partForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const partId = document.getElementById('partId').value;
        const generation = document.getElementById('generation').value.trim();
        const partName = document.getElementById('part_name').value.trim();
        const partModelNumber = document.getElementById('part_model_number').value.trim();
        const partType = document.getElementById('part_type').value;
        const notes = document.getElementById('notes').value.trim();
        const displayOrder = parseInt(document.getElementById('display_order').value) || 0;
        const associatedPartsInput = document.getElementById('associated_parts').value.trim();
        // Parse comma-separated model numbers into array
        const associatedParts = associatedPartsInput 
            ? associatedPartsInput.split(',').map(p => p.trim()).filter(p => p.length > 0)
            : [];
        
        if (!generation || !partName || !partModelNumber || !partType) {
            showError('All required fields must be filled');
            return;
        }
        
        submitButton.disabled = true;
        showSpinner();
        
        try {
            const url = partId 
                ? `${API_BASE}/api/admin/part/${partId}`
                : `${API_BASE}/api/admin/part`;
            const method = partId ? 'PUT' : 'POST';
            
            // Use FormData to handle file uploads
            const formData = new FormData();
            formData.append('generation', generation);
            formData.append('part_name', partName);
            formData.append('part_model_number', partModelNumber);
            formData.append('part_type', partType);
            formData.append('notes', notes || '');
            formData.append('display_order', displayOrder);
            formData.append('associated_parts', JSON.stringify(associatedParts));
            
            // Add image files if selected
            const exampleImageFile = document.getElementById('example_image').files[0];
            const caseImageFile = document.getElementById('authenticity_case_image').files[0];
            const airpodImageFile = document.getElementById('authenticity_airpod_image').files[0];
            
            // Add checkbox values for showing images
            const showCaseImage = document.getElementById('show_case_image').checked;
            const showAirpodImage = document.getElementById('show_airpod_image').checked;
            formData.append('show_case_image', showCaseImage);
            formData.append('show_airpod_image', showAirpodImage);
            
            if (exampleImageFile) {
                formData.append('example_image', exampleImageFile);
            }
            if (caseImageFile) {
                formData.append('authenticity_case_image', caseImageFile);
            }
            if (airpodImageFile) {
                formData.append('authenticity_airpod_image', airpodImageFile);
            }
            
            const response = await fetch(url, {
                method: method,
                body: formData
                // Don't set Content-Type header - browser will set it with boundary for FormData
            });
            
            const data = await response.json();
            
            if (response.ok && data.success) {
                showSuccess(partId ? 'Part updated successfully!' : 'Part added successfully!');
                partForm.reset();
                document.getElementById('partId').value = '';
                document.getElementById('caseImagePreview').innerHTML = '';
                document.getElementById('airpodImagePreview').innerHTML = '';
                document.getElementById('associated_parts').value = JSON.stringify([]);
                populateAssociatedPartsCheckboxes(); // Clear checkboxes
                cancelEdit();
                loadParts();
                loadGenerations();
            } else {
                showError(data.error || 'Failed to save part');
            }
        } catch (error) {
            console.error('Save part error:', error);
            showError('Network error. Please try again.');
        } finally {
            submitButton.disabled = false;
            hideSpinner();
        }
    });
}

// Populate associated parts checkboxes
function populateAssociatedPartsCheckboxes(currentPartModelNumber = null) {
    const container = document.getElementById('associatedPartsCheckboxes');
    if (!container) {
        console.warn('[Associated Parts] Container not found');
        return;
    }
    
    if (!allPartsData || allPartsData.length === 0) {
        container.innerHTML = '<p style="color: #666; font-size: 0.9rem; margin: 0;">No parts available. Parts will appear here once loaded.</p>';
        return;
    }
    
    // Get current selected parts
    const hiddenInput = document.getElementById('associated_parts');
    const selectedParts = hiddenInput && hiddenInput.value 
        ? JSON.parse(hiddenInput.value || '[]')
        : [];
    
    // Group parts by generation
    const partsByGeneration = {};
    allPartsData.forEach(part => {
        if (!partsByGeneration[part.generation]) {
            partsByGeneration[part.generation] = [];
        }
        // Don't show the current part in the list
        if (part.part_model_number !== currentPartModelNumber) {
            partsByGeneration[part.generation].push(part);
        }
    });
    
    let html = '';
    Object.keys(partsByGeneration).sort().forEach(generation => {
        html += `<div style="margin-bottom: 16px;">`;
        html += `<div style="font-weight: 600; color: #284064; margin-bottom: 8px; font-size: 0.95rem;">${escapeHtml(generation)}</div>`;
        
        partsByGeneration[generation].forEach(part => {
            const isChecked = selectedParts.includes(part.part_model_number);
            const partTypeLabel = part.part_type === 'left' ? 'Left AirPod' : part.part_type === 'right' ? 'Right AirPod' : 'Case';
            html += `
                <label style="display: flex; align-items: center; gap: 8px; padding: 6px 8px; cursor: pointer; border-radius: 4px; transition: background 0.2s;" 
                       onmouseover="this.style.background='#e7f3ff'" 
                       onmouseout="this.style.background='transparent'">
                    <input type="checkbox" 
                           class="associated-part-checkbox" 
                           value="${escapeHtml(part.part_model_number)}"
                           ${isChecked ? 'checked' : ''}
                           style="width: 18px; height: 18px; cursor: pointer;">
                    <span style="font-size: 0.9rem; color: #1a1a1a;">
                        <strong>${escapeHtml(part.part_model_number)}</strong> - ${escapeHtml(part.part_name)} (${partTypeLabel})
                    </span>
                </label>
            `;
        });
        
        html += `</div>`;
    });
    
    container.innerHTML = html || '<p style="color: #666; font-size: 0.9rem; margin: 0;">No other parts available.</p>';
    
    // Add event listeners to update hidden input
    container.querySelectorAll('.associated-part-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', updateAssociatedPartsFromCheckboxes);
    });
}

// Update hidden input from checkboxes
function updateAssociatedPartsFromCheckboxes() {
    const checkboxes = document.querySelectorAll('.associated-part-checkbox:checked');
    const selectedParts = Array.from(checkboxes).map(cb => cb.value);
    const hiddenInput = document.getElementById('associated_parts');
    if (hiddenInput) {
        hiddenInput.value = JSON.stringify(selectedParts);
    }
    console.log('[Associated Parts] Updated:', selectedParts);
}

// Get associated parts array from hidden input (JSON)
function getAssociatedPartsFromInput() {
    const input = document.getElementById('associated_parts');
    if (!input) return [];
    const value = input.value;
    if (!value) return [];
    try {
        return JSON.parse(value);
    } catch (e) {
        return [];
    }
}

// Initialize associated parts checkboxes when parts are loaded
function initializeAssociatedPartsCheckboxes() {
    if (allPartsData && allPartsData.length > 0) {
        const partModelNumber = document.getElementById('part_model_number').value;
        populateAssociatedPartsCheckboxes(partModelNumber || null);
    } else {
        // Wait for parts to load
        setTimeout(initializeAssociatedPartsCheckboxes, 500);
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(initializeAssociatedPartsCheckboxes, 500);
    });
} else {
    setTimeout(initializeAssociatedPartsCheckboxes, 500);
}

// Edit part
async function editPart(id) {
    try {
        // Convert id to string/number if needed
        const partId = String(id);
        
        const response = await fetch(`${API_BASE}/api/admin/parts`);
        const data = await response.json();
        
        if (response.ok && data.parts) {
            const part = data.parts.find(p => String(p.id) === partId);
            if (part) {
                document.getElementById('partId').value = part.id;
                document.getElementById('generation').value = part.generation;
                document.getElementById('part_name').value = part.part_name;
                document.getElementById('part_model_number').value = part.part_model_number;
                document.getElementById('part_type').value = part.part_type;
                document.getElementById('notes').value = part.notes || '';
                document.getElementById('display_order').value = part.display_order || 0;
                
                // Populate associated parts checkboxes
                const associatedPartsHidden = document.getElementById('associated_parts');
                if (associatedPartsHidden && part.associated_parts && Array.isArray(part.associated_parts)) {
                    associatedPartsHidden.value = JSON.stringify(part.associated_parts);
                    populateAssociatedPartsCheckboxes(part.part_model_number);
                } else if (associatedPartsHidden) {
                    associatedPartsHidden.value = JSON.stringify([]);
                    populateAssociatedPartsCheckboxes(part.part_model_number);
                }
                
                // Show existing images if they exist
                const examplePreview = document.getElementById('exampleImagePreview');
                const casePreview = document.getElementById('caseImagePreview');
                const airpodPreview = document.getElementById('airpodImagePreview');
                
                if (part.example_image && examplePreview) {
                    examplePreview.innerHTML = `<img src="${part.example_image}" style="max-width: 200px; max-height: 150px; border-radius: 4px; border: 1px solid #ddd;"><br><small style="color: #666; font-size: 0.8rem;">Current image (upload new to replace)</small>`;
                } else if (examplePreview) {
                    examplePreview.innerHTML = '';
                }
                
                if (part.authenticity_case_image && casePreview) {
                    casePreview.innerHTML = `<img src="${part.authenticity_case_image}" style="max-width: 200px; max-height: 150px; border-radius: 4px; border: 1px solid #ddd;"><br><small style="color: #666; font-size: 0.8rem;">Current image (upload new to replace)</small>`;
                } else if (casePreview) {
                    casePreview.innerHTML = '';
                }
                
                // Set checkbox for showing case image (default to true if not set)
                const showCaseImageCheckbox = document.getElementById('show_case_image');
                if (showCaseImageCheckbox) {
                    showCaseImageCheckbox.checked = part.show_case_image !== false; // Default to true
                }
                
                if (part.authenticity_airpod_image && airpodPreview) {
                    airpodPreview.innerHTML = `<img src="${part.authenticity_airpod_image}" style="max-width: 200px; max-height: 150px; border-radius: 4px; border: 1px solid #ddd;"><br><small style="color: #666; font-size: 0.8rem;">Current image (upload new to replace)</small>`;
                } else if (airpodPreview) {
                    airpodPreview.innerHTML = '';
                }
                
                // Set checkbox for showing AirPod image (default to true if not set)
                const showAirpodImageCheckbox = document.getElementById('show_airpod_image');
                if (showAirpodImageCheckbox) {
                    showAirpodImageCheckbox.checked = part.show_airpod_image !== false; // Default to true
                }
                
                formTitle.textContent = 'Edit Part';
                submitButtonText.textContent = 'Update Part';
                cancelButton.style.display = 'inline-block';
                
                // Scroll to form
                document.querySelector('.parts-form').scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }
    } catch (error) {
        console.error('Edit part error:', error);
        showError('Failed to load part for editing');
    }
}

// Cancel edit
function cancelEdit() {
    document.getElementById('partId').value = '';
    partForm.reset();
    document.getElementById('exampleImagePreview').innerHTML = '';
    document.getElementById('caseImagePreview').innerHTML = '';
    document.getElementById('airpodImagePreview').innerHTML = '';
    document.getElementById('associated_parts').value = JSON.stringify([]);
    populateAssociatedPartsCheckboxes(); // Clear checkboxes
    formTitle.textContent = 'Add New Part';
    submitButtonText.textContent = 'Add Part';
    cancelButton.style.display = 'none';
}

if (cancelButton) {
    cancelButton.addEventListener('click', cancelEdit);
}

// Delete part
async function deletePart(id) {
    if (!confirm('Are you sure you want to delete this part? This action cannot be undone.')) {
        return;
    }
    
    try {
        // Convert id to string for URL encoding
        const partId = String(id);
        const response = await fetch(`${API_BASE}/api/admin/part/${encodeURIComponent(partId)}`, {
            method: 'DELETE'
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
            showSuccess('Part deleted successfully');
            loadParts();
            if (document.getElementById('partId').value == partId) {
                cancelEdit();
            }
        } else {
            showError(data.error || 'Failed to delete part');
        }
    } catch (error) {
        console.error('Delete part error:', error);
        showError('Network error. Please try again.');
    }
}

// Make functions available globally (for backwards compatibility)
window.editPart = editPart;
window.deletePart = deletePart;

// Escape HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Initialize
if (document.getElementById('partsList')) {
    loadParts();
    loadGenerations();
    
    // Refresh parts every 30 seconds
    setInterval(loadParts, 30000);
}

// Ensure autocomplete is populated - run this code immediately
console.log('[Autocomplete Init] Script loaded, readyState:', document.readyState);

function tryPopulateAutocomplete() {
    console.log('[Autocomplete Init] Attempting to populate, allPartsData length:', allPartsData ? allPartsData.length : 0);
    const datalist = document.getElementById('associatedPartsSuggestions');
    const input = document.getElementById('associated_parts');
    console.log('[Autocomplete Init] Datalist found:', !!datalist, 'Input found:', !!input);
    
    if (allPartsData && allPartsData.length > 0) {
        updateAssociatedPartsAutocomplete();
    } else {
        // Try loading parts if not loaded
        console.log('[Autocomplete Init] No parts data, attempting to load...');
        fetch(`${API_BASE}/api/admin/parts`)
            .then(res => res.json())
            .then(data => {
                if (data.parts) {
                    allPartsData = data.parts;
                    console.log('[Autocomplete Init] Loaded', allPartsData.length, 'parts');
                    updateAssociatedPartsAutocomplete();
                }
            })
            .catch(err => console.error('[Autocomplete Init] Error loading parts:', err));
    }
}

// Hook into loadParts to populate autocomplete when parts are loaded
const originalLoadParts = loadParts;
loadParts = async function() {
    const result = await originalLoadParts();
    console.log('[Autocomplete Init] Parts loaded, triggering autocomplete update');
    setTimeout(tryPopulateAutocomplete, 100);
    return result;
};

// Try multiple times to ensure it runs
console.log('[Autocomplete Init] Setting up initialization timers');
if (document.readyState === 'complete' || document.readyState === 'interactive') {
    console.log('[Autocomplete Init] DOM ready, trying immediately');
    setTimeout(tryPopulateAutocomplete, 100);
    setTimeout(tryPopulateAutocomplete, 1000);
    setTimeout(tryPopulateAutocomplete, 2000);
} else {
    console.log('[Autocomplete Init] Waiting for DOMContentLoaded');
    document.addEventListener('DOMContentLoaded', () => {
        console.log('[Autocomplete Init] DOMContentLoaded fired');
        setTimeout(tryPopulateAutocomplete, 100);
        setTimeout(tryPopulateAutocomplete, 1000);
        setTimeout(tryPopulateAutocomplete, 2000);
    });
}

// Also try after window load
window.addEventListener('load', () => {
    console.log('[Autocomplete Init] Window load event fired');
    setTimeout(tryPopulateAutocomplete, 500);
});

// Final fallback - try after 3 seconds
setTimeout(() => {
    console.log('[Autocomplete Init] Final fallback attempt');
    tryPopulateAutocomplete();
}, 3000);

