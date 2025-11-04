const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const session = require('express-session');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Trust proxy (needed for Railway/Heroku)
app.set('trust proxy', 1);

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

// Session configuration
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

// Initialize SQLite database
// Use Railway's persistent volume path if available, otherwise use current directory
const DB_PATH = process.env.DATABASE_PATH || './database.sqlite';
const db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
        console.error('Database path:', DB_PATH);
    } else {
        console.log('Connected to SQLite database at:', DB_PATH);
        initializeDatabase();
    }
});

// Create tables if they don't exist
function initializeDatabase() {
    db.run(`CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        serial_number TEXT NOT NULL,
        security_barcode TEXT UNIQUE NOT NULL,
        part_type TEXT NOT NULL,
        generation TEXT,
        part_model_number TEXT,
        notes TEXT,
        ebay_order_number TEXT,
        date_added DATETIME DEFAULT CURRENT_TIMESTAMP,
        confirmation_checked BOOLEAN DEFAULT 0,
        confirmation_date DATETIME
    )`, (err) => {
        if (err) {
            console.error('Error creating table:', err.message);
        } else {
            console.log('Database initialized');
            // Add new columns if they don't exist (for existing databases)
            db.run(`ALTER TABLE products ADD COLUMN generation TEXT`, () => {});
            db.run(`ALTER TABLE products ADD COLUMN part_model_number TEXT`, () => {});
            db.run(`ALTER TABLE products ADD COLUMN notes TEXT`, () => {});
            db.run(`ALTER TABLE products ADD COLUMN ebay_order_number TEXT`, () => {});
        }
    });
    
    // Create parts table for managing AirPod parts database
    db.run(`CREATE TABLE IF NOT EXISTS airpod_parts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        generation TEXT NOT NULL,
        part_name TEXT NOT NULL,
        part_model_number TEXT NOT NULL,
        part_type TEXT NOT NULL,
        notes TEXT,
        display_order INTEGER DEFAULT 0,
        date_added DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(generation, part_name)
    )`, (err) => {
        if (err) {
            console.error('Error creating airpod_parts table:', err.message);
        } else {
            console.log('AirPod parts table initialized');
            // Check if table is empty and populate with initial data
            db.get('SELECT COUNT(*) as count FROM airpod_parts', (err, row) => {
                if (!err && row && row.count === 0) {
                    populateInitialParts();
                }
            });
        }
    });
}

// Populate initial parts data
function populateInitialParts() {
    const initialParts = [
        // AirPods (1st Gen)
        {generation: 'AirPods (1st Gen)', part_name: 'Standard AirPods earbuds (Left)', part_model_number: 'A1523', part_type: 'left', notes: 'Basic model numbers', display_order: 1},
        {generation: 'AirPods (1st Gen)', part_name: 'Standard AirPods earbuds (Right)', part_model_number: 'A1722', part_type: 'right', notes: 'Basic model numbers', display_order: 2},
        {generation: 'AirPods (1st Gen)', part_name: 'Charging Case (Lightning)', part_model_number: 'A1602', part_type: 'case', notes: 'Works with gen 1 & gen 2', display_order: 3},
        // AirPods (2nd Gen)
        {generation: 'AirPods (2nd Gen)', part_name: 'Standard AirPods earbuds (Left)', part_model_number: 'A2031', part_type: 'left', notes: 'Model numbers', display_order: 1},
        {generation: 'AirPods (2nd Gen)', part_name: 'Standard AirPods earbuds (Right)', part_model_number: 'A2032', part_type: 'right', notes: 'Model numbers', display_order: 2},
        {generation: 'AirPods (2nd Gen)', part_name: 'Charging Case (Wireless)', part_model_number: 'A1938', part_type: 'case', notes: 'Qi Wireless case for gen1/2', display_order: 3},
        {generation: 'AirPods (2nd Gen)', part_name: 'Charging Case (Lightning)', part_model_number: 'A1602', part_type: 'case', notes: 'Lightning case - works with gen 1 & gen 2', display_order: 4},
        // AirPods (3rd Gen)
        {generation: 'AirPods (3rd Gen)', part_name: 'Earbuds (Left)', part_model_number: 'A2564', part_type: 'left', notes: 'Genuine Apple part listing', display_order: 1},
        {generation: 'AirPods (3rd Gen)', part_name: 'Earbuds (Right)', part_model_number: 'A2565', part_type: 'right', notes: 'Genuine Apple part listing', display_order: 2},
        {generation: 'AirPods (3rd Gen)', part_name: 'Charging Case (MagSafe)', part_model_number: 'A2566', part_type: 'case', notes: 'MagSafe case, gen3', display_order: 3},
        {generation: 'AirPods (3rd Gen)', part_name: 'Charging Case (Lightning)', part_model_number: 'A2566-L', part_type: 'case', notes: 'Lightning case for gen3', display_order: 4},
        // AirPods (4th Gen) standard
        {generation: 'AirPods (4th Gen) standard line (non-Pro)', part_name: 'Earbuds (Left)', part_model_number: 'A3050', part_type: 'left', notes: 'Non-ANC variant', display_order: 1},
        {generation: 'AirPods (4th Gen) standard line (non-Pro)', part_name: 'Earbuds (Right)', part_model_number: 'A3053 / A3054', part_type: 'right', notes: 'Non-ANC variant (multiple model numbers)', display_order: 2},
        {generation: 'AirPods (4th Gen) standard line (non-Pro)', part_name: 'Charging Case', part_model_number: 'A3058', part_type: 'case', notes: 'Case for standard gen4', display_order: 3},
        // AirPods (4th Gen) ANC
        {generation: 'AirPods (4th Gen) standard line (ANC version)', part_name: 'Earbuds (Left)', part_model_number: 'A3055', part_type: 'left', notes: 'ANC version of standard line', display_order: 1},
        {generation: 'AirPods (4th Gen) standard line (ANC version)', part_name: 'Earbuds (Right)', part_model_number: 'A3056 / A3057', part_type: 'right', notes: 'ANC version of standard line (multiple model numbers)', display_order: 2},
        {generation: 'AirPods (4th Gen) standard line (ANC version)', part_name: 'Charging Case', part_model_number: 'A3059', part_type: 'case', notes: 'ANC case', display_order: 3},
        // AirPods Pro (1st Gen)
        {generation: 'AirPods Pro (1st Gen)', part_name: 'Earbuds (Right)', part_model_number: 'A2083', part_type: 'right', notes: 'Identified in teardown', display_order: 1},
        {generation: 'AirPods Pro (1st Gen)', part_name: 'Earbuds (Left)', part_model_number: 'A2084', part_type: 'left', notes: 'Identified in teardown', display_order: 2},
        {generation: 'AirPods Pro (1st Gen)', part_name: 'Charging Case', part_model_number: 'A2190', part_type: 'case', notes: 'MagSafe case first Pro', display_order: 3},
        {generation: 'AirPods Pro (1st Gen)', part_name: 'Charging Case (Lightning)', part_model_number: 'A2190-L', part_type: 'case', notes: 'Lightning case for Pro 1st Gen', display_order: 4},
        {generation: 'AirPods Pro (1st Gen)', part_name: 'Service Kit Replacement Pods (Left)', part_model_number: '661-17164', part_type: 'left', notes: 'Internal service kit', display_order: 5},
        {generation: 'AirPods Pro (1st Gen)', part_name: 'Service Kit Replacement Pods (Right)', part_model_number: '661-17165', part_type: 'right', notes: 'Internal service kit', display_order: 6},
        // AirPods Pro (2nd Gen)
        {generation: 'AirPods Pro (2nd Gen)', part_name: 'Charging Case (USB-C MagSafe)', part_model_number: 'A2968', part_type: 'case', notes: 'USB-C version', display_order: 1},
        {generation: 'AirPods Pro (2nd Gen)', part_name: 'Charging Case (Lightning)', part_model_number: 'A2968-L', part_type: 'case', notes: 'Lightning version (compatibility case)', display_order: 2}
    ];
    
    const stmt = db.prepare('INSERT INTO airpod_parts (generation, part_name, part_model_number, part_type, notes, display_order) VALUES (?, ?, ?, ?, ?, ?)');
    initialParts.forEach(part => {
        stmt.run(part.generation, part.part_name, part.part_model_number, part.part_type, part.notes, part.display_order);
    });
    stmt.finalize();
    console.log('Initial AirPod parts data populated');
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

// Add new product (Admin only)
app.post('/api/admin/product', requireAuth, (req, res) => {
    const { serial_number, security_barcode, part_type, generation, part_model_number, notes, ebay_order_number } = req.body;
    
    if (!serial_number || !security_barcode || !part_type) {
        return res.status(400).json({ error: 'Serial number, security barcode, and part type are required' });
    }
    
    if (!['left', 'right', 'case'].includes(part_type.toLowerCase())) {
        return res.status(400).json({ error: 'Part type must be left, right, or case' });
    }
    
    db.run(
        'INSERT INTO products (serial_number, security_barcode, part_type, generation, part_model_number, notes, ebay_order_number) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [
            serial_number.trim(), 
            security_barcode.trim(), 
            part_type.toLowerCase(),
            generation ? generation.trim() : null,
            part_model_number ? part_model_number.trim() : null,
            notes ? notes.trim() : null,
            ebay_order_number ? ebay_order_number.trim() : null
        ],
        function(err) {
            if (err) {
                if (err.message.includes('UNIQUE constraint')) {
                    res.status(409).json({ error: 'Security barcode already exists' });
                } else {
                    res.status(500).json({ error: 'Database error: ' + err.message });
                }
            } else {
                res.json({ 
                    success: true, 
                    message: 'Product added successfully',
                    id: this.lastID 
                });
            }
        }
    );
});

// Get all products (Admin only, paginated)
app.get('/api/admin/products', requireAuth, (req, res) => {
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;
    
    db.all(
        'SELECT * FROM products ORDER BY date_added DESC LIMIT ? OFFSET ?',
        [limit, offset],
        (err, rows) => {
            if (err) {
                res.status(500).json({ error: 'Database error: ' + err.message });
            } else {
                db.get('SELECT COUNT(*) as total FROM products', (err, countRow) => {
                    if (err) {
                        res.json({ products: rows, total: rows.length });
                    } else {
                        res.json({ products: rows, total: countRow.total });
                    }
                });
            }
        }
    );
});

// Delete product (Admin only)
app.delete('/api/admin/product/:id', requireAuth, (req, res) => {
    const id = parseInt(req.params.id);
    
    db.run('DELETE FROM products WHERE id = ?', [id], function(err) {
        if (err) {
            res.status(500).json({ error: 'Database error: ' + err.message });
        } else if (this.changes === 0) {
            res.status(404).json({ error: 'Product not found' });
        } else {
            res.json({ success: true, message: 'Product deleted successfully' });
        }
    });
});

// Verify customer barcode (Public)
app.post('/api/verify-barcode', (req, res) => {
    const { security_barcode } = req.body;
    const ip = req.ip || req.connection.remoteAddress;
    
    if (!security_barcode) {
        return res.status(400).json({ error: 'Security barcode is required' });
    }
    
    // Check rate limiting
    if (!checkRateLimit(ip)) {
        return res.status(429).json({ error: 'Too many attempts. Please try again later.' });
    }
    
    db.get(
        'SELECT id, serial_number, security_barcode, part_type FROM products WHERE security_barcode = ?',
        [security_barcode.trim()],
        (err, row) => {
            if (err) {
                res.status(500).json({ error: 'Database error: ' + err.message });
            } else if (!row) {
                res.status(404).json({ error: 'Invalid security code. Please check and try again.' });
            } else {
                res.json({ 
                    success: true, 
                    part_type: row.part_type,
                    serial_number: row.serial_number
                });
            }
        }
    );
});

// Log confirmation (Public)
app.post('/api/confirm-understanding', (req, res) => {
    const { security_barcode } = req.body;
    
    if (!security_barcode) {
        return res.status(400).json({ error: 'Security barcode is required' });
    }
    
    db.run(
        'UPDATE products SET confirmation_checked = 1, confirmation_date = CURRENT_TIMESTAMP WHERE security_barcode = ?',
        [security_barcode.trim()],
        function(err) {
            if (err) {
                res.status(500).json({ error: 'Database error: ' + err.message });
            } else if (this.changes === 0) {
                res.status(404).json({ error: 'Security barcode not found' });
            } else {
                res.json({ success: true, message: 'Confirmation logged' });
            }
        }
    );
});

// Get product info by barcode (for confirmation page)
app.get('/api/product-info/:barcode', (req, res) => {
    const { barcode } = req.params;
    
    db.get(
        'SELECT part_type, serial_number, generation, part_model_number FROM products WHERE security_barcode = ?',
        [barcode.trim()],
        (err, row) => {
            if (err) {
                res.status(500).json({ error: 'Database error: ' + err.message });
            } else if (!row) {
                res.status(404).json({ error: 'Product not found' });
            } else {
                res.json({ 
                    part_type: row.part_type,
                    serial_number: row.serial_number,
                    generation: row.generation,
                    part_model_number: row.part_model_number
                });
            }
        }
    );
});

// Get all parts (for admin form)
app.get('/api/admin/parts', requireAuth, (req, res) => {
    db.all(
        'SELECT * FROM airpod_parts ORDER BY generation, display_order, part_name',
        (err, rows) => {
            if (err) {
                res.status(500).json({ error: 'Database error: ' + err.message });
            } else {
                res.json({ parts: rows });
            }
        }
    );
});

// Get parts by generation
app.get('/api/admin/parts/:generation', requireAuth, (req, res) => {
    const generation = decodeURIComponent(req.params.generation);
    db.all(
        'SELECT * FROM airpod_parts WHERE generation = ? ORDER BY display_order, part_name',
        [generation],
        (err, rows) => {
            if (err) {
                res.status(500).json({ error: 'Database error: ' + err.message });
            } else {
                res.json({ parts: rows });
            }
        }
    );
});

// Add new part
app.post('/api/admin/part', requireAuth, (req, res) => {
    const { generation, part_name, part_model_number, part_type, notes, display_order } = req.body;
    
    if (!generation || !part_name || !part_model_number || !part_type) {
        return res.status(400).json({ error: 'Generation, part name, part model number, and part type are required' });
    }
    
    if (!['left', 'right', 'case'].includes(part_type.toLowerCase())) {
        return res.status(400).json({ error: 'Part type must be left, right, or case' });
    }
    
    console.log('Adding new part:', { generation, part_name, part_model_number, part_type });
    
    db.run(
        'INSERT INTO airpod_parts (generation, part_name, part_model_number, part_type, notes, display_order) VALUES (?, ?, ?, ?, ?, ?)',
        [
            generation.trim(),
            part_name.trim(),
            part_model_number.trim(),
            part_type.toLowerCase(),
            notes ? notes.trim() : null,
            display_order || 0
        ],
        function(err) {
            if (err) {
                console.error('Database insert error:', err);
                if (err.message.includes('UNIQUE constraint')) {
                    res.status(409).json({ error: 'A part with this generation and name already exists' });
                } else {
                    res.status(500).json({ error: 'Database error: ' + err.message });
                }
            } else {
                console.log('Part added successfully, id:', this.lastID);
                res.json({ success: true, message: 'Part added successfully', id: this.lastID });
            }
        }
    );
});

// Update part
app.put('/api/admin/part/:id', requireAuth, (req, res) => {
    const id = parseInt(req.params.id);
    const { generation, part_name, part_model_number, part_type, notes, display_order } = req.body;
    
    if (!generation || !part_name || !part_model_number || !part_type) {
        return res.status(400).json({ error: 'Generation, part name, part model number, and part type are required' });
    }
    
    if (!['left', 'right', 'case'].includes(part_type.toLowerCase())) {
        return res.status(400).json({ error: 'Part type must be left, right, or case' });
    }
    
    console.log('Updating part:', { id, generation, part_name, part_model_number, part_type });
    
    db.run(
        'UPDATE airpod_parts SET generation = ?, part_name = ?, part_model_number = ?, part_type = ?, notes = ?, display_order = ? WHERE id = ?',
        [
            generation.trim(),
            part_name.trim(),
            part_model_number.trim(),
            part_type.toLowerCase(),
            notes ? notes.trim() : null,
            display_order || 0,
            id
        ],
        function(err) {
            if (err) {
                console.error('Database update error:', err);
                res.status(500).json({ error: 'Database error: ' + err.message });
            } else if (this.changes === 0) {
                console.log('Part not found for update, id:', id);
                res.status(404).json({ error: 'Part not found' });
            } else {
                console.log('Part updated successfully, changes:', this.changes);
                res.json({ success: true, message: 'Part updated successfully' });
            }
        }
    );
});

// Delete part
app.delete('/api/admin/part/:id', requireAuth, (req, res) => {
    const id = parseInt(req.params.id);
    
    db.run('DELETE FROM airpod_parts WHERE id = ?', [id], function(err) {
        if (err) {
            res.status(500).json({ error: 'Database error: ' + err.message });
        } else if (this.changes === 0) {
            res.status(404).json({ error: 'Part not found' });
        } else {
            res.json({ success: true, message: 'Part deleted successfully' });
        }
    });
});

// Get all generations
app.get('/api/admin/generations', requireAuth, (req, res) => {
    db.all(
        'SELECT DISTINCT generation FROM airpod_parts ORDER BY generation',
        (err, rows) => {
            if (err) {
                res.status(500).json({ error: 'Database error: ' + err.message });
            } else {
                res.json({ generations: rows.map(r => r.generation) });
            }
        }
    );
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

// Error handling
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
    console.log(`LJM AirPod Support Server running on http://localhost:${PORT}`);
    console.log(`Admin panel: http://localhost:${PORT}/admin/login`);
});

// Graceful shutdown
process.on('SIGINT', () => {
    db.close((err) => {
        if (err) {
            console.error('Error closing database:', err.message);
        } else {
            console.log('Database connection closed');
        }
        process.exit(0);
    });
});

