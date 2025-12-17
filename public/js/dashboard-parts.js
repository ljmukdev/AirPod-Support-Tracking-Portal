// Dashboard Parts Loader - Loads parts from API instead of hardcoded data

// Define API_BASE globally if not already defined
if (typeof window.API_BASE === 'undefined') {
    window.API_BASE = '';
}
// Reference the global API_BASE
var API_BASE = window.API_BASE;

// Load parts from API and populate dropdowns
let partsData = {};
let generations = [];
let allParts = []; // Store flat list of all parts for searching

async function loadPartsData() {
    try {
        const response = await fetch(`${API_BASE}/api/admin/parts`);
        const data = await response.json();
        
        if (response.ok && data.parts) {
            // Store flat list for searching
            allParts = data.parts;
            
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

// Search for part by model number and auto-populate fields
function searchPartByModelNumber(modelNumber) {
    if (!modelNumber || modelNumber.trim().length === 0) {
        return null;
    }
    
    const searchTerm = modelNumber.trim().toUpperCase();
    
    // Try exact match first
    let match = allParts.find(part => 
        part.part_model_number && 
        part.part_model_number.toUpperCase() === searchTerm
    );
    
    // If no exact match, try partial match
    if (!match) {
        match = allParts.find(part => 
            part.part_model_number && 
            part.part_model_number.toUpperCase().includes(searchTerm)
        );
    }
    
    // Also check if the search term is contained in any part number
    if (!match) {
        match = allParts.find(part => 
            part.part_model_number && 
            searchTerm.includes(part.part_model_number.toUpperCase())
        );
    }
    
    return match;
}

// Auto-populate fields from part data
function populateFieldsFromPart(part) {
    if (!part) return;
    
    const generationSelect = document.getElementById('generation');
    const partSelectionSelect = document.getElementById('partSelection');
    const partModelNumberInput = document.getElementById('partModelNumber');
    const partTypeSelect = document.getElementById('partType');
    const notesInput = document.getElementById('notes');
    
    // Set generation
    if (generationSelect && part.generation) {
        generationSelect.value = part.generation;
        // Trigger change event to populate part selection dropdown
        generationSelect.dispatchEvent(new Event('change'));
        
        // Wait a bit for dropdown to populate, then set part selection
        setTimeout(() => {
            // Find and select the matching part in the dropdown
            const options = Array.from(partSelectionSelect.options);
            const matchingOption = options.find(opt => 
                opt.value === part.part_name || 
                opt.dataset.modelNumber === part.part_model_number
            );
            
            if (matchingOption) {
                partSelectionSelect.value = matchingOption.value;
                partSelectionSelect.dispatchEvent(new Event('change'));
            } else {
                // If dropdown option not found, manually set values
                // First ensure partModelNumber is set
                if (part.part_model_number) {
                    partModelNumberInput.value = part.part_model_number;
                }
                // Set part type
                if (part.part_type) {
                    partTypeSelect.value = part.part_type;
                }
                // Set notes
                if (part.notes) {
                    notesInput.value = part.notes;
                }
                // Try to find part by model number in current generation
                const currentGenParts = partsData[part.generation] || [];
                const matchingPart = currentGenParts.find(p => 
                    p.part_model_number === part.part_model_number
                );
                if (matchingPart) {
                    // Create option if it doesn't exist
                    const option = document.createElement('option');
                    option.value = matchingPart.part_name;
                    option.textContent = matchingPart.part_name;
                    option.dataset.modelNumber = matchingPart.part_model_number;
                    option.dataset.partType = matchingPart.part_type;
                    option.dataset.notes = matchingPart.notes || '';
                    partSelectionSelect.appendChild(option);
                    partSelectionSelect.value = matchingPart.part_name;
                    partSelectionSelect.dispatchEvent(new Event('change'));
                }
            }
        }, 100);
    }
}

// Setup event listeners for part model number auto-fill
function setupPartModelNumberAutoFill() {
    const generationSelect = document.getElementById('generation');
    const partSelectionSelect = document.getElementById('partSelection');
    const partModelNumberInput = document.getElementById('partModelNumber');
    const partTypeSelect = document.getElementById('partType');
    const notesInput = document.getElementById('notes');
    
    if (!generationSelect || !partSelectionSelect || !partModelNumberInput) {
        // Elements not found, try again after a short delay
        setTimeout(setupPartModelNumberAutoFill, 100);
        return;
    }
    
    if (generationSelect && partSelectionSelect) {
        generationSelect.addEventListener('change', () => {
            const generation = generationSelect.value;
            
            // Clear previous options
            partSelectionSelect.innerHTML = '<option value="">Select part</option>';
            // Don't clear partModelNumber if it was manually entered - only clear if part selection changes
            // partModelNumberInput.value = '';
            if (partTypeSelect) partTypeSelect.value = '';
            if (notesInput) notesInput.value = '';
            
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
                if (partModelNumberInput) partModelNumberInput.value = selectedOption.dataset.modelNumber;
                
                // Auto-select part type if it's unambiguous (left/right/case)
                const partType = selectedOption.dataset.partType;
                if (partTypeSelect && partType && (partType === 'left' || partType === 'right' || partType === 'case')) {
                    partTypeSelect.value = partType;
                }
                
                // Auto-fill notes
                if (notesInput && selectedOption.dataset.notes) {
                    notesInput.value = selectedOption.dataset.notes;
                }
            } else {
                if (partModelNumberInput) partModelNumberInput.value = '';
                if (notesInput) notesInput.value = '';
            }
        });
    }
    
    // Auto-populate from part number input
    if (partModelNumberInput) {
        let searchTimeout;
        
        partModelNumberInput.addEventListener('input', (e) => {
            const modelNumber = e.target.value.trim();
            
            // Clear previous timeout
            clearTimeout(searchTimeout);
            
            // Only search if we have at least 3 characters (e.g., "A29")
            if (modelNumber.length >= 3) {
                // Debounce the search
                searchTimeout = setTimeout(() => {
                    const matchedPart = searchPartByModelNumber(modelNumber);
                    
                    if (matchedPart) {
                        // Only auto-populate if fields are empty or user wants to override
                        // Check if generation is already set and matches
                        const currentGeneration = generationSelect ? generationSelect.value : '';
                        const currentPartSelection = partSelectionSelect ? partSelectionSelect.value : '';
                        
                        // If fields are empty or user is clearly searching, auto-populate
                        if (!currentGeneration || !currentPartSelection || 
                            currentGeneration === matchedPart.generation) {
                            populateFieldsFromPart(matchedPart);
                        }
                    }
                }, 500); // Wait 500ms after user stops typing
            } else if (modelNumber.length === 0) {
                // Clear fields if input is cleared
                if (generationSelect) generationSelect.value = '';
                if (partSelectionSelect) partSelectionSelect.innerHTML = '<option value="">Select part</option>';
                if (partTypeSelect) partTypeSelect.value = '';
                if (notesInput) notesInput.value = '';
            }
        });
        
        // Also check on blur (when user leaves the field)
        partModelNumberInput.addEventListener('blur', (e) => {
            const modelNumber = e.target.value.trim();
            if (modelNumber.length >= 3) {
                const matchedPart = searchPartByModelNumber(modelNumber);
                if (matchedPart) {
                    populateFieldsFromPart(matchedPart);
                }
            }
        });
    }
}

// Initialize when page loads
function initializePartsLoader() {
    if (document.getElementById('generation')) {
        loadPartsData().then(() => {
            // Setup event listeners after parts data is loaded
            setupPartModelNumberAutoFill();
        });
    } else {
        // Try again after DOM is ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initializePartsLoader);
        } else {
            setTimeout(initializePartsLoader, 100);
        }
    }
}

// Start initialization
initializePartsLoader();

