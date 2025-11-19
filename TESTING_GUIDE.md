# Testing Guide: SVG Image Cache-Busting Deployment

## Deployment Status
✅ **Code pushed to GitHub** - Railway should auto-deploy

## Testing Steps

### 1. Wait for Railway Deployment
- Check Railway dashboard for deployment completion
- Look for "Deployment successful" status
- Usually takes 1-3 minutes

### 2. Test Direct SVG File Access

**Test URLs (with cache-busting):**
```
https://airpodsupport.ljmuk.co.uk/images/examples/airpod-pro-2nd-gen-case.svg?v=1.2.0.028
https://airpodsupport.ljmuk.co.uk/images/examples/airpod-pro-2nd-gen-left.svg?v=1.2.0.028
https://airpodsupport.ljmuk.co.uk/images/examples/airpod-pro-2nd-gen-right.svg?v=1.2.0.028
```

**Expected Result:**
- ✅ SVG should display actual AirPod illustrations (rectangles, circles, ellipses)
- ❌ Should NOT show "Placeholder - Image Coming Soon" text
- ✅ File size should be ~1,200 bytes (not placeholder size)

**How to Verify:**
1. Open URL in browser
2. Right-click → "View Page Source" or "Inspect"
3. Should see SVG code with `<rect>`, `<ellipse>`, `<circle>` elements
4. Should NOT see text "Placeholder - Image Coming Soon"

### 3. Test Customer Portal

**Test URL:**
```
https://airpodsupport.ljmuk.co.uk/warranty-registration.html?barcode=1234
```

**Steps:**
1. Open the URL above
2. Open browser Developer Tools (F12)
3. Go to Console tab
4. Look for these log messages:
   ```
   [Compatible Parts] Final image path for ...: /images/examples/...svg?v=1.2.0.028
   [Compatible Parts] Fallback path for ...: /images/examples/...svg?v=1.2.0.028
   [Compatible Parts] Image loaded successfully: /images/examples/...svg?v=1.2.0.028
   ```

**Expected Result:**
- ✅ Step 1 should show compatible parts with example images
- ✅ Images should display actual AirPod illustrations (not placeholders)
- ✅ Console should show image paths with `?v=1.2.0.028` query parameter
- ✅ No errors in console

### 4. Verify Network Requests

**In Developer Tools:**
1. Go to Network tab
2. Filter by "svg"
3. Look for requests like:
   ```
   airpod-pro-2nd-gen-case.svg?v=1.2.0.028
   ```
4. Click on the request
5. Check:
   - **Status:** 200 OK
   - **Size:** ~1.2 KB (not placeholder size)
   - **Preview:** Should show actual SVG illustration

### 5. Clear Browser Cache (If Needed)

**If images still show placeholders:**

**Chrome/Edge:**
1. Press `Ctrl + Shift + Delete`
2. Select "Cached images and files"
3. Click "Clear data"
4. Hard refresh: `Ctrl + F5`

**Firefox:**
1. Press `Ctrl + Shift + Delete`
2. Select "Cache"
3. Click "Clear Now"
4. Hard refresh: `Ctrl + F5`

**Safari:**
1. Safari → Preferences → Advanced
2. Check "Show Develop menu"
3. Develop → Empty Caches
4. Hard refresh: `Cmd + Shift + R`

### 6. Verify IMAGE_VERSION Constant

**Check the code:**
1. View source of warranty-registration.html
2. Find the script tag loading `warranty-registration.js`
3. Open `warranty-registration.js` in browser
4. Search for `IMAGE_VERSION`
5. Should see: `const IMAGE_VERSION = '1.2.0.028';`

## Troubleshooting

### Issue: Still seeing placeholder text

**Possible Causes:**
1. **Browser cache** - Clear cache and hard refresh
2. **CDN cache** - Railway may have CDN caching (wait 5-10 minutes)
3. **Deployment not complete** - Check Railway logs
4. **Wrong file served** - Verify file exists on server

**Solutions:**
1. Clear browser cache (see step 5 above)
2. Wait 5-10 minutes for CDN cache to expire
3. Check Railway deployment logs
4. Verify file exists: Check direct SVG URL

### Issue: Images not loading at all

**Check:**
1. Railway deployment logs for errors
2. Browser console for 404 errors
3. Network tab for failed requests
4. File paths are correct in code

### Issue: Version query parameter not added

**Check:**
1. Console logs should show `?v=1.2.0.028` in paths
2. Network tab should show query parameter in requests
3. Verify `IMAGE_VERSION` constant is defined

## Success Criteria

✅ All SVG files load with correct illustrations (not placeholders)
✅ All image paths include `?v=1.2.0.028` query parameter
✅ Console shows successful image loading
✅ Network tab shows 200 OK responses
✅ Customer portal displays compatible parts with images correctly

## Next Steps After Successful Test

1. **Monitor** for any cache-related issues
2. **Update version** when SVG files change:
   - Edit `IMAGE_VERSION` constant in `warranty-registration.js`
   - Bump version number (e.g., `1.2.0.029`)
   - Commit and push

## Quick Test Checklist

- [ ] Railway deployment completed successfully
- [ ] Direct SVG URLs show illustrations (not placeholders)
- [ ] Customer portal loads correctly
- [ ] Console shows image paths with `?v=1.2.0.028`
- [ ] Network tab shows successful SVG requests
- [ ] Images display correctly in Step 1 compatibility check
- [ ] No console errors


