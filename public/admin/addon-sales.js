// Add-On Sales Management JavaScript

// Ensure API_BASE is available
if (typeof window.API_BASE === 'undefined') {
    window.API_BASE = '';
}

// Helper function to get API_BASE without redeclaring
function getApiBase() {
    return window.API_BASE || '';
}

// Check authentication
checkAuth();

// State
let editingAddonId = null;
let allParts = [];
let allGenerations = [];
let selectedGenerations = new Set();
let selectedPartModels = new Set();

// Load all add-on sales
async function loadAddonSales() {
    const addonList = document.getElementById('addonList');
    if (!addonList) return;
    
    try {
        const response = await authenticatedFetch(`${getApiBase()}/api/admin/addon-sales`);
        const data = await response.json();
        
        if (response.ok && data.addonSales) {
            if (data.addonSales.length === 0) {
                addonList.innerHTML = '<p style="text-align: center; padding: 40px; color: #666;">No add-on sales yet. Create the first one using the form on the left.</p>';
                return;
            }
            
            addonList.innerHTML = data.addonSales.map(addon => {
                const associations = [];
                if (addon.associated_generations && addon.associated_generations.length > 0) {
                    associations.push(`Generations: ${addon.associated_generations.join(', ')}`);
                }
                if (addon.associated_part_models && addon.associated_part_models.length > 0) {
                    associations.push(`Parts: ${addon.associated_part_models.join(', ')}`);
                }
                
                const imageHtml = addon.image ? `
                    <div style="margin-top: 10px;">
                        <img src="${addon.image}" alt="${addon.name}" style="max-width: 150px; border-radius: 4px; border: 2px solid #e8ecf1;">
                    </div>
                ` : '';
                
                return `
                    <div class="addon-item">
                        <div class="addon-item-header">
                            <div>
                                <div class="addon-item-title">${escapeHtml(addon.name)}</div>
                                <span class="status-badge ${addon.active ? 'status-active' : 'status-inactive'}">
                                    ${addon.active ? 'Active' : 'Inactive'}
                                </span>
                            </div>
                            <div class="addon-item-actions">
                                <button class="edit-button" onclick="editAddon('${addon._id}')">Edit</button>
                                <button class="delete-button" onclick="deleteAddon('${addon._id}')">Delete</button>
                            </div>
                        </div>
                        <div class="addon-item-details">
                            <div class="addon-detail">
                                <span class="addon-detail-label">Price:</span>
                                <span>£${parseFloat(addon.price || 0).toFixed(2)}</span>
                            </div>
                            <div class="addon-detail">
                                <span class="addon-detail-label">Description:</span>
                                <span>${escapeHtml(addon.description || 'No description')}</span>
                            </div>
                            ${associations.length > 0 ? `
                                <div class="addon-detail" style="grid-column: 1 / -1;">
                                    <span class="addon-detail-label">Associated Products:</span>
                                    <span>${associations.join(' | ')}</span>
                                </div>
                            ` : ''}
                        </div>
                        ${imageHtml}
                    </div>
                `;
            }).join('');
        } else {
            addonList.innerHTML = '<p style="text-align: center; padding: 40px; color: red;">Error loading add-on sales</p>';
        }
    } catch (error) {
        console.error('Error loading add-on sales:', error);
        addonList.innerHTML = '<p style="text-align: center; padding: 40px; color: red;">Network error. Please refresh the page.</p>';
    }
}

// Load parts and generations for association
async function loadPartsAndGenerations() {
    try {
        // Load parts
        const partsResponse = await authenticatedFetch(`${getApiBase()}/api/admin/parts`);
        if (partsResponse.ok) {
            const partsData = await partsResponse.json();
            allParts = partsData.parts || [];
            updatePartModelList();
        }
        
        // Load generations
        const generationsResponse = await authenticatedFetch(`${getApiBase()}/api/admin/generations`);
        if (generationsResponse.ok) {
            const generationsData = await generationsResponse.json();
            allGenerations = generationsData.generations || [];
            updateGenerationFilter();
        }
    } catch (error) {
        console.error('Error loading parts/generations:', error);
    }
}

// Update part model list
function updatePartModelList() {
    const partModelList = document.getElementById('partModelList');
    if (!partModelList) return;
    
    if (allParts.length === 0) {
        partModelList.innerHTML = '<p style="text-align: center; color: #666; padding: 20px;">No parts available</p>';
        return;
    }
    
    // Group by generation for better organization
    const partsByGeneration = {};
    allParts.forEach(part => {
        if (!partsByGeneration[part.generation]) {
            partsByGeneration[part.generation] = [];
        }
        partsByGeneration[part.generation].push(part);
    });
    
    let html = '';
    Object.keys(partsByGeneration).sort().forEach(gen => {
        html += `<div style="margin-bottom: 10px;"><strong style="color: var(--primary-navy);">${escapeHtml(gen)}</strong></div>`;
        partsByGeneration[gen].forEach(part => {
            const checked = selectedPartModels.has(part.part_model_number) ? 'checked' : '';
            html += `
                <div class="association-item">
                    <input type="checkbox" id="part_${part.part_model_number}" value="${part.part_model_number}" ${checked} onchange="togglePartModel('${part.part_model_number}')">
                    <label for="part_${part.part_model_number}">${escapeHtml(part.part_model_number)} - ${escapeHtml(part.part_name)}</label>
                </div>
            `;
        });
    });
    
    partModelList.innerHTML = html;
}

// Update generation filter
function updateGenerationFilter() {
    const generationFilter = document.getElementById('generationFilter');
    if (!generationFilter) return;
    
    generationFilter.innerHTML = allGenerations.map(gen => {
        const selected = selectedGenerations.has(gen) ? 'selected' : '';
        return `<option value="${escapeHtml(gen)}" ${selected}>${escapeHtml(gen)}</option>`;
    }).join('');
    
    generationFilter.addEventListener('change', function() {
        selectedGenerations.clear();
        Array.from(this.selectedOptions).forEach(option => {
            selectedGenerations.add(option.value);
        });
        updateSelectedAssociations();
    });
}

// Toggle part model selection
function togglePartModel(partModel) {
    if (selectedPartModels.has(partModel)) {
        selectedPartModels.delete(partModel);
    } else {
        selectedPartModels.add(partModel);
    }
    updateSelectedAssociations();
}

// Update selected associations display
function updateSelectedAssociations() {
    const selectedAssociations = document.getElementById('selectedAssociations');
    if (!selectedAssociations) return;
    
    const associations = [];
    if (selectedGenerations.size > 0) {
        associations.push(`Generations: ${Array.from(selectedGenerations).join(', ')}`);
    }
    if (selectedPartModels.size > 0) {
        associations.push(`Part Models: ${Array.from(selectedPartModels).join(', ')}`);
    }
    
    selectedAssociations.textContent = associations.length > 0 ? associations.join(' | ') : 'None selected';
}

// Edit add-on sale
async function editAddon(id) {
    editingAddonId = id;
    
    try {
        const response = await authenticatedFetch(`${getApiBase()}/api/admin/addon-sale/${id}`);
        const data = await response.json();
        
        if (response.ok && data.addonSale) {
            const addon = data.addonSale;
            
            // Populate form
            document.getElementById('addonId').value = addon._id;
            document.getElementById('name').value = addon.name || '';
            document.getElementById('description').value = addon.description || '';
            document.getElementById('price').value = addon.price || '';
            document.getElementById('active').checked = addon.active !== false;
            
            // Set associations
            selectedGenerations.clear();
            selectedPartModels.clear();
            if (addon.associated_generations) {
                addon.associated_generations.forEach(gen => selectedGenerations.add(gen));
            }
            if (addon.associated_part_models) {
                addon.associated_part_models.forEach(model => selectedPartModels.add(model));
            }
            
            updateGenerationFilter();
            updatePartModelList();
            updateSelectedAssociations();
            
            // Show image preview if exists
            const imagePreview = document.getElementById('imagePreview');
            if (addon.image) {
                imagePreview.innerHTML = `<img src="${addon.image}" alt="${addon.name}" style="max-width: 200px;">`;
            } else {
                imagePreview.innerHTML = '';
            }
            
            // Update form title and button
            document.getElementById('formTitle').textContent = 'Edit Add-On Sale';
            document.getElementById('submitButtonText').textContent = 'Update Add-On Sale';
            document.getElementById('cancelButton').style.display = 'inline-block';
            
            // Scroll to form
            document.querySelector('.addon-form').scrollIntoView({ behavior: 'smooth', block: 'start' });
            
            showSuccess('Add-on sale loaded for editing');
        } else {
            showError('Failed to load add-on sale');
        }
    } catch (error) {
        console.error('Error loading add-on sale:', error);
        showError('Network error loading add-on sale');
    }
}

// Delete add-on sale
async function deleteAddon(id) {
    if (!confirm('Are you sure you want to delete this add-on sale? This action cannot be undone.')) {
        return;
    }
    
    try {
        const response = await authenticatedFetch(`${getApiBase()}/api/admin/addon-sale/${id}`, {
            method: 'DELETE'
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
            showSuccess('Add-on sale deleted successfully');
            loadAddonSales();
        } else {
            showError(data.error || 'Failed to delete add-on sale');
        }
    } catch (error) {
        console.error('Error deleting add-on sale:', error);
        showError('Network error. Please try again.');
    }
}

// Cancel edit
function cancelEdit() {
    editingAddonId = null;
    document.getElementById('addonForm').reset();
    document.getElementById('addonId').value = '';
    document.getElementById('imagePreview').innerHTML = '';
    selectedGenerations.clear();
    selectedPartModels.clear();
    updateGenerationFilter();
    updatePartModelList();
    updateSelectedAssociations();
    document.getElementById('formTitle').textContent = 'Add New Add-On Sale';
    document.getElementById('submitButtonText').textContent = 'Add Add-On Sale';
    document.getElementById('cancelButton').style.display = 'none';
}

// Form submission
document.getElementById('addonForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const name = document.getElementById('name').value.trim();
    const description = document.getElementById('description').value.trim();
    const price = parseFloat(document.getElementById('price').value);
    const active = document.getElementById('active').checked;
    const imageFile = document.getElementById('image').files[0];
    
    if (!name) {
        showError('Name is required');
        return;
    }
    
    if (isNaN(price) || price < 0) {
        showError('Valid price is required');
        return;
    }
    
    if (selectedGenerations.size === 0 && selectedPartModels.size === 0) {
        showError('Please associate this add-on sale with at least one product (generation or part model)');
        return;
    }
    
    const submitButton = document.getElementById('submitButton');
    submitButton.disabled = true;
    showSpinner();
    
    try {
        const formData = new FormData();
        formData.append('name', name);
        formData.append('description', description);
        formData.append('price', price);
        formData.append('active', active);
        formData.append('associated_generations', JSON.stringify(Array.from(selectedGenerations)));
        formData.append('associated_part_models', JSON.stringify(Array.from(selectedPartModels)));
        
        if (imageFile) {
            formData.append('image', imageFile);
        }
        
        const url = editingAddonId 
            ? `${getApiBase()}/api/admin/addon-sale/${editingAddonId}`
            : `${getApiBase()}/api/admin/addon-sale`;
        const method = editingAddonId ? 'PUT' : 'POST';
        
        const response = await fetch(url, {
            method: method,
            body: formData
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
            showSuccess(editingAddonId ? 'Add-on sale updated successfully!' : 'Add-on sale created successfully!');
            cancelEdit();
            loadAddonSales();
        } else {
            showError(data.error || 'Failed to save add-on sale');
        }
    } catch (error) {
        console.error('Error saving add-on sale:', error);
        showError('Network error. Please try again.');
    } finally {
        submitButton.disabled = false;
        hideSpinner();
    }
});

// Image preview
document.getElementById('image')?.addEventListener('change', function(e) {
    const file = e.target.files[0];
    const preview = document.getElementById('imagePreview');
    
    if (file) {
        const reader = new FileReader();
        reader.onload = function(event) {
            preview.innerHTML = `<img src="${event.target.result}" alt="Preview" style="max-width: 200px; border-radius: 4px; border: 2px solid #e8ecf1;">`;
        };
        reader.readAsDataURL(file);
    } else {
        preview.innerHTML = '';
    }
});

// Cancel button
document.getElementById('cancelButton')?.addEventListener('click', cancelEdit);

// Logout
document.getElementById('logoutButton')?.addEventListener('click', async () => {
    try {
        const response = await authenticatedFetch(`${getApiBase()}/api/admin/logout`, { method: 'POST' });
        if (response.ok) {
            window.location.href = 'login.html';
        }
    } catch (error) {
        console.error('Logout error:', error);
        window.location.href = 'login.html';
    }
});

// Escape HTML to prevent XSS
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Make functions available globally
window.editAddon = editAddon;
window.deleteAddon = deleteAddon;
window.togglePartModel = togglePartModel;

// Initialize
loadPartsAndGenerations();
loadAddonSales();

