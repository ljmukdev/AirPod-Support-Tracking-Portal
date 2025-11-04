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
const db = new sqlite3.Database('./database.sqlite', (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
    } else {
        console.log('Connected to SQLite database');
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
        }
    });
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
    const { serial_number, security_barcode, part_type, generation, part_model_number, notes } = req.body;
    
    if (!serial_number || !security_barcode || !part_type) {
        return res.status(400).json({ error: 'Serial number, security barcode, and part type are required' });
    }
    
    if (!['left', 'right', 'case'].includes(part_type.toLowerCase())) {
        return res.status(400).json({ error: 'Part type must be left, right, or case' });
    }
    
    db.run(
        'INSERT INTO products (serial_number, security_barcode, part_type, generation, part_model_number, notes) VALUES (?, ?, ?, ?, ?, ?)',
        [
            serial_number.trim(), 
            security_barcode.trim(), 
            part_type.toLowerCase(),
            generation ? generation.trim() : null,
            part_model_number ? part_model_number.trim() : null,
            notes ? notes.trim() : null
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

// Serve admin pages
app.get('/admin/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin', 'login.html'));
});

app.get('/admin/dashboard', requireAuthHTML, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin', 'dashboard.html'));
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

