# Refactor Summary: Image Version Constant

## Changes Made

### 1. ✅ Created Single IMAGE_VERSION Constant

**Location:** `public/js/warranty-registration.js` line 968

```javascript
// Image version for cache-busting - bump this when SVG files are updated
const IMAGE_VERSION = '1.2.0.028';
```

### 2. ✅ Refactored `getFallbackExampleImage()` Function

**Location:** `public/js/warranty-registration.js` lines 970-995

**Before:**
- Returned base paths without version
- Version was added separately in calling code

**After:**
- Function now automatically appends `?v=${IMAGE_VERSION}` to all returned paths
- All fallback images use the same version constant
- Single source of truth for version

**Final Function:**
```javascript
function getFallbackExampleImage(partType, partModelNumber) {
    const modelToImage = {
        // AirPods Pro 2nd Gen
        'A2698': '/images/examples/airpod-pro-2nd-gen-left.svg',
        'A2699': '/images/examples/airpod-pro-2nd-gen-right.svg',
        'A2700': '/images/examples/airpod-pro-2nd-gen-case.svg',
        // ... all other generations
    };
    
    const basePath = modelToImage[partModelNumber] || '/images/examples/airpod-pro-2nd-gen-left.svg';
    // Add cache-busting query parameter
    return `${basePath}?v=${IMAGE_VERSION}`;
}
```

### 3. ✅ Updated Image Path Logic

**Location:** `public/js/warranty-registration.js` lines 913-918

**Before:**
```javascript
const cacheBuster = 'v=1.2.0.028';
const finalImagePath = imagePath + (imagePath.includes('?') ? '&' : '?') + cacheBuster;
const fallbackPath = getFallbackExampleImage(...) + '?' + cacheBuster;
```

**After:**
```javascript
const finalImagePath = imagePath.includes('?') 
    ? imagePath + `&v=${IMAGE_VERSION}`
    : imagePath + `?v=${IMAGE_VERSION}`;
const fallbackPath = getFallbackExampleImage(part.partType, part.partModelNumber);
```

### 4. ✅ Verified No Hardcoded Paths

**Search Results:**
- ✅ All paths in `modelToImage` are base paths (correct - version appended by function)
- ✅ No hardcoded paths with version strings found
- ✅ All image references now use `IMAGE_VERSION` constant

**Files Checked:**
- `public/js/warranty-registration.js` - ✅ All paths use IMAGE_VERSION
- Documentation files contain examples (expected)

### 5. ✅ Verified SVG Files Are Tracked

**Git Status:**
```
public/images/examples/airpod-pro-2nd-gen-case.svg  ✅ Tracked
public/images/examples/airpod-pro-2nd-gen-left.svg  ✅ Tracked
public/images/examples/airpod-pro-2nd-gen-right.svg ✅ Tracked
```

**Git Ignore Check:**
- ✅ SVG files are NOT excluded in `.gitignore`
- ✅ All SVG files in `public/images/examples/` are tracked

## Files Changed

1. **`public/js/warranty-registration.js`**
   - Added `IMAGE_VERSION` constant (line 968)
   - Refactored `getFallbackExampleImage()` to use version constant (lines 970-995)
   - Updated image path logic to use `IMAGE_VERSION` (lines 913-918)

## How to Update Version

**To bump the version (e.g., when SVG files are updated):**

1. Open `public/js/warranty-registration.js`
2. Find line 968: `const IMAGE_VERSION = '1.2.0.028';`
3. Update to new version: `const IMAGE_VERSION = '1.2.0.029';`
4. Commit and push

**That's it!** All image paths will automatically use the new version.

## Verification

### Before Deployment:
- ✅ Single `IMAGE_VERSION` constant defined
- ✅ All fallback images use version constant
- ✅ All database image paths get version appended
- ✅ SVG files tracked in git
- ✅ No hardcoded version strings

### After Deployment:
- Test: `https://airpodsupport.ljmuk.co.uk/images/examples/airpod-pro-2nd-gen-case.svg?v=1.2.0.028`
- Verify images display correctly (not placeholder text)
- Check browser console for correct image paths

## Next Steps

1. **Review the changes** in `public/js/warranty-registration.js`
2. **Commit and push:**
   ```bash
   git add public/js/warranty-registration.js
   git commit -m "Refactor: Use single IMAGE_VERSION constant for cache-busting"
   git push
   ```
3. **Deploy to Railway** and verify images load correctly
4. **If SVG files are updated in future**, bump `IMAGE_VERSION` in one place


