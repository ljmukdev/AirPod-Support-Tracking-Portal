// Dashboard Parts Loader - Loads parts from API instead of hardcoded data

// Use existing API_BASE if available, otherwise declare it
if (typeof window.API_BASE === 'undefined') {
    window.API_BASE = '';
}
const API_BASE = window.API_BASE;

// Load parts from API and populate dropdowns
let partsData = {};
let generations = [];

async function loadPartsData() {
    try {
        const response = await fetch(`${API_BASE}/api/admin/parts`);
        const data = await response.json();
        
        if (response.ok && data.parts) {
            // Group parts by generation
            partsData = {};
            generations = [];
            
            data.parts.forEach(part => {
                if (!partsData[part.generation]) {
                    partsData[part.generation] = [];
                    generations.push(part.generation);
                }
                partsData[part.generation].push(part);
            });
            
            // Populate generation dropdown
            const generationSelect = document.getElementById('generation');
            if (generationSelect) {
                generationSelect.innerHTML = '<option value="">Select generation</option>';
                generations.sort().forEach(gen => {
                    const option = document.createElement('option');
                    option.value = gen;
                    option.textContent = gen;
                    generationSelect.appendChild(option);
                });
            }
        } else {
            console.error('Failed to load parts:', data.error);
        }
    } catch (error) {
        console.error('Error loading parts:', error);
    }
}

// Update part selection when generation changes
const generationSelect = document.getElementById('generation');
const partSelectionSelect = document.getElementById('partSelection');
const partModelNumberInput = document.getElementById('partModelNumber');
const partTypeSelect = document.getElementById('partType');
const notesInput = document.getElementById('notes');

if (generationSelect && partSelectionSelect) {
    generationSelect.addEventListener('change', () => {
        const generation = generationSelect.value;
        
        // Clear previous options
        partSelectionSelect.innerHTML = '<option value="">Select part</option>';
        partModelNumberInput.value = '';
        partTypeSelect.value = '';
        notesInput.value = '';
        
        if (generation && partsData[generation]) {
            // Sort parts by display_order, then by name
            const sortedParts = [...partsData[generation]].sort((a, b) => {
                if (a.display_order !== b.display_order) {
                    return (a.display_order || 0) - (b.display_order || 0);
                }
                return a.part_name.localeCompare(b.part_name);
            });
            
            // Add options for this generation
            sortedParts.forEach(part => {
                const option = document.createElement('option');
                option.value = part.part_name;
                option.textContent = part.part_name;
                option.dataset.modelNumber = part.part_model_number;
                option.dataset.partType = part.part_type;
                option.dataset.notes = part.notes || '';
                partSelectionSelect.appendChild(option);
            });
        }
    });
    
    // Update part model number and part type when part selection changes
    partSelectionSelect.addEventListener('change', () => {
        const selectedOption = partSelectionSelect.options[partSelectionSelect.selectedIndex];
        
        if (selectedOption && selectedOption.dataset.modelNumber) {
            partModelNumberInput.value = selectedOption.dataset.modelNumber;
            
            // Auto-select part type if it's unambiguous (left/right/case)
            const partType = selectedOption.dataset.partType;
            if (partType && (partType === 'left' || partType === 'right' || partType === 'case')) {
                partTypeSelect.value = partType;
            }
            
            // Auto-fill notes
            if (selectedOption.dataset.notes) {
                notesInput.value = selectedOption.dataset.notes;
            }
        } else {
            partModelNumberInput.value = '';
            notesInput.value = '';
        }
    });
}

// Initialize when page loads
if (document.getElementById('generation')) {
    loadPartsData();
}

