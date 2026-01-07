const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const bodyParser = require('body-parser');
const session = require('express-session');
// Import connect-mongo - v5.x uses direct export, not default
let MongoStore;
try {
    // v5.x style - direct import (no .default)
    MongoStore = require('connect-mongo');
} catch (e) {
    console.error('Error importing connect-mongo:', e);
    MongoStore = null;
}
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const crypto = require('crypto');
// Initialize Stripe only if secret key is available
let stripe = null;
if (process.env.STRIPE_SECRET_KEY) {
    stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
} else {
    console.warn('⚠️  Stripe secret key not set - payment features will be disabled');
}

// Initialize Nodemailer for email sending (optional)
let nodemailer = null;
let emailTransporter = null;
if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    try {
        nodemailer = require('nodemailer');
        emailTransporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: parseInt(process.env.SMTP_PORT || '587'),
            secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS
            }
        });
        console.log('✅ Email service initialized');
    } catch (err) {
        console.warn('⚠️  Failed to initialize email service:', err.message);
    }
} else {
    console.warn('⚠️  Email configuration not set - email receipts will not be sent');
    console.warn('   Set SMTP_HOST, SMTP_USER, SMTP_PASS (and optionally SMTP_PORT, SMTP_SECURE) to enable emails');
}

// Initialize GoCardless (DISABLED - Using Stripe for card payments)
// GoCardless is primarily for Direct Debits, Stripe handles one-off card payments
/*
let gocardless = null;
if (process.env.GOCARDLESS_ACCESS_TOKEN) {
    const gocardlessLib = require('gocardless-nodejs');
    const constants = require('gocardless-nodejs/constants');
    
    // Determine environment
    const environment = process.env.GOCARDLESS_ENVIRONMENT === 'sandbox' 
        ? constants.Environments.Sandbox 
        : constants.Environments.Live;
    
    gocardless = gocardlessLib(
        process.env.GOCARDLESS_ACCESS_TOKEN,
        environment,
        { raiseOnIdempotencyConflict: false }
    );
    console.log('✅ GoCardless initialized');
} else {
    console.warn('⚠️  GoCardless access token not set - payment features will be disabled');
}
*/

const app = express();
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Environment detection
console.log(`🌍 Environment: ${NODE_ENV}`);
if (NODE_ENV === 'staging') {
    console.log('⚠️  STAGING ENVIRONMENT - Testing mode');
} else if (NODE_ENV === 'production') {
    console.log('✅ PRODUCTION ENVIRONMENT');
} else {
    console.log('🔧 DEVELOPMENT ENVIRONMENT');
}

// Trust proxy (needed for Railway/Heroku)
app.set('trust proxy', 1);

// Disable X-Powered-By header for security
app.disable('x-powered-by');

// Security headers middleware for API endpoints
app.use('/api', (req, res, next) => {
    // Set security headers
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'no-store');
    // Removed deprecated Pragma and Expires headers - Cache-Control is sufficient
    next();
});

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Inject environment info into responses (for staging banner)
app.use((req, res, next) => {
    res.locals.NODE_ENV = NODE_ENV;
    res.locals.isStaging = NODE_ENV === 'staging';
    res.locals.isProduction = NODE_ENV === 'production';
    next();
});

// Handle favicon requests gracefully (suppress 404 errors)
app.get('/favicon.ico', (req, res) => {
    res.status(204).end(); // No Content
});

// Determine uploads directory
// Railway volumes: Check multiple possible paths
// Railway volumes can be mounted at various paths depending on configuration
function findRailwayVolumePath() {
    console.log('🔍 Searching for Railway volume mount point...');
    
    // Check environment variables first (Railway may set these or you can set manually)
    if (process.env.RAILWAY_VOLUME_MOUNT_PATH) {
        if (fs.existsSync(process.env.RAILWAY_VOLUME_MOUNT_PATH)) {
            console.log('✅ Found volume via RAILWAY_VOLUME_MOUNT_PATH:', process.env.RAILWAY_VOLUME_MOUNT_PATH);
            return process.env.RAILWAY_VOLUME_MOUNT_PATH;
        } else {
            console.log('⚠️  RAILWAY_VOLUME_MOUNT_PATH set but path does not exist:', process.env.RAILWAY_VOLUME_MOUNT_PATH);
        }
    }
    if (process.env.UPLOADS_VOLUME_PATH) {
        if (fs.existsSync(process.env.UPLOADS_VOLUME_PATH)) {
            console.log('✅ Found volume via UPLOADS_VOLUME_PATH:', process.env.UPLOADS_VOLUME_PATH);
            return process.env.UPLOADS_VOLUME_PATH;
        } else {
            console.log('⚠️  UPLOADS_VOLUME_PATH set but path does not exist:', process.env.UPLOADS_VOLUME_PATH);
        }
    }
    
    // Check common Railway volume mount paths
    // Note: Railway volumes are mounted at the path you specify in the dashboard
    const commonPaths = ['/data', '/uploads', '/storage', '/mnt'];
    console.log('   Checking common mount paths:', commonPaths);
    for (const mountPath of commonPaths) {
        if (fs.existsSync(mountPath)) {
            console.log(`   Found ${mountPath}, testing...`);
            // Check if it's actually a mount point and writable
            try {
                fs.accessSync(mountPath, fs.constants.W_OK);
                // Try to create a test file to verify it's writable and persistent
                const testFile = path.join(mountPath, '.railway-volume-test');
                try {
                    fs.writeFileSync(testFile, 'test');
                    fs.unlinkSync(testFile);
                    console.log('✅ Found writable volume at:', mountPath);
                    return mountPath;
                } catch (e) {
                    // Not writable, continue searching
                    console.log(`   ⚠️  ${mountPath} exists but not writable:`, e.message);
                }
            } catch (e) {
                // Not accessible, continue searching
                console.log(`   ⚠️  ${mountPath} exists but not accessible:`, e.message);
            }
        }
    }
    
    console.log('   ℹ️  No Railway volume found, will use ephemeral storage');
    console.log('   💡 To use persistent storage:');
    console.log('      1. Create a Volume in Railway dashboard');
    console.log('      2. Mount it to your App service at /data (or another path)');
    console.log('      3. Set RAILWAY_VOLUME_MOUNT_PATH=/data environment variable');
    return null;
}

const RAILWAY_VOLUME_PATH = findRailwayVolumePath();
let uploadsDir;
let usingVolume = false;

if (RAILWAY_VOLUME_PATH) {
    // Use Railway persistent volume
    uploadsDir = path.join(RAILWAY_VOLUME_PATH, 'uploads');
    usingVolume = true;
    console.log('📦 Using Railway persistent volume for uploads:', uploadsDir);
    console.log('   Volume mount path:', RAILWAY_VOLUME_PATH);
} else {
    // Use local public/uploads directory
    uploadsDir = path.join(__dirname, 'public', 'uploads');
    console.log('📁 Using local directory for uploads:', uploadsDir);
    console.log('   ⚠️  No Railway volume detected - files will be ephemeral');
    console.log('   💡 To use persistent storage, mount a volume and set RAILWAY_VOLUME_MOUNT_PATH');
}

// Ensure uploads directory exists
if (!fs.existsSync(uploadsDir)) {
    try {
        fs.mkdirSync(uploadsDir, { recursive: true });
        console.log('✅ Created uploads directory:', uploadsDir);
    } catch (err) {
        console.error('❌ Failed to create uploads directory:', err.message);
        // Fallback to public/uploads if volume creation fails
        uploadsDir = path.join(__dirname, 'public', 'uploads');
        fs.mkdirSync(uploadsDir, { recursive: true });
        console.log('📁 Fallback to local directory:', uploadsDir);
    }
}

// Store uploadsDir for use in routes
global.uploadsDir = uploadsDir;
// Also store the absolute path for debugging
global.uploadsDirAbsolute = path.resolve(uploadsDir);
console.log(`💾 Uploads directory configured: ${uploadsDir}`);
console.log(`   Absolute path: ${global.uploadsDirAbsolute}`);

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        // Always use the current uploadsDir (set at startup)
        const currentUploadsDir = global.uploadsDir || uploadsDir;
        const absolutePath = path.resolve(currentUploadsDir);
        
        // Ensure directory exists
        if (!fs.existsSync(currentUploadsDir)) {
            try {
                fs.mkdirSync(currentUploadsDir, { recursive: true });
                console.log(`💾 Created uploads directory: ${currentUploadsDir}`);
            } catch (err) {
                console.error(`❌ Failed to create uploads directory: ${err.message}`);
                // Use fallback
                const fallbackDir = path.join(__dirname, 'public', 'uploads');
                fs.mkdirSync(fallbackDir, { recursive: true });
                console.log(`💾 Using fallback directory: ${fallbackDir}`);
                // Update global for consistency
                global.uploadsDir = fallbackDir;
                global.uploadsDirAbsolute = path.resolve(fallbackDir);
                return cb(null, fallbackDir);
            }
        }
        
        // Update global to ensure consistency
        global.uploadsDir = currentUploadsDir;
        global.uploadsDirAbsolute = absolutePath;
        
        // Verify directory is writable before saving
        try {
            fs.accessSync(currentUploadsDir, fs.constants.W_OK);
            
            // Try to write a test file to verify Railway volume is actually writable
            const testFile = path.join(currentUploadsDir, `.write-test-${Date.now()}`);
            try {
                fs.writeFileSync(testFile, 'test');
                fs.unlinkSync(testFile);
                console.log(`💾 Multer saving to: ${currentUploadsDir} (absolute: ${absolutePath}) - Volume verified writable`);
            } catch (testErr) {
                console.error(`⚠️  Volume write test failed: ${testErr.message}`);
                console.error(`   This may indicate Railway volume sync issues`);
            }
            
            cb(null, currentUploadsDir);
        } catch (permErr) {
            console.error(`❌ Directory not writable: ${currentUploadsDir}`);
            console.error(`   Error: ${permErr.message}`);
            // Try fallback
            const fallbackDir = path.join(__dirname, 'public', 'uploads');
            try {
                fs.mkdirSync(fallbackDir, { recursive: true });
                console.log(`💾 Using fallback directory: ${fallbackDir}`);
                global.uploadsDir = fallbackDir;
                global.uploadsDirAbsolute = path.resolve(fallbackDir);
                cb(null, fallbackDir);
            } catch (fallbackErr) {
                console.error(`❌ Fallback directory also failed: ${fallbackErr.message}`);
                cb(new Error(`Cannot write to uploads directory: ${permErr.message}`));
            }
        }
    },
    filename: (req, file, cb) => {
        // Generate unique filename: timestamp-random-originalname
        // Normalize extension to lowercase for consistency
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname).toLowerCase();
        const filename = `product-${uniqueSuffix}${ext}`;
        console.log(`   📝 Generated filename: ${filename} (from: ${file.originalname})`);
        cb(null, filename);
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB max
    },
    fileFilter: (req, file, cb) => {
        // Accept only images
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed'));
        }
    }
});

// Multer error handler middleware
const handleMulterError = (err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        // Ignore unexpected file errors if we're already processing the request
        if (err.code === 'LIMIT_UNEXPECTED_FILE') {
            console.log('Multer: Unexpected file field, but continuing...');
            return next();
        }
        console.error('Multer error:', err);
        return res.status(400).json({ error: 'File upload error: ' + err.message });
    }
    if (err) {
        console.error('Upload error:', err);
        return res.status(400).json({ error: err.message });
    }
    next();
};

// Diagnostic endpoint to check uploads directory (Admin only)
app.get('/api/admin/uploads-diagnostic', requireAuth, requireDB, (req, res) => {
    try {
        const currentUploadsDir = global.uploadsDir || uploadsDir;
        const absolutePath = global.uploadsDirAbsolute || path.resolve(currentUploadsDir);
        
        const diagnostic = {
            configured_dir: currentUploadsDir,
            absolute_path: absolutePath,
            directory_exists: fs.existsSync(currentUploadsDir),
            volume_mount_path: process.env.RAILWAY_VOLUME_MOUNT_PATH || 'not set',
            files: []
        };
        
        if (diagnostic.directory_exists) {
            try {
                const files = fs.readdirSync(currentUploadsDir);
                diagnostic.files = files.map(filename => {
                    const filePath = path.join(currentUploadsDir, filename);
                    try {
                        const stats = fs.statSync(filePath);
                        return {
                            filename,
                            size: stats.size,
                            size_kb: (stats.size / 1024).toFixed(2),
                            modified: stats.mtime
                        };
                    } catch (err) {
                        return {
                            filename,
                            error: err.message
                        };
                    }
                });
                diagnostic.file_count = files.length;
            } catch (err) {
                diagnostic.error = `Failed to read directory: ${err.message}`;
            }
        } else {
            diagnostic.error = 'Directory does not exist';
            // Check if parent directories exist
            diagnostic.parent_exists = fs.existsSync('/data');
            diagnostic.parent_uploads_exists = fs.existsSync('/data/uploads');
        }
        
        res.json(diagnostic);
    } catch (err) {
        console.error('Diagnostic error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Serve example images
app.get('/uploads/examples/:filename', async (req, res) => {
    const filename = req.params.filename;
    const currentUploadsDir = global.uploadsDir || uploadsDir;
    const exampleImagesDir = path.join(currentUploadsDir, 'examples');
    const filePath = path.resolve(exampleImagesDir, filename);
    
    console.log(`[Examples] Serving image request: ${filename}`);
    console.log(`[Examples] File path: ${filePath}`);
    console.log(`[Examples] File exists: ${fs.existsSync(filePath)}`);
    
    // Check if directory exists
    if (!fs.existsSync(exampleImagesDir)) {
        console.warn(`[Examples] Examples images directory does not exist: ${exampleImagesDir}`);
        return res.status(404).json({ error: 'Examples images directory not found' });
    }
    
    // Check if file exists
    if (fs.existsSync(filePath)) {
        // Verify it's actually a file (not a directory)
        const stats = fs.statSync(filePath);
        if (!stats.isFile()) {
            console.warn(`[Examples] Path exists but is not a file: ${filePath}`);
            return res.status(404).json({ error: 'Path is not a file' });
        }
        
        // Set appropriate content type
        const ext = path.extname(filename).toLowerCase();
        const contentType = ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' :
                           ext === '.png' ? 'image/png' :
                           ext === '.gif' ? 'image/gif' :
                           ext === '.webp' ? 'image/webp' :
                           ext === '.svg' ? 'image/svg+xml' : 'application/octet-stream';
        
        res.setHeader('Content-Type', contentType);
        res.sendFile(filePath, (err) => {
            if (err) {
                console.error(`[Examples] Error sending file: ${err.message}`);
                if (!res.headersSent) {
                    res.status(500).json({ error: 'Error serving image file' });
                }
            }
        });
    } else {
        // List directory contents for debugging
        try {
            const files = fs.readdirSync(exampleImagesDir);
            console.warn(`[Examples] Image not found: ${filePath}`);
            console.warn(`[Examples] Directory contains ${files.length} file(s):`, files.slice(0, 10));
        } catch (dirErr) {
            console.error(`[Examples] Error reading directory: ${dirErr.message}`);
        }
        res.status(404).json({ error: 'Image not found', filename });
    }
});

// Serve add-on sales images - MUST be before /uploads/:filename route
app.get('/uploads/addon-sales/:filename', async (req, res) => {
    const filename = req.params.filename;
    const currentUploadsDir = global.uploadsDir || uploadsDir;
    const addonSalesImagesDir = path.join(currentUploadsDir, 'addon-sales');
    const filePath = path.resolve(addonSalesImagesDir, filename);
    
    // Check if directory exists
    if (!fs.existsSync(addonSalesImagesDir)) {
        res.status(404).setHeader('Content-Type', 'text/plain').send('Add-on sales images directory not found');
        return;
    }
    
    // Check if file exists
    if (fs.existsSync(filePath)) {
        const stats = fs.statSync(filePath);
        if (!stats.isFile()) {
            res.status(404).setHeader('Content-Type', 'text/plain').send('Path is not a file');
            return;
        }
        
        // Set appropriate content type
        const ext = path.extname(filename).toLowerCase();
        const contentType = ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' :
                           ext === '.png' ? 'image/png' :
                           ext === '.gif' ? 'image/gif' :
                           ext === '.webp' ? 'image/webp' : 'application/octet-stream';
        
        res.setHeader('Content-Type', contentType);
        res.sendFile(filePath, (err) => {
            if (err) {
                console.error(`[Add-On Sales] Error sending file: ${err.message}`);
                if (!res.headersSent) {
                    res.status(500).setHeader('Content-Type', 'text/plain').send('Error serving image file');
                }
            }
        });
    } else {
        res.status(404).setHeader('Content-Type', 'text/plain').send(`Image not found: ${filename}`);
    }
});

// Serve authenticity images - MUST be before /uploads/:filename route
app.get('/uploads/authenticity/:filename', async (req, res) => {
    const filename = req.params.filename;
    const currentUploadsDir = global.uploadsDir || uploadsDir;
    const authenticityImagesDir = path.join(currentUploadsDir, 'authenticity');
    const filePath = path.resolve(authenticityImagesDir, filename);
    
    console.log(`[Authenticity] ===== IMAGE REQUEST RECEIVED =====`);
    console.log(`[Authenticity] Request URL: ${req.url}`);
    console.log(`[Authenticity] Request path: ${req.path}`);
    console.log(`[Authenticity] Filename param: ${filename}`);
    console.log(`[Authenticity] Uploads directory: ${currentUploadsDir}`);
    console.log(`[Authenticity] Authenticity images directory: ${authenticityImagesDir}`);
    console.log(`[Authenticity] File path: ${filePath}`);
    console.log(`[Authenticity] File exists: ${fs.existsSync(filePath)}`);
    
    // Check if directory exists
    if (!fs.existsSync(authenticityImagesDir)) {
        console.warn(`[Authenticity] Authenticity images directory does not exist: ${authenticityImagesDir}`);
        // Return 404 with proper content type for image (not JSON)
        res.status(404).setHeader('Content-Type', 'text/plain').send('Authenticity images directory not found');
        return;
    }
    
    // Check if file exists
    if (fs.existsSync(filePath)) {
        // Verify it's actually a file (not a directory)
        const stats = fs.statSync(filePath);
        if (!stats.isFile()) {
            console.warn(`[Authenticity] Path exists but is not a file: ${filePath}`);
            res.status(404).setHeader('Content-Type', 'text/plain').send('Path is not a file');
            return;
        }
        
        // Set appropriate content type
        const ext = path.extname(filename).toLowerCase();
        const contentType = ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' :
                           ext === '.png' ? 'image/png' :
                           ext === '.gif' ? 'image/gif' :
                           ext === '.webp' ? 'image/webp' : 'application/octet-stream';
        
        res.setHeader('Content-Type', contentType);
        res.sendFile(filePath, (err) => {
            if (err) {
                console.error(`[Authenticity] Error sending file: ${err.message}`);
                if (!res.headersSent) {
                    res.status(500).setHeader('Content-Type', 'text/plain').send('Error serving image file');
                }
            } else {
                console.log(`[Authenticity] Successfully served file: ${filename}`);
            }
        });
    } else {
        // List directory contents for debugging
        try {
            const files = fs.readdirSync(authenticityImagesDir);
            console.warn(`[Authenticity] Image not found: ${filePath}`);
            console.warn(`[Authenticity] Directory contains ${files.length} file(s):`, files.slice(0, 10));
            console.warn(`[Authenticity] Looking for filename: ${filename}`);
            console.warn(`[Authenticity] Available files:`, files);
        } catch (dirErr) {
            console.error(`[Authenticity] Error reading directory: ${dirErr.message}`);
        }
        // Return 404 with proper content type (not JSON - browsers expect image)
        res.status(404).setHeader('Content-Type', 'text/plain').send(`Image not found: ${filename}`);
    }
});

// Log all /uploads/ requests for debugging
app.use('/uploads', (req, res, next) => {
    if (req.path && req.path.includes('authenticity')) {
        console.log(`[Uploads Middleware] Authenticity request detected: ${req.path}`);
    }
    next();
});

// Explicit route for uploads BEFORE static middleware to handle missing files gracefully
// This prevents Express static from throwing unhandled errors
app.get('/uploads/:filename', async (req, res, next) => {
    const filename = req.params.filename;
    
    // Skip authenticity, example, and addon-sales images - they're handled by specific routes above
    // Check the request path to see if it's an authenticity, example, or addon-sales image request
    if (req.path && (req.path.startsWith('/uploads/authenticity/') || req.path.startsWith('/uploads/examples/') || req.path.startsWith('/uploads/addon-sales/'))) {
        console.log(`[Uploads Route] Skipping ${req.path} - handled by specific route`);
        return next(); // Let the more specific route handle it
    }
    
    // CRITICAL: Use the same uploadsDir that Multer uses for saving files
    // This must match exactly where files are saved
    const currentUploadsDir = global.uploadsDir || uploadsDir;
    const filePath = path.join(currentUploadsDir, filename);
    
    // Log for debugging (only on first attempt)
    console.log(`🔍 Serving file request: ${filename}`);
    
    // Retry logic for Railway volume sync delays
    // Railway volumes can have VERY significant sync delays (30-120+ seconds for network-mounted volumes)
    const maxRetries = 50; // Very aggressive retries for Railway sync delays
    const retryDelay = 2000; // Start with 2 seconds
    
    // Initial delay before first check - Railway volumes are network-mounted and async
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            // Check if file exists
            fs.accessSync(filePath, fs.constants.F_OK);
            
            // File exists, verify it's readable
            const stats = fs.statSync(filePath);
            if (stats.isFile() && stats.size > 0) {
                // File exists and is valid, serve it
                return res.sendFile(filePath, (err) => {
                    if (err) {
                        console.error(`Error serving file ${filePath}:`, err.message);
                        if (!res.headersSent) {
                            res.status(500).type('application/json').json({ error: 'Error serving file' });
                        }
                    }
                });
            }
        } catch (accessErr) {
            // File doesn't exist or not accessible yet - check for case-insensitive match
            if (fs.existsSync(currentUploadsDir)) {
                try {
                    const files = fs.readdirSync(currentUploadsDir);
                    // Check for case-insensitive match
                    const matchingFile = files.find(f => f.toLowerCase() === filename.toLowerCase());
                    
                    if (matchingFile) {
                        const correctedPath = path.join(currentUploadsDir, matchingFile);
                        try {
                            const stats = fs.statSync(correctedPath);
                            if (stats.isFile() && stats.size > 0) {
                                // Found matching file, serve it
                                if (attempt > 0) {
                                    console.log(`   ✅ Found file after ${attempt} retry(ies) (case-insensitive match)`);
                                }
                                return res.sendFile(correctedPath, (err) => {
                                    if (err) {
                                        console.error(`Error serving file ${correctedPath}:`, err.message);
                                        if (!res.headersSent) {
                                            res.status(500).type('application/json').json({ error: 'Error serving file' });
                                        }
                                    }
                                });
                            }
                        } catch (statErr) {
                            // File exists but not ready yet - continue retry
                        }
                    }
                } catch (dirErr) {
                    // Directory read error - continue retry
                }
            }
            
            // If not last attempt, wait and retry with exponential backoff (capped higher)
            if (attempt < maxRetries - 1) {
                const delay = Math.min(retryDelay * (attempt + 1), 10000); // Cap at 10 seconds per retry
                if (attempt % 5 === 0 && attempt > 0) { // Log every 5th retry after first
                    console.log(`   ⏳ Still waiting for file to sync (attempt ${attempt + 1}/${maxRetries}, ${delay}ms delay)...`);
                }
                await new Promise(resolve => setTimeout(resolve, delay));
                continue;
            }
        }
    }
    
    // After all retries failed, return 404
    console.log(`❌ File not found after ${maxRetries} attempts: ${filename}`);
    console.log(`   Searched in: ${currentUploadsDir}`);
    
    // Check directory contents for debugging
    if (fs.existsSync(currentUploadsDir)) {
        try {
            const files = fs.readdirSync(currentUploadsDir);
            console.log(`   Directory contains ${files.length} file(s)`);
            const matchingFile = files.find(f => f.toLowerCase() === filename.toLowerCase());
            if (matchingFile) {
                console.log(`   ⚠️  Case-insensitive match found but file not accessible: ${matchingFile}`);
            }
        } catch (dirErr) {
            // Ignore directory read errors
        }
    }
    
    res.status(404).type('application/json').json({ 
        error: 'File not found',
        message: 'This file may still be syncing to the volume. Please try again in a moment.'
    });
});

// Serve static files from public directory (except uploads, handled above)
// Add middleware to suppress 404 logging for browser extension files
app.use((req, res, next) => {
    const browserExtensionFiles = [
        'twint_ch.js',
        'lkk_ch.js',
        'support_parent.css',
        'twint_ch.min.js',
        'lkk_ch.min.js'
    ];
    
    const isBrowserExtensionFile = browserExtensionFiles.some(file => 
        req.path && req.path.includes(file)
    );
    
    if (isBrowserExtensionFile) {
        // Silently return 404 for browser extension files
        return res.status(404).end();
    }
    
    next();
});

// Add cache-busting middleware for HTML files
app.use((req, res, next) => {
    // Don't cache HTML files - always fetch fresh version
    if (req.path.endsWith('.html')) {
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('X-Content-Type-Options', 'nosniff');
    }
    next();
});

// Security headers middleware for static files
app.use((req, res, next) => {
    // Add security headers to all static files
    res.setHeader('X-Content-Type-Options', 'nosniff');
    next();
});

app.use(express.static('public', {
    index: false, // Don't serve index.html for directories
    dotfiles: 'ignore', // Ignore dotfiles
    etag: true,
    lastModified: true,
    maxAge: process.env.NODE_ENV === 'production' ? '1d' : '0' // Cache for 1 day in production, no cache in development
}));

// Session configuration with MongoDB store (if available)
// Construct MongoDB connection URL for session store
function getMongoSessionUrl() {
    const MONGOUSER = process.env.MONGOUSER || process.env.MONGODB_USER || process.env.MONGO_INITDB_ROOT_USERNAME;
    const MONGOPASSWORD = process.env.MONGOPASSWORD || process.env.MONGODB_PASSWORD || process.env.MONGO_INITDB_ROOT_PASSWORD;
    const MONGOHOST = process.env.MONGOHOST || process.env.MONGODB_HOST || process.env.RAILWAY_PRIVATE_DOMAIN;
    const MONGOPORT = process.env.MONGOPORT || process.env.MONGODB_PORT || process.env.RAILWAY_TCP_PROXY_PORT || '27017';
    const MONGODATABASE = process.env.MONGODATABASE || process.env.MONGODB_DATABASE || 'AutoRestockDB';
    
    if (MONGOUSER && MONGOPASSWORD && MONGOHOST && isResolved(MONGOHOST) && isResolved(MONGOUSER) && isResolved(MONGOPASSWORD)) {
        const encodedPassword = encodeURIComponent(MONGOPASSWORD);
        return `mongodb://${MONGOUSER}:${encodedPassword}@${MONGOHOST}:${MONGOPORT}/${MONGODATABASE}?authSource=admin`;
    }
    return null;
}

const mongoSessionUrl = getMongoSessionUrl();

// Session store - try MongoStore but fall back to MemoryStore on error
let sessionStore;
if (mongoSessionUrl && MongoStore && typeof MongoStore === 'function') {
    try {
        sessionStore = new MongoStore({
            mongoUrl: mongoSessionUrl,
            touchAfter: 24 * 3600,
            crypto: {
                secret: process.env.SESSION_SECRET || 'LJM_SECURE_SESSION_KEY_2024'
            }
        });
        console.log('✅ Using MongoStore for sessions');
    } catch (error) {
        console.error('❌ Error creating MongoStore:', error.message);
        console.warn('⚠️  Falling back to MemoryStore (sessions will not persist across restarts)');
        sessionStore = undefined; // Fall back to MemoryStore
    }
} else {
    console.warn('⚠️  MongoStore not available, using MemoryStore (sessions will not persist across restarts)');
    sessionStore = undefined;
}

app.use(session({
    secret: process.env.SESSION_SECRET || 'LJM_SECURE_SESSION_KEY_2024',
    resave: false,
    saveUninitialized: false,
    store: sessionStore, // Will be undefined if MongoStore failed, causing fallback to MemoryStore
    cookie: {
        secure: process.env.NODE_ENV === 'production', // Use secure cookies in production (HTTPS)
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        httpOnly: true
    }
}));

// MongoDB connection
let db;

// Helper to check if a value is a resolved variable (not a template string)
function isResolved(value) {
    if (!value || typeof value !== 'string' || value.length === 0) {
        return false;
    }
    // Check for Railway template syntax: ${{VAR}} or ${VAR}
    if (value.includes('${')) {
        return false;
    }
    return true;
}

// Helper to resolve Railway template variables
function resolveRailwayTemplate(template, envVars) {
    if (!template || !template.includes('${')) {
        return template;
    }
    
    // Try to resolve ${{VAR}} or ${VAR} patterns
    let resolved = template;
    const matches = template.matchAll(/\$\{?\{?([^}]+)\}?\}?/g);
    
    for (const match of matches) {
        const varName = match[1];
        const value = envVars[varName];
        if (value && isResolved(value)) {
            resolved = resolved.replace(match[0], value);
        } else {
            return null; // Can't resolve
        }
    }
    
    return resolved;
}

// Build MongoDB connection string from various Railway environment variables
function getMongoConnectionString() {
    // Try full connection string first (only if it's resolved, not a template)
    let mongoUri = process.env.MONGODB_URI || process.env.MONGO_URL || process.env.MONGO_PUBLIC_URL;
    
    // Try to resolve Railway templates if present
    if (mongoUri && mongoUri.includes('${')) {
        const resolved = resolveRailwayTemplate(mongoUri, process.env);
        if (resolved && isResolved(resolved)) {
            return resolved;
        }
    }
    
    if (mongoUri && isResolved(mongoUri)) {
        return mongoUri;
    }
    
    // Try building from individual components
    let MONGOUSER = process.env.MONGOUSER || process.env.MONGODB_USER || process.env.MONGO_INITDB_ROOT_USERNAME;
    let MONGOPASSWORD = process.env.MONGOPASSWORD || process.env.MONGODB_PASSWORD || process.env.MONGO_INITDB_ROOT_PASSWORD;
    let MONGOHOST = process.env.MONGOHOST || process.env.MONGODB_HOST || process.env.RAILWAY_PRIVATE_DOMAIN;
    let MONGOPORT = process.env.MONGOPORT || process.env.MONGODB_PORT || process.env.RAILWAY_TCP_PROXY_PORT || '27017';
    const MONGODATABASE = process.env.MONGODATABASE || process.env.MONGODB_DATABASE || 'AutoRestockDB';
    
    // Resolve any template variables in individual components
    if (MONGOUSER && MONGOUSER.includes('${')) {
        MONGOUSER = resolveRailwayTemplate(MONGOUSER, process.env);
    }
    if (MONGOPASSWORD && MONGOPASSWORD.includes('${')) {
        MONGOPASSWORD = resolveRailwayTemplate(MONGOPASSWORD, process.env);
    }
    if (MONGOHOST && MONGOHOST.includes('${')) {
        MONGOHOST = resolveRailwayTemplate(MONGOHOST, process.env);
    }
    if (MONGOPORT && MONGOPORT.includes('${')) {
        MONGOPORT = resolveRailwayTemplate(MONGOPORT, process.env) || '27017';
    }
    
    // Only build connection string if all required components are resolved (not templates)
    if (MONGOHOST && isResolved(MONGOHOST)) {
        if (MONGOUSER && MONGOPASSWORD && isResolved(MONGOUSER) && isResolved(MONGOPASSWORD)) {
            // Try multiple authSource options - Railway MongoDB might use 'admin' or the database name
            const encodedPassword = encodeURIComponent(MONGOPASSWORD);
            const database = MONGODATABASE || 'AutoRestockDB';
            
            // Try with authSource matching database name or admin
            // Railway MongoDB typically uses 'admin' as authSource, but database name can work too
            const authSource = process.env.MONGO_AUTH_SOURCE || 'admin';
            return `mongodb://${MONGOUSER}:${encodedPassword}@${MONGOHOST}:${MONGOPORT}/${database}?authSource=${authSource}`;
        } else if (!MONGOUSER || !MONGOPASSWORD) {
            // No auth
            return `mongodb://${MONGOHOST}:${MONGOPORT}/${MONGODATABASE || 'AutoRestockDB'}`;
        }
    }
    
    return null;
}

const MONGODB_URI = getMongoConnectionString();

if (!MONGODB_URI) {
    console.error('╔════════════════════════════════════════════════════════════════╗');
    console.error('║  MONGODB CONNECTION STRING NOT FOUND!                          ║');
    console.error('╚════════════════════════════════════════════════════════════════╝');
    console.error('\n🔍 ISSUE: Railway template variables (${{}}) are not being resolved.');
    console.error('   Railway should auto-resolve these when services are connected.');
    console.error('\n📋 QUICK FIX - Do this in Railway:');
    console.error('\n1. Go to Railway Dashboard → Your MongoDB Service → Variables');
    console.error('2. Find these variables and COPY their ACTUAL VALUES (not templates):');
    console.error('   - MONGO_INITDB_ROOT_USERNAME (should be "mongo" or similar)');
    console.error('   - MONGO_INITDB_ROOT_PASSWORD (copy the actual password)');
    console.error('   - RAILWAY_PRIVATE_DOMAIN (copy the actual domain)');
    console.error('\n3. Go to Your App Service → Variables tab');
    console.error('4. DELETE the template variables and ADD these with ACTUAL values:');
    console.error('   MONGOUSER = mongo');
    console.error('   MONGOPASSWORD = (paste the actual password from MongoDB service)');
    console.error('   MONGOHOST = (paste the actual domain from MongoDB service)');
    console.error('   MONGOPORT = 27017');
    console.error('\n📊 Current MongoDB environment variables:');
    const mongoVars = Object.keys(process.env).filter(k => 
        k.includes('MONGO') || k.includes('RAILWAY') || k.includes('MONGODB')
    ).sort();
    if (mongoVars.length === 0) {
        console.error('   ❌ No MongoDB variables found at all!');
    } else {
        mongoVars.forEach(key => {
            const value = process.env[key];
            const isTemplate = value && typeof value === 'string' && value.includes('${');
            if (isTemplate) {
                console.error(`   ⚠️  ${key} = [TEMPLATE] "${value.substring(0, 60)}..."`);
            } else if (value) {
                // Don't show full passwords, just length
                const displayValue = key.includes('PASSWORD') ? '[HIDDEN]' : value;
                console.error(`   ✅ ${key} = "${displayValue}"`);
            } else {
                console.error(`   ❌ ${key} = [NOT SET]`);
            }
        });
    }
    console.error('\n💡 Alternative: Use Railway Service Reference');
    console.error('   If services are connected, Railway should auto-resolve.');
    console.error('   Make sure your App service is in the same project as MongoDB.');
    console.error('\n🔧 After fixing variables, Railway will auto-redeploy.');
    console.error('   Check logs - you should see "✅ Connected to MongoDB successfully"');
    process.exit(1);
}

console.log('Attempting MongoDB connection...');

// Try connecting with multiple authSource options
async function tryConnect() {
    const MONGOUSER = process.env.MONGOUSER;
    const MONGOPASSWORD = process.env.MONGOPASSWORD;
    const MONGOHOST = process.env.MONGOHOST;
    const MONGOPORT = process.env.MONGOPORT || '27017';
    const database = process.env.MONGODATABASE || process.env.MONGODB_DATABASE || 'AutoRestockDB';
    const encodedPassword = encodeURIComponent(MONGOPASSWORD);
    
    // Try different authSource options
    const authOptions = [
        { authSource: 'admin', desc: 'admin (standard)' },
        { authSource: 'AutoRestockDB', desc: 'AutoRestockDB (database name)' },
        { authSource: null, desc: 'no authSource' }
    ];
    
    for (const option of authOptions) {
        const authSourceParam = option.authSource ? `?authSource=${option.authSource}` : '';
        const connectionString = `mongodb://${MONGOUSER}:${encodedPassword}@${MONGOHOST}:${MONGOPORT}/${database}${authSourceParam}`;
        
        try {
            console.log(`Trying connection with authSource: ${option.desc}...`);
            const client = await MongoClient.connect(connectionString);
            console.log(`✅ Connected to MongoDB successfully using authSource: ${option.desc}`);
            db = client.db(database);
            await initializeDatabase();
            return; // Success, exit function
        } catch (err) {
            if (err.message.includes('Authentication failed') || err.message.includes('auth')) {
                console.log(`❌ Failed with ${option.desc}: ${err.message}`);
                continue; // Try next option
            } else {
                // Other error, throw it
                throw err;
            }
        }
    }
    
    // If we get here, all auth options failed
    throw new Error('All authentication methods failed');
}

// Start MongoDB connection in background - don't block server startup
tryConnect()
    .catch(err => {
        console.error('❌ MongoDB connection error:', err.message);
        
        // Provide troubleshooting steps
        console.error('\n🔧 AUTHENTICATION FAILED - Troubleshooting Steps:');
        console.error('\n1. ✅ Double-check credentials in Railway MongoDB service:');
        console.error('   - Go to MongoDB service → Variables');
        console.error('   - Verify MONGO_INITDB_ROOT_USERNAME matches your MONGOUSER');
        console.error('   - Verify MONGO_INITDB_ROOT_PASSWORD matches your MONGOPASSWORD');
        console.error('   - Check for any extra spaces or quotes in the password');
        console.error('\n2. ✅ Verify your App service variables:');
        console.error(`   MONGOUSER = "${process.env.MONGOUSER || 'NOT SET'}"`);
        console.error(`   MONGOPASSWORD = "${process.env.MONGOPASSWORD ? '[SET - ' + process.env.MONGOPASSWORD.length + ' chars]' : 'NOT SET'}"`);
        console.error(`   MONGOHOST = "${process.env.MONGOHOST || 'NOT SET'}"`);
        console.error(`   MONGOPORT = "${process.env.MONGOPORT || 'NOT SET'}"`);
        console.error(`   MONGODATABASE = "${process.env.MONGODATABASE || 'AutoRestockDB (default)'}"`);
        console.error('\n3. 💡 TIP: Copy the EXACT password from MongoDB service variables');
        console.error('   - No extra spaces');
        console.error('   - No quotes around the value');
        console.error('   - Check if password has special characters that need handling');
        
        // Don't exit - let server start and retry connection
        console.error('\n⚠️  Server will continue to run but database features will be unavailable.');
        console.error('   Retrying MongoDB connection in background...');
        
        // Retry connection every 30 seconds
        const retryInterval = setInterval(() => {
            console.log('🔄 Retrying MongoDB connection...');
            tryConnect()
                .then(() => {
                    console.log('✅ MongoDB connection successful after retry!');
                    clearInterval(retryInterval);
                })
                .catch(retryErr => {
                    console.error('❌ Retry failed:', retryErr.message);
                });
        }, 30000);
    });

// Initialize database collections and indexes
async function initializeDatabase() {
    try {
        // Create indexes for products collection
        // Drop and recreate security_barcode index with sparse option
        try {
            await db.collection('products').dropIndex('security_barcode_1');
            console.log('✅ Dropped old security_barcode index');
        } catch (err) {
            // Index might not exist, that's okay
            if (!err.message.includes('index not found')) {
                console.log('Note: Could not drop security_barcode index (may not exist):', err.message);
            }
        }
        await db.collection('products').createIndex({ security_barcode: 1 }, { unique: true, sparse: true });
        await db.collection('products').createIndex({ date_added: -1 });
        
        // Create indexes for airpod_parts collection
        await db.collection('airpod_parts').createIndex({ generation: 1, part_name: 1 }, { unique: true });
        await db.collection('airpod_parts').createIndex({ generation: 1, display_order: 1 });
        
        // Create indexes for warranties collection
        try {
            await db.collection('warranties').createIndex({ security_barcode: 1 });
            await db.collection('warranties').createIndex({ customer_email: 1 });
            await db.collection('warranties').createIndex({ registration_date: -1 });
            await db.collection('warranties').createIndex({ warranty_id: 1 }, { unique: true });
            await db.collection('warranties').createIndex({ terms_version: 1 });
        } catch (err) {
            // Indexes may already exist, ignore error
            if (!err.message.includes('already exists') && !err.message.includes('E11000')) {
                console.error('Warning: Could not create warranty indexes:', err.message);
            }
        }
        
        // Create indexes for warranty_terms collection
        try {
            await db.collection('warranty_terms').createIndex({ version: 1 }, { unique: true });
            await db.collection('warranty_terms').createIndex({ created_at: -1 });
        } catch (err) {
            // Indexes may already exist, ignore error
            if (!err.message.includes('already exists') && !err.message.includes('E11000')) {
                console.error('Warning: Could not create warranty_terms indexes:', err.message);
            }
        }
        
        // Create indexes for setup_instructions collection
        try {
            await db.collection('setup_instructions').createIndex({ generation: 1, part_model_number: 1 }, { unique: true });
            await db.collection('setup_instructions').createIndex({ generation: 1 });
        } catch (err) {
            // Indexes may already exist, ignore error
            if (!err.message.includes('already exists') && !err.message.includes('E11000')) {
                console.error('Warning: Could not create setup_instructions indexes:', err.message);
            }
        }

        // Create indexes for cookie-based tracking collections
        try {
            // Page views collection
            await db.collection('page_views').createIndex({ tracking_id: 1, timestamp: -1 });
            await db.collection('page_views').createIndex({ session_id: 1, timestamp: -1 });
            await db.collection('page_views').createIndex({ page: 1 });
            
            // User sessions collection
            await db.collection('user_sessions').createIndex({ session_id: 1 }, { unique: true });
            await db.collection('user_sessions').createIndex({ tracking_id: 1 });
            await db.collection('user_sessions').createIndex({ started_at: -1 });
            
            // User interactions collection
            await db.collection('user_interactions').createIndex({ tracking_id: 1, timestamp: -1 });
            await db.collection('user_interactions').createIndex({ session_id: 1, timestamp: -1 });
            await db.collection('user_interactions').createIndex({ interaction_type: 1 });
            
            // Cookie consents collection
            await db.collection('cookie_consents').createIndex({ timestamp: -1 });
            await db.collection('cookie_consents').createIndex({ consent_type: 1 });
        } catch (err) {
            if (!err.message.includes('already exists') && !err.message.includes('E11000')) {
                console.error('Warning: Could not create cookie tracking indexes:', err.message);
            }
        }
        
        console.log('Database indexes created');
        
        // Check if parts collection is empty and populate
        const partsCount = await db.collection('airpod_parts').countDocuments();
        if (partsCount === 0) {
            await populateInitialParts();
        }
        
        // Initialize warranty pricing if not exists
        await initializeWarrantyPricing();
    } catch (err) {
        console.error('Database initialization error:', err);
    }
}

// Normalize security barcode for comparison (removes hyphens and converts to uppercase)
// This allows matching both hyphenated (ABC-123-DEF) and non-hyphenated (ABC123DEF) codes
function normalizeSecurityBarcode(barcode) {
    if (!barcode) return '';
    return barcode.trim().toUpperCase().replace(/-/g, '');
}

// Create a MongoDB query that matches security barcode with or without hyphens
// Since codes are stored WITH hyphens (e.g., "ABC-123-DEF") but users may enter WITHOUT hyphens (e.g., "ABC123DEF"),
// we create a regex that matches the normalized (no-hyphen) version with optional hyphens inserted
function createSecurityBarcodeQuery(barcode) {
    if (!barcode) return null;
    
    const normalized = normalizeSecurityBarcode(barcode); // Remove all hyphens
    const original = barcode.trim().toUpperCase(); // Keep original format
    
    // Create regex pattern: match normalized characters in sequence with optional hyphens between any characters
    // Example: normalized "ABC123DEF" will match "ABC-123-DEF", "ABC123-DEF", "ABC-123DEF", etc.
    // Pattern: A followed by optional hyphen, B followed by optional hyphen, etc.
    const regexPattern = '^' + normalized.split('').join('[-]?') + '$';
    
    return {
        $or: [
            { security_barcode: original }, // Try exact match first (fastest, works if user entered with hyphens)
            { security_barcode: normalized }, // Try normalized match (works if stored without hyphens)
            { security_barcode: { $regex: regexPattern, $options: 'i' } } // Regex: normalized with optional hyphens
        ]
    };
}

// Initialize warranty pricing with default values
async function initializeWarrantyPricing() {
    try {
        const pricingCount = await db.collection('warranty_pricing').countDocuments();
        if (pricingCount === 0) {
            const defaultPricing = {
                '3months': 4.99,
                '6months': 7.99,
                '12months': 12.99,
                '3months_enabled': true,
                '6months_enabled': true,
                '12months_enabled': true,
                last_updated: new Date(),
                updated_by: 'system'
            };
            await db.collection('warranty_pricing').insertOne(defaultPricing);
            console.log('Default warranty pricing initialized');
        } else {
            // Ensure existing records have enabled flags (migration)
            await db.collection('warranty_pricing').updateMany(
                { '3months_enabled': { $exists: false } },
                {
                    $set: {
                        '3months_enabled': true,
                        '6months_enabled': true,
                        '12months_enabled': true
                    }
                }
            );
        }
    } catch (err) {
        console.error('Error initializing warranty pricing:', err);
    }
}

// Populate initial parts data
async function populateInitialParts() {
    const initialParts = [
        // AirPods (1st Gen)
        {generation: 'AirPods (1st Gen)', part_name: 'Standard AirPods earbuds (Left)', part_model_number: 'A1523', part_type: 'left', notes: 'Basic model numbers', display_order: 1, date_added: new Date()},
        {generation: 'AirPods (1st Gen)', part_name: 'Standard AirPods earbuds (Right)', part_model_number: 'A1722', part_type: 'right', notes: 'Basic model numbers', display_order: 2, date_added: new Date()},
        {generation: 'AirPods (1st Gen)', part_name: 'Charging Case (Lightning)', part_model_number: 'A1602', part_type: 'case', notes: 'Works with gen 1 & gen 2', display_order: 3, date_added: new Date()},
        // AirPods (2nd Gen)
        {generation: 'AirPods (2nd Gen)', part_name: 'Standard AirPods earbuds (Left)', part_model_number: 'A2031', part_type: 'left', notes: 'Model numbers', display_order: 1, date_added: new Date()},
        {generation: 'AirPods (2nd Gen)', part_name: 'Standard AirPods earbuds (Right)', part_model_number: 'A2032', part_type: 'right', notes: 'Model numbers', display_order: 2, date_added: new Date()},
        {generation: 'AirPods (2nd Gen)', part_name: 'Charging Case (Wireless)', part_model_number: 'A1938', part_type: 'case', notes: 'Qi Wireless case for gen1/2', display_order: 3, date_added: new Date()},
        {generation: 'AirPods (2nd Gen)', part_name: 'Charging Case (Lightning)', part_model_number: 'A1602', part_type: 'case', notes: 'Lightning case - works with gen 1 & gen 2', display_order: 4, date_added: new Date()},
        // AirPods (3rd Gen)
        {generation: 'AirPods (3rd Gen)', part_name: 'Earbuds (Left)', part_model_number: 'A2564', part_type: 'left', notes: 'Genuine Apple part listing', display_order: 1, date_added: new Date()},
        {generation: 'AirPods (3rd Gen)', part_name: 'Earbuds (Right)', part_model_number: 'A2565', part_type: 'right', notes: 'Genuine Apple part listing', display_order: 2, date_added: new Date()},
        {generation: 'AirPods (3rd Gen)', part_name: 'Charging Case (MagSafe)', part_model_number: 'A2566', part_type: 'case', notes: 'MagSafe case, gen3', display_order: 3, date_added: new Date()},
        {generation: 'AirPods (3rd Gen)', part_name: 'Charging Case (Lightning)', part_model_number: 'A2566-L', part_type: 'case', notes: 'Lightning case for gen3', display_order: 4, date_added: new Date()},
        // AirPods (4th Gen) standard
        {generation: 'AirPods (4th Gen) standard line (non-Pro)', part_name: 'Earbuds (Left)', part_model_number: 'A3050', part_type: 'left', notes: 'Non-ANC variant', display_order: 1, date_added: new Date()},
        {generation: 'AirPods (4th Gen) standard line (non-Pro)', part_name: 'Earbuds (Right)', part_model_number: 'A3053 / A3054', part_type: 'right', notes: 'Non-ANC variant (multiple model numbers)', display_order: 2, date_added: new Date()},
        {generation: 'AirPods (4th Gen) standard line (non-Pro)', part_name: 'Charging Case', part_model_number: 'A3058', part_type: 'case', notes: 'Case for standard gen4', display_order: 3, date_added: new Date()},
        // AirPods (4th Gen) ANC
        {generation: 'AirPods (4th Gen) standard line (ANC version)', part_name: 'Earbuds (Left)', part_model_number: 'A3055', part_type: 'left', notes: 'ANC version of standard line', display_order: 1, date_added: new Date()},
        {generation: 'AirPods (4th Gen) standard line (ANC version)', part_name: 'Earbuds (Right)', part_model_number: 'A3056 / A3057', part_type: 'right', notes: 'ANC version of standard line (multiple model numbers)', display_order: 2, date_added: new Date()},
        {generation: 'AirPods (4th Gen) standard line (ANC version)', part_name: 'Charging Case', part_model_number: 'A3059', part_type: 'case', notes: 'ANC case', display_order: 3, date_added: new Date()},
        // AirPods Pro (1st Gen)
        {generation: 'AirPods Pro (1st Gen)', part_name: 'Earbuds (Right)', part_model_number: 'A2083', part_type: 'right', notes: 'Identified in teardown', display_order: 1, date_added: new Date()},
        {generation: 'AirPods Pro (1st Gen)', part_name: 'Earbuds (Left)', part_model_number: 'A2084', part_type: 'left', notes: 'Identified in teardown', display_order: 2, date_added: new Date()},
        {generation: 'AirPods Pro (1st Gen)', part_name: 'Charging Case', part_model_number: 'A2190', part_type: 'case', notes: 'MagSafe case first Pro', display_order: 3, date_added: new Date()},
        {generation: 'AirPods Pro (1st Gen)', part_name: 'Charging Case (Lightning)', part_model_number: 'A2190-L', part_type: 'case', notes: 'Lightning case for Pro 1st Gen', display_order: 4, date_added: new Date()},
        {generation: 'AirPods Pro (1st Gen)', part_name: 'Service Kit Replacement Pods (Left)', part_model_number: '661-17164', part_type: 'left', notes: 'Internal service kit', display_order: 5, date_added: new Date()},
        {generation: 'AirPods Pro (1st Gen)', part_name: 'Service Kit Replacement Pods (Right)', part_model_number: '661-17165', part_type: 'right', notes: 'Internal service kit', display_order: 6, date_added: new Date()},
        // AirPods Pro (2nd Gen)
        {generation: 'AirPods Pro (2nd Gen)', part_name: 'Earbuds (Left)', part_model_number: 'A2698', part_type: 'left', notes: 'Left AirPod Pro 2nd Gen', display_order: 1, date_added: new Date()},
        {generation: 'AirPods Pro (2nd Gen)', part_name: 'Earbuds (Right)', part_model_number: 'A2699', part_type: 'right', notes: 'Right AirPod Pro 2nd Gen', display_order: 2, date_added: new Date()},
        {generation: 'AirPods Pro (2nd Gen)', part_name: 'Charging Case (USB-C MagSafe)', part_model_number: 'A2700', part_type: 'case', notes: 'USB-C MagSafe case', display_order: 3, date_added: new Date()},
        {generation: 'AirPods Pro (2nd Gen)', part_name: 'Earbuds (Left) - USB-C', part_model_number: 'A3048', part_type: 'left', notes: 'Left AirPod Pro 2nd Gen USB-C variant', display_order: 4, date_added: new Date()},
        {generation: 'AirPods Pro (2nd Gen)', part_name: 'Earbuds (Right) - USB-C', part_model_number: 'A3047', part_type: 'right', notes: 'Right AirPod Pro 2nd Gen USB-C variant', display_order: 5, date_added: new Date()},
        {generation: 'AirPods Pro (2nd Gen)', part_name: 'Charging Case (USB-C MagSafe)', part_model_number: 'A2968', part_type: 'case', notes: 'USB-C version (alternative case)', display_order: 6, date_added: new Date()},
        {generation: 'AirPods Pro (2nd Gen)', part_name: 'Charging Case (Lightning)', part_model_number: 'A2968-L', part_type: 'case', notes: 'Lightning version (compatibility case)', display_order: 7, date_added: new Date()}
    ];
    
    try {
        await db.collection('airpod_parts').insertMany(initialParts);
        console.log('Initial AirPod parts data populated');
    } catch (err) {
        console.error('Error populating initial parts:', err);
    }
}

// Rate limiting for barcode verification (simple in-memory store)
const verificationAttempts = new Map();
const MAX_ATTEMPTS = 10;
const ATTEMPT_WINDOW = 60 * 60 * 1000; // 1 hour

function checkRateLimit(ip) {
    const now = Date.now();
    const attempts = verificationAttempts.get(ip) || [];
    const recentAttempts = attempts.filter(time => now - time < ATTEMPT_WINDOW);
    
    if (recentAttempts.length >= MAX_ATTEMPTS) {
        return false;
    }
    
    recentAttempts.push(now);
    verificationAttempts.set(ip, recentAttempts);
    return true;
}

// Check if database is connected
function requireDB(req, res, next) {
    if (!db) {
        console.error('Database not connected. MongoDB connection failed.');
        return res.status(503).json({ error: 'Database not available. Please check MongoDB connection.' });
    }
    next();
}

// Authentication middleware
// Use User Service authentication middleware
const auth = require('./auth');

function requireAuth(req, res, next) {
    console.log(`[AUTH] ${req.method} ${req.path} - Checking authentication`);

    // Try JWT token first (from User Service)
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        console.log(`[AUTH] JWT token present: ${token.substring(0, 20)}...`);
        return auth.requireAuth()(req, res, next);
    }

    // Fallback to session-based auth for backward compatibility
    if (req.session && req.session.authenticated) {
        console.log('[AUTH] Session-based auth successful');
        return next();
    }

    console.log('[AUTH] ❌ No valid authentication found - returning 401');
    console.log('[AUTH] Authorization header:', authHeader ? 'present but invalid' : 'missing');
    console.log('[AUTH] Session authenticated:', req.session?.authenticated ? 'yes' : 'no');
    res.status(401).json({ error: 'Unauthorized' });
}

// Authentication middleware for HTML pages (redirects to login)
function requireAuthHTML(req, res, next) {
    // Check for JWT token in cookies or query params (from User Service)
    const token = req.cookies?.accessToken || req.query?.token;
    
    if (token) {
        // If token is in query params, it means we're coming from callback
        // Let the page load and the frontend will handle it
        if (req.query?.token) {
            console.log('Token found in query params, allowing page load');
            return next();
        }
        
        // If token is in cookies, verify it
        if (req.cookies?.accessToken) {
            // Try to verify with User Service auth middleware
            const authHeader = `Bearer ${req.cookies.accessToken}`;
            req.headers.authorization = authHeader;
            
            // Use the JWT auth middleware
            return auth.requireAuth()(req, res, (err) => {
                if (err) {
                    console.log('JWT verification failed, redirecting to login');
                    res.redirect('/admin/login');
                } else {
                    next();
                }
            });
        }
    }
    
    // Check for session-based auth (backward compatibility)
    if (req.session && req.session.authenticated) {
        return next();
    }
    
    // Redirect to login if not authenticated
    console.log('No authentication found, redirecting to login');
    res.redirect('/admin/login');
}

// API Routes

// Admin Login (TEMPORARILY RE-ENABLED for access recovery)
// This endpoint is temporarily enabled to allow access to existing accounts
// TODO: Migrate to User Service and disable this endpoint
app.post('/api/admin/login', (req, res) => {
    try {
        const { username, password } = req.body;
        
        if (!username || !password) {
            return res.status(400).json({ 
                success: false,
                error: 'BAD_REQUEST', 
                message: 'Username and password are required' 
            });
        }
        
        const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
        const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'LJM2024secure';
        
        console.log('Legacy login attempt:', { username, providedPassword: password ? '***' : 'missing', expectedUsername: ADMIN_USERNAME });
        
        if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
            // Ensure session is available
            if (!req.session) {
                console.error('Session not available - session middleware may not be configured');
                return res.status(500).json({ 
                    success: false,
                    error: 'SESSION_ERROR', 
                    message: 'Session not available. Please check server configuration.' 
                });
            }
            
            req.session.authenticated = true;
            req.session.username = username;
            console.log('Legacy login successful for user:', username);
            return res.json({ success: true, message: 'Login successful' });
        } else {
            console.log('Legacy login failed - invalid credentials');
            return res.status(401).json({ 
                success: false,
                error: 'INVALID_CREDENTIALS', 
                message: 'Invalid username or password' 
            });
        }
    } catch (error) {
        console.error('Error in legacy login endpoint:', error);
        return res.status(500).json({ 
            success: false,
            error: 'SERVER_ERROR', 
            message: 'An error occurred during login. Please try again.' 
        });
    }
});

// Admin Logout
app.get('/api/admin/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            res.status(500).json({ error: 'Logout failed' });
        } else {
            res.json({ success: true, message: 'Logged out successfully' });
        }
    });
});

// Check authentication status
app.get('/api/admin/check-auth', (req, res) => {
    if (req.session && req.session.authenticated) {
        res.json({ authenticated: true });
    } else {
        res.json({ authenticated: false });
    }
});

// Create a phone photo upload session (Admin only)
app.post('/api/admin/photo-upload-session', requireAuth, requireDB, async (req, res) => {
    try {
        const sessionId = crypto.randomBytes(16).toString('hex');
        const collection = db.collection('photo_upload_sessions');
        await collection.insertOne({
            session_id: sessionId,
            created_at: new Date(),
            photos: []
        });

        res.json({ success: true, sessionId });
    } catch (error) {
        console.error('Error creating photo upload session:', error);
        res.status(500).json({ success: false, error: 'Failed to create upload session' });
    }
});

// Get phone photo upload session details (Admin only)
app.get('/api/admin/photo-upload-session/:sessionId', requireAuth, requireDB, async (req, res) => {
    try {
        const { sessionId } = req.params;
        const collection = db.collection('photo_upload_sessions');
        const session = await collection.findOne({ session_id: sessionId });

        if (!session) {
            return res.status(404).json({ success: false, error: 'Upload session not found' });
        }

        res.json({ success: true, sessionId, photos: session.photos || [] });
    } catch (error) {
        console.error('Error fetching photo upload session:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch upload session' });
    }
});

// Upload phone photos to an existing session (Public)
app.post('/api/photo-upload/:sessionId', requireDB, (req, res, next) => {
    upload.array('photos', 5)(req, res, (err) => {
        if (err) {
            return handleMulterError(err, req, res, next);
        }
        next();
    });
}, async (req, res) => {
    try {
        const { sessionId } = req.params;
        const collection = db.collection('photo_upload_sessions');
        const session = await collection.findOne({ session_id: sessionId });

        if (!session) {
            return res.status(404).json({ success: false, error: 'Upload session not found' });
        }

        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ success: false, error: 'No photos uploaded' });
        }

        const currentUploadsDir = global.uploadsDir || uploadsDir;
        const savedPhotos = [];

        for (const file of req.files) {
            const actualSavedPath = file.path || path.join(currentUploadsDir, file.filename);
            if (fs.existsSync(actualSavedPath)) {
                savedPhotos.push(`/uploads/${file.filename}`);
            } else {
                console.warn(`⚠️  Uploaded file missing on disk: ${actualSavedPath}`);
            }
        }

        if (savedPhotos.length === 0) {
            return res.status(500).json({ success: false, error: 'Failed to persist uploaded photos' });
        }

        await collection.updateOne(
            { session_id: sessionId },
            { $push: { photos: { $each: savedPhotos } } }
        );

        res.json({ success: true, photos: savedPhotos });
    } catch (error) {
        console.error('Error uploading phone photos:', error);
        res.status(500).json({ success: false, error: 'Failed to upload photos' });
    }
});

// Add new product (Admin only) - with photo upload support
app.post('/api/admin/product', requireAuth, requireDB, (req, res, next) => {
    // Use multer middleware, but handle errors gracefully
    upload.array('photos', 5)(req, res, (err) => {
        if (err) {
            // If it's an unexpected file error and we have other data, continue
            if (err.code === 'LIMIT_UNEXPECTED_FILE' && req.body && (req.body.serial_number || req.body.security_barcode)) {
                console.log('Multer: Ignoring unexpected file field, continuing with form data');
                return next();
            }
            return handleMulterError(err, req, res, next);
        }
        next();
    });
}, async (req, res) => {
    // Multer parses FormData - text fields come through req.body
    const serial_number = req.body.serial_number;
    const security_barcode = req.body.security_barcode;
    const part_type = req.body.part_type;
    const generation = req.body.generation;
    const part_model_number = req.body.part_model_number;
    const notes = req.body.notes;
    const ebay_order_number = req.body.ebay_order_number;
    const sales_order_number = req.body.sales_order_number;
    
    // Log received data for debugging
    console.log('Received product data:', {
        serial_number: serial_number ? 'present' : 'missing',
        security_barcode: security_barcode ? 'present' : 'missing',
        part_type: part_type ? 'present' : 'missing',
        generation: generation || 'not provided',
        part_model_number: part_model_number || 'not provided',
        files_count: req.files ? req.files.length : 0
    });
    
    if (!serial_number || !security_barcode || !part_type) {
        return res.status(400).json({ 
            error: 'Serial number, security barcode, and part type are required',
            received: {
                serial_number: !!serial_number,
                security_barcode: !!security_barcode,
                part_type: !!part_type
            }
        });
    }
    
    if (!['left', 'right', 'case'].includes(part_type.toLowerCase())) {
        return res.status(400).json({ error: 'Part type must be left, right, or case' });
    }
    
    try {
        // Process uploaded photos
        const photos = [];
        if (req.files && req.files.length > 0) {
            console.log(`📸 Processing ${req.files.length} uploaded file(s)...`);
            const currentUploadsDir = global.uploadsDir || uploadsDir;
            console.log(`   Upload directory: ${currentUploadsDir}`);
            console.log(`   Global uploadsDir: ${global.uploadsDir || 'not set'}`);
            console.log(`   Local uploadsDir: ${uploadsDir}`);
            
            // Process files with retry mechanism for Railway volume async writes
            for (let index = 0; index < req.files.length; index++) {
                const file = req.files[index];
                // Multer saves files and provides the actual path in file.path
                const actualSavedPath = file.path || path.join(currentUploadsDir, file.filename);
                const expectedPath = path.join(currentUploadsDir, file.filename);
                
                console.log(`   File ${index + 1}: ${file.filename}`);
                console.log(`      Multer says saved at: ${actualSavedPath}`);
                console.log(`      Expected at: ${expectedPath}`);
                console.log(`      File size reported: ${file.size} bytes`);
                
                // Check if file exists with retry (Railway volumes may have async writes)
                // Multer may report success before file is actually synced to Railway volume
                // Railway volumes can have sync delays of 30-120+ seconds for network-mounted volumes
                let verifiedPath = null;
                const maxRetries = 60; // Very aggressive retries for Railway sync delays (60 attempts)
                const retryDelay = 2000; // Start with 2 second delay
                
                // CRITICAL: Wait longer initially - Railway volumes are network-mounted and async
                // Files may not appear in directory listings for 10-30+ seconds after Multer reports success
                console.log(`      ⏳ Waiting 3 seconds before first check (Railway volume sync delay)...`);
                await new Promise(resolve => setTimeout(resolve, 3000));
                
                for (let retry = 0; retry < maxRetries; retry++) {
                    // Check both paths
                    if (fs.existsSync(actualSavedPath)) {
                        // Verify it's actually a file and readable
                        try {
                            const stats = fs.statSync(actualSavedPath);
                            if (stats.isFile() && stats.size > 0) {
                                verifiedPath = actualSavedPath;
                                if (retry > 0) {
                                    console.log(`      ✅ Found at multer path (after ${retry} retries, ${(retry * retryDelay)}ms): ${actualSavedPath}`);
                                } else {
                                    console.log(`      ✅ Found at multer path: ${actualSavedPath}`);
                                }
                                break;
                            }
                        } catch (statErr) {
                            // File exists but can't stat it - might still be writing
                            console.log(`      ⏳ File exists but not ready (retry ${retry + 1}/${maxRetries}): ${statErr.message}`);
                        }
                    } else if (fs.existsSync(expectedPath)) {
                        try {
                            const stats = fs.statSync(expectedPath);
                            if (stats.isFile() && stats.size > 0) {
                                verifiedPath = expectedPath;
                                if (retry > 0) {
                                    console.log(`      ✅ Found at expected path (after ${retry} retries): ${expectedPath}`);
                                } else {
                                    console.log(`      ✅ Found at expected path: ${expectedPath}`);
                                }
                                break;
                            }
                        } catch (statErr) {
                            console.log(`      ⏳ File exists but not ready (retry ${retry + 1}/${maxRetries}): ${statErr.message}`);
                        }
                    }
                    
                    if (retry < maxRetries - 1) {
                        // Wait before retrying (exponential backoff with higher cap)
                        // Railway volumes may need up to 120+ seconds to sync for network-mounted volumes
                        const delay = Math.min(retryDelay * (retry + 1), 10000); // Cap at 10 seconds per retry
                        if (retry % 5 === 0) { // Log every 5th retry
                            console.log(`      ⏳ Still waiting for Railway volume sync (attempt ${retry + 1}/${maxRetries}, ${delay}ms delay)...`);
                        }
                        await new Promise(resolve => setTimeout(resolve, delay));
                    }
                }
                
                if (!verifiedPath) {
                    console.error(`      ❌ NOT FOUND after ${maxRetries} attempts!`);
                    console.error(`         Checked: ${actualSavedPath}`);
                    console.error(`         Checked: ${expectedPath}`);
                    console.error(`         Directory exists: ${fs.existsSync(currentUploadsDir)}`);
                    console.error(`         Directory writable: ${fs.constants ? 'checking...' : 'unknown'}`);
                    
                    // Try to check directory permissions
                    try {
                        fs.accessSync(currentUploadsDir, fs.constants.W_OK);
                        console.error(`         ✅ Directory is writable`);
                    } catch (permErr) {
                        console.error(`         ❌ Directory permission error: ${permErr.message}`);
                    }
                    
                    // Try to list directory contents
                    try {
                        const dirContents = fs.readdirSync(currentUploadsDir);
                        console.error(`         Directory contains ${dirContents.length} file(s):`, dirContents.slice(0, 5));
                    } catch (dirErr) {
                        console.error(`         ❌ Cannot read directory: ${dirErr.message}`);
                    }
                    
                    console.error(`         Multer file object:`, {
                        filename: file.filename,
                        path: file.path,
                        destination: file.destination,
                        size: file.size
                    });
                    
                    // IMPORTANT: Trust Multer's path if directory is writable
                    // Railway volumes may have sync delays, but Multer succeeded
                    // We'll add the file path anyway and hope it appears later
                    if (fs.existsSync(currentUploadsDir)) {
                        try {
                            fs.accessSync(currentUploadsDir, fs.constants.W_OK);
                            console.error(`      ⚠️  Trusting Multer's path despite verification failure (Railway volume sync delay?)`);
                            console.error(`      📝 Adding file path to database anyway: ${file.filename}`);
                            verifiedPath = actualSavedPath; // Trust Multer - file should appear eventually
                        } catch (permErr) {
                            console.error(`         ❌ Cannot trust Multer - directory not writable: ${permErr.message}`);
                        }
                    }
                }
                
                if (verifiedPath) {
                    try {
                        // Store relative path for serving
                        photos.push(`/uploads/${file.filename}`);
                        
                        // Try to get file stats (may fail if Railway volume hasn't synced yet)
                        try {
                            const stats = fs.statSync(verifiedPath);
                            console.log(`      ✅ Photo verified: ${(stats.size / 1024).toFixed(1)} KB`);
                            console.log(`      📍 Actual save location: ${verifiedPath}`);
                        } catch (statErr) {
                            // File path trusted but not yet synced - use Multer's reported size
                            console.log(`      ⚠️  Photo path trusted (Railway sync pending): ${file.filename}`);
                            console.log(`      📦 Multer reported size: ${(file.size / 1024).toFixed(1)} KB`);
                            console.log(`      📍 Expected location: ${verifiedPath}`);
                        }
                        
                        console.log(`      🌐 Will be served from: /uploads/${file.filename}`);
                        
                        // IMPORTANT: Ensure global.uploadsDir matches where file was actually saved
                        const actualDir = path.dirname(verifiedPath);
                        const expectedDir = path.resolve(currentUploadsDir);
                        const actualDirResolved = path.resolve(actualDir);
                        
                        if (actualDirResolved !== expectedDir) {
                            console.log(`      ⚠️  Path mismatch detected!`);
                            console.log(`         Expected dir: ${expectedDir}`);
                            console.log(`         Actual dir: ${actualDirResolved}`);
                            console.log(`      🔧 Updating global.uploadsDir to match actual save location`);
                            global.uploadsDir = actualDir;
                            global.uploadsDirAbsolute = actualDirResolved;
                        }
                    } catch (err) {
                        console.error(`      ❌ Error processing file: ${err.message}`);
                    }
                }
            }
            console.log(`📸 Total photos processed: ${photos.length}/${req.files.length}`);
        }
        
        const product = {
            serial_number: serial_number.trim(),
            security_barcode: security_barcode.trim().toUpperCase(), // Store in uppercase
            part_type: part_type.toLowerCase(),
            generation: generation ? generation.trim() : null,
            part_model_number: part_model_number ? part_model_number.trim() : null,
            notes: notes ? notes.trim() : null,
            ebay_order_number: ebay_order_number ? ebay_order_number.trim() : null,
            sales_order_number: sales_order_number ? sales_order_number.trim() : null,
            photos: photos, // Array of photo paths
            tracking_number: null,
            tracking_date: null,
            date_added: new Date(),
            confirmation_checked: false,
            confirmation_date: null
        };
        
        const result = await db.collection('products').insertOne(product);
        console.log('Product added successfully, ID:', result.insertedId.toString());
        res.json({ 
            success: true, 
            message: 'Product added successfully',
            id: result.insertedId.toString()
        });
    } catch (err) {
        if (err.code === 11000) { // MongoDB duplicate key error
            res.status(409).json({ error: 'Security barcode already exists' });
        } else {
            console.error('Database error:', err);
            res.status(500).json({ error: 'Database error: ' + err.message });
        }
    }
});

// Get all products (Admin only, paginated)
app.get('/api/admin/products', requireAuth, requireDB, async (req, res) => {
    console.log('[PRODUCTS] Request received - limit:', req.query.limit, 'offset:', req.query.offset);
    console.log('[PRODUCTS] User:', req.user?.email || 'no user data');

    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;

    try {
        const products = await db.collection('products')
            .find({})
            .sort({ date_added: -1 })
            .limit(limit)
            .skip(offset)
            .toArray();

        const total = await db.collection('products').countDocuments();
        console.log(`[PRODUCTS] ✅ Found ${products.length} products (total: ${total})`);
        
        // Get warranties for all products
        // Build a flat array of all possible barcode matches (handling hyphen variations)
        const warrantyConditions = [];
        products.forEach(product => {
            // Skip products without security_barcode
            if (!product.security_barcode) {
                return;
            }
            
            const normalized = normalizeSecurityBarcode(product.security_barcode);
            const original = product.security_barcode.trim().toUpperCase();
            
            // Add exact matches
            warrantyConditions.push({ security_barcode: original });
            warrantyConditions.push({ security_barcode: normalized });
            
            // Add regex pattern for hyphen variations
            if (normalized) {
                const regexPattern = '^' + normalized.split('').join('[-]?') + '$';
                warrantyConditions.push({ security_barcode: { $regex: regexPattern, $options: 'i' } });
            }
        });
        
        // Fetch warranties using $or with all conditions
        const allWarranties = warrantyConditions.length > 0
            ? await db.collection('warranties').find({ $or: warrantyConditions }).toArray()
            : [];
        
        // Create a map of normalized security_barcode -> warranty for quick lookup
        const warrantyMap = {};
        allWarranties.forEach(warranty => {
            // Normalize both product and warranty barcodes for matching
            const warrantyBarcodeNormalized = normalizeSecurityBarcode(warranty.security_barcode);
            warrantyMap[warrantyBarcodeNormalized] = warranty;
            // Also store with original barcode for exact matches
            warrantyMap[warranty.security_barcode] = warranty;
        });
        
        // Convert MongoDB ObjectId to string for JSON response and add warranty info
        const productsWithStringIds = products.map(product => {
            // Try to find warranty by exact match or normalized barcode
            const productBarcodeNormalized = normalizeSecurityBarcode(product.security_barcode);
            const warranty = warrantyMap[product.security_barcode] || warrantyMap[productBarcodeNormalized];
            
            const productData = {
                ...product,
                id: product._id.toString(),
                _id: undefined
            };
            
            // Add warranty information
            if (warranty) {
                productData.warranty = {
                    warranty_id: warranty.warranty_id,
                    status: warranty.status || 'active',
                    payment_status: warranty.payment_status || 'free',
                    standard_warranty_end: warranty.standard_warranty_end,
                    extended_warranty_end: warranty.extended_warranty_end,
                    extended_warranty: warranty.extended_warranty || 'none'
                };
            }
            
            return productData;
        });
        
        res.json({ products: productsWithStringIds, total });
    } catch (err) {
        console.error('Database error:', err);
        res.status(500).json({ error: 'Database error: ' + err.message });
    }
});

// Update product (Admin only)
app.put('/api/admin/product/:id', requireAuth, requireDB, (req, res, next) => {
    // Use multer middleware for file uploads (optional)
    upload.array('photos', 5)(req, res, (err) => {
        if (err) {
            if (err.code === 'LIMIT_UNEXPECTED_FILE' && req.body && (req.body.serial_number || req.body.security_barcode)) {
                console.log('Multer: Ignoring unexpected file field, continuing with form data');
                return next();
            }
            return handleMulterError(err, req, res, next);
        }
        next();
    });
}, async (req, res) => {
    const id = req.params.id;
    
    if (!ObjectId.isValid(id)) {
        return res.status(400).json({ error: 'Invalid product ID' });
    }
    
    const serial_number = req.body.serial_number;
    const security_barcode = req.body.security_barcode;
    const part_type = req.body.part_type;
    const generation = req.body.generation;
    const part_model_number = req.body.part_model_number;
    const notes = req.body.notes;
    const ebay_order_number = req.body.ebay_order_number;
    const sales_order_number = req.body.sales_order_number;
    
    if (!serial_number || !security_barcode || !part_type) {
        return res.status(400).json({ 
            error: 'Serial number, security barcode, and part type are required'
        });
    }
    
    if (!['left', 'right', 'case'].includes(part_type.toLowerCase())) {
        return res.status(400).json({ error: 'Part type must be left, right, or case' });
    }
    
    try {
        // Process uploaded photos if any
        let photosUpdate = {};
        if (req.files && req.files.length > 0) {
            console.log(`📸 Processing ${req.files.length} uploaded file(s) for update...`);
            const currentUploadsDir = global.uploadsDir || uploadsDir;
            console.log(`   Upload directory: ${currentUploadsDir}`);
            
            const verifiedPhotos = [];
            req.files.forEach((file, index) => {
                // Verify file was actually saved
                const actualSavedPath = file.path || path.join(currentUploadsDir, file.filename);
                const expectedPath = path.join(currentUploadsDir, file.filename);
                
                console.log(`   File ${index + 1}: ${file.filename}`);
                console.log(`      Multer says saved at: ${actualSavedPath}`);
                console.log(`      Expected at: ${expectedPath}`);
                
                // Check both paths
                let verifiedPath = null;
                if (fs.existsSync(actualSavedPath)) {
                    verifiedPath = actualSavedPath;
                    console.log(`      ✅ Found at multer path: ${actualSavedPath}`);
                } else if (fs.existsSync(expectedPath)) {
                    verifiedPath = expectedPath;
                    console.log(`      ✅ Found at expected path: ${expectedPath}`);
                } else {
                    console.error(`      ❌ NOT FOUND at either location!`);
                    console.error(`         Checked: ${actualSavedPath}`);
                    console.error(`         Checked: ${expectedPath}`);
                }
                
                if (verifiedPath) {
                    verifiedPhotos.push(`/uploads/${file.filename}`);
                    const stats = fs.statSync(verifiedPath);
                    console.log(`      ✅ Photo verified: ${(stats.size / 1024).toFixed(1)} KB`);
                    console.log(`      📍 Actual save location: ${verifiedPath}`);
                    
                    // Update global.uploadsDir if path mismatch
                    const actualDir = path.dirname(verifiedPath);
                    const expectedDir = path.resolve(currentUploadsDir);
                    const actualDirResolved = path.resolve(actualDir);
                    
                    if (actualDirResolved !== expectedDir) {
                        console.log(`      ⚠️  Path mismatch! Updating global.uploadsDir`);
                        global.uploadsDir = actualDir;
                        global.uploadsDirAbsolute = actualDirResolved;
                    }
                } else {
                    console.error(`      ❌ Skipping file - not found on disk`);
                }
            });
            
            console.log(`📸 Total photos verified: ${verifiedPhotos.length}/${req.files.length}`);
            
            // Get existing photos and append new verified ones
            const existingProduct = await db.collection('products').findOne({ _id: new ObjectId(id) });
            const existingPhotos = existingProduct ? (existingProduct.photos || []) : [];
            photosUpdate.photos = [...existingPhotos, ...verifiedPhotos];
        }
        
        const updateData = {
            serial_number: serial_number.trim(),
            security_barcode: security_barcode.trim().toUpperCase(), // Store in uppercase
            part_type: part_type.toLowerCase(),
            generation: generation ? generation.trim() : null,
            part_model_number: part_model_number ? part_model_number.trim() : null,
            notes: notes ? notes.trim() : null,
            ebay_order_number: ebay_order_number ? ebay_order_number.trim() : null,
            sales_order_number: sales_order_number ? sales_order_number.trim() : null,
            ...photosUpdate
            // Note: tracking_number and tracking_date are updated via separate endpoint
        };
        
        const result = await db.collection('products').updateOne(
            { _id: new ObjectId(id) },
            { $set: updateData }
        );
        
        if (result.matchedCount === 0) {
            res.status(404).json({ error: 'Product not found' });
        } else {
            console.log('Product updated successfully, ID:', id);
            res.json({ success: true, message: 'Product updated successfully' });
        }
    } catch (err) {
        console.error('Database error:', err);
        res.status(500).json({ error: 'Database error: ' + err.message });
    }
});

// Update tracking information for a product (Admin only)
app.put('/api/admin/product/:id/tracking', requireAuth, requireDB, async (req, res) => {
    const id = req.params.id;
    
    if (!ObjectId.isValid(id)) {
        return res.status(400).json({ error: 'Invalid product ID' });
    }
    
    const tracking_number = req.body.tracking_number ? req.body.tracking_number.trim() : null;
    
    try {
        const updateData = {
            tracking_number: tracking_number,
            tracking_date: tracking_number ? new Date() : null
        };
        
        const result = await db.collection('products').updateOne(
            { _id: new ObjectId(id) },
            { $set: updateData }
        );
        
        if (result.matchedCount === 0) {
            res.status(404).json({ error: 'Product not found' });
        } else {
            console.log('Tracking updated successfully, ID:', id, 'Tracking:', tracking_number);
            res.json({ success: true, message: 'Tracking information updated successfully' });
        }
    } catch (err) {
        console.error('Database error:', err);
        res.status(500).json({ error: 'Database error: ' + err.message });
    }
});

// Update eBay order number (Admin only)
app.put('/api/admin/product/:id/ebay-order', requireAuth, requireDB, async (req, res) => {
    const id = req.params.id;
    
    if (!ObjectId.isValid(id)) {
        return res.status(400).json({ error: 'Invalid product ID' });
    }
    
    const ebay_order_number = req.body.ebay_order_number ? req.body.ebay_order_number.trim() : null;
    
    try {
        const updateData = {
            ebay_order_number: ebay_order_number
        };
        
        const result = await db.collection('products').updateOne(
            { _id: new ObjectId(id) },
            { $set: updateData }
        );
        
        if (result.matchedCount === 0) {
            res.status(404).json({ error: 'Product not found' });
        } else {
            console.log('eBay order number updated successfully, ID:', id, 'Order:', ebay_order_number);
            res.json({ success: true, message: 'eBay order number updated successfully' });
        }
    } catch (err) {
        console.error('Database error:', err);
        res.status(500).json({ error: 'Database error: ' + err.message });
    }
});

// Update sales order number (Admin only)
app.put('/api/admin/product/:id/sales-order', requireAuth, requireDB, async (req, res) => {
    const id = req.params.id;
    
    if (!ObjectId.isValid(id)) {
        return res.status(400).json({ error: 'Invalid product ID' });
    }
    
    const sales_order_number = req.body.sales_order_number ? req.body.sales_order_number.trim() : null;
    
    try {
        const updateData = {
            sales_order_number: sales_order_number
        };
        
        const result = await db.collection('products').updateOne(
            { _id: new ObjectId(id) },
            { $set: updateData }
        );
        
        if (result.matchedCount === 0) {
            res.status(404).json({ error: 'Product not found' });
        } else {
            console.log('Sales order number updated successfully, ID:', id, 'Order:', sales_order_number);
            res.json({ success: true, message: 'Sales order number updated successfully' });
        }
    } catch (err) {
        console.error('Database error:', err);
        res.status(500).json({ error: 'Database error: ' + err.message });
    }
});

// ===== PURCHASES MANAGEMENT API ENDPOINTS =====

// Get all purchases (Admin only)
app.get('/api/admin/purchases', requireAuth, requireDB, async (req, res) => {
    try {
        const purchases = await db.collection('purchases').find({}).sort({ purchase_date: -1 }).toArray();
        res.json({ success: true, purchases });
    } catch (err) {
        console.error('Database error:', err);
        res.status(500).json({ error: 'Database error: ' + err.message });
    }
});

// Add new purchase (Admin only)
app.post('/api/admin/purchases', requireAuth, requireDB, async (req, res) => {
    try {
        const {
            platform,
            order_number,
            seller_name,
            purchase_date,
            generation,
            connector_type,
            anc_type,
            items_purchased,
            quantity,
            purchase_price,
            condition,
            status,
            feedback_left,
            expected_delivery,
            tracking_provider,
            tracking_number,
            serial_numbers,
            notes
        } = req.body;
        
        // Validation
        if (!platform || !order_number || !seller_name || !purchase_date || !generation || !items_purchased || !Array.isArray(items_purchased) || items_purchased.length === 0 || !quantity || purchase_price === undefined || !status) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        
        const purchase = {
            platform,
            order_number,
            seller_name,
            purchase_date: new Date(purchase_date),
            generation,
            connector_type: connector_type || null, // usb-c or lightning (for Pro 2nd Gen)
            anc_type: anc_type || null, // anc or non-anc (for 4th Gen)
            items_purchased: items_purchased, // Array of items: case, left, right, box, ear_tips, cable, protective_case
            quantity: parseInt(quantity),
            purchase_price: parseFloat(purchase_price),
            condition: condition || 'good',
            status: status, // paid, awaiting_despatch, awaiting_delivery, delivered, awaiting_return, returned, refunded
            feedback_left: feedback_left === true,
            expected_delivery: expected_delivery ? new Date(expected_delivery) : null,
            tracking_provider: tracking_provider || null,
            tracking_number: tracking_number ? tracking_number.trim().toUpperCase() : null,
            serial_numbers: serial_numbers || [],
            notes: notes || '',
            date_added: new Date()
        };
        
        const result = await db.collection('purchases').insertOne(purchase);
        
        console.log('Purchase added successfully, ID:', result.insertedId);
        res.json({ success: true, message: 'Purchase added successfully', id: result.insertedId });
    } catch (err) {
        console.error('Database error:', err);
        res.status(500).json({ error: 'Database error: ' + err.message });
    }
});

// Get single purchase (Admin only)
app.get('/api/admin/purchases/:id', requireAuth, requireDB, async (req, res) => {
    const id = req.params.id;
    
    if (!ObjectId.isValid(id)) {
        return res.status(400).json({ error: 'Invalid purchase ID' });
    }
    
    try {
        const purchase = await db.collection('purchases').findOne({ _id: new ObjectId(id) });
        
        if (!purchase) {
            return res.status(404).json({ error: 'Purchase not found' });
        }
        
        res.json({ success: true, purchase });
    } catch (err) {
        console.error('Database error:', err);
        res.status(500).json({ error: 'Database error: ' + err.message });
    }
});

// Get purchase by tracking number (Admin only)
app.get('/api/admin/purchases/by-tracking/:trackingNumber', requireAuth, requireDB, async (req, res) => {
    const trackingNumber = req.params.trackingNumber;
    
    if (!trackingNumber) {
        return res.status(400).json({ error: 'Tracking number is required' });
    }
    
    try {
        // Search case-insensitively
        const purchase = await db.collection('purchases').findOne({ 
            tracking_number: { $regex: new RegExp(`^${trackingNumber.trim()}$`, 'i') }
        });
        
        if (!purchase) {
            return res.status(404).json({ error: 'No purchase found with this tracking number' });
        }
        
        res.json({ success: true, purchase });
    } catch (err) {
        console.error('Database error:', err);
        res.status(500).json({ error: 'Database error: ' + err.message });
    }
});

// Helper function to get display name for item type
function getItemDisplayName(itemType) {
    const names = {
        'case': 'Case',
        'left': 'Left AirPod',
        'right': 'Right AirPod',
        'box': 'Box',
        'ear_tips': 'Ear Tips',
        'cable': 'Cable',
        'protective_case': 'Protective Case'
    };
    return names[itemType] || itemType;
}

// Get part number from airpod_parts collection
async function getPartNumber(generation, itemType, connectorType = null, ancType = null) {
    try {
        console.log(`[PART LOOKUP] Searching for: generation="${generation}", itemType="${itemType}", connector="${connectorType}", anc="${ancType}"`);
        
        // Build query - try exact match first
        let query = {
            generation: generation,
            part_type: itemType
        };
        
        // Find matching part - prioritize based on connector/ANC type if provided
        let parts = await db.collection('airpod_parts').find(query).toArray();
        
        // If no exact match, try case-insensitive regex
        if (parts.length === 0) {
            console.log(`[PART LOOKUP] No exact match, trying case-insensitive search...`);
            query = {
                generation: { $regex: new RegExp(`^${generation.replace(/[()]/g, '\\$&')}$`, 'i') },
                part_type: itemType
            };
            parts = await db.collection('airpod_parts').find(query).toArray();
        }
        
        if (parts.length === 0) {
            console.log(`[PART LOOKUP] ❌ No part found for ${generation} ${itemType}`);
            // Log all available generations for debugging
            const allGenerations = await db.collection('airpod_parts').distinct('generation');
            console.log(`[PART LOOKUP] Available generations:`, allGenerations);
            return null;
        }
        
        console.log(`[PART LOOKUP] ✅ Found ${parts.length} matching part(s)`);
        
        // If multiple parts, try to match by connector type or ANC type
        if (parts.length > 1) {
            // For Pro 2nd Gen, match by connector type
            if (connectorType) {
                const matchingPart = parts.find(p => 
                    (connectorType === 'USB-C' && (p.part_name.includes('USB-C') || p.part_model_number.includes('A2700') || p.part_model_number.includes('A2968') || p.part_model_number.includes('A3048') || p.part_model_number.includes('A3047'))) ||
                    (connectorType === 'Lightning' && (p.part_name.includes('Lightning') || p.part_model_number.includes('A2698') || p.part_model_number.includes('A2699')))
                );
                if (matchingPart) {
                    console.log(`[PART LOOKUP] ✅ Found ${matchingPart.part_model_number} for ${generation} ${itemType} (${connectorType})`);
                    return matchingPart.part_model_number;
                }
            }
            
            // Return first part as default
            console.log(`[PART LOOKUP] Multiple parts found, using first: ${parts[0].part_model_number}`);
            return parts[0].part_model_number;
        }
        
        console.log(`[PART LOOKUP] ✅ Found ${parts[0].part_model_number} for ${generation} ${itemType}`);
        return parts[0].part_model_number;
    } catch (err) {
        console.error(`[PART LOOKUP] ❌ Error looking up part number:`, err);
        return null;
    }
}

// Generate email template for seller contact
function generateSellerEmail(purchase, checkIn) {
    const issues = checkIn.issues_detected || [];
    
    if (issues.length === 0) {
        return null;
    }
    
    // Analyze issue types
    const hasCriticalIssues = issues.some(item => 
        item.issues.some(issue => issue.severity === 'critical')
    );
    
    const hasAuthenticityIssues = issues.some(item =>
        item.issues.some(issue => issue.type === 'authenticity')
    );
    
    const hasAudibleIssues = issues.some(item =>
        item.issues.some(issue => issue.type === 'audible')
    );
    
    const hasConnectivityIssues = issues.some(item =>
        item.issues.some(issue => issue.type === 'connectivity')
    );
    
    const hasConditionIssues = issues.some(item =>
        item.issues.some(issue => issue.type === 'condition')
    );
    
    // Build email content
    let emailBody = 'Hi,\n\n';
    emailBody += 'Thank you for sending ';
    emailBody += issues.length === 1 ? 'this' : 'these';
    emailBody += ' over. ';
    
    // Visual condition assessment
    const hasGoodVisualCondition = checkIn.items.some(item => 
        ['new', 'like_new', 'excellent', 'good'].includes(item.condition)
    );
    
    if (hasGoodVisualCondition && !hasConditionIssues) {
        emailBody += 'Visually, ';
        const allGoodCondition = checkIn.items.every(item =>
            ['new', 'like_new', 'excellent'].includes(item.condition)
        );
        if (issues.length === 1) {
            emailBody += 'it is in ' + (allGoodCondition ? 'immaculate' : 'good') + ' condition. ';
        } else {
            emailBody += 'they are in ' + (allGoodCondition ? 'immaculate' : 'good') + ' condition. ';
        }
    }
    
    // Main issue statement - make it specific to the item(s)
    if (issues.length === 1) {
        const item = issues[0];
        const itemType = item.item_type;
        emailBody += `Unfortunately, we are experiencing an issue with the ${item.item_name.toLowerCase()}. `;
        
        // Describe specific issue contextually
        const issue = item.issues[0];
        
        if (issue.type === 'audible' && issue.severity === 'critical') {
            if (itemType === 'case') {
                emailBody += 'The charging case is not functioning correctly.\n\n';
            } else {
                emailBody += 'Although it shows as connected, there is no audible sound coming from it.\n\n';
            }
        } else if (issue.type === 'audible') {
            emailBody += `The sound quality is ${issue.description.includes('poor') ? 'poor' : 'not as expected'}.\n\n`;
        } else if (issue.type === 'connectivity') {
            if (itemType === 'case') {
                emailBody += 'The case is not pairing or connecting correctly to devices.\n\n';
            } else {
                emailBody += `The ${item.item_name.toLowerCase()} has connectivity issues and won't pair correctly.\n\n`;
            }
        } else if (issue.type === 'authenticity') {
            emailBody += 'Based on our detailed inspection, we have concerns about the authenticity of this item.\n\n';
        } else if (issue.type === 'condition') {
            emailBody += `The visual condition is worse than described in the listing (${issue.description.toLowerCase()}).\n\n`;
        }
    } else {
        // Multiple items with issues
        emailBody += 'Unfortunately, we are experiencing issues with the following items:\n\n';
        
        issues.forEach(item => {
            emailBody += `• **${item.item_name}**: `;
            
            const descriptions = item.issues.map(issue => {
                if (issue.type === 'audible' && issue.severity === 'critical') {
                    return 'no audible sound';
                } else if (issue.type === 'audible') {
                    return 'poor sound quality';
                } else if (issue.type === 'connectivity') {
                    return 'connectivity/pairing problems';
                } else if (issue.type === 'authenticity') {
                    return 'authenticity concerns';
                } else if (issue.type === 'condition') {
                    return 'condition worse than described';
                }
                return issue.description;
            });
            
            emailBody += descriptions.join(', ');
            emailBody += '\n';
        });
        emailBody += '\n';
    }
    
    // Troubleshooting steps taken
    if (hasAudibleIssues || hasConnectivityIssues) {
        emailBody += 'We have carried out a full reset in line with Apple\'s guidance';
        
        if (hasConnectivityIssues && !hasAuthenticityIssues) {
            emailBody += ', however this has not resolved the issue. We have also noticed that the Apple pairing animation does not always appear, which can sometimes be an indicator of counterfeit items. That said, based on our visual inspection and experience, we are confident these are genuine and believe this may instead be a software-related issue.\n\n';
        } else {
            emailBody += ', however this has not resolved the ';
            emailBody += issues.length === 1 ? 'issue' : 'issues';
            emailBody += '.\n\n';
        }
    }
    
    // Expertise statement
    if (hasAuthenticityIssues) {
        emailBody += 'To be completely transparent, we purchase AirPods for resale and have extensive experience with genuine Apple products. We have carried out a thorough inspection and unfortunately have significant concerns about authenticity.\n\n';
    } else {
        emailBody += 'To be completely open, we purchase AirPods for resale and have extensive experience diagnosing faults. ';
        
        if (hasCriticalIssues) {
            emailBody += 'In all honesty, this ';
            emailBody += issues.length > 1 ? 'combination of issues is' : 'particular issue is';
            emailBody += ' something we rarely encounter';
            emailBody += issues.length === 1 ? ' and is the first time we\'ve seen this specific problem' : '';
            emailBody += '.\n\n';
        } else {
            emailBody += '\n\n';
        }
    }
    
    // Resolution options
    if (hasAuthenticityIssues) {
        emailBody += 'Given the authenticity concerns, we would need to return the item for a full refund.\n\n';
    } else {
        emailBody += 'We will continue to try to resolve ';
        emailBody += issues.length === 1 ? 'it' : 'these issues';
        emailBody += ', as our preference is always to get items fully working. However, if this proves unsuccessful, we would like to propose one of the following options:\n\n';
        
        // Calculate partial refund amount (only count actual AirPod parts, not accessories)
        const totalPrice = parseFloat(purchase.purchase_price) || 0;
        
        // Count only AirPod parts (case, left, right) from items_purchased
        const airpodParts = purchase.items_purchased ? 
            purchase.items_purchased.filter(item => ['case', 'left', 'right'].includes(item)).length : 3;
        
        const affectedItemCount = issues.length;
        const partialRefundAmount = (totalPrice * affectedItemCount / airpodParts).toFixed(2);
        
        emailBody += `• Return the full set for a full refund\n`;
        emailBody += `• Keep the `;
        emailBody += issues.length === 1 ? 'item' : 'items';
        emailBody += ` and receive a partial refund of £${partialRefundAmount}, reflecting the `;
        
        if (affectedItemCount === 1) {
            const itemName = issues[0].item_name.toLowerCase();
            emailBody += `non-functioning ${itemName}`;
        } else {
            emailBody += affectedItemCount + ' non-functioning items';
        }
        emailBody += '\n\n';
    }
    
    emailBody += 'Please let us know how you would like to proceed.\n\n';
    emailBody += 'Kind regards,\n';
    emailBody += 'LJMUK';
    
    return emailBody;
}

// Check-in a purchase (Admin only)
app.post('/api/admin/check-in', requireAuth, requireDB, async (req, res) => {
    try {
        const {
            purchase_id,
            tracking_number,
            items
        } = req.body;
        
        // Validation
        if (!purchase_id || !items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        
        if (!ObjectId.isValid(purchase_id)) {
            return res.status(400).json({ error: 'Invalid purchase ID' });
        }
        
        // Analyze items for issues
        console.log('[CHECK-IN] Analyzing items for issues:', JSON.stringify(items, null, 2));
        const issues = [];
        items.forEach(item => {
            console.log(`[CHECK-IN] Checking item: ${item.item_type}`);
            console.log(`  - is_genuine: ${item.is_genuine}`);
            console.log(`  - condition: ${item.condition}`);
            console.log(`  - audible_condition: ${item.audible_condition}`);
            console.log(`  - connects_correctly: ${item.connects_correctly}`);
            
            const itemIssues = [];
            
            // Check if not genuine
            if (item.is_genuine === false) {
                console.log(`  ✗ Issue detected: Not genuine`);
                itemIssues.push({
                    type: 'authenticity',
                    severity: 'critical',
                    description: 'Item appears to be counterfeit or not genuine'
                });
            }
            
            // Check visual condition issues (fair or poor)
            if (['fair', 'poor'].includes(item.condition)) {
                console.log(`  ✗ Issue detected: Visual condition ${item.condition}`);
                itemIssues.push({
                    type: 'condition',
                    severity: item.condition === 'poor' ? 'high' : 'medium',
                    description: `Visual condition is ${item.condition}`
                });
            }
            
            // Check audible condition issues (only for left/right AirPods)
            if (['left', 'right'].includes(item.item_type) && item.audible_condition) {
                console.log(`  - Checking audible condition: ${item.audible_condition}`);
                if (['poor', 'not_working'].includes(item.audible_condition)) {
                    console.log(`  ✗ Issue detected: Audible condition ${item.audible_condition}`);
                    itemIssues.push({
                        type: 'audible',
                        severity: item.audible_condition === 'not_working' ? 'critical' : 'high',
                        description: item.audible_condition === 'not_working' 
                            ? 'No audible sound - item not working'
                            : `Poor sound quality - audible condition is ${item.audible_condition}`
                    });
                } else if (item.audible_condition === 'fair') {
                    console.log(`  ✗ Issue detected: Audible condition fair`);
                    itemIssues.push({
                        type: 'audible',
                        severity: 'medium',
                        description: 'Fair sound quality - audible condition is fair'
                    });
                }
            }
            
            // Check connectivity issues
            if (item.connects_correctly === false) {
                console.log(`  ✗ Issue detected: Connectivity problem`);
                itemIssues.push({
                    type: 'connectivity',
                    severity: 'high',
                    description: 'Item has connectivity/pairing issues'
                });
            }
            
            if (itemIssues.length > 0) {
                console.log(`  Total issues for ${item.item_type}: ${itemIssues.length}`);
                issues.push({
                    item_type: item.item_type,
                    item_name: getItemDisplayName(item.item_type),
                    issues: itemIssues
                });
            } else {
                console.log(`  ✓ No issues detected for ${item.item_type}`);
            }
        });
        
        console.log(`[CHECK-IN] Total items with issues: ${issues.length}`);
        
        const checkInRecord = {
            purchase_id: new ObjectId(purchase_id),
            tracking_number: tracking_number || null,
            items: items.map(item => ({
                item_type: item.item_type,
                is_genuine: item.is_genuine === true,
                condition: item.condition,
                serial_number: item.serial_number || null,
                audible_condition: item.audible_condition || null,
                connects_correctly: item.connects_correctly !== undefined ? item.connects_correctly : null
            })),
            issues_detected: issues,
            has_issues: issues.length > 0,
            checked_in_by: req.user.email,
            checked_in_at: new Date()
        };
        
        const result = await db.collection('check_ins').insertOne(checkInRecord);
        
        // Update purchase status based on issues
        const purchaseUpdate = {
            checked_in: true,
            checked_in_date: new Date()
        };
        
        if (issues.length > 0) {
            // Set to on_hold if issues detected
            purchaseUpdate.status = 'on_hold';
            purchaseUpdate.requires_seller_contact = true;
        } else {
            // Set to delivered if no issues
            purchaseUpdate.status = 'delivered';
        }
        
        await db.collection('purchases').updateOne(
            { _id: new ObjectId(purchase_id) },
            { $set: purchaseUpdate }
        );
        
        console.log('Check-in completed successfully, ID:', result.insertedId, 'Issues found:', issues.length);
        res.json({ 
            success: true, 
            message: 'Check-in completed successfully', 
            id: result.insertedId,
            issues_found: issues
        });
    } catch (err) {
        console.error('Database error:', err);
        res.status(500).json({ error: 'Database error: ' + err.message });
    }
});

// Get all tasks/to-dos (Admin only)
app.get('/api/admin/tasks', requireAuth, requireDB, async (req, res) => {
    try {
        const tasks = [];
        const now = new Date();
        
        // 1. Find check-ins with pending and completed workflow steps
        const checkInsWithIssues = await db.collection('check_ins').find({
            has_issues: true,
            email_sent_at: { $exists: true }
        }).toArray();
        
        for (const checkIn of checkInsWithIssues) {
            const workflow = checkIn.resolution_workflow || {};
            const emailSentDate = new Date(checkIn.email_sent_at);
            const hoursSinceEmail = (now - emailSentDate) / (1000 * 60 * 60);
            
            // Get purchase info
            const purchase = await db.collection('purchases').findOne({
                _id: new ObjectId(checkIn.purchase_id)
            });
            
            if (!purchase) continue;
            
            // Task 1: Follow-up (due after 48 hours)
            const followUpDue = new Date(emailSentDate.getTime() + (48 * 60 * 60 * 1000));
            const followUpIsOverdue = now > followUpDue;
            const followUpDueSoon = hoursSinceEmail > 36 && hoursSinceEmail < 48;
            const followUpCompleted = !!workflow.follow_up_sent_at || !!workflow.resolved_at;
            
            tasks.push({
                id: checkIn._id.toString(),
                check_in_id: checkIn._id.toString(),
                purchase_id: purchase._id.toString(),
                type: 'workflow_follow_up',
                title: 'Send Follow-Up Message',
                description: `Follow up with seller about ${purchase.generation || 'AirPods'} issue (Tracking: ${checkIn.tracking_number || purchase.tracking_number || 'N/A'})`,
                due_date: followUpDue,
                is_overdue: followUpCompleted ? false : followUpIsOverdue,
                due_soon: followUpCompleted ? false : followUpDueSoon,
                tracking_number: checkIn.tracking_number || purchase.tracking_number,
                seller: purchase.seller_name,
                issue_summary: checkIn.issues_detected ? checkIn.issues_detected.map(i => i.item_name).join(', ') : 'Issues detected',
                completed: followUpCompleted,
                completed_at: workflow.follow_up_sent_at || workflow.resolved_at
            });
            
            // Task 2: Open case (due after 72 hours)
            const caseOpenDue = new Date(emailSentDate.getTime() + (72 * 60 * 60 * 1000));
            const caseIsOverdue = now > caseOpenDue;
            const caseDueSoon = hoursSinceEmail > 60 && hoursSinceEmail < 72;
            const caseCompleted = !!workflow.case_opened_at || !!workflow.resolved_at;
            
            tasks.push({
                id: checkIn._id.toString() + '_case',
                check_in_id: checkIn._id.toString(),
                purchase_id: purchase._id.toString(),
                type: 'workflow_case_open',
                title: 'Open eBay Case',
                description: `Ready to open "Item not as described" case for ${purchase.generation || 'AirPods'} (Tracking: ${checkIn.tracking_number || purchase.tracking_number || 'N/A'})`,
                due_date: caseOpenDue,
                is_overdue: caseCompleted ? false : caseIsOverdue,
                due_soon: caseCompleted ? false : caseDueSoon,
                tracking_number: checkIn.tracking_number || purchase.tracking_number,
                seller: purchase.seller_name,
                follow_up_sent: !!workflow.follow_up_sent_at,
                issue_summary: checkIn.issues_detected ? checkIn.issues_detected.map(i => i.item_name).join(', ') : 'Issues detected',
                completed: caseCompleted,
                completed_at: workflow.case_opened_at || workflow.resolved_at
            });
        }
        
        // 2. Find purchases with overdue deliveries
        const purchasesAwaitingDelivery = await db.collection('purchases').find({
            status: { $in: ['awaiting_delivery', 'dispatched'] },
            expected_delivery: { $exists: true, $ne: null },
            checked_in: { $ne: true }
        }).toArray();
        
        for (const purchase of purchasesAwaitingDelivery) {
            const expectedDelivery = new Date(purchase.expected_delivery);
            const isOverdue = now > expectedDelivery;
            
            if (isOverdue) {
                const daysOverdue = Math.floor((now - expectedDelivery) / (1000 * 60 * 60 * 24));
                
                tasks.push({
                    id: purchase._id.toString() + '_delivery',
                    purchase_id: purchase._id.toString(),
                    type: 'delivery_overdue',
                    title: 'Chase Overdue Delivery',
                    description: `${purchase.generation || 'AirPods'} delivery overdue by ${daysOverdue} day${daysOverdue !== 1 ? 's' : ''} (Tracking: ${purchase.tracking_number || 'N/A'})`,
                    due_date: expectedDelivery,
                    is_overdue: true,
                    due_soon: false,
                    tracking_number: purchase.tracking_number,
                    seller: purchase.seller_name,
                    days_overdue: daysOverdue,
                    expected_delivery_formatted: expectedDelivery.toLocaleDateString('en-GB', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric'
                    })
                });
            }
        }
        
        // 3. Find purchases where feedback hasn't been left yet (after check-in)
        const purchasesNeedingFeedback = await db.collection('purchases').find({
            checked_in: true,
            $or: [
                { feedback_left: false },
                { feedback_left: { $exists: false } },
                { feedback_left: null }
            ]
        }).toArray();
        
        for (const purchase of purchasesNeedingFeedback) {
            // Calculate days since checked in
            const daysSinceCheckIn = purchase.checked_in_date ? (now - new Date(purchase.checked_in_date)) / (1000 * 60 * 60 * 24) : 0;
            const isOverdue = daysSinceCheckIn > 3; // Overdue after 3 days
            const dueSoon = daysSinceCheckIn > 1 && daysSinceCheckIn <= 3; // Due soon if 1-3 days
            
            tasks.push({
                id: `feedback-${purchase._id.toString()}`,
                purchase_id: purchase._id.toString(),
                type: 'leave_feedback',
                title: 'Leave feedback for seller',
                description: `${purchase.generation || 'AirPods'} from ${purchase.seller_name || 'seller'} (Order: ${purchase.order_number || 'N/A'})`,
                due_date: purchase.checked_in_date ? new Date(new Date(purchase.checked_in_date).getTime() + (3 * 24 * 60 * 60 * 1000)) : new Date(),
                is_overdue: isOverdue,
                due_soon: dueSoon,
                seller: purchase.seller_name,
                order_number: purchase.order_number,
                tracking_number: purchase.tracking_number,
                generation: purchase.generation,
                items_purchased: purchase.items_purchased,
                completed: false,
                priority: isOverdue ? 'high' : (dueSoon ? 'medium' : 'normal')
            });
        }
        
        // 4. Find products missing photos or security barcode
        const productsNeedingAttention = await db.collection('products').find({
            $or: [
                { photos: { $exists: false } },
                { photos: { $size: 0 } },
                { photos: null },
                { security_barcode: { $exists: false } },
                { security_barcode: null },
                { security_barcode: '' }
            ],
            status: { $ne: 'sold' } // Only for items not yet sold
        }).toArray();
        
        for (const product of productsNeedingAttention) {
            const missingItems = [];
            
            // Check for missing photos
            if (!product.photos || product.photos.length === 0) {
                missingItems.push('photos');
            }
            
            // Check for missing security barcode
            if (!product.security_barcode || product.security_barcode === '') {
                missingItems.push('security barcode');
            }
            
            if (missingItems.length > 0) {
                // Determine priority based on how long it's been since added
                const daysSinceAdded = product.date_added ? (now - new Date(product.date_added)) / (1000 * 60 * 60 * 24) : 0;
                const isOverdue = daysSinceAdded > 7; // Overdue after 7 days
                const dueSoon = daysSinceAdded > 5 && daysSinceAdded <= 7; // Due soon if 5-7 days old
                
                tasks.push({
                    id: `product-${product._id.toString()}`,
                    product_id: product._id.toString(),
                    type: 'product_missing_info',
                    title: `Add ${missingItems.join(' and ')} to product`,
                    description: `${product.generation || 'Unknown'} - ${product.part_type || 'Unknown part'} (Serial: ${product.serial_number || 'N/A'})`,
                    due_date: product.date_added ? new Date(new Date(product.date_added).getTime() + (7 * 24 * 60 * 60 * 1000)) : new Date(),
                    is_overdue: isOverdue,
                    due_soon: dueSoon,
                    serial_number: product.serial_number,
                    missing_items: missingItems,
                    completed: false,
                    priority: isOverdue ? 'high' : (dueSoon ? 'medium' : 'normal')
                });
            }
        }
        
        console.log(`[TASKS] Found ${tasks.length} tasks`);
        
        res.json({
            success: true,
            tasks: tasks
        });
    } catch (err) {
        console.error('[TASKS] Error:', err);
        res.status(500).json({ error: 'Database error: ' + err.message });
    }
});

// Get all check-ins (Admin only)
app.get('/api/admin/check-ins', requireAuth, requireDB, async (req, res) => {
    try {
        const checkIns = await db.collection('check_ins')
            .find({})
            .sort({ checked_in_at: -1 })
            .limit(50)
            .toArray();
        
        res.json({
            success: true,
            check_ins: checkIns
        });
    } catch (err) {
        console.error('Database error:', err);
        res.status(500).json({ error: 'Database error: ' + err.message });
    }
});

// Split check-in into products (Admin only)
app.post('/api/admin/check-in/:id/split', requireAuth, requireDB, async (req, res) => {
    const id = req.params.id;
    const { selected_items } = req.body;
    
    if (!ObjectId.isValid(id)) {
        return res.status(400).json({ error: 'Invalid check-in ID' });
    }
    
    if (!selected_items || !Array.isArray(selected_items) || selected_items.length === 0) {
        return res.status(400).json({ error: 'No items selected to split' });
    }
    
    try {
        // Load check-in
        const checkIn = await db.collection('check_ins').findOne({ _id: new ObjectId(id) });
        
        if (!checkIn) {
            return res.status(404).json({ error: 'Check-in not found' });
        }
        
        // Check if already split
        if (checkIn.split_into_products) {
            return res.status(400).json({ error: 'This check-in has already been split into products' });
        }
        
        // Load associated purchase
        const purchase = await db.collection('purchases').findOne({ 
            _id: new ObjectId(checkIn.purchase_id) 
        });
        
        if (!purchase) {
            return res.status(404).json({ error: 'Associated purchase not found' });
        }
        
        console.log('[SPLIT] Splitting check-in into products:', id);
        console.log('[SPLIT] Selected items:', selected_items);
        
        // Create products for selected items
        const productsToCreate = [];
        const itemsToSplit = checkIn.items.filter(item => {
            if (!selected_items.includes(item.item_type)) {
                return false;
            }
            // AirPods parts need serial numbers
            if (['case', 'left', 'right'].includes(item.item_type)) {
                return item.serial_number;
            }
            // Box and Ear Tips don't need serial numbers
            if (['box', 'ear_tips'].includes(item.item_type)) {
                return true;
            }
            return false;
        });
        
        console.log('[SPLIT] Items to create products for:', itemsToSplit.length);
        
        for (const item of itemsToSplit) {
            const productName = `AirPods ${purchase.generation || 'Unknown'} - ${getItemDisplayName(item.item_type)}`;
            
            console.log(`[SPLIT] Creating product for: ${item.item_type}, generation: "${purchase.generation}"`);
            
            // Get part number from database
            let partNumber = null;
            if (['case', 'left', 'right'].includes(item.item_type)) {
                partNumber = await getPartNumber(
                    purchase.generation, 
                    item.item_type, 
                    purchase.connector_type, 
                    purchase.anc_type
                );
                console.log(`[SPLIT] Part number for ${item.item_type}: ${partNumber || 'NOT FOUND'}`);
            }
            
            // Determine product type (more descriptive than item_type)
            const productType = getItemDisplayName(item.item_type);
            
            // Determine status based on issues
            let status = 'in_stock';
            let notes = [];
            
            // Check if this item has issues
            if (checkIn.issues_detected) {
                const itemIssues = checkIn.issues_detected.find(i => i.item_type === item.item_type);
                if (itemIssues) {
                    status = 'faulty';
                    notes.push('Issues found during check-in:');
                    itemIssues.issues.forEach(issue => {
                        notes.push(`- ${issue.description}`);
                    });
                }
            }
            
            const product = {
                serial_number: item.serial_number || null,
                security_number: null,
                product_name: productName,
                part_number: partNumber,
                part_model_number: partNumber,
                product_type: productType,
                part_type: item.item_type,
                generation: purchase.generation || 'Unknown',
                connector_type: purchase.connector_type || null,
                anc_type: purchase.anc_type || null,
                ebay_order_number: purchase.order_number || null,
                tracking_number: purchase.tracking_number || null,
                visual_condition: item.condition,
                audible_condition: item.audible_condition || null,
                connectivity_status: item.connects_correctly !== null ? (item.connects_correctly ? 'working' : 'faulty') : null,
                is_genuine: item.is_genuine,
                photos_uploaded: false,
                status: status,
                notes: notes.join('\n'),
                date_added: new Date(),
                purchase_id: purchase._id,
                check_in_id: checkIn._id,
                purchase_price: purchase.purchase_price ? (purchase.purchase_price / itemsToSplit.length) : null,
                platform: purchase.platform || null,
                seller_name: purchase.seller_name || null,
                created_by: req.user.email
            };
            
            productsToCreate.push(product);
        }
        
        if (productsToCreate.length === 0) {
            return res.status(400).json({ error: 'No valid items found to create products' });
        }
        
        // Insert products
        console.log(`[SPLIT] Creating ${productsToCreate.length} products`);
        const result = await db.collection('products').insertMany(productsToCreate);
        
        // Mark check-in as split
        const allSplittableItems = checkIn.items.filter(item => {
            if (['case', 'left', 'right'].includes(item.item_type)) {
                return item.serial_number;
            }
            if (['box', 'ear_tips'].includes(item.item_type)) {
                return true;
            }
            return false;
        });
        const unsplitItems = allSplittableItems.filter(item => !selected_items.includes(item.item_type));
        
        await db.collection('check_ins').updateOne(
            { _id: new ObjectId(id) },
            { 
                $set: { 
                    split_into_products: true,
                    split_date: new Date(),
                    split_by: req.user.email,
                    products_created: result.insertedCount,
                    items_split: selected_items,
                    items_not_split: unsplitItems.map(i => i.item_type),
                    items_not_split_reason: 'Kept for spares/repairs or partial refund'
                }
            }
        );
        
        // Update purchase status
        await db.collection('purchases').updateOne(
            { _id: new ObjectId(checkIn.purchase_id) },
            { 
                $set: { 
                    status: 'completed',
                    completed_date: new Date()
                }
            }
        );
        
        console.log(`[SPLIT] Successfully created ${result.insertedCount} products`);
        
        res.json({
            success: true,
            products_created: result.insertedCount,
            product_ids: Object.values(result.insertedIds)
        });
    } catch (err) {
        console.error('[SPLIT] Error:', err);
        res.status(500).json({ error: 'Database error: ' + err.message });
    }
});

// Undo split - delete products and reset check-in (Admin only)
app.post('/api/admin/check-in/:id/undo-split', requireAuth, requireDB, async (req, res) => {
    const id = req.params.id;
    
    if (!ObjectId.isValid(id)) {
        return res.status(400).json({ error: 'Invalid check-in ID' });
    }
    
    try {
        // Load check-in
        const checkIn = await db.collection('check_ins').findOne({ _id: new ObjectId(id) });
        
        if (!checkIn) {
            return res.status(404).json({ error: 'Check-in not found' });
        }
        
        if (!checkIn.split_into_products) {
            return res.status(400).json({ error: 'This check-in has not been split yet' });
        }
        
        console.log('[UNDO SPLIT] Undoing split for check-in:', id);
        
        // Find and delete all products created from this check-in
        const productsToDelete = await db.collection('products').find({
            check_in_id: new ObjectId(id)
        }).toArray();
        
        console.log(`[UNDO SPLIT] Found ${productsToDelete.length} products to delete`);
        
        if (productsToDelete.length > 0) {
            const deleteResult = await db.collection('products').deleteMany({
                check_in_id: new ObjectId(id)
            });
            console.log(`[UNDO SPLIT] Deleted ${deleteResult.deletedCount} products`);
        }
        
        // Reset check-in split status
        await db.collection('check_ins').updateOne(
            { _id: new ObjectId(id) },
            { 
                $unset: { 
                    split_into_products: "",
                    split_date: "",
                    split_by: "",
                    products_created: "",
                    items_split: "",
                    items_not_split: "",
                    items_not_split_reason: ""
                }
            }
        );
        
        console.log('[UNDO SPLIT] Reset check-in split status');
        
        // Update purchase status back to checked_in (not completed)
        if (checkIn.purchase_id) {
            await db.collection('purchases').updateOne(
                { _id: new ObjectId(checkIn.purchase_id) },
                { 
                    $set: { 
                        status: 'delivered'
                    },
                    $unset: {
                        completed_date: ""
                    }
                }
            );
            console.log('[UNDO SPLIT] Updated purchase status back to delivered');
        }
        
        res.json({
            success: true,
            message: 'Split operation undone successfully',
            products_deleted: productsToDelete.length
        });
    } catch (err) {
        console.error('[UNDO SPLIT] Error:', err);
        res.status(500).json({ error: 'Database error: ' + err.message });
    }
});

// Migrate order numbers from purchase to sales field (Admin only - one-time migration)
app.post('/api/admin/migrate-order-numbers', requireAuth, requireDB, async (req, res) => {
    try {
        console.log('[MIGRATION] Starting order number migration...');
        
        const products = db.collection('products');
        
        // Find all products with ebay_order_number that is NOT the purchase order
        const productsToMigrate = await products.find({
            ebay_order_number: { 
                $exists: true, 
                $ne: null,
                $ne: '15-14031-74596' // Exclude the actual purchase order
            }
        }).toArray();
        
        console.log(`[MIGRATION] Found ${productsToMigrate.length} products to migrate`);
        
        if (productsToMigrate.length === 0) {
            return res.json({
                success: true,
                message: 'No products need migration',
                migrated: 0
            });
        }
        
        // Perform migration
        let successCount = 0;
        let errorCount = 0;
        
        for (const product of productsToMigrate) {
            try {
                await products.updateOne(
                    { _id: product._id },
                    {
                        $set: {
                            sales_order_number: product.ebay_order_number,
                            ebay_order_number: null
                        }
                    }
                );
                successCount++;
            } catch (error) {
                console.error(`[MIGRATION] Error migrating product ${product._id}:`, error.message);
                errorCount++;
            }
        }
        
        console.log(`[MIGRATION] Complete - Success: ${successCount}, Errors: ${errorCount}`);
        
        // Get final statistics
        const purchaseOrderCount = await products.countDocuments({ 
            ebay_order_number: '15-14031-74596' 
        });
        const salesOrderCount = await products.countDocuments({ 
            sales_order_number: { $exists: true, $ne: null } 
        });
        
        res.json({
            success: true,
            message: 'Migration completed successfully',
            migrated: successCount,
            errors: errorCount,
            stats: {
                purchaseOrders: purchaseOrderCount,
                salesOrders: salesOrderCount
            }
        });
    } catch (err) {
        console.error('[MIGRATION] Error:', err);
        res.status(500).json({ error: 'Migration failed: ' + err.message });
    }
});

// Update check-in (Admin only)
app.put('/api/admin/check-in/:id', requireAuth, requireDB, async (req, res) => {
    const id = req.params.id;
    const { items } = req.body;
    
    if (!ObjectId.isValid(id)) {
        return res.status(400).json({ error: 'Invalid check-in ID' });
    }
    
    if (!items || !Array.isArray(items)) {
        return res.status(400).json({ error: 'Items array is required' });
    }
    
    try {
        console.log('[CHECK-IN UPDATE] Updating check-in:', id);
        console.log('[CHECK-IN UPDATE] New items:', JSON.stringify(items, null, 2));
        
        // Re-analyze items for issues after update
        const issues = [];
        items.forEach(item => {
            const itemIssues = [];
            
            // Check if not genuine
            if (item.is_genuine === false) {
                itemIssues.push({
                    type: 'authenticity',
                    severity: 'critical',
                    description: 'Item appears to be counterfeit or not genuine'
                });
            }
            
            // Check visual condition issues
            if (['fair', 'poor'].includes(item.condition)) {
                itemIssues.push({
                    type: 'condition',
                    severity: item.condition === 'poor' ? 'high' : 'medium',
                    description: `Visual condition is ${item.condition}`
                });
            }
            
            // Check audible condition issues
            if (['left', 'right'].includes(item.item_type) && item.audible_condition) {
                if (['poor', 'not_working'].includes(item.audible_condition)) {
                    itemIssues.push({
                        type: 'audible',
                        severity: item.audible_condition === 'not_working' ? 'critical' : 'high',
                        description: item.audible_condition === 'not_working' 
                            ? 'No audible sound - item not working'
                            : `Poor sound quality - audible condition is ${item.audible_condition}`
                    });
                } else if (item.audible_condition === 'fair') {
                    itemIssues.push({
                        type: 'audible',
                        severity: 'medium',
                        description: 'Fair sound quality - audible condition is fair'
                    });
                }
            }
            
            // Check connectivity issues
            if (item.connects_correctly === false) {
                itemIssues.push({
                    type: 'connectivity',
                    severity: 'high',
                    description: 'Item has connectivity/pairing issues'
                });
            }
            
            if (itemIssues.length > 0) {
                issues.push({
                    item_type: item.item_type,
                    item_name: getItemDisplayName(item.item_type),
                    issues: itemIssues
                });
            }
        });
        
        const updateData = {
            items: items.map(item => ({
                item_type: item.item_type,
                is_genuine: item.is_genuine === true,
                condition: item.condition,
                serial_number: item.serial_number || null,
                audible_condition: item.audible_condition || null,
                connects_correctly: item.connects_correctly !== undefined ? item.connects_correctly : null
            })),
            issues_detected: issues,
            has_issues: issues.length > 0,
            last_updated_by: req.user.email,
            last_updated_at: new Date()
        };
        
        const result = await db.collection('check_ins').updateOne(
            { _id: new ObjectId(id) },
            { $set: updateData }
        );
        
        if (result.matchedCount === 0) {
            return res.status(404).json({ error: 'Check-in not found' });
        }
        
        console.log('[CHECK-IN UPDATE] Updated successfully, has_issues:', issues.length > 0);
        
        res.json({
            success: true,
            message: 'Check-in updated successfully',
            has_issues: issues.length > 0
        });
    } catch (err) {
        console.error('[CHECK-IN UPDATE] Error:', err);
        res.status(500).json({ error: 'Database error: ' + err.message });
    }
});

// Mark follow-up email as sent (Admin only)
app.post('/api/admin/check-in/:id/mark-follow-up-sent', requireAuth, requireDB, async (req, res) => {
    const id = req.params.id;
    
    if (!ObjectId.isValid(id)) {
        return res.status(400).json({ error: 'Invalid check-in ID' });
    }
    
    try {
        const result = await db.collection('check_ins').updateOne(
            { _id: new ObjectId(id) },
            { 
                $set: { 
                    'resolution_workflow.follow_up_sent_at': new Date(),
                    'resolution_workflow.follow_up_sent_by': req.user.email
                }
            }
        );
        
        if (result.matchedCount === 0) {
            return res.status(404).json({ error: 'Check-in not found' });
        }
        
        console.log('[WORKFLOW] Follow-up marked as sent for check-in:', id);
        
        res.json({
            success: true,
            message: 'Follow-up marked as sent'
        });
    } catch (err) {
        console.error('[WORKFLOW] Error:', err);
        res.status(500).json({ error: 'Database error: ' + err.message });
    }
});

// Mark eBay case as opened (Admin only)
app.post('/api/admin/check-in/:id/mark-case-opened', requireAuth, requireDB, async (req, res) => {
    const id = req.params.id;
    const { case_number } = req.body;
    
    if (!ObjectId.isValid(id)) {
        return res.status(400).json({ error: 'Invalid check-in ID' });
    }
    
    try {
        const result = await db.collection('check_ins').updateOne(
            { _id: new ObjectId(id) },
            { 
                $set: { 
                    'resolution_workflow.case_opened_at': new Date(),
                    'resolution_workflow.case_opened_by': req.user.email,
                    'resolution_workflow.case_number': case_number || null
                }
            }
        );
        
        if (result.matchedCount === 0) {
            return res.status(404).json({ error: 'Check-in not found' });
        }
        
        console.log('[WORKFLOW] eBay case marked as opened for check-in:', id);
        
        res.json({
            success: true,
            message: 'eBay case marked as opened'
        });
    } catch (err) {
        console.error('[WORKFLOW] Error:', err);
        res.status(500).json({ error: 'Database error: ' + err.message });
    }
});

// Mark issue as resolved (Admin only)
app.post('/api/admin/check-in/:id/mark-resolved', requireAuth, requireDB, async (req, res) => {
    const id = req.params.id;
    const {
        resolution_type,
        seller_responded,
        seller_response_notes,
        refund_amount,
        seller_cooperative,
        resolution_notes
    } = req.body;

    if (!ObjectId.isValid(id)) {
        return res.status(400).json({ error: 'Invalid check-in ID' });
    }

    if (!resolution_type) {
        return res.status(400).json({ error: 'Resolution type is required' });
    }

    try {
        const resolutionData = {
            'resolution_workflow.resolved_at': new Date(),
            'resolution_workflow.resolved_by': req.user.email,
            'resolution_workflow.resolution_type': resolution_type,
            'resolution_workflow.seller_responded': seller_responded === true || seller_responded === 'true',
            'resolution_workflow.seller_response_notes': seller_response_notes || '',
            'resolution_workflow.refund_amount': refund_amount ? parseFloat(refund_amount) : null,
            'resolution_workflow.seller_cooperative': seller_cooperative === true || seller_cooperative === 'true',
            'resolution_workflow.resolution_notes': resolution_notes || ''
        };

        const result = await db.collection('check_ins').updateOne(
            { _id: new ObjectId(id) },
            { $set: resolutionData }
        );

        if (result.matchedCount === 0) {
            return res.status(404).json({ error: 'Check-in not found' });
        }

        // Also update purchase status if not already resolved
        await db.collection('purchases').updateOne(
            { _id: new ObjectId((await db.collection('check_ins').findOne({ _id: new ObjectId(id) })).purchase_id) },
            { $set: { status: 'resolved' } }
        );
        
        console.log('[WORKFLOW] Issue marked as resolved for check-in:', id);
        
        res.json({
            success: true,
            message: 'Issue marked as resolved'
        });
    } catch (err) {
        console.error('[WORKFLOW] Error:', err);
        res.status(500).json({ error: 'Database error: ' + err.message });
    }
});

// Mark check-in email as sent (Admin only)
app.post('/api/admin/check-in/:id/mark-email-sent', requireAuth, requireDB, async (req, res) => {
    const id = req.params.id;
    
    if (!ObjectId.isValid(id)) {
        return res.status(400).json({ error: 'Invalid check-in ID' });
    }
    
    try {
        const result = await db.collection('check_ins').updateOne(
            { _id: new ObjectId(id) },
            { 
                $set: { 
                    email_sent_at: new Date(),
                    email_sent_by: req.user.email
                }
            }
        );
        
        if (result.matchedCount === 0) {
            return res.status(404).json({ error: 'Check-in not found' });
        }
        
        console.log('[CHECK-IN] Email marked as sent for check-in:', id);
        
        res.json({
            success: true,
            message: 'Email marked as sent'
        });
    } catch (err) {
        console.error('[CHECK-IN] Error marking email as sent:', err);
        res.status(500).json({ error: 'Database error: ' + err.message });
    }
});

// Get check-in details with generated email (Admin only)
app.get('/api/admin/check-in/:id', requireAuth, requireDB, async (req, res) => {
    const id = req.params.id;
    
    if (!ObjectId.isValid(id)) {
        return res.status(400).json({ error: 'Invalid check-in ID' });
    }
    
    try {
        const checkIn = await db.collection('check_ins').findOne({ _id: new ObjectId(id) });
        
        if (!checkIn) {
            return res.status(404).json({ error: 'Check-in not found' });
        }
        
        console.log('[CHECK-IN] Retrieved check-in from DB:', JSON.stringify(checkIn, null, 2));
        
        const purchase = await db.collection('purchases').findOne({ 
            _id: new ObjectId(checkIn.purchase_id) 
        });
        
        if (!purchase) {
            return res.status(404).json({ error: 'Purchase not found' });
        }
        
        // Generate email template
        const emailContent = generateSellerEmail(purchase, checkIn);
        
        res.json({
            success: true,
            check_in: checkIn,
            purchase: purchase,
            email_template: emailContent
        });
    } catch (err) {
        console.error('Database error:', err);
        res.status(500).json({ error: 'Database error: ' + err.message });
    }
});

// Update purchase (Admin only)
app.put('/api/admin/purchases/:id', requireAuth, requireDB, async (req, res) => {
    const id = req.params.id;
    
    if (!ObjectId.isValid(id)) {
        return res.status(400).json({ error: 'Invalid purchase ID' });
    }
    
    try {
        const {
            platform,
            order_number,
            seller_name,
            purchase_date,
            generation,
            connector_type,
            anc_type,
            items_purchased,
            quantity,
            purchase_price,
            condition,
            status,
            feedback_left,
            expected_delivery,
            tracking_provider,
            tracking_number,
            serial_numbers,
            notes
        } = req.body;
        
        // Validation
        if (!platform || !order_number || !seller_name || !purchase_date || !generation || !items_purchased || !Array.isArray(items_purchased) || items_purchased.length === 0 || !quantity || purchase_price === undefined || !status) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        
        const updateData = {
            platform,
            order_number,
            seller_name,
            purchase_date: new Date(purchase_date),
            generation,
            connector_type: connector_type || null, // usb-c or lightning (for Pro 2nd Gen)
            anc_type: anc_type || null, // anc or non-anc (for 4th Gen)
            items_purchased,
            quantity: parseInt(quantity),
            purchase_price: parseFloat(purchase_price),
            condition: condition || 'good',
            status: status, // paid, awaiting_despatch, awaiting_delivery, delivered, awaiting_return, returned, refunded
            feedback_left: feedback_left === true,
            expected_delivery: expected_delivery ? new Date(expected_delivery) : null,
            tracking_provider: tracking_provider || null,
            tracking_number: tracking_number ? tracking_number.trim().toUpperCase() : null,
            serial_numbers: serial_numbers || [],
            notes: notes || '',
            date_updated: new Date()
        };
        
        const result = await db.collection('purchases').updateOne(
            { _id: new ObjectId(id) },
            { $set: updateData }
        );
        
        if (result.matchedCount === 0) {
            return res.status(404).json({ error: 'Purchase not found' });
        }
        
        console.log('Purchase updated successfully, ID:', id);
        res.json({ success: true, message: 'Purchase updated successfully' });
    } catch (err) {
        console.error('Database error:', err);
        res.status(500).json({ error: 'Database error: ' + err.message });
    }
});

// Delete purchase (Admin only)
app.delete('/api/admin/purchases/:id', requireAuth, requireDB, async (req, res) => {
    const id = req.params.id;
    
    if (!ObjectId.isValid(id)) {
        return res.status(400).json({ error: 'Invalid purchase ID' });
    }
    
    try {
        const result = await db.collection('purchases').deleteOne({ _id: new ObjectId(id) });
        
        if (result.deletedCount === 0) {
            res.status(404).json({ error: 'Purchase not found' });
        } else {
            console.log('Purchase deleted successfully, ID:', id);
            res.json({ success: true, message: 'Purchase deleted successfully' });
        }
    } catch (err) {
        console.error('Database error:', err);
        res.status(500).json({ error: 'Database error: ' + err.message });
    }
});

// Generate seller feedback text based on purchase (Admin only)
app.post('/api/admin/purchases/:id/generate-feedback', requireAuth, requireDB, async (req, res) => {
    const id = req.params.id;

    if (!ObjectId.isValid(id)) {
        return res.status(400).json({ error: 'Invalid purchase ID' });
    }

    try {
        const purchase = await db.collection('purchases').findOne({ _id: new ObjectId(id) });

        if (!purchase) {
            return res.status(404).json({ error: 'Purchase not found' });
        }

        // Check if there's a check-in with issues for this purchase
        const checkIn = await db.collection('check_ins').findOne({
            purchase_id: new ObjectId(id)
        });

        const hasIssues = checkIn && checkIn.has_issues;
        const resolutionWorkflow = checkIn ? checkIn.resolution_workflow : null;
        const wasFormallyClosed = resolutionWorkflow && resolutionWorkflow.resolved_at;
        const resolutionType = resolutionWorkflow ? resolutionWorkflow.resolution_type : null;
        const sellerCooperative = resolutionWorkflow ? resolutionWorkflow.seller_cooperative : null;
        const refundAmount = resolutionWorkflow ? resolutionWorkflow.refund_amount : null;

        // Check purchase status and notes for refund/resolution info
        const status = purchase.status;
        const notes = purchase.notes || '';
        const notesLower = notes.toLowerCase();

        const isRefunded = status === 'refunded' || status === 'returned';

        // Check for issue/refund keywords in notes (fallback if workflow not used)
        const hasIssueNotes = notesLower.includes('issue') ||
                             notesLower.includes('fault') ||
                             notesLower.includes('problem') ||
                             notesLower.includes('defect');

        const hasRefundNotes = notesLower.includes('refund') ||
                              notesLower.includes('partial');

        // Check for positive resolution keywords in notes (fallback)
        const hasPositiveResolutionNotes = notesLower.includes('offered') ||
                                          notesLower.includes('cooperative') ||
                                          notesLower.includes('forthcoming') ||
                                          notesLower.includes('responsive') ||
                                          notesLower.includes('professional') ||
                                          notesLower.includes('helpful') ||
                                          notesLower.includes('resolved') ||
                                          notesLower.includes('agreed') ||
                                          notesLower.includes('accepted');

        // Determine if this was an issue that was resolved cooperatively
        // Priority: use workflow data if available, otherwise fall back to notes
        const hadCooperativeResolution = (hasIssues || hasIssueNotes || hasRefundNotes) &&
                                        (sellerCooperative === true ||
                                         (wasFormallyClosed && sellerCooperative !== false) ||
                                         hasPositiveResolutionNotes);

        // Debug logging
        console.log('[FEEDBACK] Purchase:', purchase.order_number);
        console.log('[FEEDBACK] Status:', status);
        console.log('[FEEDBACK] Notes:', notes);
        console.log('[FEEDBACK] Has check-in:', !!checkIn);
        console.log('[FEEDBACK] Has issues:', hasIssues);
        console.log('[FEEDBACK] Has issue notes:', hasIssueNotes);
        console.log('[FEEDBACK] Has refund notes:', hasRefundNotes);
        console.log('[FEEDBACK] Has positive resolution notes:', hasPositiveResolutionNotes);
        console.log('[FEEDBACK] Was formally closed:', wasFormallyClosed);
        console.log('[FEEDBACK] Seller cooperative:', sellerCooperative);
        console.log('[FEEDBACK] Refund amount:', refundAmount);
        console.log('[FEEDBACK] Resolution type:', resolutionType);
        console.log('[FEEDBACK] Had cooperative resolution:', hadCooperativeResolution);
        console.log('[FEEDBACK] Is refunded:', isRefunded);

        // Generate personalized feedback based on purchase details
        const generation = purchase.generation || 'AirPods';
        const items = purchase.items_purchased || [];
        const condition = purchase.condition || 'good';
        const platform = purchase.platform || 'eBay';

        // Build detailed feedback based on what was purchased and condition
        let feedback = '';

        // Determine what items were included
        const hasCase = items.includes('case') || items.includes('Case');
        const hasLeft = items.includes('left') || items.includes('Left');
        const hasRight = items.includes('right') || items.includes('Right');
        const hasBox = items.includes('box') || items.includes('Box');
        const hasEarTips = items.includes('ear_tips') || items.includes('Ear Tips');
        const hasCable = items.includes('cable') || items.includes('Cable');

        // Determine if it's a complete set
        const isCompleteSet = hasCase && hasLeft && hasRight;

        // Special handling if there were issues but seller was cooperative
        if (hadCooperativeResolution) {
            // Seller was cooperative in resolving an issue
            const itemDesc = isCompleteSet ? generation :
                            (hasCase ? `${generation} case` :
                             (hasLeft || hasRight ? `${generation} ${hasLeft && hasRight ? 'earbuds' : 'earbud'}` : generation));

            feedback = `While there was an initial issue with the ${itemDesc}, `;
            feedback += `the seller was extremely professional and responsive in resolving it. `;

            // Check if it was a partial refund or full resolution
            if ((resolutionType && resolutionType.toLowerCase().includes('partial')) || notesLower.includes('partial')) {
                feedback += `They offered a fair partial refund without hesitation. `;
            } else if ((resolutionType && resolutionType.toLowerCase().includes('refund')) || notesLower.includes('full refund')) {
                feedback += `They promptly offered a full refund. `;
            } else {
                feedback += `They worked with me to find a fair solution. `;
            }

            feedback += `Great customer service and communication throughout. `;
            feedback += `Sellers like this who stand behind their items and resolve issues quickly are rare. `;
            feedback += `Would buy from again despite the hiccup!`;
        }
        // Full refund/return with no positive resolution
        else if (isRefunded && !hadCooperativeResolution) {
            feedback = `Unfortunately the ${generation} had issues and required a return. `;
            feedback += `Seller processed the refund, but the item did not meet expectations. `;
            feedback += `Transaction completed but would recommend checking items carefully before purchasing.`;
        }
        // No issues - generate positive feedback based on condition
        else if (condition === 'new' || condition === 'like_new') {
            if (isCompleteSet) {
                feedback = `Fantastic! The ${generation} arrived in pristine condition. Both AirPods and charging case are flawless and work perfectly. `;
                if (hasBox) feedback += `Everything came in the original box with all accessories included. `;
                feedback += `Exactly as described in the listing. Fast delivery and excellent packaging. `;
                feedback += `Really happy with this purchase - highly recommend this seller! A+++`;
            } else {
                const parts = [];
                if (hasCase) parts.push('charging case');
                if (hasLeft) parts.push('left AirPod');
                if (hasRight) parts.push('right AirPod');
                feedback = `Perfect transaction! The ${generation} ${parts.join(' and ')} arrived in excellent condition. `;
                feedback += `Everything works perfectly and looks brand new. Fast shipping and great communication. `;
                feedback += `Highly recommended seller! A+++`;
            }
        } else if (condition === 'very_good' || condition === 'good') {
            if (isCompleteSet) {
                feedback = `Great purchase! The ${generation} arrived exactly as described. `;
                feedback += `Both AirPods connect instantly and sound quality is excellent. Charging case works perfectly. `;
                if (hasBox || hasEarTips) feedback += `All accessories included as shown. `;
                feedback += `Item was well packaged and arrived quickly. Professional seller - would definitely buy from again!`;
            } else {
                const parts = [];
                if (hasCase) parts.push('case');
                if (hasLeft) parts.push('left pod');
                if (hasRight) parts.push('right pod');
                feedback = `Very pleased with this ${generation} ${parts.join(' and ')}. `;
                feedback += `Everything works as it should and condition matches the description. `;
                feedback += `Good communication and fast postage. Recommended seller!`;
            }
        } else {
            if (isCompleteSet) {
                feedback = `Happy with this purchase. ${generation} received and working properly. `;
                feedback += `Both earbuds connect fine and battery life is good. `;
                feedback += `Item as described. Thank you!`;
            } else {
                feedback = `Item received as described and working well. Good communication from seller. Thank you for the smooth transaction!`;
            }
        }

        res.json({
            success: true,
            feedback: feedback,
            platform: platform
        });
    } catch (err) {
        console.error('Database error:', err);
        res.status(500).json({ error: 'Database error: ' + err.message });
    }
});

// Mark product as returned/refunded (Admin only)
app.put('/api/admin/product/:id/return', requireAuth, requireDB, async (req, res) => {
    const id = req.params.id;
    
    if (!ObjectId.isValid(id)) {
        return res.status(400).json({ error: 'Invalid product ID' });
    }
    
    const { return_reason, refund_amount, original_postage_packaging, item_opened } = req.body;
    
    if (!return_reason || refund_amount === undefined || refund_amount === null || refund_amount === '') {
        return res.status(400).json({ 
            error: 'Return reason and refund amount are required' 
        });
    }
    
    const refundAmount = parseFloat(refund_amount);
    const originalPostage = parseFloat(original_postage_packaging) || 0;
    const itemOpened = item_opened === true || item_opened === 'true';
    
    if (isNaN(refundAmount) || refundAmount < 0) {
        return res.status(400).json({ error: 'Invalid refund amount' });
    }
    
    try {
        // Get current product to check return count
        const product = await db.collection('products').findOne({ _id: new ObjectId(id) });
        
        if (!product) {
            return res.status(404).json({ error: 'Product not found' });
        }
        
        const currentReturnCount = product.return_count || 0;
        const totalRefundAmount = (product.total_refund_amount || 0) + refundAmount;
        const totalPostageLost = (product.total_postage_lost || 0) + originalPostage;
        
        const updateData = {
            status: 'returned',
            return_reason: return_reason.trim(),
            refund_amount: refundAmount,
            original_postage_packaging: originalPostage,
            item_opened: itemOpened,
            return_date: new Date(),
            return_count: currentReturnCount + 1,
            total_refund_amount: totalRefundAmount,
            total_postage_lost: totalPostageLost,
            last_return_date: new Date()
        };
        
        const result = await db.collection('products').updateOne(
            { _id: new ObjectId(id) },
            { $set: updateData }
        );
        
        if (result.matchedCount === 0) {
            res.status(404).json({ error: 'Product not found' });
        } else {
            console.log('Product marked as returned, ID:', id);
            res.json({ 
                success: true, 
                message: 'Product marked as returned successfully',
                return_count: currentReturnCount + 1,
                total_refund_amount: totalRefundAmount,
                total_postage_lost: totalPostageLost
            });
        }
    } catch (err) {
        console.error('Database error:', err);
        res.status(500).json({ error: 'Database error: ' + err.message });
    }
});

// Update return details for a returned product (Admin only)
app.put('/api/admin/product/:id/return-details', requireAuth, requireDB, async (req, res) => {
    const id = req.params.id;
    
    if (!ObjectId.isValid(id)) {
        return res.status(400).json({ error: 'Invalid product ID' });
    }
    
    const { return_reason, refund_amount, original_postage_packaging, return_postage_cost, item_opened } = req.body;
    
    if (!return_reason || refund_amount === undefined || refund_amount === null || refund_amount === '') {
        return res.status(400).json({ 
            error: 'Return reason and refund amount are required' 
        });
    }
    
    const refundAmount = parseFloat(refund_amount);
    const originalPostage = parseFloat(original_postage_packaging) || 0;
    const returnPostage = parseFloat(return_postage_cost) || 0;
    const itemOpened = item_opened === true || item_opened === 'true';
    
    if (isNaN(refundAmount) || refundAmount < 0) {
        return res.status(400).json({ error: 'Invalid refund amount' });
    }
    
    try {
        // Get current product
        const product = await db.collection('products').findOne({ _id: new ObjectId(id) });
        
        if (!product) {
            return res.status(404).json({ error: 'Product not found' });
        }
        
        if (product.status !== 'returned') {
            return res.status(400).json({ error: 'Product is not marked as returned' });
        }
        
        // Calculate total costs
        const totalCost = refundAmount + originalPostage + returnPostage;
        
        const updateData = {
            return_reason: return_reason.trim(),
            refund_amount: refundAmount,
            original_postage_packaging: originalPostage,
            return_postage_cost: returnPostage,
            item_opened: itemOpened,
            total_refund_amount: refundAmount, // Update total refund amount
            total_postage_lost: originalPostage + returnPostage, // Update total postage lost
            total_return_cost: totalCost // Store total cost for easy calculation
        };
        
        const result = await db.collection('products').updateOne(
            { _id: new ObjectId(id) },
            { $set: updateData }
        );
        
        if (result.matchedCount === 0) {
            res.status(404).json({ error: 'Product not found' });
        } else {
            console.log('Return details updated, ID:', id);
            res.json({ 
                success: true, 
                message: 'Return details updated successfully',
                total_refund_amount: refundAmount,
                total_postage_lost: originalPostage + returnPostage,
                total_return_cost: totalCost
            });
        }
    } catch (err) {
        console.error('Database error:', err);
        res.status(500).json({ error: 'Database error: ' + err.message });
    }
});

// Reopen/Reactivate a returned product (Admin only)
app.put('/api/admin/product/:id/reopen', requireAuth, requireDB, async (req, res) => {
    const id = req.params.id;
    
    if (!ObjectId.isValid(id)) {
        return res.status(400).json({ error: 'Invalid product ID' });
    }
    
    try {
        const updateData = {
            status: 'active'
        };
        
        const result = await db.collection('products').updateOne(
            { _id: new ObjectId(id) },
            { $set: updateData }
        );
        
        if (result.matchedCount === 0) {
            res.status(404).json({ error: 'Product not found' });
        } else {
            res.json({ success: true, message: 'Product reopened successfully' });
        }
    } catch (err) {
        console.error('Database error:', err);
        res.status(500).json({ error: 'Database error: ' + err.message });
    }
});

// Mark returned product as resold to new buyer (Admin only)
app.put('/api/admin/product/:id/resale', requireAuth, requireDB, async (req, res) => {
    const id = req.params.id;
    
    if (!ObjectId.isValid(id)) {
        return res.status(400).json({ error: 'Invalid product ID' });
    }
    
    const { ebay_order_number, security_barcode, resale_notes, archive_return } = req.body;
    
    if (!ebay_order_number || !ebay_order_number.trim()) {
        return res.status(400).json({ error: 'New eBay order number is required' });
    }
    
    try {
        // Get current product to archive return info
        const product = await db.collection('products').findOne({ _id: new ObjectId(id) });
        
        if (!product) {
            return res.status(404).json({ error: 'Product not found' });
        }
        
        if (product.status !== 'returned') {
            return res.status(400).json({ error: 'Product is not marked as returned' });
        }
        
        // Initialize or get resale history
        const resaleHistory = product.resale_history || [];
        const resaleCount = (product.resale_count || 0) + 1;
        
        // Create resale record
        const resaleRecord = {
            resale_date: new Date(),
            resale_number: resaleCount,
            new_ebay_order_number: ebay_order_number.trim(),
            previous_ebay_order_number: product.ebay_order_number,
            security_barcode_changed: security_barcode ? true : false,
            old_security_barcode: product.security_barcode,
            new_security_barcode: security_barcode || product.security_barcode,
            resale_notes: resale_notes || '',
            return_info_archived: archive_return === true
        };
        
        // If archiving return info, add it to the resale record
        if (archive_return) {
            resaleRecord.archived_return_data = {
                return_reason: product.return_reason,
                refund_amount: product.refund_amount,
                original_postage_packaging: product.original_postage_packaging,
                return_postage_cost: product.return_postage_cost,
                item_opened: product.item_opened,
                return_date: product.return_date,
                return_count: product.return_count,
                total_refund_amount: product.total_refund_amount,
                total_postage_lost: product.total_postage_lost,
                total_return_cost: product.total_return_cost
            };
        }
        
        resaleHistory.push(resaleRecord);
        
        // Build update data
        const updateData = {
            status: 'active',
            ebay_order_number: ebay_order_number.trim(),
            resale_count: resaleCount,
            resale_history: resaleHistory,
            last_resale_date: new Date()
        };
        
        // Update security barcode if provided
        if (security_barcode && security_barcode.trim()) {
            updateData.security_barcode = security_barcode.trim().toUpperCase();
        }
        
        // If archiving, clear return fields from main product
        if (archive_return) {
            updateData.return_reason = null;
            updateData.refund_amount = null;
            updateData.original_postage_packaging = null;
            updateData.return_postage_cost = null;
            updateData.item_opened = null;
            updateData.return_date = null;
            updateData.total_return_cost = null;
            // Note: Keep return_count and totals for analytics, just clear the last return details
        }
        
        const result = await db.collection('products').updateOne(
            { _id: new ObjectId(id) },
            { $set: updateData }
        );
        
        if (result.matchedCount === 0) {
            res.status(404).json({ error: 'Product not found' });
        } else {
            res.json({ 
                success: true, 
                message: 'Product marked as resold successfully',
                resale_count: resaleCount,
                ebay_order_number: ebay_order_number.trim(),
                archived: archive_return
            });
        }
    } catch (err) {
        console.error('Database error:', err);
        res.status(500).json({ error: 'Database error: ' + err.message });
    }
});

// Get settings (Admin only)
app.get('/api/admin/settings', requireAuth, requireDB, async (req, res) => {
    try {
        const settingsDoc = await db.collection('settings').findOne({ type: 'system' });
        
        if (!settingsDoc) {
            // Return default settings
            return res.json({
                success: true,
                settings: {
                    product_status_options: [
                        { value: 'active', label: 'Active' },
                        { value: 'delivered_no_warranty', label: 'Delivered (No Warranty)' },
                        { value: 'returned', label: 'Returned' },
                        { value: 'pending', label: 'Pending' }
                    ],
                    email_settings: {
                        smtp_host: '',
                        smtp_port: 587,
                        smtp_secure: false,
                        smtp_user: '',
                        smtp_pass: '',
                        smtp_from: ''
                    }
                }
            });
        }
        
        const settings = settingsDoc.settings || {};
        
        // Ensure email_settings exists
        if (!settings.email_settings) {
            settings.email_settings = {
                smtp_host: '',
                smtp_port: 587,
                smtp_secure: false,
                smtp_user: '',
                smtp_pass: '',
                smtp_from: ''
            };
        }
        
        res.json({
            success: true,
            settings: settings
        });
    } catch (err) {
        console.error('Database error:', err);
        res.status(500).json({ error: 'Database error: ' + err.message });
    }
});

// Update settings (Admin only)
app.put('/api/admin/settings', requireAuth, requireDB, async (req, res) => {
    try {
        const { product_status_options, email_settings } = req.body;
        
        const settings = {};
        
        // Handle product status options
        if (product_status_options) {
            if (!Array.isArray(product_status_options)) {
                return res.status(400).json({ error: 'product_status_options must be an array' });
            }
            
            // Validate status options
            for (const option of product_status_options) {
                if (!option.value || !option.label) {
                    return res.status(400).json({ error: 'Each status option must have both value and label' });
                }
                if (!/^[a-z0-9_]+$/.test(option.value)) {
                    return res.status(400).json({ error: 'Status values must contain only lowercase letters, numbers, and underscores' });
                }
            }
            
            // Check for duplicate values
            const values = product_status_options.map(opt => opt.value);
            const uniqueValues = new Set(values);
            if (values.length !== uniqueValues.size) {
                return res.status(400).json({ error: 'Duplicate status values are not allowed' });
            }
            
            settings.product_status_options = product_status_options;
        }
        
        // Handle email settings
        if (email_settings) {
            // Validate email settings
            if (!email_settings.smtp_host || !email_settings.smtp_user || !email_settings.smtp_pass) {
                return res.status(400).json({ error: 'SMTP host, username, and password are required' });
            }
            
            if (!email_settings.smtp_port || email_settings.smtp_port < 1 || email_settings.smtp_port > 65535) {
                return res.status(400).json({ error: 'Valid SMTP port (1-65535) is required' });
            }
            
            settings.email_settings = {
                smtp_host: email_settings.smtp_host.trim(),
                smtp_port: parseInt(email_settings.smtp_port),
                smtp_secure: email_settings.smtp_secure === true || email_settings.smtp_secure === 'true',
                smtp_user: email_settings.smtp_user.trim(),
                smtp_pass: email_settings.smtp_pass.trim(), // Store password (will be encrypted in production)
                smtp_from: email_settings.smtp_from ? email_settings.smtp_from.trim() : email_settings.smtp_user.trim()
            };
            
            // Reinitialize email transporter with new settings
            try {
                if (nodemailer) {
                    emailTransporter = nodemailer.createTransport({
                        host: settings.email_settings.smtp_host,
                        port: settings.email_settings.smtp_port,
                        secure: settings.email_settings.smtp_secure,
                        auth: {
                            user: settings.email_settings.smtp_user,
                            pass: settings.email_settings.smtp_pass
                        }
                    });
                    console.log('✅ Email transporter updated with new settings');
                }
            } catch (emailErr) {
                console.error('Error updating email transporter:', emailErr);
                // Don't fail the save - just log the error
            }
        }
        
        // Get existing settings and merge
        const existingSettings = await db.collection('settings').findOne({ type: 'system' });
        const mergedSettings = existingSettings?.settings || {};
        
        // Merge new settings with existing
        Object.assign(mergedSettings, settings);
        
        // Upsert settings document
        await db.collection('settings').updateOne(
            { type: 'system' },
            { 
                $set: { 
                    settings: mergedSettings,
                    updated_at: new Date()
                }
            },
            { upsert: true }
        );
        
        res.json({ success: true, message: 'Settings updated successfully' });
    } catch (err) {
        console.error('Database error:', err);
        res.status(500).json({ error: 'Database error: ' + err.message });
    }
});

// Test email configuration (Admin only)
app.post('/api/admin/test-email', requireAuth, requireDB, async (req, res) => {
    try {
        const { smtp_host, smtp_port, smtp_secure, smtp_user, smtp_pass, smtp_from, test_email } = req.body;
        
        // Validate required fields
        if (!smtp_host || !smtp_user || !smtp_pass || !test_email) {
            return res.status(400).json({ error: 'SMTP host, username, password, and test email address are required' });
        }
        
        if (!nodemailer) {
            return res.status(503).json({ error: 'Email service not available. Please ensure nodemailer is installed.' });
        }
        
        // Create test transporter
        const testTransporter = nodemailer.createTransport({
            host: smtp_host.trim(),
            port: parseInt(smtp_port) || 587,
            secure: smtp_secure === true || smtp_secure === 'true',
            auth: {
                user: smtp_user.trim(),
                pass: smtp_pass.trim()
            }
        });
        
        // Verify connection
        await testTransporter.verify();
        
        // Send test email
        const fromEmail = smtp_from ? smtp_from.trim() : smtp_user.trim();
        const mailOptions = {
            from: fromEmail,
            to: test_email.trim(),
            subject: 'Test Email from LJM AirPod Support',
            text: 'This is a test email to verify your SMTP configuration is working correctly.',
            html: '<p>This is a test email to verify your SMTP configuration is working correctly.</p><p>If you received this email, your email settings are configured properly!</p>'
        };
        
        const info = await testTransporter.sendMail(mailOptions);
        
        res.json({ 
            success: true, 
            message: 'Test email sent successfully!',
            messageId: info.messageId
        });
    } catch (err) {
        console.error('Email test error:', err);
        res.status(500).json({ 
            error: 'Failed to send test email: ' + err.message 
        });
    }
});

// Get valid statuses helper function
async function getValidStatuses() {
    // Check if db is available
    if (!db) {
        return ['active', 'returned', 'delivered_no_warranty', 'pending'];
    }
    
    try {
        const settingsDoc = await db.collection('settings').findOne({ type: 'system' });
        if (settingsDoc && settingsDoc.settings && settingsDoc.settings.product_status_options) {
            return settingsDoc.settings.product_status_options.map(opt => opt.value);
        }
    } catch (err) {
        console.error('Error fetching valid statuses:', err);
    }
    // Return defaults if settings not found
    return ['active', 'returned', 'delivered_no_warranty', 'pending'];
}

// Quick status update (Admin only) - for dashboard quick editing
app.put('/api/admin/product/:id/status', requireAuth, requireDB, async (req, res) => {
    const id = req.params.id;
    
    if (!ObjectId.isValid(id)) {
        return res.status(400).json({ error: 'Invalid product ID' });
    }
    
    const { status, return_reason } = req.body;
    
    if (!status) {
        return res.status(400).json({ error: 'Status is required' });
    }
    
    // Get valid statuses from settings
    const validStatuses = await getValidStatuses();
    if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
    }
    
    try {
        const updateData = {
            status: status
        };
        
        // If marking as returned, add return reason if provided
        if (status === 'returned' && return_reason) {
            updateData.return_reason = return_reason.trim();
            updateData.last_return_date = new Date();
            // Increment return count
            const product = await db.collection('products').findOne({ _id: new ObjectId(id) });
            if (product) {
                updateData.return_count = (product.return_count || 0) + 1;
            }
        }
        
        // If marking as delivered_no_warranty, set a flag
        if (status === 'delivered_no_warranty') {
            updateData.delivered_no_warranty_date = new Date();
        }
        
        const result = await db.collection('products').updateOne(
            { _id: new ObjectId(id) },
            { $set: updateData }
        );
        
        if (result.matchedCount === 0) {
            res.status(404).json({ error: 'Product not found' });
        } else {
            res.json({ success: true, message: 'Status updated successfully' });
        }
    } catch (err) {
        console.error('Database error:', err);
        res.status(500).json({ error: 'Database error: ' + err.message });
    }
});

// Data access verification endpoint (Admin only)
app.get('/api/admin/verify-data-access', requireAuth, requireDB, async (req, res) => {
    try {
        const productsSample = await db.collection('products').find({}).limit(1).toArray();
        const productCount = await db.collection('products').countDocuments();
        const warrantyCount = await db.collection('warranties').countDocuments();
        
        let hasUserOwnership = false;
        let ownershipFields = [];
        
        if (productsSample.length > 0) {
            const product = productsSample[0];
            const allFields = Object.keys(product);
            ownershipFields = allFields.filter(k => 
                k.includes('user') || k.includes('owner') || k.includes('created_by')
            );
            hasUserOwnership = ownershipFields.length > 0;
        }
        
        res.json({
            success: true,
            data: {
                hasUserOwnership,
                ownershipFields,
                productCount,
                warrantyCount,
                message: hasUserOwnership 
                    ? `Products have user ownership fields: ${ownershipFields.join(', ')}` 
                    : 'Products have NO user ownership fields - data is shared',
                conclusion: hasUserOwnership
                    ? 'Data migration may be needed to associate with users'
                    : '✅ No mounting needed - data is accessible to all authenticated users'
            }
        });
    } catch (error) {
        console.error('Error verifying data access:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get single product by ID (Admin only)
app.get('/api/admin/product/:id', requireAuth, requireDB, async (req, res) => {
    const id = req.params.id;
    
    try {
        if (!ObjectId.isValid(id)) {
            return res.status(400).json({ error: 'Invalid product ID' });
        }
        
        const product = await db.collection('products').findOne({ _id: new ObjectId(id) });
        
        if (!product) {
            res.status(404).json({ error: 'Product not found' });
        } else {
            // Convert MongoDB _id to string for JSON response
            product.id = product._id.toString();
            delete product._id;
            res.json({ success: true, product: product });
        }
    } catch (err) {
        console.error('Database error:', err);
        res.status(500).json({ error: 'Database error: ' + err.message });
    }
});

// Delete product (Admin only)
app.delete('/api/admin/product/:id', requireAuth, requireDB, async (req, res) => {
    const id = req.params.id;
    
    try {
        if (!ObjectId.isValid(id)) {
            return res.status(400).json({ error: 'Invalid product ID' });
        }
        
        const result = await db.collection('products').deleteOne({ _id: new ObjectId(id) });
        
        if (result.deletedCount === 0) {
            res.status(404).json({ error: 'Product not found' });
        } else {
            res.json({ success: true, message: 'Product deleted successfully' });
        }
    } catch (err) {
        console.error('Database error:', err);
        res.status(500).json({ error: 'Database error: ' + err.message });
    }
});

// Verify customer barcode (Public)
app.post('/api/verify-barcode', requireDB, async (req, res) => {
    const { security_barcode } = req.body;
    const ip = req.ip || req.connection.remoteAddress;
    
    if (!security_barcode) {
        return res.status(400).json({ error: 'Security barcode is required' });
    }
    
    // Check rate limiting
    if (!checkRateLimit(ip)) {
        return res.status(429).json({ error: 'Too many attempts. Please try again later.' });
    }
    
    try {
        // Search for barcode with or without hyphens
        const barcodeQuery = createSecurityBarcodeQuery(security_barcode);
        const product = await db.collection('products').findOne(barcodeQuery);
        
        if (!product) {
            res.status(404).json({ error: 'Invalid security code. Please check and try again.' });
        } else {
            // Get part name from airpod_parts collection
            let partName = null;
            if (product.part_model_number) {
                // Try exact match first
                let partDoc = await db.collection('airpod_parts').findOne({
                    part_model_number: product.part_model_number
                });
                
                // If not found, try case-insensitive search
                if (!partDoc) {
                    console.log('[Verify Barcode] Exact match failed, trying case-insensitive search for', product.part_model_number);
                    const allParts = await db.collection('airpod_parts').find({}).toArray();
                    partDoc = allParts.find(p => 
                        p.part_model_number && 
                        p.part_model_number.toUpperCase() === product.part_model_number.toUpperCase()
                    );
                }
                
                if (partDoc && partDoc.part_name) {
                    partName = partDoc.part_name;
                    console.log('[Verify Barcode] Found part name:', partName, 'for model', product.part_model_number);
                } else {
                    console.log('[Verify Barcode] No part name found for model', product.part_model_number);
                    console.log('[Verify Barcode] Searched in airpod_parts collection');
                }
            }
            
            // Get associated parts details if they exist
            let associatedPartsDetails = [];
            if (product.associated_parts && Array.isArray(product.associated_parts) && product.associated_parts.length > 0) {
                console.log('[Verify Barcode] Product has associated_parts:', product.associated_parts);

                // Fetch full details for each associated part
                const associatedPartsDocs = await db.collection('airpod_parts').find({
                    part_model_number: { $in: product.associated_parts }
                }).toArray();

                console.log('[Verify Barcode] Found', associatedPartsDocs.length, 'associated parts documents');
                associatedPartsDocs.forEach(part => {
                    console.log('[Verify Barcode] Part:', part.part_model_number, 'example_image:', part.example_image);
                });

                associatedPartsDetails = associatedPartsDocs.map(part => ({
                    part_model_number: part.part_model_number,
                    part_name: part.part_name,
                    part_type: part.part_type,
                    example_image: part.example_image || null
                }));

                console.log('[Verify Barcode] Sending associatedPartsDetails:', JSON.stringify(associatedPartsDetails, null, 2));
            } else {
                console.log('[Verify Barcode] No associated_parts configured for this product');
            }

            res.json({
                success: true,
                part_type: product.part_type,
                serial_number: product.serial_number,
                generation: product.generation,
                part_model_number: product.part_model_number,
                part_name: partName || null,
                photos: product.photos || [],
                ebay_order_number: product.ebay_order_number || null,
                date_added: product.date_added,
                notes: product.notes || null,
                associated_parts: associatedPartsDetails
            });
        }
    } catch (err) {
        console.error('Database error:', err);
        res.status(500).json({ error: 'Database error: ' + err.message });
    }
});

// Diagnostic endpoint to check parts data (Admin only)
app.get('/api/admin/diagnostic/parts/:modelNumbers', requireAuth, requireDB, async (req, res) => {
    try {
        const modelNumbers = req.params.modelNumbers.split(',');
        console.log('[Diagnostic] Checking parts:', modelNumbers);

        const parts = await db.collection('parts').find({
            part_model_number: { $in: modelNumbers }
        }).toArray();

        const diagnosticInfo = parts.map(part => ({
            part_model_number: part.part_model_number,
            part_name: part.part_name,
            part_type: part.part_type,
            example_image: part.example_image,
            example_image_exists: !!part.example_image,
            example_image_type: typeof part.example_image,
            example_image_value: part.example_image || 'NULL/EMPTY',
            all_fields: Object.keys(part)
        }));

        res.json({
            success: true,
            parts: diagnosticInfo,
            count: parts.length
        });
    } catch (err) {
        console.error('[Diagnostic] Error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Log confirmation (Public)
app.post('/api/confirm-understanding', requireDB, async (req, res) => {
    const { security_barcode } = req.body;
    
    if (!security_barcode) {
        return res.status(400).json({ error: 'Security barcode is required' });
    }
    
    try {
        // Search for barcode with or without hyphens
        const barcodeQuery = createSecurityBarcodeQuery(security_barcode);
        const result = await db.collection('products').updateOne(
            barcodeQuery,
            { 
                $set: { 
                    confirmation_checked: true, 
                    confirmation_date: new Date() 
                } 
            }
        );
        
        if (result.matchedCount === 0) {
            res.status(404).json({ error: 'Security barcode not found' });
        } else {
            res.json({ success: true, message: 'Confirmation logged' });
        }
    } catch (err) {
        console.error('Database error:', err);
        res.status(500).json({ error: 'Database error: ' + err.message });
    }
});

// Get warranty pricing (Public) - only returns enabled options
app.get('/api/warranty/pricing', requireDB, async (req, res) => {
    try {
        // Disable caching to ensure fresh pricing data
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        
        const pricing = await db.collection('warranty_pricing').findOne({}, { sort: { last_updated: -1 } });
        if (!pricing) {
            // Return default pricing if none exists (all enabled by default)
            return res.json({
                '3months': 4.99,
                '6months': 7.99,
                '12months': 12.99
            });
        }
        const result = {};
        // Only include enabled warranty options
        if (pricing['3months_enabled'] !== false) {
            result['3months'] = pricing['3months'] || 4.99;
        }
        if (pricing['6months_enabled'] !== false) {
            result['6months'] = pricing['6months'] || 7.99;
        }
        if (pricing['12months_enabled'] !== false) {
            result['12months'] = pricing['12months'] || 12.99;
        }
        res.json(result);
    } catch (err) {
        console.error('Error fetching warranty pricing:', err);
        res.status(500).json({ error: 'Failed to fetch warranty pricing' });
    }
});

// Get warranty pricing (Admin only - includes metadata and enabled status)
// Public API endpoint to get enabled warranty options (for frontend display)
app.get('/api/warranty-options', requireDB, async (req, res) => {
    try {
        // Disable caching for this endpoint to ensure fresh data
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        
        const pricing = await db.collection('warranty_pricing').findOne({}, { sort: { last_updated: -1 } });
        
        // Explicitly check for true/false values - default to false if not explicitly true
        const enabledOptions = {
            '3months': pricing ? (pricing['3months_enabled'] === true) : true,
            '6months': pricing ? (pricing['6months_enabled'] === true) : true,
            '12months': pricing ? (pricing['12months_enabled'] === true) : true
        };
        
        res.json(enabledOptions);
    } catch (err) {
        console.error('Error fetching warranty options:', err);
        // Return default (all enabled) on error
        res.json({
            '3months': true,
            '6months': true,
            '12months': true
        });
    }
});

app.get('/api/admin/warranty-pricing', requireAuth, requireDB, async (req, res) => {
    try {
        const pricing = await db.collection('warranty_pricing').findOne({}, { sort: { last_updated: -1 } });
        if (!pricing) {
            // Return default pricing if none exists (all enabled by default)
            return res.json({
                '3months': 4.99,
                '6months': 7.99,
                '12months': 12.99,
                '3months_enabled': true,
                '6months_enabled': true,
                '12months_enabled': true,
                last_updated: null,
                updated_by: null
            });
        }
        res.json({
            '3months': pricing['3months'] || 4.99,
            '6months': pricing['6months'] || 7.99,
            '12months': pricing['12months'] || 12.99,
            '3months_enabled': pricing['3months_enabled'] === true, // Only true if explicitly true
            '6months_enabled': pricing['6months_enabled'] === true,
            '12months_enabled': pricing['12months_enabled'] === true,
            last_updated: pricing.last_updated,
            updated_by: pricing.updated_by
        });
    } catch (err) {
        console.error('Error fetching warranty pricing:', err);
        res.status(500).json({ error: 'Failed to fetch warranty pricing' });
    }
});

// Update warranty pricing (Admin only)
app.post('/api/admin/warranty-pricing', requireAuth, requireDB, async (req, res) => {
    const { 
        '3months': threeMonths, 
        '6months': sixMonths, 
        '12months': twelveMonths,
        '3months_enabled': threeMonthsEnabled,
        '6months_enabled': sixMonthsEnabled,
        '12months_enabled': twelveMonthsEnabled
    } = req.body;
    
    // Validation
    if (threeMonths === undefined || sixMonths === undefined || twelveMonths === undefined) {
        return res.status(400).json({ error: 'All pricing values are required' });
    }
    
    const prices = {
        '3months': parseFloat(threeMonths),
        '6months': parseFloat(sixMonths),
        '12months': parseFloat(twelveMonths)
    };
    
    // Validate prices are positive numbers
    if (isNaN(prices['3months']) || isNaN(prices['6months']) || isNaN(prices['12months']) ||
        prices['3months'] < 0 || prices['6months'] < 0 || prices['12months'] < 0) {
        return res.status(400).json({ error: 'All prices must be valid positive numbers' });
    }
    
    // Handle enabled flags - explicitly convert to boolean
    // Checkboxes send true/false as booleans - explicitly handle both true and false
    function toBoolean(value) {
        // Explicitly check for false values first
        if (value === false || value === 'false' || value === 0 || value === '0') {
            return false;
        }
        // Then check for true values
        if (value === true || value === 'true' || value === 1 || value === '1') {
            return true;
        }
        // Default to false if undefined/null (safer than defaulting to true)
        return false;
    }
    
    const enabledFlags = {
        '3months_enabled': toBoolean(threeMonthsEnabled),
        '6months_enabled': toBoolean(sixMonthsEnabled),
        '12months_enabled': toBoolean(twelveMonthsEnabled)
    };
    
    console.log('Raw enabled values from request:', { 
        threeMonthsEnabled, 
        sixMonthsEnabled, 
        twelveMonthsEnabled,
        threeMonthsEnabledType: typeof threeMonthsEnabled,
        sixMonthsEnabledType: typeof sixMonthsEnabled,
        twelveMonthsEnabledType: typeof twelveMonthsEnabled
    }); // Debug log
    console.log('Enabled flags after processing:', enabledFlags); // Debug log
    
    try {
        console.log('Saving warranty pricing:', {
            prices,
            enabledFlags,
            username: req.session.username || 'admin'
        }); // Debug log
        
        // Use upsert to update or create pricing document
        const result = await db.collection('warranty_pricing').updateOne(
            {},
            {
                $set: {
                    '3months': prices['3months'],
                    '6months': prices['6months'],
                    '12months': prices['12months'],
                    '3months_enabled': enabledFlags['3months_enabled'],
                    '6months_enabled': enabledFlags['6months_enabled'],
                    '12months_enabled': enabledFlags['12months_enabled'],
                    last_updated: new Date(),
                    updated_by: req.session.username || 'admin'
                }
            },
            { upsert: true }
        );
        
        console.log('Database update result:', {
            matchedCount: result.matchedCount,
            modifiedCount: result.modifiedCount,
            upsertedCount: result.upsertedCount,
            upsertedId: result.upsertedId
        }); // Debug log
        
        // Verify what was actually saved by reading it back
        const savedPricing = await db.collection('warranty_pricing').findOne({}, { sort: { last_updated: -1 } });
        console.log('✅ Verified saved values in database:', {
            '3months_enabled': savedPricing?.['3months_enabled'],
            '6months_enabled': savedPricing?.['6months_enabled'],
            '12months_enabled': savedPricing?.['12months_enabled']
        }); // Debug log
        
        const enabledStatus = Object.entries(enabledFlags).map(([key, val]) => `${key.replace('_enabled', '')}:${val ? 'ON' : 'OFF'}`).join(', ');
        console.log(`✅ Warranty pricing updated by ${req.session.username || 'admin'}: 3mo=£${prices['3months']}, 6mo=£${prices['6months']}, 12mo=£${prices['12months']} | ${enabledStatus}`);
        
        res.json({
            success: true,
            message: 'Warranty pricing updated successfully',
            pricing: prices,
            enabled: enabledFlags
        });
    } catch (err) {
        console.error('Error updating warranty pricing:', err);
        res.status(500).json({ error: 'Failed to update warranty pricing: ' + err.message });
    }
});

// ========== Warranty Terms & Conditions API ==========

// Get current active terms version (Public - for registration)
app.get('/api/warranty-terms/current', requireDB, async (req, res) => {
    try {
        const currentTerms = await db.collection('warranty_terms').findOne(
            {},
            { sort: { version: -1 } }
        );
        
        if (!currentTerms) {
            // Return default terms if none exist
            return res.json({
                version: 1,
                content: 'No terms and conditions have been set yet.',
                created_at: new Date(),
                created_by: 'system'
            });
        }
        
        res.json({
            version: currentTerms.version,
            content: currentTerms.content,
            created_at: currentTerms.created_at,
            created_by: currentTerms.created_by
        });
    } catch (err) {
        console.error('Error fetching current warranty terms:', err);
        res.status(500).json({ error: 'Failed to fetch warranty terms' });
    }
});

// Get current active terms version (Admin)
app.get('/api/admin/warranty-terms/current', requireAuth, requireDB, async (req, res) => {
    try {
        const currentTerms = await db.collection('warranty_terms').findOne(
            {},
            { sort: { version: -1 } }
        );
        
        if (!currentTerms) {
            return res.json({ terms: null });
        }
        
        res.json({ terms: currentTerms });
    } catch (err) {
        console.error('Error fetching current warranty terms:', err);
        res.status(500).json({ error: 'Failed to fetch warranty terms' });
    }
});

// Get all terms versions (Admin)
app.get('/api/admin/warranty-terms/versions', requireAuth, requireDB, async (req, res) => {
    try {
        const versions = await db.collection('warranty_terms').find({}).sort({ version: -1 }).toArray();
        
        // Count active warranties per version
        const versionsWithCounts = await Promise.all(versions.map(async (version) => {
            const count = await db.collection('warranties').countDocuments({
                terms_version: version.version
            });
            return {
                ...version,
                active_warranties: count
            };
        }));
        
        res.json({ versions: versionsWithCounts });
    } catch (err) {
        console.error('Error fetching warranty terms versions:', err);
        res.status(500).json({ error: 'Failed to fetch warranty terms versions' });
    }
});

// Get specific terms version (Admin)
app.get('/api/admin/warranty-terms/version/:version', requireAuth, requireDB, async (req, res) => {
    try {
        const version = parseInt(req.params.version);
        if (isNaN(version)) {
            return res.status(400).json({ error: 'Invalid version number' });
        }
        
        const terms = await db.collection('warranty_terms').findOne({ version });
        
        if (!terms) {
            return res.status(404).json({ error: 'Version not found' });
        }
        
        res.json({ terms });
    } catch (err) {
        console.error('Error fetching warranty terms version:', err);
        res.status(500).json({ error: 'Failed to fetch warranty terms version' });
    }
});

// Create new terms version (Admin)
app.post('/api/admin/warranty-terms', requireAuth, requireDB, async (req, res) => {
    const { content } = req.body;
    
    if (!content || typeof content !== 'string' || !content.trim()) {
        return res.status(400).json({ error: 'Terms content is required' });
    }
    
    try {
        // Get the highest version number
        const latestVersion = await db.collection('warranty_terms').findOne(
            {},
            { sort: { version: -1 } }
        );
        
        const newVersion = latestVersion ? latestVersion.version + 1 : 1;
        
        const newTerms = {
            version: newVersion,
            content: content.trim(),
            created_at: new Date(),
            created_by: req.session.username || 'admin'
        };
        
        await db.collection('warranty_terms').insertOne(newTerms);
        
        console.log(`✅ New warranty terms version ${newVersion} created by ${req.session.username || 'admin'}`);
        
        res.json({
            success: true,
            version: newVersion,
            message: `Version ${newVersion} created successfully`
        });
    } catch (err) {
        console.error('Error creating warranty terms version:', err);
        res.status(500).json({ error: 'Failed to create warranty terms version' });
    }
});

// Version API endpoint (Public)
// Version endpoint - returns current app version
app.get('/api/version', (req, res) => {
    try {
        const path = require('path');
        const versionPath = path.join(__dirname, 'version.json');
        
        if (fs.existsSync(versionPath)) {
            const versionData = JSON.parse(fs.readFileSync(versionPath, 'utf8'));
            res.json({
                version: versionData.version || '1.2.0',
                build: versionData.build || new Date().toISOString().split('T')[0],
                revision: versionData.revision || '001'
            });
        } else {
            // Fallback to package.json version
            const packageJson = require('./package.json');
            res.json({
                version: packageJson.version || '1.2.0',
                build: new Date().toISOString().split('T')[0],
                revision: packageJson.version.split('.').pop() || '001'
            });
        }
    } catch (err) {
        console.error('Error reading version:', err);
        // Always return a valid response, never fail
        res.status(200).json({
            version: '1.2.0',
            build: new Date().toISOString().split('T')[0],
            revision: '001'
        });
    }
});

// Payment API endpoints (GoCardless) - DISABLED - Using Stripe instead
// GoCardless endpoints commented out - Stripe handles one-off card payments

/*
// Get GoCardless configuration (Public)
app.get('/api/payment/config', (req, res) => {
    try {
        const accessToken = process.env.GOCARDLESS_ACCESS_TOKEN;
        if (!accessToken) {
            return res.status(200).json({ 
                configured: false,
                error: 'GoCardless not configured. Please add GOCARDLESS_ACCESS_TOKEN to Railway environment variables.'
            });
        }
        res.status(200).json({ 
            configured: true,
            environment: process.env.GOCARDLESS_ENVIRONMENT || 'live'
        });
    } catch (error) {
        console.error('Error in /api/payment/config:', error);
        res.status(200).json({ 
            configured: false,
            error: 'Error loading payment configuration: ' + error.message
        });
    }
});
*/

// Stripe API endpoints (ACTIVE - Primary payment method for card payments)

// Get Stripe publishable key (Public)
app.get('/api/stripe/config', (req, res) => {
    try {
        const publishableKey = process.env.STRIPE_PUBLISHABLE_KEY;
        if (!publishableKey) {
            // Return 200 with null key instead of 500 error
            // Frontend will handle this gracefully
            return res.status(200).json({ 
                publishableKey: null,
                error: 'Stripe not configured. Please add STRIPE_PUBLISHABLE_KEY to Railway environment variables.'
            });
        }
        res.status(200).json({ publishableKey });
    } catch (error) {
        console.error('Error in /api/stripe/config:', error);
        res.status(200).json({ 
            publishableKey: null,
            error: 'Error loading Stripe configuration: ' + error.message
        });
    }
});

// Create payment intent (Public - but amount verified on server)
app.post('/api/stripe/create-payment-intent', requireDB, async (req, res) => {
    const { amount, currency = 'gbp', description } = req.body;
    
    if (!amount || amount <= 0) {
        return res.status(400).json({ error: 'Invalid amount' });
    }
    
    // Check if Stripe is configured
    if (!stripe || !process.env.STRIPE_SECRET_KEY) {
        return res.status(503).json({ 
            error: 'Payment system not configured',
            message: 'Please add STRIPE_SECRET_KEY to Railway environment variables.'
        });
    }
    
    try {
        const paymentIntent = await stripe.paymentIntents.create({
            amount: Math.round(amount), // Amount in cents
            currency: currency.toLowerCase(),
            description: description || 'Extended warranty purchase',
            automatic_payment_methods: {
                enabled: true,
            },
        });
        
        console.log(`💳 Payment intent created: ${paymentIntent.id} - £${(amount / 100).toFixed(2)}`);
        
        res.json({
            clientSecret: paymentIntent.client_secret,
            paymentIntentId: paymentIntent.id
        });
    } catch (error) {
        console.error('Stripe payment intent creation error:', error);
        res.status(500).json({ 
            error: 'Failed to create payment intent',
            message: error.message 
        });
    }
});

// GoCardless API endpoints - DISABLED - Using Stripe instead
/*
// Create redirect flow for Direct Debit mandate setup (Public)
app.post('/api/gocardless/create-redirect-flow', requireDB, async (req, res) => {
    const { amount, description, successUrl, customerEmail, customerName } = req.body;
    
    if (!amount || amount <= 0) {
        return res.status(400).json({ error: 'Invalid amount' });
    }
    
    if (!gocardless || !process.env.GOCARDLESS_ACCESS_TOKEN) {
        return res.status(503).json({ 
            error: 'Payment system not configured',
            message: 'Please add GOCARDLESS_ACCESS_TOKEN to Railway environment variables.'
        });
    }
    
    try {
        const baseUrl = req.protocol + '://' + req.get('host');
        // Note: GoCardless will append redirect_flow_id to the success URL automatically
        // GoCardless API uses snake_case
        const redirectFlowParams = {
            description: description || 'Extended warranty purchase',
            session_token: req.sessionID, // Use session ID as token
            success_redirect_url: successUrl || `${baseUrl}/warranty-registration.html?payment=success`
        };
        
        // Add prefilled customer if provided
        if (customerEmail || customerName) {
            redirectFlowParams.prefilled_customer = {};
            if (customerEmail) {
                redirectFlowParams.prefilled_customer.email = customerEmail;
            }
            if (customerName) {
                const nameParts = customerName.split(' ');
                redirectFlowParams.prefilled_customer.given_name = nameParts[0] || '';
                if (nameParts.length > 1) {
                    redirectFlowParams.prefilled_customer.family_name = nameParts.slice(1).join(' ');
                }
            }
        }
        
        const redirectFlow = await gocardless.redirectFlows.create(redirectFlowParams);
        
        console.log(`💳 GoCardless redirect flow created: ${redirectFlow.id} - £${(amount / 100).toFixed(2)}`);
        
        res.json({
            redirectFlowId: redirectFlow.id,
            redirectUrl: redirectFlow.redirect_url
        });
    } catch (error) {
        console.error('GoCardless redirect flow creation error:', error);
        res.status(500).json({ 
            error: 'Failed to create redirect flow',
            message: error.message || 'Unknown error'
        });
    }
});

// Complete redirect flow and create payment (Public) - DISABLED
/*
app.post('/api/gocardless/complete-redirect-flow', requireDB, async (req, res) => {
    const { redirectFlowId, amount, description } = req.body;
    
    if (!redirectFlowId) {
        return res.status(400).json({ error: 'Redirect flow ID is required' });
    }
    
    if (!amount || amount <= 0) {
        return res.status(400).json({ error: 'Invalid amount' });
    }
    
    if (!gocardless || !process.env.GOCARDLESS_ACCESS_TOKEN) {
        return res.status(503).json({ 
            error: 'Payment system not configured',
            message: 'Please add GOCARDLESS_ACCESS_TOKEN to Railway environment variables.'
        });
    }
    
    try {
        // Complete the redirect flow to get the mandate
        // GoCardless API uses snake_case
        const completedFlow = await gocardless.redirectFlows.complete(redirectFlowId, {
            session_token: req.sessionID
        });
        
        console.log(`✅ Redirect flow completed: ${redirectFlowId}, Mandate: ${completedFlow.links.mandate}`);
        
        // Create a payment using the mandate
        const payment = await gocardless.payments.create({
            amount: Math.round(amount), // Amount in pence
            currency: 'GBP',
            links: {
                mandate: completedFlow.links.mandate
            },
            description: description || 'Extended warranty purchase'
        });
        
        console.log(`💳 Payment created: ${payment.id} - £${(amount / 100).toFixed(2)}`);
        
        // Store payment info in database
        if (db) {
            await db.collection('payments').insertOne({
                paymentId: payment.id,
                mandateId: completedFlow.links.mandate,
                amount: amount,
                currency: 'GBP',
                status: payment.status,
                createdAt: new Date(),
                redirectFlowId: redirectFlowId
            });
        }
        
        res.json({
            paymentId: payment.id,
            mandateId: completedFlow.links.mandate,
            status: payment.status,
            amount: amount
        });
    } catch (error) {
        console.error('GoCardless payment creation error:', error);
        res.status(500).json({ 
            error: 'Failed to create payment',
            message: error.message || 'Unknown error'
        });
    }
});
*/

// GoCardless webhook endpoint (Public - but should verify webhook secret) - DISABLED
/*
app.post('/api/gocardless/webhook', requireDB, async (req, res) => {
    const signature = req.headers['webhook-signature'];
    const webhookSecret = process.env.GOCARDLESS_WEBHOOK_SECRET;
    
    // Verify webhook signature if secret is configured
    if (webhookSecret && signature) {
        // TODO: Implement webhook signature verification
        // For now, we'll trust the webhook if secret is set
    }
    
    const events = req.body.events || [];
    
    console.log(`📥 GoCardless webhook received: ${events.length} event(s)`);
    
    try {
        for (const event of events) {
            console.log(`  Event: ${event.resource_type} - ${event.action} - ${event.links[event.resource_type]}`);
            
            // Handle payment events
            if (event.resource_type === 'payments') {
                const paymentId = event.links.payment;
                
                // Update payment status in database
                if (db) {
                    await db.collection('payments').updateOne(
                        { paymentId: paymentId },
                        {
                            $set: {
                                status: event.action,
                                updatedAt: new Date(),
                                lastEvent: event
                            }
                        },
                        { upsert: true }
                    );
                }
                
                console.log(`  Payment ${paymentId} status: ${event.action}`);
            }
            
            // Handle mandate events
            if (event.resource_type === 'mandates') {
                const mandateId = event.links.mandate;
                console.log(`  Mandate ${mandateId} event: ${event.action}`);
            }
        }
        
        res.status(200).json({ received: true });
    } catch (error) {
        console.error('Error processing GoCardless webhook:', error);
        res.status(500).json({ error: 'Webhook processing failed' });
    }
});
*/

// Register warranty (Public)
// Reconditioning request endpoint
app.post('/api/reconditioning-request', requireDB, async (req, res) => {
    try {
        const { name, email, phone, address, part_model_number, part_name, generation, security_barcode, ebay_order_number } = req.body;
        
        // Validate required fields
        if (!name || !email || !phone || !address) {
            return res.status(400).json({ 
                success: false, 
                error: 'Missing required fields: name, email, phone, and address are required' 
            });
        }
        
        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ 
                success: false, 
                error: 'Invalid email format' 
            });
        }
        
        const db = req.db;
        const reconditioningCollection = db.collection('reconditioning_requests');
        
        // Insert reconditioning request
        const requestData = {
            name,
            email,
            phone,
            address,
            part_model_number: part_model_number || null,
            part_name: part_name || null,
            generation: generation || null,
            security_barcode: security_barcode || null,
            ebay_order_number: ebay_order_number || null,
            status: 'pending',
            created_at: new Date(),
            updated_at: new Date()
        };
        
        const result = await reconditioningCollection.insertOne(requestData);
        
        console.log(`[Reconditioning] New request created: ${result.insertedId} for ${email}`);
        
        res.json({
            success: true,
            request_id: result.insertedId,
            message: 'Reconditioning request submitted successfully'
        });
    } catch (error) {
        console.error('[Reconditioning] Error processing request:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to process reconditioning request' 
        });
    }
});

// Helper function to initialize email transporter from database settings
async function initializeEmailFromDatabase(db) {
    if (!nodemailer) {
        return null;
    }
    
    try {
        const settingsDoc = await db.collection('settings').findOne({ type: 'system' });
        if (settingsDoc && settingsDoc.settings && settingsDoc.settings.email_settings) {
            const emailSettings = settingsDoc.settings.email_settings;
            if (emailSettings.smtp_host && emailSettings.smtp_user && emailSettings.smtp_pass) {
                return nodemailer.createTransport({
                    host: emailSettings.smtp_host,
                    port: emailSettings.smtp_port || 587,
                    secure: emailSettings.smtp_secure === true,
                    auth: {
                        user: emailSettings.smtp_user,
                        pass: emailSettings.smtp_pass
                    }
                });
            }
        }
    } catch (err) {
        console.error('Error loading email settings from database:', err);
    }
    
    return null;
}

// Helper function to send warranty confirmation email
async function sendWarrantyConfirmationEmail(warranty, product, db) {
    // Try to get transporter from database first, then fall back to global
    let transporter = emailTransporter;
    
    if (!transporter && db && nodemailer) {
        transporter = await initializeEmailFromDatabase(db);
        if (transporter) {
            emailTransporter = transporter; // Cache it
        }
    }
    
    if (!transporter || !nodemailer) {
        console.log('Email service not configured - skipping email send');
        return;
    }
    
    try {
        const warrantyPlanMap = {
            'none': 'Standard 30-day warranty',
            '3month': '3 Month Extended Warranty',
            '6month': '6 Month Extended Warranty',
            '12month': '12 Month Extended Warranty'
        };
        
        const warrantyPlanName = warrantyPlanMap[warranty.extended_warranty] || 'Standard 30-day warranty';
        
        // Format dates
        const regDate = new Date(warranty.registration_date).toLocaleDateString('en-GB', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        
        const standardEndDate = new Date(warranty.standard_warranty_end).toLocaleDateString('en-GB', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        
        let extendedEndDateText = '';
        if (warranty.extended_warranty && warranty.extended_warranty !== 'none' && warranty.extended_warranty_end) {
            extendedEndDateText = `\nExtended Warranty End Date: ${new Date(warranty.extended_warranty_end).toLocaleDateString('en-GB', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            })}`;
        }
        
        const productName = product?.part_name || 'AirPod Replacement Part';
        const totalPrice = warranty.warranty_price || 0;
        
        // Calculate warranty price and accessories price separately
        const warrantyPrice = warranty.extended_warranty && warranty.extended_warranty !== 'none' ? 
            (warranty.warranty_price - (warranty.accessories?.reduce((sum, acc) => sum + (acc.price || 0), 0) || 0)) : 0;
        const accessoriesPrice = warranty.accessories?.reduce((sum, acc) => sum + (acc.price || 0), 0) || 0;
        
        // Build accessories HTML
        let accessoriesHtml = '';
        let accessoriesText = '';
        if (warranty.accessories && warranty.accessories.length > 0) {
            accessoriesHtml = '<div class="receipt-item"><span><strong>Accessories:</strong></span><span>';
            accessoriesText = '\nAccessories:\n';
            warranty.accessories.forEach((acc, index) => {
                const accPrice = parseFloat(acc.price || 0);
                accessoriesHtml += `${acc.name} (£${accPrice.toFixed(2)})${index < warranty.accessories.length - 1 ? ', ' : ''}`;
                accessoriesText += `  - ${acc.name}: £${accPrice.toFixed(2)}\n`;
            });
            accessoriesHtml += '</span></div>';
        }
        
        const emailHtml = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #007bff; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 8px 8px; }
        .success-icon { font-size: 48px; text-align: center; color: #28a745; margin: 20px 0; }
        .receipt-box { background: white; border: 2px solid #dee2e6; border-radius: 8px; padding: 20px; margin: 20px 0; }
        .receipt-item { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #e9ecef; }
        .receipt-item:last-child { border-bottom: none; }
        .receipt-total { margin-top: 20px; padding-top: 20px; border-top: 2px solid #dee2e6; font-size: 18px; font-weight: bold; }
        .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Warranty Registration Confirmed</h1>
        </div>
        <div class="content">
            <div class="success-icon">✓</div>
            <h2 style="text-align: center; color: #28a745;">Thank You!</h2>
            <p>Dear ${warranty.customer_name},</p>
            <p>Your warranty registration has been successfully completed. Please find your receipt and warranty details below.</p>
            
            <div class="receipt-box">
                <h3 style="margin-top: 0;">Receipt</h3>
                <div class="receipt-item">
                    <span><strong>Warranty ID:</strong></span>
                    <span>${warranty.warranty_id}</span>
                </div>
                <div class="receipt-item">
                    <span><strong>Registration Date:</strong></span>
                    <span>${regDate}</span>
                </div>
                <div class="receipt-item">
                    <span><strong>Product:</strong></span>
                    <span>${productName}</span>
                </div>
                <div class="receipt-item">
                    <span><strong>Warranty Plan:</strong></span>
                    <span>${warrantyPlanName}</span>
                </div>
                <div class="receipt-item">
                    <span><strong>Standard Warranty End:</strong></span>
                    <span>${standardEndDate}</span>
                </div>
                ${extendedEndDateText ? `<div class="receipt-item"><span><strong>Extended Warranty End:</strong></span><span>${extendedEndDateText.replace('Extended Warranty End Date: ', '')}</span></div>` : ''}
                ${warrantyPrice > 0 ? `<div class="receipt-item"><span><strong>Extended Warranty:</strong></span><span>£${warrantyPrice.toFixed(2)}</span></div>` : ''}
                ${accessoriesHtml}
                <div class="receipt-total">
                    <span>Total Paid:</span>
                    <span>£${totalPrice.toFixed(2)}</span>
                </div>
            </div>
            
            <h3>Important Information</h3>
            <ul>
                <li><strong>Keep your Warranty ID safe:</strong> ${warranty.warranty_id}</li>
                <li>Your standard 30-day warranty is active from ${regDate}</li>
                ${warranty.extended_warranty && warranty.extended_warranty !== 'none' ? `<li>Your extended warranty is active until ${extendedEndDateText.replace('Extended Warranty End Date: ', '')}</li>` : ''}
                <li>If you need to make a claim, please contact support with your Warranty ID</li>
            </ul>
            
            <p>Thank you for choosing LJM AirPod Support!</p>
        </div>
        <div class="footer">
            <p>&copy; 2024 LJM. All rights reserved.</p>
            <p>This is an automated email. Please do not reply.</p>
        </div>
    </div>
</body>
</html>
        `;
        
        const emailText = `
Warranty Registration Confirmed

Dear ${warranty.customer_name},

Your warranty registration has been successfully completed.

Receipt:
---------
Warranty ID: ${warranty.warranty_id}
Registration Date: ${regDate}
Product: ${productName}
Warranty Plan: ${warrantyPlanName}
Standard Warranty End: ${standardEndDate}${extendedEndDateText ? '\nExtended Warranty End: ' + extendedEndDateText.replace('Extended Warranty End Date: ', '') : ''}${warrantyPrice > 0 ? '\nExtended Warranty: £' + warrantyPrice.toFixed(2) : ''}${accessoriesText}
Total Paid: £${totalPrice.toFixed(2)}

Important Information:
- Keep your Warranty ID safe: ${warranty.warranty_id}
- Your standard 30-day warranty is active from ${regDate}
${warranty.extended_warranty && warranty.extended_warranty !== 'none' ? `- Your extended warranty is active until ${extendedEndDateText.replace('Extended Warranty End Date: ', '')}\n` : ''}
- If you need to make a claim, please contact support with your Warranty ID

Thank you for choosing LJM AirPod Support!

---
© 2024 LJM. All rights reserved.
This is an automated email. Please do not reply.
        `;
        
        // Get from email - prefer database settings, then env vars, then smtp_user
        let fromEmail = warranty.customer_email; // fallback
        if (db) {
            try {
                const settingsDoc = await db.collection('settings').findOne({ type: 'system' });
                if (settingsDoc?.settings?.email_settings?.smtp_from) {
                    fromEmail = settingsDoc.settings.email_settings.smtp_from;
                } else if (settingsDoc?.settings?.email_settings?.smtp_user) {
                    fromEmail = settingsDoc.settings.email_settings.smtp_user;
                }
            } catch (err) {
                // Fall through to env vars
            }
        }
        if (fromEmail === warranty.customer_email) {
            fromEmail = process.env.SMTP_FROM || process.env.SMTP_USER || warranty.customer_email;
        }
        
        const mailOptions = {
            from: fromEmail,
            to: warranty.customer_email,
            subject: `Warranty Registration Confirmed - ${warranty.warranty_id}`,
            text: emailText,
            html: emailHtml
        };
        
        const info = await transporter.sendMail(mailOptions);
        console.log(`✅ Confirmation email sent to ${warranty.customer_email}:`, info.messageId);
    } catch (error) {
        console.error('Error sending confirmation email:', error);
        throw error; // Re-throw so caller can handle it
    }
}

// Track page views (cookie-based tracking)
app.post('/api/track/page-view', requireDB, async (req, res) => {
    try {
        const {
            tracking_id,
            session_id,
            page,
            referrer,
            timestamp,
            user_agent,
            screen_width,
            screen_height
        } = req.body;

        if (!tracking_id || !session_id || !page) {
            return res.status(400).json({ error: 'tracking_id, session_id, and page are required' });
        }

        const pageView = {
            tracking_id,
            session_id,
            page,
            referrer: referrer || 'direct',
            timestamp: timestamp ? new Date(timestamp) : new Date(),
            user_agent: user_agent || req.get('user-agent') || null,
            screen_width: screen_width || null,
            screen_height: screen_height || null,
            ip_address: req.ip || req.connection.remoteAddress
        };

        // Insert page view
        await db.collection('page_views').insertOne(pageView);

        // Update or create user session
        await db.collection('user_sessions').updateOne(
            { session_id },
            {
                $set: {
                    last_page: page,
                    last_updated: new Date(),
                    updated_at: new Date()
                },
                $setOnInsert: {
                    session_id,
                    tracking_id,
                    started_at: new Date(),
                    created_at: new Date(),
                    page_views: []
                },
                $push: {
                    page_views: {
                        $each: [{
                            page,
                            timestamp: new Date(),
                            referrer: referrer || 'direct'
                        }],
                        $slice: -100 // Keep last 100 page views
                    }
                }
            },
            { upsert: true }
        );

        res.json({ success: true });
    } catch (error) {
        console.error('Error tracking page view:', error);
        res.status(500).json({ error: 'Failed to track page view' });
    }
});

// Track user interactions (clicks, form submissions, etc.)
app.post('/api/track/interaction', requireDB, async (req, res) => {
    try {
        const {
            tracking_id,
            session_id,
            interaction_type,
            interaction_data,
            timestamp,
            page
        } = req.body;

        if (!tracking_id || !session_id || !interaction_type) {
            return res.status(400).json({ error: 'tracking_id, session_id, and interaction_type are required' });
        }

        const interaction = {
            tracking_id,
            session_id,
            interaction_type, // 'click', 'form_submit', 'button_click', 'link_click', etc.
            interaction_data: interaction_data || {},
            page: page || req.path,
            timestamp: timestamp ? new Date(timestamp) : new Date(),
            ip_address: req.ip || req.connection.remoteAddress
        };

        // Insert interaction
        await db.collection('user_interactions').insertOne(interaction);

        // Update session with interaction
        await db.collection('user_sessions').updateOne(
            { session_id },
            {
                $set: {
                    last_interaction: interaction_type,
                    last_interaction_time: new Date(),
                    last_updated: new Date()
                },
                $push: {
                    interactions: {
                        $each: [{
                            type: interaction_type,
                            data: interaction_data || {},
                            timestamp: new Date()
                        }],
                        $slice: -200 // Keep last 200 interactions
                    }
                }
            },
            { upsert: true }
        );

        res.json({ success: true });
    } catch (error) {
        console.error('Error tracking interaction:', error);
        res.status(500).json({ error: 'Failed to track interaction' });
    }
});

// Track cookie consent
app.post('/api/track/cookie-consent', requireDB, async (req, res) => {
    try {
        const { consent_type, timestamp } = req.body;

        if (!consent_type) {
            return res.status(400).json({ error: 'consent_type is required' });
        }

        const consent = {
            consent_type,
            timestamp: timestamp ? new Date(timestamp) : new Date(),
            ip_address: req.ip || req.connection.remoteAddress,
            user_agent: req.get('user-agent') || null
        };

        await db.collection('cookie_consents').insertOne(consent);

        res.json({ success: true });
    } catch (error) {
        console.error('Error tracking cookie consent:', error);
        res.status(500).json({ error: 'Failed to track consent' });
    }
});

// Track registration session events
app.post('/api/track/registration-event', requireDB, async (req, res) => {
    try {
        const {
            session_id,
            event_type,
            step_number,
            security_barcode,
            event_data,
            timestamp
        } = req.body;
        
        if (!session_id || !event_type) {
            return res.status(400).json({ error: 'session_id and event_type are required' });
        }
        
        const event = {
            session_id,
            event_type, // 'session_start', 'step_viewed', 'step_completed', 'drop_off', 'completed'
            step_number: step_number || null,
            security_barcode: security_barcode || null,
            event_data: event_data || {},
            timestamp: timestamp ? new Date(timestamp) : new Date(),
            ip_address: req.ip || req.connection.remoteAddress,
            user_agent: req.get('user-agent') || null
        };
        
        // Insert event into tracking collection
        await db.collection('registration_tracking').insertOne(event);
        
        // Handle session_start specially - create new session
        if (event_type === 'session_start') {
            await db.collection('registration_sessions').insertOne({
                session_id,
                security_barcode: security_barcode || null,
                started_at: new Date(),
                created_at: new Date(),
                status: 'active',
                last_event: event_type,
                last_step: step_number || null,
                last_updated: new Date(),
                events: [event]
            });
        } else {
            // Update or create session summary for other events
            const sessionUpdate = {
                $set: {
                    last_event: event_type,
                    last_step: step_number || null,
                    last_updated: new Date(),
                    updated_at: new Date()
                },
                $setOnInsert: {
                    session_id,
                    security_barcode: security_barcode || null,
                    started_at: new Date(),
                    created_at: new Date(),
                    status: 'active',
                    events: []
                }
            };
            
            // Add event to events array
            await db.collection('registration_sessions').updateOne(
                { session_id },
                {
                    ...sessionUpdate,
                    $push: {
                        events: {
                            $each: [event],
                            $slice: -100 // Keep last 100 events
                        }
                    }
                },
                { upsert: true }
            );
        }
        
        // If drop_off or completed, update session status
        if (event_type === 'drop_off' || event_type === 'completed') {
            await db.collection('registration_sessions').updateOne(
                { session_id },
                {
                    $set: {
                        status: event_type === 'completed' ? 'completed' : 'abandoned',
                        completed_at: event_type === 'completed' ? new Date() : null,
                        abandoned_at: event_type === 'drop_off' ? new Date() : null
                    }
                }
            );
        }
        
        res.json({ success: true });
    } catch (error) {
        console.error('Error tracking registration event:', error);
        res.status(500).json({ error: 'Failed to track event' });
    }
});

// Get registration analytics for admin
app.get('/api/admin/registration-analytics', requireAuth, requireDB, async (req, res) => {
    try {
        const { startDate, endDate, groupBy = 'day' } = req.query;
        
        const matchStage = {};
        if (startDate || endDate) {
            matchStage.started_at = {};
            if (startDate) matchStage.started_at.$gte = new Date(startDate);
            if (endDate) matchStage.started_at.$lte = new Date(endDate);
        }
        
        // Get session summaries
        const sessions = await db.collection('registration_sessions')
            .find(matchStage)
            .sort({ started_at: -1 })
            .limit(1000)
            .toArray();
        
        // Calculate statistics
        const stats = {
            total_sessions: sessions.length,
            completed: sessions.filter(s => s.status === 'completed').length,
            abandoned: sessions.filter(s => s.status === 'abandoned').length,
            active: sessions.filter(s => s.status === 'active').length,
            completion_rate: sessions.length > 0 
                ? (sessions.filter(s => s.status === 'completed').length / sessions.length * 100).toFixed(2)
                : 0,
            drop_off_by_step: {},
            average_time_to_complete: null,
            sessions_by_date: {}
        };
        
        // Calculate drop-off by step
        sessions.forEach(session => {
            if (session.status === 'abandoned' && session.last_step) {
                stats.drop_off_by_step[session.last_step] = 
                    (stats.drop_off_by_step[session.last_step] || 0) + 1;
            }
            
            // Group by date
            if (session.started_at) {
                const dateKey = session.started_at.toISOString().split('T')[0];
                if (!stats.sessions_by_date[dateKey]) {
                    stats.sessions_by_date[dateKey] = { total: 0, completed: 0, abandoned: 0 };
                }
                stats.sessions_by_date[dateKey].total++;
                if (session.status === 'completed') stats.sessions_by_date[dateKey].completed++;
                if (session.status === 'abandoned') stats.sessions_by_date[dateKey].abandoned++;
            }
        });
        
        // Calculate average time to complete
        const completedSessions = sessions.filter(s => s.status === 'completed' && s.completed_at && s.started_at);
        if (completedSessions.length > 0) {
            const totalTime = completedSessions.reduce((sum, s) => {
                return sum + (s.completed_at.getTime() - s.started_at.getTime());
            }, 0);
            stats.average_time_to_complete = Math.round(totalTime / completedSessions.length / 1000); // in seconds
        }
        
        res.json({
            success: true,
            stats,
            sessions: sessions.slice(0, 100) // Return first 100 sessions for detail view
        });
    } catch (error) {
        console.error('Error fetching registration analytics:', error);
        res.status(500).json({ error: 'Failed to fetch analytics' });
    }
});

// Get site analytics (cookie-based tracking)
app.get('/api/admin/site-analytics', requireAuth, requireDB, async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        
        const matchStage = {};
        if (startDate || endDate) {
            matchStage.timestamp = {};
            if (startDate) matchStage.timestamp.$gte = new Date(startDate);
            if (endDate) {
                const end = new Date(endDate);
                end.setHours(23, 59, 59, 999);
                matchStage.timestamp.$lte = end;
            }
        }
        
        // Get page views
        const pageViews = await db.collection('page_views')
            .find(matchStage)
            .toArray();
        
        // Get unique visitors
        const uniqueVisitors = await db.collection('page_views')
            .distinct('tracking_id', matchStage);
        
        // Get active sessions (sessions updated in last 30 minutes)
        const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
        const activeSessions = await db.collection('user_sessions')
            .countDocuments({ last_updated: { $gte: thirtyMinutesAgo } });
        
        // Get interactions
        const interactions = await db.collection('user_interactions')
            .find(matchStage)
            .toArray();
        
        // Get sessions
        const sessions = await db.collection('user_sessions')
            .find(matchStage.started_at ? { started_at: matchStage.timestamp } : {})
            .sort({ started_at: -1 })
            .limit(100)
            .toArray();
        
        // Calculate top pages
        const pageCounts = {};
        pageViews.forEach(pv => {
            pageCounts[pv.page] = (pageCounts[pv.page] || 0) + 1;
        });
        const topPages = Object.entries(pageCounts)
            .map(([page, count]) => ({ page, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);
        
        // Calculate interactions by type
        const interactionCounts = {};
        interactions.forEach(interaction => {
            const type = interaction.interaction_type || 'unknown';
            interactionCounts[type] = (interactionCounts[type] || 0) + 1;
        });
        
        // Calculate average session duration
        let totalDuration = 0;
        let sessionCount = 0;
        sessions.forEach(session => {
            if (session.started_at && session.last_updated) {
                const duration = (new Date(session.last_updated) - new Date(session.started_at)) / 1000;
                if (duration > 0) {
                    totalDuration += duration;
                    sessionCount++;
                }
            }
        });
        const avgSessionDuration = sessionCount > 0 ? Math.round(totalDuration / sessionCount) : 0;
        
        const stats = {
            total_page_views: pageViews.length,
            unique_visitors: uniqueVisitors.length,
            active_sessions: activeSessions,
            total_interactions: interactions.length,
            avg_session_duration: avgSessionDuration
        };
        
        res.json({
            stats,
            top_pages: topPages,
            interactions_by_type: interactionCounts,
            sessions: sessions.map(s => ({
                ...s,
                started_at: s.started_at,
                last_updated: s.last_updated
            }))
        });
    } catch (error) {
        console.error('Error getting site analytics:', error);
        res.status(500).json({ error: 'Failed to get site analytics' });
    }
});

// Get cookie consent analytics
app.get('/api/admin/cookie-analytics', requireAuth, requireDB, async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        
        const matchStage = {};
        if (startDate || endDate) {
            matchStage.timestamp = {};
            if (startDate) matchStage.timestamp.$gte = new Date(startDate);
            if (endDate) {
                const end = new Date(endDate);
                end.setHours(23, 59, 59, 999);
                matchStage.timestamp.$lte = end;
            }
        }
        
        const consents = await db.collection('cookie_consents')
            .find(matchStage)
            .toArray();
        
        // Calculate consent distribution
        const consentDistribution = {};
        consents.forEach(consent => {
            const type = consent.consent_type || 'unknown';
            consentDistribution[type] = (consentDistribution[type] || 0) + 1;
        });
        
        const stats = {
            total_consents: consents.length,
            accept_all: consentDistribution['all_cookies'] || 0,
            essential_only: consentDistribution['essential_only'] || 0,
            custom: consentDistribution['custom'] || 0
        };
        
        res.json({
            stats,
            consent_distribution: consentDistribution
        });
    } catch (error) {
        console.error('Error getting cookie analytics:', error);
        res.status(500).json({ error: 'Failed to get cookie analytics' });
    }
});

// Get user journey for a specific tracking ID
app.get('/api/admin/user-journey', requireAuth, requireDB, async (req, res) => {
    try {
        const { tracking_id } = req.query;
        
        if (!tracking_id) {
            return res.status(400).json({ error: 'tracking_id is required' });
        }
        
        // Get all page views for this tracking ID
        const pageViews = await db.collection('page_views')
            .find({ tracking_id })
            .sort({ timestamp: 1 })
            .toArray();
        
        // Get all interactions for this tracking ID
        const interactions = await db.collection('user_interactions')
            .find({ tracking_id })
            .sort({ timestamp: 1 })
            .toArray();
        
        // Combine and sort by timestamp
        const journey = [
            ...pageViews.map(pv => ({
                type: 'page_view',
                page: pv.page,
                timestamp: pv.timestamp,
                referrer: pv.referrer
            })),
            ...interactions.map(inter => ({
                type: 'interaction',
                interaction_type: inter.interaction_type,
                interaction_data: inter.interaction_data,
                page: inter.page,
                timestamp: inter.timestamp
            }))
        ].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        
        res.json({
            tracking_id,
            journey,
            total_page_views: pageViews.length,
            total_interactions: interactions.length
        });
    } catch (error) {
        console.error('Error getting user journey:', error);
        res.status(500).json({ error: 'Failed to get user journey' });
    }
});

app.post('/api/warranty/register', requireDB, async (req, res) => {
    const {
        security_barcode,
        customer_name,
        customer_email,
        customer_phone,
        billing_address,
        extended_warranty,
        marketing_consent,
        warranty_price,
        payment_intent_id,
        terms_version,
        terms_accepted,
        accessories
    } = req.body;
    
    // Check if user wants to register warranty (if they opted out, they might skip this)
    // For now, we require basic info if they're calling this endpoint
    // Frontend should handle skipping if they don't want warranty
    
    // Validation
    if (!security_barcode) {
        return res.status(400).json({ 
            error: 'Security barcode is required' 
        });
    }
    
    // If registering warranty, require customer info
    if (!customer_name || !customer_email) {
        return res.status(400).json({ 
            error: 'Customer name and email are required for warranty registration' 
        });
    }
    
    // Validate terms acceptance
    if (!terms_accepted) {
        return res.status(400).json({ 
            error: 'You must accept the Terms & Conditions to register a warranty' 
        });
    }
    
    // Get current terms version if not provided
    let finalTermsVersion = terms_version;
    if (!finalTermsVersion) {
        try {
            const currentTerms = await db.collection('warranty_terms').findOne(
                {},
                { sort: { version: -1 } }
            );
            finalTermsVersion = currentTerms ? currentTerms.version : 1;
        } catch (err) {
            console.error('Error fetching current terms version:', err);
            finalTermsVersion = 1; // Default to version 1 if error
        }
    }
    
    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(customer_email)) {
        return res.status(400).json({ error: 'Invalid email address' });
    }
    
    // Verify product exists
    try {
        // Search for barcode with or without hyphens
        const barcodeQuery = createSecurityBarcodeQuery(security_barcode);
        const product = await db.collection('products').findOne(barcodeQuery);
        
        if (!product) {
            return res.status(404).json({ error: 'Product not found' });
        }
        
        // Use the product's actual security_barcode (may have hyphens) for warranty lookup
        const productBarcode = product.security_barcode;
        
        // Check if warranty already registered for this product
        // Use the same query function to handle both formats
        const warrantyQuery = createSecurityBarcodeQuery(productBarcode);
        const existingWarranty = await db.collection('warranties').findOne(warrantyQuery);
        
        if (existingWarranty) {
            return res.status(409).json({ 
                error: 'Warranty already registered for this product',
                warranty_id: existingWarranty.warranty_id
            });
        }
        
        // Generate unique warranty ID
        const warrantyId = 'WR-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9).toUpperCase();
        
        // Calculate warranty dates
        const registrationDate = new Date();
        const standardWarrantyEnd = new Date(registrationDate);
        standardWarrantyEnd.setDate(standardWarrantyEnd.getDate() + 30); // 30 days
        
        let extendedWarrantyEnd = null;
        if (extended_warranty && extended_warranty !== 'none') {
            extendedWarrantyEnd = new Date(standardWarrantyEnd);
            const months = extended_warranty === '3months' ? 3 : extended_warranty === '6months' ? 6 : 12;
            extendedWarrantyEnd.setMonth(extendedWarrantyEnd.getMonth() + months);
        }
        
        // If extended warranty was purchased, verify payment
        if (extended_warranty && extended_warranty !== 'none' && warranty_price > 0) {
            if (!payment_intent_id) {
                return res.status(400).json({ 
                    error: 'Payment required for extended warranty' 
                });
            }
            
            // Verify payment intent was successful
            try {
                const paymentIntent = await stripe.paymentIntents.retrieve(payment_intent_id);
                
                if (paymentIntent.status !== 'succeeded') {
                    return res.status(400).json({ 
                        error: 'Payment not completed. Please complete payment first.' 
                    });
                }
                
                // Verify amount matches
                if (paymentIntent.amount !== Math.round(warranty_price * 100)) {
                    return res.status(400).json({ 
                        error: 'Payment amount mismatch' 
                    });
                }
                
                console.log(`✅ Payment verified: ${paymentIntent.id} - £${(paymentIntent.amount / 100).toFixed(2)}`);
            } catch (stripeErr) {
                console.error('Stripe verification error:', stripeErr);
                return res.status(400).json({ 
                    error: 'Payment verification failed. Please contact support.' 
                });
            }
        }
        
        const warranty = {
            warranty_id: warrantyId,
            security_barcode: productBarcode, // Use product's actual barcode (with hyphens if stored that way)
            product_id: product._id.toString(),
            customer_name: customer_name.trim(),
            customer_email: customer_email.trim().toLowerCase(),
            customer_phone: customer_phone ? customer_phone.trim() : null,
            billing_address: billing_address ? {
                line1: billing_address.line1 ? billing_address.line1.trim() : null,
                line2: billing_address.line2 ? billing_address.line2.trim() : null,
                city: billing_address.city ? billing_address.city.trim() : null,
                postcode: billing_address.postcode ? billing_address.postcode.trim().toUpperCase() : null,
                country: billing_address.country ? billing_address.country.trim().toUpperCase() : null
            } : null,
            standard_warranty_start: registrationDate,
            standard_warranty_end: standardWarrantyEnd,
            extended_warranty: extended_warranty || 'none',
            extended_warranty_end: extendedWarrantyEnd,
            warranty_price: warranty_price || 0,
            payment_intent_id: payment_intent_id || null,
            payment_status: payment_intent_id ? 'paid' : 'free',
            marketing_consent: marketing_consent || false,
            terms_version: finalTermsVersion,
            terms_accepted: true,
            terms_accepted_date: registrationDate,
            registration_date: registrationDate,
            status: 'active',
            claims_count: 0,
            last_claim_date: null,
            accessories: accessories || [] // Store accessories data
        };
        
        const result = await db.collection('warranties').insertOne(warranty);
        
        console.log(`✅ Warranty registered: ${warrantyId} for product ${security_barcode}`);
        console.log(`   Customer: ${customer_name} (${customer_email})`);
        console.log(`   Extended warranty: ${extended_warranty || 'none'} (£${warranty_price || 0})`);
        
        // Send confirmation email (non-blocking - don't fail registration if email fails)
        // Get product name for email
        let productName = 'AirPod Replacement Part';
        if (product && product.part_name) {
            productName = product.part_name;
        }
        sendWarrantyConfirmationEmail(warranty, { part_name: productName }, db).catch(err => {
            console.error('Failed to send confirmation email:', err);
            // Don't throw - email failure shouldn't break registration
        });
        
        res.json({
            success: true,
            message: 'Warranty registered successfully',
            warranty_id: warrantyId,
            warranty: {
                id: warrantyId,
                standard_end: standardWarrantyEnd,
                extended_end: extendedWarrantyEnd,
                price: warranty_price || 0
            }
        });
    } catch (err) {
        if (err.code === 11000) {
            res.status(409).json({ error: 'Warranty ID conflict. Please try again.' });
        } else {
            console.error('Database error:', err);
            res.status(500).json({ error: 'Database error: ' + err.message });
        }
    }
});

// Get warranty details by warranty_id (public endpoint for completion page)
app.get('/api/warranty/:warrantyId', requireDB, async (req, res) => {
    const warrantyId = req.params.warrantyId;
    
    try {
        const warranty = await db.collection('warranties').findOne({ warranty_id: warrantyId });
        
        if (!warranty) {
            return res.status(404).json({ error: 'Warranty not found' });
        }
        
        // Get product info
        let productName = 'AirPod Replacement Part';
        if (warranty.product_id) {
            try {
                const product = await db.collection('products').findOne({ _id: new ObjectId(warranty.product_id) });
                if (product && product.part_name) {
                    productName = product.part_name;
                }
            } catch (err) {
                console.error('Error fetching product:', err);
            }
        }
        
        // Format response
        res.json({
            warranty_id: warranty.warranty_id,
            customer_email: warranty.customer_email,
            customer_name: warranty.customer_name,
            product_name: productName,
            extended_warranty: warranty.extended_warranty || 'none',
            warranty_price: warranty.warranty_price || 0,
            registration_date: warranty.registration_date,
            standard_warranty_end: warranty.standard_warranty_end,
            extended_warranty_end: warranty.extended_warranty_end,
            payment_status: warranty.payment_status,
            status: warranty.status,
            accessories: warranty.accessories || []
        });
    } catch (err) {
        console.error('Error fetching warranty:', err);
        res.status(500).json({ error: 'Database error: ' + err.message });
    }
});

// List all warranties (Admin only)
app.get('/api/admin/warranties', requireAuth, requireDB, async (req, res) => {
    console.log('[WARRANTIES] Request received');
    console.log('[WARRANTIES] User:', req.user?.email || 'no user data');
    console.log('[WARRANTIES] User Level:', req.user?.userLevel || 'N/A');

    try {
        const warranties = await db.collection('warranties')
            .find({})
            .sort({ registration_date: -1 })
            .limit(1000) // Limit to prevent overwhelming response
            .toArray();

        console.log(`[WARRANTIES] ✅ Found ${warranties.length} warranties`);

        // Format warranties for display
        const formattedWarranties = warranties.map(warranty => ({
            id: warranty._id.toString(),
            warranty_id: warranty.warranty_id,
            security_barcode: warranty.security_barcode,
            customer_name: warranty.customer_name,
            customer_email: warranty.customer_email,
            customer_phone: warranty.customer_phone,
            extended_warranty: warranty.extended_warranty,
            warranty_price: warranty.warranty_price,
            payment_status: warranty.payment_status,
            status: warranty.status,
            registration_date: warranty.registration_date,
            standard_warranty_end: warranty.standard_warranty_end,
            extended_warranty_end: warranty.extended_warranty_end,
            marketing_consent: warranty.marketing_consent
        }));

        console.log(`[WARRANTIES] ✅ Returning ${formattedWarranties.length} formatted warranties`);
        res.json({ warranties: formattedWarranties });
    } catch (err) {
        console.error('[WARRANTIES] ❌ Database error:', err);
        res.status(500).json({ error: 'Database error: ' + err.message });
    }
});

// Delete warranty (Admin only)
app.delete('/api/admin/warranty/:id', requireAuth, requireDB, async (req, res) => {
    const id = req.params.id;
    
    try {
        if (!ObjectId.isValid(id)) {
            return res.status(400).json({ error: 'Invalid warranty ID' });
        }
        
        const result = await db.collection('warranties').deleteOne({ _id: new ObjectId(id) });
        
        if (result.deletedCount === 0) {
            res.status(404).json({ error: 'Warranty not found' });
        } else {
            console.log(`✅ Warranty deleted: ${id}`);
            res.json({ success: true, message: 'Warranty deleted successfully' });
        }
    } catch (err) {
        console.error('Database error:', err);
        res.status(500).json({ error: 'Database error: ' + err.message });
    }
});

// Search for product by serial number, eBay order number, or security barcode (Admin only)
app.get('/api/admin/search-product', requireAuth, requireDB, async (req, res) => {
    try {
        const { serial_number, ebay_order_number, security_barcode } = req.query;
        
        if (!serial_number && !ebay_order_number && !security_barcode) {
            return res.status(400).json({ error: 'Please provide serial_number, ebay_order_number, or security_barcode' });
        }
        
        // Build search query - if multiple criteria provided, use AND logic (all must match)
        // If only security_barcode, use the special $or query for hyphen handling
        let query = {};
        
        if (security_barcode && !serial_number && !ebay_order_number) {
            // Only security_barcode provided - use the special query for hyphen handling
            const barcodeQuery = createSecurityBarcodeQuery(security_barcode.trim());
            if (barcodeQuery) {
                query = barcodeQuery;
            } else {
                return res.status(400).json({ error: 'Invalid security barcode format' });
            }
        } else {
            // Multiple criteria or single non-barcode criteria - build standard query
            if (serial_number) {
                query.serial_number = serial_number.trim();
            }
            if (ebay_order_number) {
                query.ebay_order_number = ebay_order_number.trim();
            }
            if (security_barcode) {
                // When combined with other fields, we need to handle the $or properly
                // Use the normalized version for exact match, or include $or in a $and
                const normalized = normalizeSecurityBarcode(security_barcode.trim());
                const original = security_barcode.trim().toUpperCase();
                // Try exact matches first, then regex if needed
                query.$or = [
                    { security_barcode: original },
                    { security_barcode: normalized },
                    { security_barcode: { $regex: '^' + normalized.split('').join('[-]?') + '$', $options: 'i' } }
                ];
            }
        }
        
        console.log('🔍 Search query:', JSON.stringify(query));
        
        // Search for product
        const product = await db.collection('products').findOne(query);
        
        if (!product) {
            console.log('❌ Product not found with query:', JSON.stringify(query));
            return res.status(404).json({ error: 'Product not found' });
        }
        
        console.log('✅ Product found:', product.security_barcode);
        
        // Get associated warranty if exists
        const productBarcode = product.security_barcode;
        const warrantyQuery = createSecurityBarcodeQuery(productBarcode);
        const warranty = await db.collection('warranties').findOne(warrantyQuery);
        
        // Format product data
        const productData = {
            id: product._id.toString(),
            serial_number: product.serial_number,
            security_barcode: product.security_barcode,
            ebay_order_number: product.ebay_order_number || null,
            part_type: product.part_type,
            generation: product.generation || null,
            part_model_number: product.part_model_number || null,
            notes: product.notes || null,
            photos: product.photos || [],
            tracking_number: product.tracking_number || null,
            tracking_date: product.tracking_date || null,
            date_added: product.date_added,
            confirmation_checked: product.confirmation_checked || false,
            confirmation_date: product.confirmation_date || null,
            status: product.status || 'active',
            return_reason: product.return_reason || null,
            refund_amount: product.refund_amount || null,
            original_postage_packaging: product.original_postage_packaging || null,
            return_postage_cost: product.return_postage_cost || null,
            return_date: product.return_date || null,
            return_count: product.return_count || 0,
            total_refund_amount: product.total_refund_amount || 0,
            total_postage_lost: product.total_postage_lost || 0,
            total_return_cost: product.total_return_cost || null,
            last_return_date: product.last_return_date || null
        };
        
        // Format warranty data if exists
        let warrantyData = null;
        if (warranty) {
            warrantyData = {
                id: warranty._id.toString(),
                warranty_id: warranty.warranty_id,
                customer_name: warranty.customer_name,
                customer_email: warranty.customer_email,
                customer_phone: warranty.customer_phone || null,
                billing_address: warranty.billing_address || null,
                extended_warranty: warranty.extended_warranty || 'none',
                extended_warranty_end: warranty.extended_warranty_end || null,
                warranty_price: warranty.warranty_price || 0,
                payment_intent_id: warranty.payment_intent_id || null,
                payment_status: warranty.payment_status || 'free',
                marketing_consent: warranty.marketing_consent || false,
                terms_version: warranty.terms_version || 1,
                terms_accepted: warranty.terms_accepted || false,
                terms_accepted_date: warranty.terms_accepted_date || null,
                registration_date: warranty.registration_date,
                standard_warranty_start: warranty.standard_warranty_start,
                standard_warranty_end: warranty.standard_warranty_end,
                status: warranty.status || 'active',
                claims_count: warranty.claims_count || 0,
                last_claim_date: warranty.last_claim_date || null
            };
        }
        
        res.json({
            success: true,
            product: productData,
            warranty: warrantyData
        });
    } catch (err) {
        console.error('Database error:', err);
        res.status(500).json({ error: 'Database error: ' + err.message });
    }
});

// List downloadable graphics (Admin only)
app.get('/api/admin/downloads', requireAuth, async (req, res) => {
    try {
        const imagesDir = path.join(__dirname, 'public', 'images');
        
        // Check if directory exists
        if (!fs.existsSync(imagesDir)) {
            return res.json({ files: [] });
        }
        
        // Read directory contents
        const files = fs.readdirSync(imagesDir);
        
        // Filter for image/graphic files and get their stats
        const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.pdf', '.zip'];
        const fileList = files
            .filter(file => {
                const ext = path.extname(file).toLowerCase();
                return imageExtensions.includes(ext);
            })
            .map(file => {
                const filePath = path.join(imagesDir, file);
                try {
                    const stats = fs.statSync(filePath);
                    return {
                        filename: file,
                        extension: path.extname(file).toLowerCase().replace('.', ''),
                        size: stats.size,
                        modified: stats.mtime
                    };
                } catch (err) {
                    console.error(`Error reading file ${file}:`, err);
                    return null;
                }
            })
            .filter(file => file !== null)
            .sort((a, b) => a.filename.localeCompare(b.filename));
        
        res.json({ files: fileList });
    } catch (err) {
        console.error('Error listing downloads:', err);
        res.status(500).json({ error: 'Failed to list graphics: ' + err.message });
    }
});

// Get product info by barcode (for confirmation page)
app.get('/api/product-info/:barcode', requireDB, async (req, res) => {
    const { barcode } = req.params;
    
    try {
        // Search for barcode with or without hyphens
        const barcodeQuery = createSecurityBarcodeQuery(barcode);
        const product = await db.collection('products').findOne(barcodeQuery);
        
        if (!product) {
            res.status(404).json({ error: 'Product not found' });
        } else {
            // Log photos for debugging
            console.log('Product photos from DB:', product.photos);
            
            // Ensure photos array exists and is properly formatted
            const photos = (product.photos || []).map(photo => {
                // Ensure photo path starts with /uploads/
                if (typeof photo === 'string') {
                    // If it doesn't start with /, add it
                    return photo.startsWith('/') ? photo : '/' + photo;
                }
                return photo;
            });
            
            console.log('Formatted photos array:', photos);
            
            res.json({ 
                part_type: product.part_type,
                serial_number: product.serial_number,
                generation: product.generation,
                part_model_number: product.part_model_number,
                photos: photos,
                ebay_order_number: product.ebay_order_number || null,
                date_added: product.date_added,
                notes: product.notes || null
            });
        }
    } catch (err) {
        console.error('Database error:', err);
        res.status(500).json({ error: 'Database error: ' + err.message });
    }
});

// Get all parts (for admin form)
app.get('/api/admin/parts', requireAuth, requireDB, async (req, res) => {
    try {
        const parts = await db.collection('airpod_parts')
            .find({})
            .sort({ generation: 1, display_order: 1, part_name: 1 })
            .toArray();
        
        const partsWithStringIds = parts.map(part => ({
            ...part,
            id: part._id.toString(),
            _id: undefined
        }));
        
        res.json({ parts: partsWithStringIds });
    } catch (err) {
        console.error('Database error:', err);
        res.status(500).json({ error: 'Database error: ' + err.message });
    }
});

// Get parts by generation
app.get('/api/admin/parts/:generation', requireAuth, requireDB, async (req, res) => {
    const generation = decodeURIComponent(req.params.generation);
    
    try {
        const parts = await db.collection('airpod_parts')
            .find({ generation })
            .sort({ display_order: 1, part_name: 1 })
            .toArray();
        
        const partsWithStringIds = parts.map(part => ({
            ...part,
            id: part._id.toString(),
            _id: undefined
        }));
        
        res.json({ parts: partsWithStringIds });
    } catch (err) {
        console.error('Database error:', err);
        res.status(500).json({ error: 'Database error: ' + err.message });
    }
});

// Add new part - with image upload support
app.post('/api/admin/part', requireAuth, requireDB, upload.fields([
    { name: 'example_image', maxCount: 1 },
    { name: 'authenticity_case_image', maxCount: 1 },
    { name: 'authenticity_airpod_image', maxCount: 1 }
]), async (req, res) => {
    const { generation, part_name, part_model_number, part_type, notes, display_order, show_case_image, show_airpod_image, associated_parts } = req.body;
    
    if (!generation || !part_name || !part_model_number || !part_type) {
        return res.status(400).json({ error: 'Generation, part name, part model number, and part type are required' });
    }
    
    if (!['left', 'right', 'case'].includes(part_type.toLowerCase())) {
        return res.status(400).json({ error: 'Part type must be left, right, or case' });
    }
    
    console.log('Adding new part:', { generation, part_name, part_model_number, part_type, associated_parts });
    
    try {
        const currentUploadsDir = global.uploadsDir || uploadsDir;
        const authenticityImagesDir = path.join(currentUploadsDir, 'authenticity');
        const exampleImagesDir = path.join(currentUploadsDir, 'examples');
        
        // Ensure directories exist
        if (!fs.existsSync(authenticityImagesDir)) {
            fs.mkdirSync(authenticityImagesDir, { recursive: true });
        }
        if (!fs.existsSync(exampleImagesDir)) {
            fs.mkdirSync(exampleImagesDir, { recursive: true });
        }
        
        // Process uploaded images
        let exampleImage = null;
        let authenticityCaseImage = null;
        let authenticityAirpodImage = null;
        
        if (req.files) {
            // Handle example image
            if (req.files['example_image'] && req.files['example_image'][0]) {
                const file = req.files['example_image'][0];
                const newFilename = `example_${part_model_number}_${Date.now()}${path.extname(file.originalname)}`;
                const newPath = path.join(exampleImagesDir, newFilename);
                fs.renameSync(file.path, newPath);
                exampleImage = `/uploads/examples/${newFilename}`;
                console.log('Example image saved:', exampleImage);
            }
            
            // Handle authenticity images
            if (req.files['authenticity_case_image'] && req.files['authenticity_case_image'][0]) {
                const file = req.files['authenticity_case_image'][0];
                const newFilename = `case_${part_model_number}_${Date.now()}${path.extname(file.originalname)}`;
                const newPath = path.join(authenticityImagesDir, newFilename);
                fs.renameSync(file.path, newPath);
                authenticityCaseImage = `/uploads/authenticity/${newFilename}`;
                console.log('Case authenticity image saved:', authenticityCaseImage);
            }
            
            if (req.files['authenticity_airpod_image'] && req.files['authenticity_airpod_image'][0]) {
                const file = req.files['authenticity_airpod_image'][0];
                const newFilename = `airpod_${part_model_number}_${Date.now()}${path.extname(file.originalname)}`;
                const newPath = path.join(authenticityImagesDir, newFilename);
                fs.renameSync(file.path, newPath);
                authenticityAirpodImage = `/uploads/authenticity/${newFilename}`;
                console.log('AirPod authenticity image saved:', authenticityAirpodImage);
            }
        }
        
        // Parse checkbox values (FormData sends them as strings)
        const showCaseImage = show_case_image === 'true' || show_case_image === true;
        const showAirpodImage = show_airpod_image === 'true' || show_airpod_image === true;
        
        // Parse associated_parts (comes as JSON string from FormData)
        let associatedPartsArray = [];
        if (associated_parts) {
            console.log('[POST Part] Received associated_parts:', associated_parts, 'Type:', typeof associated_parts);
            try {
                associatedPartsArray = typeof associated_parts === 'string' 
                    ? JSON.parse(associated_parts) 
                    : associated_parts;
                // Ensure it's an array
                if (!Array.isArray(associatedPartsArray)) {
                    console.warn('[POST Part] associated_parts is not an array:', associatedPartsArray);
                    associatedPartsArray = [];
                } else {
                    console.log('[POST Part] Parsed associated_parts array:', associatedPartsArray);
                }
            } catch (err) {
                console.warn('[POST Part] Error parsing associated_parts:', err);
                associatedPartsArray = [];
            }
        } else {
            console.log('[POST Part] No associated_parts provided');
        }
        
        const part = {
            generation: generation.trim(),
            part_name: part_name.trim(),
            part_model_number: part_model_number.trim(),
            part_type: part_type.toLowerCase(),
            notes: notes ? notes.trim() : null,
            display_order: display_order || 0,
            example_image: exampleImage,
            authenticity_case_image: authenticityCaseImage,
            authenticity_airpod_image: authenticityAirpodImage,
            show_case_image: showCaseImage,
            show_airpod_image: showAirpodImage,
            associated_parts: associatedPartsArray.length > 0 ? associatedPartsArray : null,
            date_added: new Date()
        };
        
        console.log('[POST Part] Saving part with associated_parts:', part.associated_parts);
        const result = await db.collection('airpod_parts').insertOne(part);
        console.log('Part added successfully, id:', result.insertedId.toString());
        res.json({ success: true, message: 'Part added successfully', id: result.insertedId.toString() });
    } catch (err) {
        console.error('Database insert error:', err);
        if (err.code === 11000) {
            res.status(409).json({ error: 'A part with this generation and name already exists' });
        } else {
            res.status(500).json({ error: 'Database error: ' + err.message });
        }
    }
});

// Update part
app.put('/api/admin/part/:id', requireAuth, requireDB, upload.fields([
    { name: 'example_image', maxCount: 1 },
    { name: 'authenticity_case_image', maxCount: 1 },
    { name: 'authenticity_airpod_image', maxCount: 1 }
]), async (req, res) => {
    const id = req.params.id;
    const { generation, part_name, part_model_number, part_type, notes, display_order, show_case_image, show_airpod_image, associated_parts } = req.body;
    
    if (!generation || !part_name || !part_model_number || !part_type) {
        return res.status(400).json({ error: 'Generation, part name, part model number, and part type are required' });
    }
    
    if (!['left', 'right', 'case'].includes(part_type.toLowerCase())) {
        return res.status(400).json({ error: 'Part type must be left, right, or case' });
    }
    
    console.log('Updating part:', { id, generation, part_name, part_model_number, part_type });
    
    try {
        if (!ObjectId.isValid(id)) {
            return res.status(400).json({ error: 'Invalid part ID' });
        }
        
        // Get existing part to preserve images if not updating
        const existingPart = await db.collection('airpod_parts').findOne({ _id: new ObjectId(id) });
        if (!existingPart) {
            return res.status(404).json({ error: 'Part not found' });
        }
        
        const currentUploadsDir = global.uploadsDir || uploadsDir;
        const authenticityImagesDir = path.join(currentUploadsDir, 'authenticity');
        const exampleImagesDir = path.join(currentUploadsDir, 'examples');
        
        // Ensure directories exist
        if (!fs.existsSync(authenticityImagesDir)) {
            fs.mkdirSync(authenticityImagesDir, { recursive: true });
        }
        if (!fs.existsSync(exampleImagesDir)) {
            fs.mkdirSync(exampleImagesDir, { recursive: true });
        }
        
        // Process uploaded images (only update if new files are provided)
        let exampleImage = existingPart.example_image || null;
        let authenticityCaseImage = existingPart.authenticity_case_image || null;
        let authenticityAirpodImage = existingPart.authenticity_airpod_image || null;
        
        if (req.files) {
            // Handle example image
            if (req.files['example_image'] && req.files['example_image'][0]) {
                // Delete old image if exists
                if (exampleImage) {
                    const oldPath = path.join(currentUploadsDir, exampleImage.replace('/uploads/', ''));
                    if (fs.existsSync(oldPath)) {
                        fs.unlinkSync(oldPath);
                    }
                }
                
                const file = req.files['example_image'][0];
                const newFilename = `example_${part_model_number}_${Date.now()}${path.extname(file.originalname)}`;
                const newPath = path.join(exampleImagesDir, newFilename);
                fs.renameSync(file.path, newPath);
                exampleImage = `/uploads/examples/${newFilename}`;
                console.log('Example image updated:', exampleImage);
            }
            
            // Handle authenticity images
            if (req.files['authenticity_case_image'] && req.files['authenticity_case_image'][0]) {
                // Delete old image if exists
                if (authenticityCaseImage) {
                    const oldPath = path.join(currentUploadsDir, authenticityCaseImage.replace('/uploads/', ''));
                    if (fs.existsSync(oldPath)) {
                        fs.unlinkSync(oldPath);
                    }
                }
                
                const file = req.files['authenticity_case_image'][0];
                const newFilename = `case_${part_model_number}_${Date.now()}${path.extname(file.originalname)}`;
                const newPath = path.join(authenticityImagesDir, newFilename);
                fs.renameSync(file.path, newPath);
                authenticityCaseImage = `/uploads/authenticity/${newFilename}`;
                console.log('Case authenticity image updated:', authenticityCaseImage);
            }
            
            if (req.files['authenticity_airpod_image'] && req.files['authenticity_airpod_image'][0]) {
                // Delete old image if exists
                if (authenticityAirpodImage) {
                    const oldPath = path.join(currentUploadsDir, authenticityAirpodImage.replace('/uploads/', ''));
                    if (fs.existsSync(oldPath)) {
                        fs.unlinkSync(oldPath);
                    }
                }
                
                const file = req.files['authenticity_airpod_image'][0];
                const newFilename = `airpod_${part_model_number}_${Date.now()}${path.extname(file.originalname)}`;
                const newPath = path.join(authenticityImagesDir, newFilename);
                fs.renameSync(file.path, newPath);
                authenticityAirpodImage = `/uploads/authenticity/${newFilename}`;
                console.log('AirPod authenticity image updated:', authenticityAirpodImage);
            }
        }
        
        const updateData = {
            generation: generation.trim(),
            part_name: part_name.trim(),
            part_model_number: part_model_number.trim(),
            part_type: part_type.toLowerCase(),
            notes: notes ? notes.trim() : null,
            display_order: display_order || 0
        };
        
        // Parse checkbox values (FormData sends them as strings)
        const showCaseImage = show_case_image === 'true' || show_case_image === true;
        const showAirpodImage = show_airpod_image === 'true' || show_airpod_image === true;
        
        // Parse associated_parts (comes as JSON string from FormData)
        let associatedPartsArray = [];
        if (associated_parts !== undefined) {
            try {
                associatedPartsArray = typeof associated_parts === 'string' 
                    ? JSON.parse(associated_parts) 
                    : associated_parts;
                // Ensure it's an array
                if (!Array.isArray(associatedPartsArray)) {
                    associatedPartsArray = [];
                }
            } catch (err) {
                console.warn('Error parsing associated_parts:', err);
                associatedPartsArray = [];
            }
        }
        // Update associated_parts (set to null if empty array, otherwise set to array)
        updateData.associated_parts = associatedPartsArray.length > 0 ? associatedPartsArray : null;
        
        // Only update image fields if they were provided
        if (exampleImage !== undefined) {
            updateData.example_image = exampleImage;
        }
        if (authenticityCaseImage !== undefined) {
            updateData.authenticity_case_image = authenticityCaseImage;
        }
        if (authenticityAirpodImage !== undefined) {
            updateData.authenticity_airpod_image = authenticityAirpodImage;
        }
        // Always update show flags if provided
        if (show_case_image !== undefined) {
            updateData.show_case_image = showCaseImage;
        }
        if (show_airpod_image !== undefined) {
            updateData.show_airpod_image = showAirpodImage;
        }
        
        const result = await db.collection('airpod_parts').updateOne(
            { _id: new ObjectId(id) },
            { $set: updateData }
        );
        
        if (result.matchedCount === 0) {
            console.log('Part not found for update, id:', id);
            res.status(404).json({ error: 'Part not found' });
        } else {
            console.log('Part updated successfully, matched:', result.matchedCount);
            res.json({ success: true, message: 'Part updated successfully' });
        }
    } catch (err) {
        console.error('Database update error:', err);
        res.status(500).json({ error: 'Database error: ' + err.message });
    }
});

// Delete part
app.delete('/api/admin/part/:id', requireAuth, requireDB, async (req, res) => {
    const id = req.params.id;
    
    try {
        if (!ObjectId.isValid(id)) {
            return res.status(400).json({ error: 'Invalid part ID' });
        }
        
        const result = await db.collection('airpod_parts').deleteOne({ _id: new ObjectId(id) });
        
        if (result.deletedCount === 0) {
            res.status(404).json({ error: 'Part not found' });
        } else {
            res.json({ success: true, message: 'Part deleted successfully' });
        }
    } catch (err) {
        console.error('Database error:', err);
        res.status(500).json({ error: 'Database error: ' + err.message });
    }
});

// Get all generations
app.get('/api/admin/generations', requireAuth, requireDB, async (req, res) => {
    try {
        const generations = await db.collection('airpod_parts').distinct('generation');
        res.json({ generations: generations.sort() });
    } catch (err) {
        console.error('Database error:', err);
        res.status(500).json({ error: 'Database error: ' + err.message });
    }
});

// Setup Instructions API endpoints

// Get all setup instructions (admin)
app.get('/api/admin/setup-instructions', requireAuth, requireDB, async (req, res) => {
    try {
        const instructions = await db.collection('setup_instructions')
            .find({})
            .sort({ generation: 1, part_model_number: 1 })
            .toArray();
        
        const instructionsWithStringIds = instructions.map(inst => ({
            ...inst,
            _id: inst._id.toString()
        }));
        
        res.json({ instructions: instructionsWithStringIds });
    } catch (err) {
        console.error('[Setup Instructions] Database error:', err);
        res.status(500).json({ error: 'Database error: ' + err.message });
    }
});

// Get a specific setup instruction (admin)
app.get('/api/admin/setup-instructions/:id', requireAuth, requireDB, async (req, res) => {
    const id = req.params.id;
    
    try {
        if (!ObjectId.isValid(id)) {
            return res.status(400).json({ error: 'Invalid instruction ID' });
        }
        
        const instruction = await db.collection('setup_instructions').findOne({ _id: new ObjectId(id) });
        
        if (!instruction) {
            return res.status(404).json({ error: 'Setup instruction not found' });
        }
        
        res.json({
            ...instruction,
            _id: instruction._id.toString()
        });
    } catch (err) {
        console.error('[Setup Instructions] Database error:', err);
        res.status(500).json({ error: 'Database error: ' + err.message });
    }
});

// Create new setup instructions (admin)
app.post('/api/admin/setup-instructions', requireAuth, requireDB, async (req, res) => {
    const { generation, part_model_number, instructions } = req.body;
    
    if (!generation || !instructions || !Array.isArray(instructions) || instructions.length === 0) {
        return res.status(400).json({ error: 'Generation and at least one instruction step are required' });
    }
    
    // Validate instruction steps
    for (let i = 0; i < instructions.length; i++) {
        const step = instructions[i];
        if (!step.title || !step.instruction) {
            return res.status(400).json({ error: `Step ${i + 1} must have both title and instruction text` });
        }
    }
    
    try {
        // Check if instruction set already exists for this generation/part combination
        const existingQuery = {
            generation: generation,
            part_model_number: part_model_number || null
        };
        
        const existing = await db.collection('setup_instructions').findOne(existingQuery);
        if (existing) {
            return res.status(400).json({ 
                error: 'Setup instructions already exist for this generation' + (part_model_number ? ` and part model` : '') 
            });
        }
        
        const newInstruction = {
            generation: generation,
            part_model_number: part_model_number || null,
            instructions: instructions.map((step, index) => ({
                step_number: step.step_number || (index + 1),
                title: step.title.trim(),
                instruction: step.instruction.trim()
            })),
            created_at: new Date(),
            updated_at: new Date()
        };
        
        const result = await db.collection('setup_instructions').insertOne(newInstruction);
        
        res.json({
            success: true,
            _id: result.insertedId.toString(),
            ...newInstruction
        });
    } catch (err) {
        console.error('[Setup Instructions] Database error:', err);
        res.status(500).json({ error: 'Database error: ' + err.message });
    }
});

// Update setup instructions (admin)
app.put('/api/admin/setup-instructions/:id', requireAuth, requireDB, async (req, res) => {
    const id = req.params.id;
    const { generation, part_model_number, instructions } = req.body;
    
    if (!ObjectId.isValid(id)) {
        return res.status(400).json({ error: 'Invalid instruction ID' });
    }
    
    if (!generation || !instructions || !Array.isArray(instructions) || instructions.length === 0) {
        return res.status(400).json({ error: 'Generation and at least one instruction step are required' });
    }
    
    // Validate instruction steps
    for (let i = 0; i < instructions.length; i++) {
        const step = instructions[i];
        if (!step.title || !step.instruction) {
            return res.status(400).json({ error: `Step ${i + 1} must have both title and instruction text` });
        }
    }
    
    try {
        const existing = await db.collection('setup_instructions').findOne({ _id: new ObjectId(id) });
        if (!existing) {
            return res.status(404).json({ error: 'Setup instruction not found' });
        }
        
        // Check if another instruction set exists for this generation/part combination (excluding current)
        const existingQuery = {
            generation: generation,
            part_model_number: part_model_number || null,
            _id: { $ne: new ObjectId(id) }
        };
        
        const duplicate = await db.collection('setup_instructions').findOne(existingQuery);
        if (duplicate) {
            return res.status(400).json({ 
                error: 'Another setup instruction set already exists for this generation' + (part_model_number ? ` and part model` : '') 
            });
        }
        
        const updateData = {
            generation: generation,
            part_model_number: part_model_number || null,
            instructions: instructions.map((step, index) => ({
                step_number: step.step_number || (index + 1),
                title: step.title.trim(),
                instruction: step.instruction.trim()
            })),
            updated_at: new Date()
        };
        
        const result = await db.collection('setup_instructions').updateOne(
            { _id: new ObjectId(id) },
            { $set: updateData }
        );
        
        if (result.matchedCount === 0) {
            return res.status(404).json({ error: 'Setup instruction not found' });
        }
        
        res.json({ success: true, message: 'Setup instructions updated successfully' });
    } catch (err) {
        console.error('[Setup Instructions] Database error:', err);
        res.status(500).json({ error: 'Database error: ' + err.message });
    }
});

// Delete setup instructions (admin)
app.delete('/api/admin/setup-instructions/:id', requireAuth, requireDB, async (req, res) => {
    const id = req.params.id;
    
    try {
        if (!ObjectId.isValid(id)) {
            return res.status(400).json({ error: 'Invalid instruction ID' });
        }
        
        const result = await db.collection('setup_instructions').deleteOne({ _id: new ObjectId(id) });
        
        if (result.deletedCount === 0) {
            res.status(404).json({ error: 'Setup instruction not found' });
        } else {
            res.json({ success: true, message: 'Setup instruction deleted successfully' });
        }
    } catch (err) {
        console.error('[Setup Instructions] Database error:', err);
        res.status(500).json({ error: 'Database error: ' + err.message });
    }
});

// Get setup instructions for public use (by generation or part_model_number)
app.get('/api/setup-instructions/:identifier', requireDB, async (req, res) => {
    const identifier = req.params.identifier;
    
    try {
        // Try to find by part_model_number first
        let instruction = await db.collection('setup_instructions').findOne({
            part_model_number: identifier
        });
        
        // If not found, try by generation
        if (!instruction) {
            instruction = await db.collection('setup_instructions').findOne({
                generation: identifier,
                part_model_number: null
            });
        }
        
        if (!instruction) {
            return res.status(404).json({ error: 'Setup instructions not found for this part or generation' });
        }
        
        res.json({
            ...instruction,
            _id: instruction._id.toString()
        });
    } catch (err) {
        console.error('[Setup Instructions] Database error:', err);
        res.status(500).json({ error: 'Database error: ' + err.message });
    }
});

// Add-On Sales API endpoints

// Get all add-on sales
app.get('/api/admin/addon-sales', requireAuth, requireDB, async (req, res) => {
    try {
        const addonSales = await db.collection('addon_sales')
            .find({})
            .sort({ name: 1 })
            .toArray();
        
        const addonSalesWithStringIds = addonSales.map(addon => ({
            ...addon,
            _id: addon._id.toString()
        }));
        
        res.json({ addonSales: addonSalesWithStringIds });
    } catch (err) {
        console.error('Database error:', err);
        res.status(500).json({ error: 'Database error: ' + err.message });
    }
});

// Get single add-on sale
app.get('/api/admin/addon-sale/:id', requireAuth, requireDB, async (req, res) => {
    const id = req.params.id;
    
    try {
        if (!ObjectId.isValid(id)) {
            return res.status(400).json({ error: 'Invalid add-on sale ID' });
        }
        
        const addonSale = await db.collection('addon_sales').findOne({ _id: new ObjectId(id) });
        
        if (!addonSale) {
            return res.status(404).json({ error: 'Add-on sale not found' });
        }
        
        res.json({ 
            addonSale: {
                ...addonSale,
                _id: addonSale._id.toString()
            }
        });
    } catch (err) {
        console.error('Database error:', err);
        res.status(500).json({ error: 'Database error: ' + err.message });
    }
});

// Create add-on sale
app.post('/api/admin/addon-sale', requireAuth, requireDB, upload.single('image'), async (req, res) => {
    const { name, description, price, active, associated_generations, associated_part_models } = req.body;
    
    if (!name || !price) {
        return res.status(400).json({ error: 'Name and price are required' });
    }
    
    const priceNum = parseFloat(price);
    if (isNaN(priceNum) || priceNum < 0) {
        return res.status(400).json({ error: 'Valid price is required' });
    }
    
    try {
        // Parse associations
        let generations = [];
        let partModels = [];
        
        if (associated_generations) {
            try {
                generations = JSON.parse(associated_generations);
            } catch (e) {
                generations = Array.isArray(associated_generations) ? associated_generations : [];
            }
        }
        
        if (associated_part_models) {
            try {
                partModels = JSON.parse(associated_part_models);
            } catch (e) {
                partModels = Array.isArray(associated_part_models) ? associated_part_models : [];
            }
        }
        
        if (generations.length === 0 && partModels.length === 0) {
            return res.status(400).json({ error: 'At least one product association (generation or part model) is required' });
        }
        
        // Handle image upload
        let imagePath = null;
        if (req.file) {
            const currentUploadsDir = global.uploadsDir || uploadsDir;
            const addonImagesDir = path.join(currentUploadsDir, 'addon-sales');
            
            // Ensure directory exists
            if (!fs.existsSync(addonImagesDir)) {
                fs.mkdirSync(addonImagesDir, { recursive: true });
            }
            
            // Move file to addon-sales directory
            const newFilename = `addon_${Date.now()}${path.extname(req.file.originalname)}`;
            const newPath = path.join(addonImagesDir, newFilename);
            fs.renameSync(req.file.path, newPath);
            imagePath = `/uploads/addon-sales/${newFilename}`;
        }
        
        const addonSale = {
            name: name.trim(),
            description: description ? description.trim() : null,
            price: priceNum,
            image: imagePath,
            active: active === 'true' || active === true,
            associated_generations: generations,
            associated_part_models: partModels,
            created_at: new Date(),
            updated_at: new Date()
        };
        
        const result = await db.collection('addon_sales').insertOne(addonSale);
        console.log('Add-on sale created:', result.insertedId.toString());
        res.json({ success: true, message: 'Add-on sale created successfully', id: result.insertedId.toString() });
    } catch (err) {
        console.error('Database error:', err);
        res.status(500).json({ error: 'Database error: ' + err.message });
    }
});

// Update add-on sale
app.put('/api/admin/addon-sale/:id', requireAuth, requireDB, upload.single('image'), async (req, res) => {
    const id = req.params.id;
    const { name, description, price, active, associated_generations, associated_part_models } = req.body;
    
    if (!name || !price) {
        return res.status(400).json({ error: 'Name and price are required' });
    }
    
    const priceNum = parseFloat(price);
    if (isNaN(priceNum) || priceNum < 0) {
        return res.status(400).json({ error: 'Valid price is required' });
    }
    
    try {
        if (!ObjectId.isValid(id)) {
            return res.status(400).json({ error: 'Invalid add-on sale ID' });
        }
        
        // Get existing add-on sale
        const existingAddon = await db.collection('addon_sales').findOne({ _id: new ObjectId(id) });
        if (!existingAddon) {
            return res.status(404).json({ error: 'Add-on sale not found' });
        }
        
        // Parse associations
        let generations = [];
        let partModels = [];
        
        if (associated_generations) {
            try {
                generations = JSON.parse(associated_generations);
            } catch (e) {
                generations = Array.isArray(associated_generations) ? associated_generations : [];
            }
        }
        
        if (associated_part_models) {
            try {
                partModels = JSON.parse(associated_part_models);
            } catch (e) {
                partModels = Array.isArray(associated_part_models) ? associated_part_models : [];
            }
        }
        
        if (generations.length === 0 && partModels.length === 0) {
            return res.status(400).json({ error: 'At least one product association (generation or part model) is required' });
        }
        
        // Handle image upload
        let imagePath = existingAddon.image || null;
        if (req.file) {
            const currentUploadsDir = global.uploadsDir || uploadsDir;
            const addonImagesDir = path.join(currentUploadsDir, 'addon-sales');
            
            // Ensure directory exists
            if (!fs.existsSync(addonImagesDir)) {
                fs.mkdirSync(addonImagesDir, { recursive: true });
            }
            
            // Delete old image if exists
            if (imagePath) {
                const oldPath = path.join(currentUploadsDir, imagePath.replace('/uploads/', ''));
                if (fs.existsSync(oldPath)) {
                    fs.unlinkSync(oldPath);
                }
            }
            
            // Move new file to addon-sales directory
            const newFilename = `addon_${Date.now()}${path.extname(req.file.originalname)}`;
            const newPath = path.join(addonImagesDir, newFilename);
            fs.renameSync(req.file.path, newPath);
            imagePath = `/uploads/addon-sales/${newFilename}`;
        }
        
        const updateData = {
            name: name.trim(),
            description: description ? description.trim() : null,
            price: priceNum,
            image: imagePath,
            active: active === 'true' || active === true,
            associated_generations: generations,
            associated_part_models: partModels,
            updated_at: new Date()
        };
        
        const result = await db.collection('addon_sales').updateOne(
            { _id: new ObjectId(id) },
            { $set: updateData }
        );
        
        if (result.matchedCount === 0) {
            return res.status(404).json({ error: 'Add-on sale not found' });
        }
        
        console.log('Add-on sale updated:', id);
        res.json({ success: true, message: 'Add-on sale updated successfully' });
    } catch (err) {
        console.error('Database error:', err);
        res.status(500).json({ error: 'Database error: ' + err.message });
    }
});

// Delete add-on sale
app.delete('/api/admin/addon-sale/:id', requireAuth, requireDB, async (req, res) => {
    const id = req.params.id;
    
    try {
        if (!ObjectId.isValid(id)) {
            return res.status(400).json({ error: 'Invalid add-on sale ID' });
        }
        
        // Get add-on sale to delete image
        const addonSale = await db.collection('addon_sales').findOne({ _id: new ObjectId(id) });
        
        if (!addonSale) {
            return res.status(404).json({ error: 'Add-on sale not found' });
        }
        
        // Delete image if exists
        if (addonSale.image) {
            const currentUploadsDir = global.uploadsDir || uploadsDir;
            const imagePath = path.join(currentUploadsDir, addonSale.image.replace('/uploads/', ''));
            if (fs.existsSync(imagePath)) {
                fs.unlinkSync(imagePath);
            }
        }
        
        const result = await db.collection('addon_sales').deleteOne({ _id: new ObjectId(id) });
        
        if (result.deletedCount === 0) {
            return res.status(404).json({ error: 'Add-on sale not found' });
        }
        
        console.log('Add-on sale deleted:', id);
        res.json({ success: true, message: 'Add-on sale deleted successfully' });
    } catch (err) {
        console.error('Database error:', err);
        res.status(500).json({ error: 'Database error: ' + err.message });
    }
});

// Get compatible parts with example images (public endpoint for warranty registration)
app.get('/api/compatible-parts/:partModelNumber', requireDB, async (req, res) => {
    const partModelNumber = req.params.partModelNumber;
    const partTypeFromQuery = req.query.part_type; // Allow part_type to be passed as query parameter
    
    try {
        console.log(`[Compatible Parts API] Request for part model number: "${partModelNumber}", part_type: "${partTypeFromQuery || 'not provided'}"`);
        
        // Find the purchased part
        let purchasedPart = await db.collection('airpod_parts').findOne({ 
            part_model_number: partModelNumber 
        });
        
        // If not found, try case-insensitive search
        if (!purchasedPart) {
            console.log(`[Compatible Parts API] Exact match failed, trying case-insensitive search`);
            const allParts = await db.collection('airpod_parts').find({}).toArray();
            purchasedPart = allParts.find(p => 
                p.part_model_number && 
                p.part_model_number.toUpperCase() === partModelNumber.toUpperCase()
            );
            if (purchasedPart) {
                console.log(`[Compatible Parts API] Found case-insensitive match: ${purchasedPart.part_model_number}`);
            }
        }
        
        // If part not found in airpod_parts but part_type is provided, use that
        // This handles cases where part model numbers are used differently (e.g., A2968 as right AirPod vs case)
        let actualPartType = purchasedPart ? purchasedPart.part_type : null;
        let generation = purchasedPart ? purchasedPart.generation : null;
        
        if (partTypeFromQuery && (!purchasedPart || actualPartType !== partTypeFromQuery)) {
            console.log(`[Compatible Parts API] Using part_type from query parameter: ${partTypeFromQuery}`);
            actualPartType = partTypeFromQuery;
            
            // Try to find generation from any part with this model number, or use a default
            if (!generation && purchasedPart) {
                generation = purchasedPart.generation;
            } else if (!generation) {
                // Try to infer generation from part number patterns
                if (partModelNumber.startsWith('A269') || partModelNumber.startsWith('A270') || partModelNumber.startsWith('A296') || partModelNumber.startsWith('A304')) {
                    generation = 'AirPods Pro (2nd Gen)';
                } else if (partModelNumber.startsWith('A208') || partModelNumber.startsWith('A219')) {
                    generation = 'AirPods Pro (1st Gen)';
                } else if (partModelNumber.startsWith('A256')) {
                    generation = 'AirPods (3rd Gen)';
                } else if (partModelNumber.startsWith('A203') || partModelNumber.startsWith('A160')) {
                    generation = 'AirPods (2nd Gen)';
                }
            }
        }
        
        if (!actualPartType) {
            console.log(`[Compatible Parts API] Part not found and no part_type provided: ${partModelNumber}`);
            return res.json({ 
                ok: true,
                data: {
                    purchasedPart: null,
                    compatibleParts: []
                }
            });
        }
        
        console.log(`[Compatible Parts API] Using part type: ${actualPartType}, generation: ${generation || 'unknown'}`);
        
        // Get all parts from the same generation
        let sameGenerationParts = [];
        if (generation) {
            sameGenerationParts = await db.collection('airpod_parts').find({
                generation: generation
            }).toArray();
        } else {
            // If no generation found, get all parts (fallback)
            sameGenerationParts = await db.collection('airpod_parts').find({}).toArray();
        }
        
        console.log(`[Compatible Parts API] Found ${sameGenerationParts.length} parts in same generation`);
        
        // Define specific compatibility mappings for known part numbers
        // This ensures we only show the correct compatible parts, not all parts of a type
        const compatibilityMap = {
            // AirPods Pro 2nd Gen
            'A2698': ['A2699', 'A2700'],  // Left AirPod -> Right AirPod, Case
            'A2699': ['A2698', 'A2700'],  // Right AirPod -> Left AirPod, Case
            'A2700': ['A2698', 'A2699'],  // Case -> Left AirPod, Right AirPod
            'A2968': ['A2699', 'A2700'],  // Right AirPod Lightning -> Left AirPod, Case
            'A3047': ['A3048', 'A2968'],  // Right AirPod USB-C -> Left AirPod USB-C, Case USB-C
            'A3048': ['A3047', 'A2968'],  // Right AirPod USB-C -> Left AirPod USB-C, Case USB-C
            // AirPods Pro 1st Gen
            'A2084': ['A2083', 'A2190'],  // Left AirPod -> Right AirPod, Case
            'A2083': ['A2084', 'A2190'],  // Right AirPod -> Left AirPod, Case
            'A2190': ['A2084', 'A2083'],  // Case -> Left AirPod, Right AirPod
            // AirPods 3rd Gen
            'A2564': ['A2565', 'A2566'],  // Left AirPod -> Right AirPod, Case
            'A2565': ['A2564', 'A2566'],  // Right AirPod -> Left AirPod, Case
            'A2566': ['A2564', 'A2565'],  // Case -> Left AirPod, Right AirPod
            // AirPods 2nd Gen
            'A2032': ['A2031', 'A1602'],  // Left AirPod -> Right AirPod, Case
            'A2031': ['A2032', 'A1602'],  // Right AirPod -> Left AirPod, Case
            'A1602': ['A2032', 'A2031'],  // Case -> Left AirPod, Right AirPod
        };
        
        // Determine compatible parts based on part type and specific mappings
        let compatibleParts = [];
        
        // First, check if the purchased part has associated_parts defined in the database
        let compatiblePartNumbers = null;
        if (purchasedPart && purchasedPart.associated_parts && Array.isArray(purchasedPart.associated_parts) && purchasedPart.associated_parts.length > 0) {
            compatiblePartNumbers = purchasedPart.associated_parts;
            console.log(`[Compatible Parts API] Using associated_parts from database for ${partModelNumber}: ${compatiblePartNumbers.join(', ')}`);
        } else {
            // Fall back to hardcoded compatibility mapping
            compatiblePartNumbers = compatibilityMap[partModelNumber];
            if (compatiblePartNumbers && compatiblePartNumbers.length > 0) {
                console.log(`[Compatible Parts API] Using hardcoded compatibility mapping for ${partModelNumber}: ${compatiblePartNumbers.join(', ')}`);
            }
        }
        
        if (compatiblePartNumbers && compatiblePartNumbers.length > 0) {
            // Use compatibility mapping (from database or hardcoded)
            compatibleParts = sameGenerationParts
                .filter(p => compatiblePartNumbers.includes(p.part_model_number))
                .map(p => ({
                    partModelNumber: p.part_model_number,
                    partType: p.part_type,
                    name: p.part_name,
                    exampleImage: p.example_image || null,
                    description: p.part_type === 'right' || p.part_type === 'left'
                        ? `${p.part_name} - should match your ${actualPartType === 'left' ? 'left' : 'right'} AirPod`
                        : `${p.part_name} - USB-C or Lightning`
                }));
        } else {
            // Fallback to type-based filtering if no specific mapping exists
            console.log(`[Compatible Parts API] No specific mapping found, using type-based filtering`);
            if (actualPartType === 'left') {
                // Compatible: right AirPod and case
                compatibleParts = sameGenerationParts
                    .filter(p => p.part_type === 'right' || p.part_type === 'case')
                    .map(p => ({
                        partModelNumber: p.part_model_number,
                        partType: p.part_type,
                        name: p.part_name,
                        exampleImage: p.example_image || null,
                        description: p.part_type === 'right' 
                            ? `${p.part_name} - should match your left AirPod`
                            : `${p.part_name} - USB-C or Lightning`
                    }));
            } else if (actualPartType === 'right') {
                // Compatible: left AirPod and case
                compatibleParts = sameGenerationParts
                    .filter(p => p.part_type === 'left' || p.part_type === 'case')
                    .map(p => ({
                        partModelNumber: p.part_model_number,
                        partType: p.part_type,
                        name: p.part_name,
                        exampleImage: p.example_image || null,
                        description: p.part_type === 'left' 
                            ? `${p.part_name} - should match your right AirPod`
                            : `${p.part_name} - USB-C or Lightning`
                    }));
            } else if (actualPartType === 'case') {
                // Compatible: left and right AirPods
                compatibleParts = sameGenerationParts
                    .filter(p => p.part_type === 'left' || p.part_type === 'right')
                    .map(p => ({
                        partModelNumber: p.part_model_number,
                        partType: p.part_type,
                        name: p.part_name,
                        exampleImage: p.example_image || null,
                        description: p.part_name
                    }));
            }
        }
        
        console.log(`[Compatible Parts API] Returning ${compatibleParts.length} compatible parts`);
        
        // Build purchasedPart info for response
        const purchasedPartInfo = purchasedPart ? {
            partModelNumber: purchasedPart.part_model_number,
            partType: actualPartType, // Use actual part type (may be from query param)
            name: purchasedPart.part_name,
            generation: generation || purchasedPart.generation
        } : {
            partModelNumber: partModelNumber,
            partType: actualPartType,
            name: `${actualPartType === 'left' ? 'Left' : actualPartType === 'right' ? 'Right' : 'Case'} AirPod`,
            generation: generation || 'Unknown'
        };
        
        res.json({
            ok: true,
            data: {
                purchasedPart: purchasedPartInfo,
                compatibleParts: compatibleParts
            }
        });
    } catch (err) {
        console.error('[Compatible Parts API] Database error:', err);
        res.status(500).json({ 
            ok: false,
            error: 'Database error: ' + err.message 
        });
    }
});

// Get add-on sales for a product (public endpoint for warranty registration)
app.get('/api/addon-sales', requireDB, async (req, res) => {
    const generation = req.query.generation;
    const partModelNumber = req.query.part_model_number;
    
    try {
        console.log(`[Add-On Sales API] Request for generation: "${generation}", part_model_number: "${partModelNumber}"`);
        
        if (!generation && !partModelNumber) {
            return res.json({ addonSales: [] });
        }
        
        // Build query to find matching add-on sales
        const query = {
            active: true // Only return active add-on sales
        };
        
        // Match by generation OR part model number
        const orConditions = [];
        
        if (generation) {
            orConditions.push({ associated_generations: generation });
        }
        
        if (partModelNumber) {
            orConditions.push({ associated_part_models: partModelNumber });
        }
        
        if (orConditions.length > 0) {
            query.$or = orConditions;
        }
        
        console.log(`[Add-On Sales API] Query:`, JSON.stringify(query, null, 2));
        
        const addonSales = await db.collection('addon_sales')
            .find(query)
            .sort({ name: 1 })
            .toArray();
        
        console.log(`[Add-On Sales API] Found ${addonSales.length} matching add-on sales`);
        
        // Format response
        const formattedAddonSales = addonSales.map(addon => ({
            id: addon._id.toString(),
            name: addon.name,
            description: addon.description,
            price: addon.price,
            image: addon.image || addon.image_url, // Support both field names
            active: addon.active
        }));
        
        res.json({ addonSales: formattedAddonSales });
    } catch (err) {
        console.error('[Add-On Sales API] Database error:', err);
        res.status(500).json({ 
            error: 'Database error: ' + err.message 
        });
    }
});

// Get authenticity images for a part (public endpoint for warranty registration)
app.get('/api/authenticity-images/:partModelNumber', requireDB, async (req, res) => {
    const partModelNumber = req.params.partModelNumber;
    
    try {
        console.log(`[Authenticity API] Request for part model number: "${partModelNumber}"`);
        
        // Find the purchased part - try both exact match and case-insensitive
        let purchasedPart = await db.collection('airpod_parts').findOne({ 
            part_model_number: partModelNumber 
        });
        
        // If not found, try case-insensitive search
        if (!purchasedPart) {
            console.log(`[Authenticity API] Exact match failed, trying case-insensitive search`);
            const allParts = await db.collection('airpod_parts').find({}).toArray();
            purchasedPart = allParts.find(p => 
                p.part_model_number && 
                p.part_model_number.toUpperCase() === partModelNumber.toUpperCase()
            );
            if (purchasedPart) {
                console.log(`[Authenticity API] Found case-insensitive match: ${purchasedPart.part_model_number}`);
            }
        }
        
        if (!purchasedPart) {
            console.log(`[Authenticity API] Part not found: ${partModelNumber}`);
            return res.json({ 
                ok: true,
                data: {
                    images: {
                        caseImage: null,
                        airpodImage: null
                    }
                }
            });
        }
        
        console.log(`[Authenticity API] Found part: ${partModelNumber}, type: ${purchasedPart.part_type}, generation: ${purchasedPart.generation}`);
        console.log(`[Authenticity API] Purchased part authenticity images:`, {
            authenticity_case_image: purchasedPart.authenticity_case_image,
            authenticity_airpod_image: purchasedPart.authenticity_airpod_image,
            allFields: Object.keys(purchasedPart).filter(k => k.includes('authenticity'))
        });
        
        // Get all parts from the same generation
        const sameGenerationParts = await db.collection('airpod_parts').find({
            generation: purchasedPart.generation
        }).toArray();
        
        console.log(`[Authenticity API] Found ${sameGenerationParts.length} parts in same generation:`, 
            sameGenerationParts.map(p => ({ 
                model: p.part_model_number, 
                type: p.part_type,
                hasCaseImg: !!p.authenticity_case_image,
                hasAirpodImg: !!p.authenticity_airpod_image
            }))
        );
        
        let caseImage = null;
        let airpodImage = null;
        
        // LOGIC: If purchased part is LEFT or RIGHT
        if (purchasedPart.part_type === 'left' || purchasedPart.part_type === 'right') {
            // AirPod image: from the purchased part itself (only if show_airpod_image is true)
            if (purchasedPart.show_airpod_image !== false) {
                airpodImage = purchasedPart.authenticity_airpod_image || null;
                console.log(`[Authenticity API] Purchased part AirPod image:`, airpodImage);
            } else {
                console.log(`[Authenticity API] AirPod image hidden by show_airpod_image flag`);
            }
            
            // Case image: from the CASE part in same generation (only if show_case_image is true)
            const casePart = sameGenerationParts.find(p => p.part_type === 'case');
            if (casePart) {
                if (casePart.show_case_image !== false) {
                    caseImage = casePart.authenticity_case_image || null;
                    console.log(`[Authenticity API] Found case part: ${casePart.part_model_number}, case image:`, caseImage);
                } else {
                    console.log(`[Authenticity API] Case image hidden by show_case_image flag for case part ${casePart.part_model_number}`);
                }
            } else {
                console.warn(`[Authenticity API] No case part found in generation ${purchasedPart.generation}`);
            }
            
            console.log(`[Authenticity API] LEFT/RIGHT part - AirPod from purchased, Case from generation CASE part`);
        }
        // LOGIC: If purchased part is CASE
        else if (purchasedPart.part_type === 'case') {
            // Case image: DO NOT send - case is sealed in box and cannot be verified at this stage
            // Users should only verify the AirPods themselves during authenticity check
            caseImage = null;
            console.log(`[Authenticity API] Case product - NOT sending case image (case is sealed in box)`);

            // AirPod image: prefer LEFT, then RIGHT from same generation (only if show_airpod_image is true)
            const leftPart = sameGenerationParts.find(p => p.part_type === 'left');
            const rightPart = sameGenerationParts.find(p => p.part_type === 'right');

            console.log(`[Authenticity API] Looking for AirPod image - Left part:`, leftPart ? { model: leftPart.part_model_number, hasImg: !!leftPart.authenticity_airpod_image, showFlag: leftPart.show_airpod_image } : 'not found');
            console.log(`[Authenticity API] Looking for AirPod image - Right part:`, rightPart ? { model: rightPart.part_model_number, hasImg: !!rightPart.authenticity_airpod_image, showFlag: rightPart.show_airpod_image } : 'not found');

            if (leftPart && leftPart.authenticity_airpod_image && leftPart.show_airpod_image !== false) {
                airpodImage = leftPart.authenticity_airpod_image;
                console.log(`[Authenticity API] Using left part AirPod image:`, airpodImage);
            } else if (rightPart && rightPart.authenticity_airpod_image && rightPart.show_airpod_image !== false) {
                airpodImage = rightPart.authenticity_airpod_image;
                console.log(`[Authenticity API] Using right part AirPod image:`, airpodImage);
            } else {
                console.warn(`[Authenticity API] No AirPod image found in compatible parts (or hidden by show flag)`);
            }

            console.log(`[Authenticity API] CASE part - Only AirPod image from generation LEFT/RIGHT part (case is sealed)`);
        }
        
        console.log(`[Authenticity API] Final images being returned:`, { caseImage, airpodImage });
        
        res.json({
            ok: true,
            data: {
                images: {
                    caseImage: caseImage,
                    airpodImage: airpodImage
                }
            },
            // Also include flat structure for backward compatibility
            authenticity_case_image: caseImage,
            authenticity_airpod_image: airpodImage
        });
    } catch (err) {
        console.error('[Authenticity API] Database error:', err);
        res.status(500).json({ 
            ok: false,
            error: 'Database error: ' + err.message 
        });
    }
});

// Callback handler for User Service authentication
app.get('/auth/callback', (req, res) => {
    try {
        const { token, refresh_token } = req.query;
        
        if (!token) {
            console.error('Auth callback: No token provided');
            return res.redirect('/admin/login?error=no_token');
        }
        
        // Store tokens in cookies (for server-side use if needed)
        res.cookie('accessToken', token, { 
            httpOnly: false, // Allow JavaScript to read it
            secure: NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 24 * 60 * 60 * 1000 // 24 hours
        });
        
        if (refresh_token) {
            res.cookie('refreshToken', refresh_token, { 
                httpOnly: false, // Allow JavaScript to read it
                secure: NODE_ENV === 'production',
                sameSite: 'lax',
                maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
            });
        }
        
        // Redirect to dashboard with tokens in URL - frontend will extract and store in localStorage
        // Then clean up the URL
        const redirectUrl = `/admin/dashboard?token=${encodeURIComponent(token)}${refresh_token ? `&refresh_token=${encodeURIComponent(refresh_token)}` : ''}`;
        console.log('Auth callback: Redirecting to dashboard with tokens');
        res.redirect(redirectUrl);
    } catch (error) {
        console.error('Auth callback error:', error);
        res.redirect('/admin/login?error=callback_failed');
    }
});

// Serve admin pages
app.get('/admin/login', (req, res, next) => {
    try {
        const loginPath = path.join(__dirname, 'public', 'admin', 'login.html');
        res.sendFile(loginPath, (err) => {
            if (err) {
                console.error('Error serving login page:', err);
                if (!res.headersSent) {
                    res.status(500).json({ error: 'Internal server error' });
                }
            }
        });
    } catch (error) {
        console.error('Error in login route:', error);
        if (!res.headersSent) {
            res.status(500).json({ error: 'Internal server error' });
        }
    }
});

app.get('/admin/dashboard', requireAuthHTML, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin', 'dashboard.html'));
});

app.get('/admin/parts', requireAuthHTML, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin', 'parts.html'));
});

app.get('/admin/addon-sales', requireAuthHTML, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin', 'addon-sales.html'));
});

app.get('/admin/settings', requireAuthHTML, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin', 'settings.html'));
});

// Health check endpoint - shows database status and readiness for warranty registration
app.get('/api/health', async (req, res) => {
    const health = {
        status: 'ok',
        timestamp: new Date().toISOString(),
        database: {
            connected: !!db,
            status: db ? 'connected' : 'disconnected'
        },
        warranty_registration: {
            ready: false,
            issues: []
        }
    };

    if (db) {
        try {
            // Check if we can access the database
            const productsCount = await db.collection('products').countDocuments();
            const warrantiesCount = await db.collection('warranties').countDocuments();

            health.database.collections = {
                products: productsCount,
                warranties: warrantiesCount
            };

            // Check if warranty registration is ready
            if (productsCount > 0) {
                health.warranty_registration.ready = true;
                health.warranty_registration.message = 'Warranty registration is operational';
            } else {
                health.warranty_registration.issues.push('No products found in database');
            }
        } catch (err) {
            health.database.status = 'error';
            health.database.error = err.message;
            health.warranty_registration.issues.push('Database query failed: ' + err.message);
        }
    } else {
        health.database.status = 'disconnected';
        health.warranty_registration.issues.push('Database not connected');
    }

    // Set HTTP status based on readiness
    const httpStatus = health.warranty_registration.ready ? 200 : 503;
    res.status(httpStatus).json(health);
});

// Catch all route - serve index.html for SPA-like behavior
app.get('*', (req, res) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/admin')) {
        return res.status(404).json({ error: 'Not found' });
    }
    
    // Suppress 404 logging for browser extension files (harmless requests)
    const browserExtensionFiles = [
        'twint_ch.js',
        'lkk_ch.js',
        'support_parent.css',
        'twint_ch.min.js',
        'lkk_ch.min.js'
    ];
    
    const isBrowserExtensionFile = browserExtensionFiles.some(file => 
        req.path.includes(file)
    );
    
    if (isBrowserExtensionFile) {
        // Silently return 404 for browser extension files
        return res.status(404).end();
    }
    
    const filePath = path.join(__dirname, 'public', req.path === '/' ? 'index.html' : req.path);
    
    // Check if file exists before trying to send it
    fs.access(filePath, fs.constants.F_OK, (err) => {
        if (err) {
            // File doesn't exist - only log if not a browser extension file
            if (!isBrowserExtensionFile) {
                // This is handled silently by returning 404
            }
            return res.status(404).end();
        }
        res.sendFile(filePath);
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
    // Suppress logging for browser extension files (harmless 404s)
    const browserExtensionFiles = [
        'twint_ch.js',
        'lkk_ch.js',
        'support_parent.css',
        'twint_ch.min.js',
        'lkk_ch.min.js'
    ];
    
    const isBrowserExtensionFile = browserExtensionFiles.some(file => 
        req.path && req.path.includes(file)
    );
    
    if (isBrowserExtensionFile && err.code === 'ENOENT') {
        // Silently return 404 for browser extension files
        return res.status(404).end();
    }
    
    // Don't log 404 errors for missing uploads (expected on ephemeral filesystem)
    if (err.code === 'ENOENT' && req.path && req.path.startsWith('/uploads/')) {
        // Suppress logging for missing upload files
        return res.status(404).type('application/json').json({ 
            error: 'File not found',
            message: 'This file may have been removed due to container restart'
        });
    }
    
    console.error('Error:', err);
    if (!res.headersSent) {
        res.status(500).type('application/json').json({ error: 'Internal server error' });
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`LJM AirPod Support Server running on http://localhost:${PORT}`);
    console.log(`Admin panel: http://localhost:${PORT}/admin/login`);

    // Check JWT_SECRET configuration
    if (!process.env.JWT_SECRET && !process.env.SERVICE_API_KEY) {
        console.error('\n⚠️  ========================================');
        console.error('⚠️  WARNING: JWT_SECRET is NOT configured!');
        console.error('⚠️  ========================================');
        console.error('   User Service authentication will FAIL');
        console.error('   Users will NOT be able to see data after logging in');
        console.error('\n   To fix (choose one):');
        console.error('   Option 1: Set JWT_SECRET environment variable in Railway');
        console.error('   Option 2: Set SERVICE_API_KEY to auto-fetch from User Service');
        console.error('\n   Without JWT_SECRET or SERVICE_API_KEY, only legacy session-based login will work\n');
    } else if (process.env.JWT_SECRET) {
        console.log('✅ JWT_SECRET configured directly - User Service authentication enabled');
    } else if (process.env.SERVICE_API_KEY) {
        console.log('✅ SERVICE_API_KEY configured - will fetch JWT_SECRET from User Service on first auth request');
    }
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('Shutting down server...');
    process.exit(0);
});
