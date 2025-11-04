// AirPod Parts Database
const airpodParts = {
    'AirPods (1st Gen)': {
        'Standard AirPods earbuds (Left)': {
            partModelNumber: 'A1523',
            partType: 'left',
            notes: 'Basic model numbers'
        },
        'Standard AirPods earbuds (Right)': {
            partModelNumber: 'A1722',
            partType: 'right',
            notes: 'Basic model numbers'
        },
        'Charging Case (Lightning)': {
            partModelNumber: 'A1602',
            partType: 'case',
            notes: 'Works with gen 1 & gen 2'
        }
    },
    'AirPods (2nd Gen)': {
        'Standard AirPods earbuds (Left)': {
            partModelNumber: 'A2031',
            partType: 'left',
            notes: 'Model numbers'
        },
        'Standard AirPods earbuds (Right)': {
            partModelNumber: 'A2032',
            partType: 'right',
            notes: 'Model numbers'
        },
        'Charging Case (Wireless)': {
            partModelNumber: 'A1938',
            partType: 'case',
            notes: 'Qi Wireless case for gen1/2'
        }
    },
    'AirPods (3rd Gen)': {
        'Earbuds (Left)': {
            partModelNumber: 'A2564',
            partType: 'left',
            notes: 'Genuine Apple part listing'
        },
        'Earbuds (Right)': {
            partModelNumber: 'A2565',
            partType: 'right',
            notes: 'Genuine Apple part listing'
        },
        'Charging Case (MagSafe)': {
            partModelNumber: 'A2566',
            partType: 'case',
            notes: 'MagSafe case, gen3'
        }
    },
    'AirPods (4th Gen) standard line (non-Pro)': {
        'Earbuds (Left)': {
            partModelNumber: 'A3050',
            partType: 'left',
            notes: 'Non-ANC variant'
        },
        'Earbuds (Right)': {
            partModelNumber: 'A3053 / A3054',
            partType: 'right',
            notes: 'Non-ANC variant (multiple model numbers)'
        },
        'Charging Case': {
            partModelNumber: 'A3058',
            partType: 'case',
            notes: 'Case for standard gen4'
        }
    },
    'AirPods (4th Gen) standard line (ANC version)': {
        'Earbuds (Left)': {
            partModelNumber: 'A3055',
            partType: 'left',
            notes: 'ANC version of standard line'
        },
        'Earbuds (Right)': {
            partModelNumber: 'A3056 / A3057',
            partType: 'right',
            notes: 'ANC version of standard line (multiple model numbers)'
        },
        'Charging Case': {
            partModelNumber: 'A3059',
            partType: 'case',
            notes: 'ANC case'
        }
    },
    'AirPods Pro (1st Gen)': {
        'Earbuds (Right)': {
            partModelNumber: 'A2083',
            partType: 'right',
            notes: 'Identified in teardown'
        },
        'Earbuds (Left)': {
            partModelNumber: 'A2084',
            partType: 'left',
            notes: 'Identified in teardown'
        },
        'Charging Case': {
            partModelNumber: 'A2190',
            partType: 'case',
            notes: 'MagSafe case first Pro'
        },
        'Service Kit Replacement Pods (Left)': {
            partModelNumber: '661-17164',
            partType: 'left',
            notes: 'Internal service kit'
        },
        'Service Kit Replacement Pods (Right)': {
            partModelNumber: '661-17165',
            partType: 'right',
            notes: 'Internal service kit'
        }
    },
    'AirPods Pro (2nd Gen)': {
        'Charging Case (USB-C MagSafe)': {
            partModelNumber: 'A2968',
            partType: 'case',
            notes: 'USB-C version'
        }
    }
};

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
        
        if (generation && airpodParts[generation]) {
            // Add options for this generation
            Object.keys(airpodParts[generation]).forEach(partName => {
                const option = document.createElement('option');
                option.value = partName;
                option.textContent = partName;
                option.dataset.modelNumber = airpodParts[generation][partName].partModelNumber;
                option.dataset.partType = airpodParts[generation][partName].partType;
                option.dataset.notes = airpodParts[generation][partName].notes || '';
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

