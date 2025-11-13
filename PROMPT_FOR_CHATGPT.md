# ChatGPT Prompt: AirPod Example Images Showing Placeholder Text Instead of Illustrations

## Problem
The customer portal displays "Placeholder - Image Coming Soon" text instead of AirPod illustrations, even though:
- Console logs confirm images load successfully: `/images/examples/airpod-pro-2nd-gen-case.svg`
- The SVG files in the repository contain actual illustrations (shapes, not text)
- The code logic appears correct

## Technical Details

**Stack:** Node.js/Express backend, MongoDB database, vanilla JavaScript frontend

**Current Flow:**
1. Frontend calls `GET /api/compatible-parts/A2699`
2. API returns compatible parts with `exampleImage: null` (no images uploaded yet)
3. Frontend fallback logic uses `getFallbackExampleImage()` to get SVG path
4. Sets `<img src="/images/examples/airpod-pro-2nd-gen-left.svg">`
5. Browser loads SVG successfully (console confirms)
6. **BUT:** Page shows "Placeholder - Image Coming Soon" text

**SVG File Content (from repository):**
The SVG files contain actual shapes:
```svg
<svg width="400" height="300">
  <rect width="400" height="300" fill="#f8f9fa"/>
  <g transform="translate(200, 150)">
    <rect x="-8" y="-80" width="16" height="60" rx="8" fill="#1a1a1a"/>
    <ellipse cx="0" cy="0" rx="35" ry="45" fill="#1a1a1a"/>
    <!-- More shapes... -->
  </g>
  <text x="200" y="250">Left AirPod Pro 2nd Gen</text>
  <text x="200" y="270">A2698</text>
</svg>
```

**But page displays:** Grey box with "Placeholder - Image Coming Soon"

## Possible Causes

1. **Browser caching** - Old placeholder SVG files cached
2. **Deployment issue** - Updated SVG files not deployed to server
3. **CDN/static file serving** - Old files being served from cache
4. **File path mismatch** - Wrong files being loaded
5. **SVG rendering issue** - Browser not rendering SVG correctly

## What We Need

1. How to verify which SVG file is actually being served?
2. How to force browser/server to serve updated SVG files?
3. Best practices for SVG file caching in production?
4. Should we add cache-busting query parameters?
5. Alternative approaches (inline SVG, data URIs, etc.)?

## Key Code

**Frontend image loading:**
```javascript
let imagePath = part.exampleImage || null;
if (!imagePath) {
    imagePath = getFallbackExampleImage(part.partType, part.partModelNumber);
    // Returns: '/images/examples/airpod-pro-2nd-gen-left.svg'
}
partCard.innerHTML = `<img src="${imagePath}" ...>`;
```

**Fallback function:**
```javascript
function getFallbackExampleImage(partType, partModelNumber) {
    const modelToImage = {
        'A2698': '/images/examples/airpod-pro-2nd-gen-left.svg',
        'A2700': '/images/examples/airpod-pro-2nd-gen-case.svg',
        // ...
    };
    return modelToImage[partModelNumber];
}
```

Please help diagnose why SVG files with actual illustrations are displaying placeholder text, and provide solutions to fix this issue.

