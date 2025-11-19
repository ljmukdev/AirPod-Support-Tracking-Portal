# Claude Prompt: Debugging SVG Image Display Issue - Placeholder Text Instead of Illustrations

## Issue Description
AirPod example images are displaying "Placeholder - Image Coming Soon" text instead of the SVG illustrations we created. The browser console shows images are loading successfully, but the visual content is wrong.

## System Architecture
- **Backend:** Node.js/Express with MongoDB
- **Frontend:** Vanilla JavaScript (no framework)
- **Image Storage:** Static SVG files in `/public/images/examples/`
- **Deployment:** Railway.app

## Current Behavior

**Console Output:**
```
[Compatible Parts] Image loaded successfully: /images/examples/airpod-pro-2nd-gen-case.svg
[Compatible Parts] Image loaded successfully: /images/examples/airpod-pro-2nd-gen-left.svg
```

**Visual Output:**
- Grey rectangular boxes
- Text: "AirPods Pro 2nd Gen Left (A2698)"
- Text: "Placeholder - Image Coming Soon"

## Investigation Findings

1. ✅ **SVG files in repository** contain actual illustrations (rectangles, ellipses, circles - no placeholder text)
2. ✅ **Code logic** appears correct - fallback function returns correct paths
3. ✅ **API endpoint** works - returns compatible parts correctly
4. ❓ **Deployed files** - Unknown if updated SVGs are on server
5. ❓ **Browser cache** - May be serving old placeholder files

## SVG File Structure (Current - Should Work)

```svg
<svg width="400" height="300" viewBox="0 0 400 300">
  <rect width="400" height="300" fill="#f8f9fa"/>
  <g transform="translate(200, 150)">
    <!-- AirPod shapes -->
    <rect x="-8" y="-80" width="16" height="60" rx="8" fill="#1a1a1a"/>
    <ellipse cx="0" cy="0" rx="35" ry="45" fill="#1a1a1a"/>
    <!-- More shapes... -->
  </g>
  <text x="200" y="250">Left AirPod Pro 2nd Gen</text>
  <text x="200" y="270">A2698</text>
</svg>
```

## Code Flow

1. `getCompatiblePartExamples('A2699')` called
2. Fetches from `/api/compatible-parts/A2699`
3. Gets compatible parts with `exampleImage: null`
4. Calls `getFallbackExampleImage('left', 'A2698')`
5. Returns `/images/examples/airpod-pro-2nd-gen-left.svg`
6. Sets `<img src="/images/examples/airpod-pro-2nd-gen-left.svg">`
7. Browser loads file (confirmed in console)
8. **Problem:** Displays placeholder text instead of shapes

## Questions to Answer

1. **Why would SVG files with shapes display placeholder text?**
   - Are there multiple versions of the files?
   - Is there a caching layer (CDN, Railway static file cache)?
   - Could the browser be loading from a different location?

2. **How can we verify what's actually being served?**
   - Check Network tab for actual file content?
   - Compare file hashes/sizes?
   - Add cache-busting query parameters?

3. **What's the best solution?**
   - Add cache-busting: `?v=${Date.now()}` or version number?
   - Use inline SVG instead of file references?
   - Switch to PNG/JPG files instead?
   - Force cache invalidation on deployment?

4. **Deployment considerations:**
   - Does Railway cache static files?
   - Do we need to clear cache after deployment?
   - Should we use a different file naming strategy?

## Proposed Solutions to Test

1. **Add cache-busting query parameter:**
   ```javascript
   const finalImagePath = imagePath + '?v=1.2.0.028';
   ```

2. **Verify file content on server:**
   - Check if deployed files match repository files
   - Compare file sizes/timestamps

3. **Use inline SVG:**
   - Embed SVG content directly in HTML instead of file reference

4. **Add version to file names:**
   - Rename files: `airpod-pro-2nd-gen-left-v2.svg`

Please analyze this issue and provide:
1. Most likely root cause
2. Step-by-step debugging approach
3. Recommended solution with code examples
4. Prevention strategies for future deployments


