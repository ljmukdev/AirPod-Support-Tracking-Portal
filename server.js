const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const bodyParser = require('body-parser');
const session = require('express-session');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const app = express();
const PORT = process.env.PORT || 3000;

// Trust proxy (needed for Railway/Heroku)
app.set('trust proxy', 1);

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

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

// Explicit route for uploads BEFORE static middleware to handle missing files gracefully
// This prevents Express static from throwing unhandled errors
app.get('/uploads/:filename', async (req, res) => {
    const filename = req.params.filename;
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

app.use(express.static('public', {
    index: false, // Don't serve index.html for directories
    dotfiles: 'ignore', // Ignore dotfiles
    etag: true,
    lastModified: true,
    maxAge: '1d' // Cache for 1 day
}));

// Session configuration
// Note: MemoryStore warning is expected in development. For production with multiple instances,
// consider using Redis or MongoDB session store (requires additional setup).
app.use(session({
    secret: process.env.SESSION_SECRET || 'LJM_SECURE_SESSION_KEY_2024',
    resave: false,
    saveUninitialized: false,
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
        
        process.exit(1);
    });

// Initialize database collections and indexes
async function initializeDatabase() {
    try {
        // Create indexes for products collection
        await db.collection('products').createIndex({ security_barcode: 1 }, { unique: true });
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
        } catch (err) {
            // Indexes may already exist, ignore error
            if (!err.message.includes('already exists') && !err.message.includes('E11000')) {
                console.error('Warning: Could not create warranty indexes:', err.message);
            }
        }
        
        console.log('Database indexes created');
        
        // Check if parts collection is empty and populate
        const partsCount = await db.collection('airpod_parts').countDocuments();
        if (partsCount === 0) {
            await populateInitialParts();
        }
    } catch (err) {
        console.error('Database initialization error:', err);
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
        {generation: 'AirPods Pro (2nd Gen)', part_name: 'Charging Case (USB-C MagSafe)', part_model_number: 'A2968', part_type: 'case', notes: 'USB-C version', display_order: 1, date_added: new Date()},
        {generation: 'AirPods Pro (2nd Gen)', part_name: 'Charging Case (Lightning)', part_model_number: 'A2968-L', part_type: 'case', notes: 'Lightning version (compatibility case)', display_order: 2, date_added: new Date()}
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
function requireAuth(req, res, next) {
    if (req.session && req.session.authenticated) {
        return next();
    }
    res.status(401).json({ error: 'Unauthorized' });
}

// Authentication middleware for HTML pages (redirects to login)
function requireAuthHTML(req, res, next) {
    if (req.session && req.session.authenticated) {
        return next();
    }
    res.redirect('/admin/login');
}

// API Routes

// Admin Login
app.post('/api/admin/login', (req, res) => {
    const { username, password } = req.body;
    const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
    const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'LJM2024secure';
    
    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
        req.session.authenticated = true;
        req.session.username = username;
        res.json({ success: true, message: 'Login successful' });
    } else {
        res.status(401).json({ error: 'Invalid credentials' });
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
            security_barcode: security_barcode.trim(),
            part_type: part_type.toLowerCase(),
            generation: generation ? generation.trim() : null,
            part_model_number: part_model_number ? part_model_number.trim() : null,
            notes: notes ? notes.trim() : null,
            ebay_order_number: ebay_order_number ? ebay_order_number.trim() : null,
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
        
        // Convert MongoDB ObjectId to string for JSON response
        const productsWithStringIds = products.map(product => ({
            ...product,
            id: product._id.toString(),
            _id: undefined
        }));
        
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
            security_barcode: security_barcode.trim(),
            part_type: part_type.toLowerCase(),
            generation: generation ? generation.trim() : null,
            part_model_number: part_model_number ? part_model_number.trim() : null,
            notes: notes ? notes.trim() : null,
            ebay_order_number: ebay_order_number ? ebay_order_number.trim() : null,
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
        const product = await db.collection('products').findOne({ 
            security_barcode: security_barcode.trim() 
        });
        
        if (!product) {
            res.status(404).json({ error: 'Invalid security code. Please check and try again.' });
        } else {
            res.json({ 
                success: true, 
                part_type: product.part_type,
                serial_number: product.serial_number,
                generation: product.generation,
                part_model_number: product.part_model_number,
                photos: product.photos || [],
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

// Log confirmation (Public)
app.post('/api/confirm-understanding', requireDB, async (req, res) => {
    const { security_barcode } = req.body;
    
    if (!security_barcode) {
        return res.status(400).json({ error: 'Security barcode is required' });
    }
    
    try {
        const result = await db.collection('products').updateOne(
            { security_barcode: security_barcode.trim() },
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

// Register warranty (Public)
app.post('/api/warranty/register', requireDB, async (req, res) => {
    const {
        security_barcode,
        customer_name,
        customer_email,
        customer_phone,
        extended_warranty,
        marketing_consent,
        warranty_price,
        payment_intent_id
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
    
    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(customer_email)) {
        return res.status(400).json({ error: 'Invalid email address' });
    }
    
    // Verify product exists
    try {
        const product = await db.collection('products').findOne({ 
            security_barcode: security_barcode.trim() 
        });
        
        if (!product) {
            return res.status(404).json({ error: 'Product not found' });
        }
        
        // Check if warranty already registered for this product
        const existingWarranty = await db.collection('warranties').findOne({
            security_barcode: security_barcode.trim()
        });
        
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
            security_barcode: security_barcode.trim(),
            product_id: product._id.toString(),
            customer_name: customer_name.trim(),
            customer_email: customer_email.trim().toLowerCase(),
            customer_phone: customer_phone ? customer_phone.trim() : null,
            standard_warranty_start: registrationDate,
            standard_warranty_end: standardWarrantyEnd,
            extended_warranty: extended_warranty || 'none',
            extended_warranty_end: extendedWarrantyEnd,
            warranty_price: warranty_price || 0,
            payment_intent_id: payment_intent_id || null,
            payment_status: payment_intent_id ? 'paid' : 'free',
            marketing_consent: marketing_consent || false,
            registration_date: registrationDate,
            status: 'active',
            claims_count: 0,
            last_claim_date: null
        };
        
        const result = await db.collection('warranties').insertOne(warranty);
        
        console.log(`✅ Warranty registered: ${warrantyId} for product ${security_barcode}`);
        console.log(`   Customer: ${customer_name} (${customer_email})`);
        console.log(`   Extended warranty: ${extended_warranty || 'none'} (£${warranty_price || 0})`);
        
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

// Get product info by barcode (for confirmation page)
app.get('/api/product-info/:barcode', requireDB, async (req, res) => {
    const { barcode } = req.params;
    
    try {
        const product = await db.collection('products').findOne({ 
            security_barcode: barcode.trim() 
        });
        
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

// Add new part
app.post('/api/admin/part', requireAuth, requireDB, async (req, res) => {
    const { generation, part_name, part_model_number, part_type, notes, display_order } = req.body;
    
    if (!generation || !part_name || !part_model_number || !part_type) {
        return res.status(400).json({ error: 'Generation, part name, part model number, and part type are required' });
    }
    
    if (!['left', 'right', 'case'].includes(part_type.toLowerCase())) {
        return res.status(400).json({ error: 'Part type must be left, right, or case' });
    }
    
    console.log('Adding new part:', { generation, part_name, part_model_number, part_type });
    
    try {
        const part = {
            generation: generation.trim(),
            part_name: part_name.trim(),
            part_model_number: part_model_number.trim(),
            part_type: part_type.toLowerCase(),
            notes: notes ? notes.trim() : null,
            display_order: display_order || 0,
            date_added: new Date()
        };
        
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
app.put('/api/admin/part/:id', requireAuth, requireDB, async (req, res) => {
    const id = req.params.id;
    const { generation, part_name, part_model_number, part_type, notes, display_order } = req.body;
    
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
        
        const result = await db.collection('airpod_parts').updateOne(
            { _id: new ObjectId(id) },
            {
                $set: {
                    generation: generation.trim(),
                    part_name: part_name.trim(),
                    part_model_number: part_model_number.trim(),
                    part_type: part_type.toLowerCase(),
                    notes: notes ? notes.trim() : null,
                    display_order: display_order || 0
                }
            }
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

// Serve admin pages
app.get('/admin/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin', 'login.html'));
});

app.get('/admin/dashboard', requireAuthHTML, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin', 'dashboard.html'));
});

app.get('/admin/parts', requireAuthHTML, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin', 'parts.html'));
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
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('Shutting down server...');
    process.exit(0);
});
