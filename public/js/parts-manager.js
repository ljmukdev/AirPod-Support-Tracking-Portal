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
        // Still try to load parts data for autocomplete even if partsList doesn't exist
        try {
            const response = await fetch(`${API_BASE}/api/admin/parts`);
            const data = await response.json();
            if (response.ok && data.parts) {
                allPartsData = data.parts;
                updateAssociatedPartsAutocomplete();
            }
        } catch (err) {
            console.error('[Parts Manager] Error loading parts for autocomplete:', err);
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
            // Store all parts for autocomplete
            allPartsData = data.parts;
            console.log('[Parts Manager] Stored', allPartsData.length, 'parts for autocomplete');
            updateAssociatedPartsAutocomplete();
            
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
                updateAssociatedPartsTags([]); // Clear tags
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

// Custom autocomplete dropdown functionality
let autocompleteTimeout;
let selectedIndex = -1;

function showAutocompleteSuggestions(searchTerm) {
    const dropdown = document.getElementById('associatedPartsDropdown');
    const input = document.getElementById('associated_parts');
    
    if (!dropdown || !input) return;
    
    if (!searchTerm || searchTerm.trim().length === 0) {
        dropdown.style.display = 'none';
        return;
    }
    
    if (!allPartsData || allPartsData.length === 0) {
        dropdown.style.display = 'none';
        return;
    }
    
    const searchLower = searchTerm.toLowerCase();
    const modelNumbers = [...new Set(allPartsData.map(part => part.part_model_number).filter(Boolean))];
    const matches = modelNumbers.filter(num => 
        num.toLowerCase().includes(searchLower)
    ).sort().slice(0, 10); // Limit to 10 suggestions
    
    if (matches.length === 0) {
        dropdown.style.display = 'none';
        return;
    }
    
    dropdown.innerHTML = '';
    selectedIndex = -1;
    
    matches.forEach((modelNumber, index) => {
        const item = document.createElement('div');
        item.style.cssText = 'padding: 8px 12px; cursor: pointer; border-bottom: 1px solid #eee;';
        item.textContent = modelNumber;
        item.dataset.value = modelNumber;
        
        item.addEventListener('mouseenter', function() {
            // Remove highlight from all items
            dropdown.querySelectorAll('div').forEach(d => {
                d.style.background = 'white';
                d.style.color = '#1a1a1a';
            });
            this.style.background = '#0064D2';
            this.style.color = 'white';
            selectedIndex = index;
        });
        
        item.addEventListener('click', function() {
            const currentValue = input.value.trim();
            const parts = currentValue ? currentValue.split(',').map(p => p.trim()).filter(p => p.length > 0) : [];
            if (!parts.includes(modelNumber)) {
                parts.push(modelNumber);
                input.value = parts.join(', ');
                updateAssociatedPartsTags(parts);
            }
            dropdown.style.display = 'none';
            input.focus();
        });
        
        dropdown.appendChild(item);
    });
    
    dropdown.style.display = 'block';
}

function updateAssociatedPartsAutocomplete() {
    // This function is now just for initialization - the real work is done by showAutocompleteSuggestions
    console.log('[Autocomplete] Autocomplete system ready with', allPartsData ? allPartsData.length : 0, 'parts');
}

// Get associated parts array from input field
function getAssociatedPartsFromInput() {
    const input = document.getElementById('associated_parts');
    if (!input) return [];
    const value = input.value.trim();
    if (!value) return [];
    return value.split(',').map(p => p.trim()).filter(p => p.length > 0);
}

// Update input field from array
function updateAssociatedPartsInput(partsArray) {
    const input = document.getElementById('associated_parts');
    if (!input) return;
    input.value = partsArray.join(', ');
}

// Update associated parts tags display
function updateAssociatedPartsTags(partsArray) {
    const tagsContainer = document.getElementById('associatedPartsTags');
    if (!tagsContainer) return;
    
    // Clear existing tags
    tagsContainer.innerHTML = '';
    
    if (!partsArray || partsArray.length === 0) {
        return;
    }
    
    // Create a tag for each part
    partsArray.forEach((partNumber, index) => {
        const tag = document.createElement('div');
        tag.style.cssText = 'display: inline-flex; align-items: center; gap: 6px; background: #e7f3ff; border: 1px solid #0064D2; border-radius: 16px; padding: 6px 12px; font-size: 0.9rem; color: #0064D2;';
        
        const partText = document.createElement('span');
        partText.textContent = partNumber;
        partText.style.cssText = 'font-weight: 500;';
        
        const removeBtn = document.createElement('button');
        removeBtn.innerHTML = '×';
        removeBtn.type = 'button';
        removeBtn.style.cssText = 'background: none; border: none; color: #0064D2; font-size: 1.2rem; font-weight: bold; cursor: pointer; padding: 0; margin-left: 4px; line-height: 1; width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; border-radius: 50%; transition: all 0.2s;';
        removeBtn.title = 'Remove ' + partNumber;
        
        // Hover effect
        removeBtn.addEventListener('mouseenter', function() {
            this.style.background = '#0064D2';
            this.style.color = 'white';
        });
        removeBtn.addEventListener('mouseleave', function() {
            this.style.background = 'none';
            this.style.color = '#0064D2';
        });
        
        // Remove handler
        removeBtn.addEventListener('click', function() {
            // Remove from array
            const currentParts = getAssociatedPartsFromInput();
            const updatedParts = currentParts.filter(p => p !== partNumber);
            updateAssociatedPartsInput(updatedParts);
            updateAssociatedPartsTags(updatedParts);
        });
        
        tag.appendChild(partText);
        tag.appendChild(removeBtn);
        tagsContainer.appendChild(tag);
    });
}

// Setup input field listener with custom autocomplete
function setupAssociatedPartsInput() {
    const associatedPartsInput = document.getElementById('associated_parts');
    const dropdown = document.getElementById('associatedPartsDropdown');
    
    if (!associatedPartsInput) {
        console.warn('[Autocomplete] Input field not found, retrying...');
        setTimeout(setupAssociatedPartsInput, 500);
        return;
    }
    
    console.log('[Autocomplete] Setting up input field listeners, allPartsData:', allPartsData ? allPartsData.length : 0);
    
    let updateTimeout;
    
    // Show autocomplete suggestions as user types
    associatedPartsInput.addEventListener('input', function(e) {
        const value = this.value;
        // Get the last part being typed (after the last comma)
        const parts = value.split(',');
        const currentPart = parts[parts.length - 1].trim();
        
        clearTimeout(autocompleteTimeout);
        autocompleteTimeout = setTimeout(() => {
            showAutocompleteSuggestions(currentPart);
        }, 200);
        
        // Update tags
        clearTimeout(updateTimeout);
        updateTimeout = setTimeout(() => {
            const allParts = getAssociatedPartsFromInput();
            updateAssociatedPartsTags(allParts);
        }, 300);
    });
    
    // Handle keyboard navigation
    associatedPartsInput.addEventListener('keydown', function(e) {
        const dropdown = document.getElementById('associatedPartsDropdown');
        if (!dropdown || dropdown.style.display === 'none') {
            if (e.key === 'Enter') {
                e.preventDefault();
                const currentValue = this.value.trim();
                if (currentValue) {
                    const parts = currentValue.split(',').map(p => p.trim()).filter(p => p.length > 0);
                    const lastPart = parts[parts.length - 1].toUpperCase();
                    const match = allPartsData.find(p => 
                        p.part_model_number && p.part_model_number.toUpperCase() === lastPart
                    );
                    if (match && !parts.slice(0, -1).includes(match.part_model_number)) {
                        parts[parts.length - 1] = match.part_model_number;
                        this.value = parts.join(', ');
                        updateAssociatedPartsTags(parts);
                    }
                    if (dropdown) dropdown.style.display = 'none';
                }
            }
            return;
        }
        
        const items = dropdown.querySelectorAll('div');
        if (items.length === 0) return;
        
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            selectedIndex = Math.min(selectedIndex + 1, items.length - 1);
            items[selectedIndex].dispatchEvent(new MouseEvent('mouseenter'));
            items[selectedIndex].scrollIntoView({ block: 'nearest' });
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            selectedIndex = Math.max(selectedIndex - 1, -1);
            if (selectedIndex >= 0) {
                items[selectedIndex].dispatchEvent(new MouseEvent('mouseenter'));
                items[selectedIndex].scrollIntoView({ block: 'nearest' });
            } else {
                items.forEach(item => {
                    item.style.background = 'white';
                    item.style.color = '#1a1a1a';
                });
            }
        } else if (e.key === 'Enter' && selectedIndex >= 0) {
            e.preventDefault();
            items[selectedIndex].click();
        } else if (e.key === 'Escape') {
            dropdown.style.display = 'none';
            selectedIndex = -1;
        }
    });
    
    // Hide dropdown when clicking outside
    document.addEventListener('click', function(e) {
        if (!associatedPartsInput.contains(e.target) && dropdown && !dropdown.contains(e.target)) {
            dropdown.style.display = 'none';
        }
    });
    
    // Update tags on blur
    associatedPartsInput.addEventListener('blur', function() {
        setTimeout(() => {
            const parts = getAssociatedPartsFromInput();
            updateAssociatedPartsTags(parts);
        }, 200); // Delay to allow click events on dropdown
    });
}

// Initialize when DOM is ready
console.log('[Autocomplete] Setting up initialization');
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        console.log('[Autocomplete] DOMContentLoaded, setting up input');
        setTimeout(setupAssociatedPartsInput, 100);
        setTimeout(setupAssociatedPartsInput, 1000);
    });
} else {
    console.log('[Autocomplete] DOM ready, setting up input immediately');
    setTimeout(setupAssociatedPartsInput, 100);
    setTimeout(setupAssociatedPartsInput, 1000);
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
                
                // Populate associated parts
                const associatedPartsField = document.getElementById('associated_parts');
                if (associatedPartsField && part.associated_parts && Array.isArray(part.associated_parts)) {
                    associatedPartsField.value = part.associated_parts.join(', ');
                    updateAssociatedPartsTags(part.associated_parts);
                } else if (associatedPartsField) {
                    associatedPartsField.value = '';
                    updateAssociatedPartsTags([]);
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
    updateAssociatedPartsTags([]); // Clear tags
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

