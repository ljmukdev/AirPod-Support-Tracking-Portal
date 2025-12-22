// Setup Instructions Manager
console.log('[Setup Instructions Manager] Script loading...');

// Use API_BASE from admin.js (already defined globally)
// If admin.js hasn't loaded yet, define it
if (typeof window.API_BASE === 'undefined') {
    window.API_BASE = '';
}
// Use window.API_BASE directly throughout to avoid redeclaration issues

let allGenerations = [];
let allParts = [];
let editingId = null;
let stepCounter = 0;

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    console.log('[Setup Instructions Manager] Initializing...');
    loadGenerations();
    loadParts();
    loadInstructions();
    setupEventListeners();
});

// Setup event listeners
function setupEventListeners() {
    const form = document.getElementById('instructionForm');
    const addStepButton = document.getElementById('addStepButton');
    const cancelButton = document.getElementById('cancelButton');
    const generationSelect = document.getElementById('generation');
    const partModelSelect = document.getElementById('part_model_number');

    form.addEventListener('submit', handleFormSubmit);
    addStepButton.addEventListener('click', addInstructionStep);
    cancelButton.addEventListener('click', cancelEdit);

    // Update parts list when generation changes
    generationSelect.addEventListener('change', function() {
        updatePartsDropdown(this.value);
    });
}

// Load generations from API
async function loadGenerations() {
    try {
        const apiBase = window.API_BASE || '';
        console.log('[Setup Instructions] Loading generations from:', `${apiBase}/api/admin/generations`);
        const response = await fetch(`${apiBase}/api/admin/generations`);
        console.log('[Setup Instructions] Response status:', response.status);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('[Setup Instructions] API error response:', errorText);
            throw new Error(`Failed to load generations: ${response.status} ${errorText}`);
        }
        
        const data = await response.json();
        console.log('[Setup Instructions] Generations data received:', data);
        allGenerations = data.generations || [];
        
        const select = document.getElementById('generation');
        if (!select) {
            console.error('[Setup Instructions] Generation select element not found!');
            return;
        }
        
        select.innerHTML = '<option value="">Select Generation</option>';
        if (allGenerations.length === 0) {
            console.warn('[Setup Instructions] No generations found in response');
            select.innerHTML += '<option value="" disabled>No generations available</option>';
        } else {
            allGenerations.forEach(gen => {
                const option = document.createElement('option');
                option.value = gen;
                option.textContent = gen;
                select.appendChild(option);
            });
            console.log('[Setup Instructions] Populated', allGenerations.length, 'generations');
        }
    } catch (error) {
        console.error('[Setup Instructions] Error loading generations:', error);
        const select = document.getElementById('generation');
        if (select) {
            select.innerHTML = '<option value="">Error loading generations</option>';
        }
    }
}

// Load parts from API
async function loadParts() {
    try {
        const apiBase = window.API_BASE || '';
        const response = await authenticatedFetch(`${apiBase}/api/admin/parts`);
        if (!response.ok) throw new Error('Failed to load parts');
        const data = await response.json();
        allParts = data.parts || [];
    } catch (error) {
        console.error('[Setup Instructions] Error loading parts:', error);
    }
}

// Update parts dropdown based on selected generation
function updatePartsDropdown(generation) {
    const select = document.getElementById('part_model_number');
    select.innerHTML = '<option value="">All parts in generation</option>';
    
    if (!generation) return;
    
    const filteredParts = allParts.filter(part => part.generation === generation);
    filteredParts.forEach(part => {
        const option = document.createElement('option');
        option.value = part.part_model_number;
        option.textContent = `${part.part_model_number} - ${part.part_name}`;
        select.appendChild(option);
    });
}

// Add a new instruction step
function addInstructionStep(stepData = null) {
    stepCounter++;
    const stepsContainer = document.getElementById('instructionSteps');
    const stepDiv = document.createElement('div');
    stepDiv.className = 'instruction-step-item';
    stepDiv.dataset.stepIndex = stepCounter;
    
    const stepNumber = stepData ? stepData.step_number : stepCounter;
    const title = stepData ? stepData.title : '';
    const instruction = stepData ? stepData.instruction : '';
    
    stepDiv.innerHTML = `
        <div class="instruction-step-header">
            <span class="instruction-step-number">Step ${stepNumber}</span>
            <button type="button" class="remove-step-button" onclick="removeInstructionStep(${stepCounter})">Remove</button>
        </div>
        <div class="form-group">
            <label>Step Title *</label>
            <input type="text" 
                   class="step-title" 
                   data-step="${stepCounter}" 
                   placeholder="e.g., Step 1: Prepare Your Device" 
                   value="${escapeHtml(title)}"
                   required>
        </div>
        <div class="form-group">
            <label>Instruction Text *</label>
            <textarea class="step-instruction" 
                      data-step="${stepCounter}" 
                      placeholder="e.g., Make sure your iPhone or iPad is nearby and unlocked. Open the Settings app." 
                      required>${escapeHtml(instruction)}</textarea>
        </div>
    `;
    
    stepsContainer.appendChild(stepDiv);
}

// Remove an instruction step
function removeInstructionStep(stepIndex) {
    const stepDiv = document.querySelector(`.instruction-step-item[data-step-index="${stepIndex}"]`);
    if (stepDiv) {
        stepDiv.remove();
    }
}

// Load all setup instructions
async function loadInstructions() {
    try {
        const apiBase = window.API_BASE || '';
        const response = await fetch(`${apiBase}/api/admin/setup-instructions`);
        if (!response.ok) throw new Error('Failed to load instructions');
        const data = await response.json();
        
        displayInstructions(data.instructions || []);
    } catch (error) {
        console.error('[Setup Instructions] Error loading instructions:', error);
        document.getElementById('instructionsList').innerHTML = '<p style="color: #dc3545;">Error loading instructions. Please refresh the page.</p>';
    }
}

// Display instructions in the list
function displayInstructions(instructions) {
    const listContainer = document.getElementById('instructionsList');
    
    if (instructions.length === 0) {
        listContainer.innerHTML = '<p style="color: #666;">No setup instructions found. Create your first set of instructions using the form.</p>';
        return;
    }
    
    // Group by generation
    const grouped = {};
    instructions.forEach(inst => {
        const key = inst.generation || 'Unknown';
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(inst);
    });
    
    let html = '';
    Object.keys(grouped).sort().forEach(generation => {
        html += `<div class="generation-group">`;
        html += `<div class="generation-header">${escapeHtml(generation)}</div>`;
        
        grouped[generation].forEach(inst => {
            const partInfo = inst.part_model_number 
                ? ` (Part: ${inst.part_model_number})` 
                : ' (All parts)';
            
            html += `<div class="instruction-item">`;
            html += `<div class="instruction-item-header">`;
            html += `<div class="instruction-item-title">${escapeHtml(generation)}${escapeHtml(partInfo)}</div>`;
            html += `<div class="instruction-item-actions">`;
            html += `<button class="edit-button" onclick="editInstruction('${inst._id}')">Edit</button>`;
            html += `<button class="delete-button" onclick="deleteInstruction('${inst._id}')">Delete</button>`;
            html += `</div>`;
            html += `</div>`;
            
            if (inst.instructions && inst.instructions.length > 0) {
                html += `<div class="instruction-steps-preview">`;
                inst.instructions.forEach(step => {
                    html += `<div class="instruction-step-preview">`;
                    html += `<strong>${escapeHtml(step.title || `Step ${step.step_number}`)}:</strong> `;
                    html += `<span>${escapeHtml((step.instruction || '').substring(0, 100))}${step.instruction && step.instruction.length > 100 ? '...' : ''}</span>`;
                    html += `</div>`;
                });
                html += `</div>`;
            }
            
            html += `</div>`;
        });
        
        html += `</div>`;
    });
    
    listContainer.innerHTML = html;
}

// Handle form submission
async function handleFormSubmit(e) {
    e.preventDefault();
    
    const formData = {
        generation: document.getElementById('generation').value,
        part_model_number: document.getElementById('part_model_number').value || null,
        instructions: []
    };
    
    // Collect all steps
    const stepItems = document.querySelectorAll('.instruction-step-item');
    stepItems.forEach((item, index) => {
        const title = item.querySelector('.step-title').value.trim();
        const instruction = item.querySelector('.step-instruction').value.trim();
        
        if (title && instruction) {
            formData.instructions.push({
                step_number: index + 1,
                title: title,
                instruction: instruction
            });
        }
    });
    
    if (formData.instructions.length === 0) {
        alert('Please add at least one instruction step.');
        return;
    }
    
    try {
        const apiBase = window.API_BASE || '';
        const url = editingId 
            ? `${apiBase}/api/admin/setup-instructions/${editingId}`
            : `${apiBase}/api/admin/setup-instructions`;
        
        const method = editingId ? 'PUT' : 'POST';
        
        const response = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData)
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to save instructions');
        }
        
        alert('Setup instructions saved successfully!');
        resetForm();
        loadInstructions();
    } catch (error) {
        console.error('[Setup Instructions] Error saving:', error);
        alert('Error saving instructions: ' + error.message);
    }
}

// Edit an instruction set
async function editInstruction(id) {
    try {
        const apiBase = window.API_BASE || '';
        const response = await fetch(`${apiBase}/api/admin/setup-instructions/${id}`);
        if (!response.ok) throw new Error('Failed to load instruction');
        const instruction = await response.json();
        
        editingId = id;
        document.getElementById('instruction_id').value = id;
        document.getElementById('formTitle').textContent = 'Edit Setup Instructions';
        document.getElementById('submitButton').textContent = 'Update Instructions';
        document.getElementById('cancelButton').style.display = 'inline-block';
        
        // Populate form
        document.getElementById('generation').value = instruction.generation;
        updatePartsDropdown(instruction.generation);
        
        setTimeout(() => {
            document.getElementById('part_model_number').value = instruction.part_model_number || '';
        }, 100);
        
        // Clear existing steps
        document.getElementById('instructionSteps').innerHTML = '';
        stepCounter = 0;
        
        // Add steps
        if (instruction.instructions && instruction.instructions.length > 0) {
            instruction.instructions.forEach(step => {
                addInstructionStep(step);
            });
        } else {
            addInstructionStep();
        }
        
        // Scroll to form
        document.querySelector('.instructions-form').scrollIntoView({ behavior: 'smooth' });
    } catch (error) {
        console.error('[Setup Instructions] Error loading instruction:', error);
        alert('Error loading instruction: ' + error.message);
    }
}

// Delete an instruction set
async function deleteInstruction(id) {
    if (!confirm('Are you sure you want to delete these setup instructions? This action cannot be undone.')) {
        return;
    }
    
    try {
        const apiBase = window.API_BASE || '';
        const response = await fetch(`${apiBase}/api/admin/setup-instructions/${id}`, {
            method: 'DELETE'
        });
        
        if (!response.ok) throw new Error('Failed to delete instruction');
        
        alert('Setup instructions deleted successfully!');
        loadInstructions();
        
        // If we were editing this instruction, reset the form
        if (editingId === id) {
            resetForm();
        }
    } catch (error) {
        console.error('[Setup Instructions] Error deleting:', error);
        alert('Error deleting instructions: ' + error.message);
    }
}

// Reset form
function resetForm() {
    editingId = null;
    document.getElementById('instructionForm').reset();
    document.getElementById('instruction_id').value = '';
    document.getElementById('formTitle').textContent = 'Add New Setup Instructions';
    document.getElementById('submitButton').textContent = 'Save Instructions';
    document.getElementById('cancelButton').style.display = 'none';
    document.getElementById('instructionSteps').innerHTML = '';
    stepCounter = 0;
    document.getElementById('part_model_number').innerHTML = '<option value="">All parts in generation</option>';
}

// Cancel edit
function cancelEdit() {
    resetForm();
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Make functions available globally for onclick handlers
window.editInstruction = editInstruction;
window.deleteInstruction = deleteInstruction;
window.removeInstructionStep = removeInstructionStep;

