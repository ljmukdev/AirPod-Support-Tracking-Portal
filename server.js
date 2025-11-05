const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const bodyParser = require('body-parser');
const session = require('express-session');
const path = require('path');
const multer = require('multer');
const fs = require('fs');

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

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        // Always use the current uploadsDir (set at startup)
        const currentUploadsDir = global.uploadsDir || uploadsDir;
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
                return cb(null, fallbackDir);
            }
        }
        console.log(`💾 Multer saving to: ${currentUploadsDir}`);
        cb(null, currentUploadsDir);
    },
    filename: (req, file, cb) => {
        // Generate unique filename: timestamp-random-originalname
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, `product-${uniqueSuffix}${ext}`);
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

// Explicit route for uploads BEFORE static middleware to handle missing files gracefully
// This prevents Express static from throwing unhandled errors
app.get('/uploads/:filename', (req, res) => {
    const filename = req.params.filename;
    // Use the same uploadsDir that we configured above (works with both local and Railway volume)
    const filePath = path.join(global.uploadsDir || uploadsDir, filename);
    
    // Check if file exists before trying to serve it
    fs.access(filePath, fs.constants.F_OK, (err) => {
        if (err) {
            // File doesn't exist - detailed debugging
            const currentUploadsDir = global.uploadsDir || uploadsDir;
            console.log(`❌ File not found: ${filename}`);
            console.log(`   Searched in: ${currentUploadsDir}`);
            console.log(`   Full path: ${filePath}`);
            
            // Check if directory exists and list contents
            if (fs.existsSync(currentUploadsDir)) {
                try {
                    const files = fs.readdirSync(currentUploadsDir);
                    console.log(`   ✅ Directory exists with ${files.length} file(s)`);
                    if (files.length > 0) {
                        console.log(`   Files in directory:`, files.slice(0, 10));
                        // Check if filename matches any file (case-insensitive)
                        const matchingFile = files.find(f => f.toLowerCase() === filename.toLowerCase());
                        if (matchingFile) {
                            console.log(`   ⚠️  Found similar file (case mismatch?): ${matchingFile}`);
                        }
                    }
                } catch (dirErr) {
                    console.error(`   ❌ Error reading directory:`, dirErr.message);
                }
            } else {
                console.error(`   ❌ Uploads directory doesn't exist: ${currentUploadsDir}`);
            }
            
            // Return 404 with proper content type
            res.status(404).type('application/json').json({ 
                error: 'File not found',
                message: 'This file may have been removed or not uploaded correctly'
            });
        } else {
            // File exists, serve it
            res.sendFile(filePath, (err) => {
                if (err) {
                    console.error(`Error serving file ${filePath}:`, err.message);
                    if (!res.headersSent) {
                        res.status(500).type('application/json').json({ error: 'Error serving file' });
                    }
                }
            });
        }
    });
});

// Serve static files from public directory (except uploads, handled above)
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
            
            req.files.forEach((file, index) => {
                // Multer saves files and provides the actual path in file.path
                // Use that instead of constructing the path
                const actualSavedPath = file.path || path.join(currentUploadsDir, file.filename);
                const expectedPath = path.join(currentUploadsDir, file.filename);
                
                console.log(`   File ${index + 1}: ${file.filename}`);
                console.log(`      Multer says saved at: ${actualSavedPath}`);
                console.log(`      Expected at: ${expectedPath}`);
                
                // Check both paths (multer's path and our expected path)
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
                    console.error(`         Multer file object:`, {
                        filename: file.filename,
                        path: file.path,
                        destination: file.destination,
                        size: file.size
                    });
                }
                
                if (verifiedPath) {
                    // Store relative path for serving
                    photos.push(`/uploads/${file.filename}`);
                    const stats = fs.statSync(verifiedPath);
                    console.log(`      ✅ Photo verified: ${(stats.size / 1024).toFixed(1)} KB`);
                }
            });
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
            const newPhotos = req.files.map(file => `/uploads/${file.filename}`);
            // Get existing photos and append new ones
            const existingProduct = await db.collection('products').findOne({ _id: new ObjectId(id) });
            const existingPhotos = existingProduct ? (existingProduct.photos || []) : [];
            photosUpdate.photos = [...existingPhotos, ...newPhotos];
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
    res.sendFile(path.join(__dirname, 'public', req.path === '/' ? 'index.html' : req.path));
});

// Error handling middleware
app.use((err, req, res, next) => {
    // Don't log 404 errors for missing uploads (expected on ephemeral filesystem)
    if (err.code === 'ENOENT' && req.path && req.path.startsWith('/uploads/')) {
        console.log(`Expected: File not found due to ephemeral filesystem: ${req.path}`);
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
