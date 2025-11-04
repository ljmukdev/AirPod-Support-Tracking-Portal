// Parts Manager JavaScript

// Define API_BASE globally if not already defined
if (typeof window.API_BASE === 'undefined') {
    window.API_BASE = '';
}
// Reference the global API_BASE
var API_BASE = window.API_BASE;

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
    if (!partsList) return;
    
    try {
        const response = await fetch(`${API_BASE}/api/admin/parts`);
        const data = await response.json();
        
        if (response.ok && data.parts) {
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
                        <div class="part-item">
                            <div class="part-item-header">
                                <div class="part-item-title">${escapeHtml(part.part_name)}</div>
                                <div class="part-item-actions">
                                    <button class="edit-button" onclick="editPart(${part.id})">Edit</button>
                                    <button class="delete-button" onclick="deletePart(${part.id})">Delete</button>
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
                            </div>
                        </div>
                    `;
                });
                
                html += `</div>`;
            });
            
            partsList.innerHTML = html;
        } else {
            partsList.innerHTML = '<p style="text-align: center; padding: 40px; color: red;">Error loading parts</p>';
        }
    } catch (error) {
        console.error('Load parts error:', error);
        document.getElementById('partsList').innerHTML = '<p style="text-align: center; padding: 40px; color: red;">Network error. Please refresh the page.</p>';
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
            
            const response = await fetch(url, {
                method: method,
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    generation,
                    part_name: partName,
                    part_model_number: partModelNumber,
                    part_type: partType,
                    notes: notes || null,
                    display_order: displayOrder
                })
            });
            
            const data = await response.json();
            
            if (response.ok && data.success) {
                showSuccess(partId ? 'Part updated successfully!' : 'Part added successfully!');
                partForm.reset();
                document.getElementById('partId').value = '';
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

// Edit part
async function editPart(id) {
    try {
        const response = await fetch(`${API_BASE}/api/admin/parts`);
        const data = await response.json();
        
        if (response.ok && data.parts) {
            const part = data.parts.find(p => p.id === id);
            if (part) {
                document.getElementById('partId').value = part.id;
                document.getElementById('generation').value = part.generation;
                document.getElementById('part_name').value = part.part_name;
                document.getElementById('part_model_number').value = part.part_model_number;
                document.getElementById('part_type').value = part.part_type;
                document.getElementById('notes').value = part.notes || '';
                document.getElementById('display_order').value = part.display_order || 0;
                
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
        const response = await fetch(`${API_BASE}/api/admin/part/${id}`, {
            method: 'DELETE'
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
            showSuccess('Part deleted successfully');
            loadParts();
            if (document.getElementById('partId').value == id) {
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

// Make functions available globally
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

