# Fix Associated Parts Checkboxes Not Appearing

## Problem
In an admin panel for managing AirPod parts, there's a section for "Associated Parts" that should display checkboxes for selecting compatible parts. The checkboxes are not appearing - instead, it just shows "Loading parts..." indefinitely.

## Current Behavior
- The page loads successfully
- Parts are fetched from the API (19 parts returned, status 200)
- Console shows: `[Parts Manager] Response data: {parts: Array(19)}`
- But the checkboxes never render - the div just shows "Loading parts..."

## Expected Behavior
After parts are loaded, the `populateAssociatedPartsCheckboxes()` function should:
1. Group all parts by generation
2. Display checkboxes for each part (excluding the current part being edited)
3. Show checkboxes grouped under generation headings
4. Allow users to select multiple associated parts

## Code Structure

### HTML (public/admin/parts.html)
```html
<div class="form-group">
    <label>Associated Parts</label>
    <small style="color: #666; font-size: 0.9rem; display: block; margin-bottom: 12px;">
        Select the compatible parts that work with this part. These will be shown with images during warranty registration.
    </small>
    <div id="associatedPartsCheckboxes" style="max-height: 300px; overflow-y: auto; border: 1px solid #ddd; border-radius: 4px; padding: 12px; background: #f8f9fa;">
        <p style="color: #666; font-size: 0.9rem; margin: 0 0 12px 0;">Loading parts...</p>
    </div>
    <input type="hidden" id="associated_parts" name="associated_parts" value="">
</div>
```

### JavaScript - Parts Loading (public/js/parts-manager.js)
```javascript
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
        console.log('[Parts Manager] response.ok:', response.ok, 'data.parts exists:', !!data.parts, 'data.parts length:', data.parts ? data.parts.length : 0);
        
        if (response.ok && data.parts) {
            console.log('[Parts Manager] Condition passed, storing parts...');
            // Store all parts for associated parts selection
            allPartsData = data.parts;
            console.log('[Parts Manager] Stored', allPartsData.length, 'parts in allPartsData');
            
            // Always populate checkboxes after loading parts
            const partModelNumber = document.getElementById('part_model_number')?.value || null;
            console.log('[Parts Manager] Populating checkboxes, current part:', partModelNumber);
            populateAssociatedPartsCheckboxes(partModelNumber);
            
            // ... rest of code to display parts list ...
        } else {
            console.warn('[Parts Manager] Condition failed - response.ok:', response.ok, 'data.parts:', !!data.parts);
        }
    } catch (error) {
        // error handling
    }
}
```

### JavaScript - Checkbox Population Function (public/js/parts-manager.js)
```javascript
// Populate associated parts checkboxes
function populateAssociatedPartsCheckboxes(currentPartModelNumber = null) {
    console.log('[Associated Parts] populateAssociatedPartsCheckboxes called, currentPart:', currentPartModelNumber, 'allPartsData length:', allPartsData ? allPartsData.length : 0);
    const container = document.getElementById('associatedPartsCheckboxes');
    if (!container) {
        console.warn('[Associated Parts] Container not found, retrying in 500ms...');
        setTimeout(() => populateAssociatedPartsCheckboxes(currentPartModelNumber), 500);
        return;
    }
    
    console.log('[Associated Parts] Container found, checking parts data...');
    if (!allPartsData || allPartsData.length === 0) {
        console.log('[Associated Parts] No parts data yet, will retry when parts are loaded');
        // Don't show "No parts available" - keep "Loading parts..." message
        // The function will be called again when parts are loaded
        return;
    }
    
    console.log('[Associated Parts] Parts data available, generating checkboxes...');
    
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
    const checkboxes = container.querySelectorAll('.associated-part-checkbox');
    checkboxes.forEach(checkbox => {
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
```

### Global Variable
```javascript
// Store all parts for autocomplete
let allPartsData = [];
```

## Console Output
The console shows:
```
[Parts Manager] Fetching parts from: /api/admin/parts
[Parts Manager] Response status: 200
[Parts Manager] Response data: {parts: Array(19)}
```

But it does NOT show the new debug logs that were added:
- `[Parts Manager] Condition passed, storing parts...`
- `[Parts Manager] Stored X parts in allPartsData`
- `[Parts Manager] Populating checkboxes, current part: ...`
- `[Associated Parts] populateAssociatedPartsCheckboxes called...`

This suggests the code after `console.log('[Parts Manager] Response data:', data);` is not executing.

## Questions to Investigate
1. Why is the condition `if (response.ok && data.parts)` not being evaluated or logged?
2. Is there a JavaScript error preventing execution?
3. Is the function being called but failing silently?
4. Is there a timing issue where the function is called before the DOM is ready?

## Task
Please:
1. Identify why `populateAssociatedPartsCheckboxes()` is not being called or not executing properly
2. Fix the issue so checkboxes appear after parts are loaded
3. Ensure the function works both when:
   - Adding a new part (no part_model_number)
   - Editing an existing part (part_model_number exists)
4. Make sure the checkboxes are properly grouped by generation
5. Ensure selected parts are saved when the form is submitted

## Additional Context
- The script tag includes a cache-busting version: `<script src="../js/parts-manager.js?v=1.2.3.008"></script>`
- There's also an initialization function `initializeAssociatedPartsCheckboxes()` that tries to populate checkboxes on page load
- The `escapeHtml()` function exists and is used elsewhere in the file

