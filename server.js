require('dotenv').config();
const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const bcrypt = require('bcryptjs');       // NEW: For password hashing
const jwt = require('jsonwebtoken');      // NEW: For generating login tokens

const app = express();

// Middleware
app.use(cors());
app.use(express.json()); // Allows us to parse JSON data

// Secret key for JWT (In a real app, move this to .env)
const JWT_SECRET = 'agrosphere_super_secret_key_2026';

// MySQL Connection Setup
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',          
    password: 'root', // ⚠️ Your MySQL password
    database: 'agrosphere_db'
});

db.connect((err) => {
    if (err) {
        console.error('Error connecting to MySQL:', err);
        return;
    }
    console.log('✅ Connected to MySQL Database.');
});

// ==========================================
// 🔐 NEW: AUTHENTICATION ROUTES
// ==========================================

// 1. REGISTER USER
app.post('/api/register', async (req, res) => {
    const { name, email, password } = req.body;

    try {
        // Check if user already exists
        db.query('SELECT * FROM users WHERE email = ?', [email], async (err, results) => {
            if (err) return res.status(500).json({ error: 'Database error' });
            if (results.length > 0) return res.status(400).json({ error: 'Email already exists' });

            // Hash the password for security
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(password, salt);

            // Insert new user into database
            const insertQuery = 'INSERT INTO users (name, email, password) VALUES (?, ?, ?)';
            db.query(insertQuery, [name, email, hashedPassword], (err, result) => {
                if (err) return res.status(500).json({ error: 'Database error' });
                res.status(201).json({ message: 'User registered successfully!' });
            });
        });
    } catch (error) {
        res.status(500).json({ error: 'Server error during registration' });
    }
});

// 2. LOGIN USER
app.post('/api/login', (req, res) => {
    const { email, password } = req.body;

    db.query('SELECT * FROM users WHERE email = ?', [email], async (err, results) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        if (results.length === 0) return res.status(401).json({ error: 'Invalid email or password' });

        const user = results[0];

        // Compare the typed password with the hashed password in DB
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(401).json({ error: 'Invalid email or password' });

        // Generate a secure JWT Token valid for 1 day
        const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '1d' });
        
        res.json({ 
            message: 'Login successful', 
            token: token, 
            user: { id: user.id, name: user.name, role: user.role } 
        });
    });
});

// Middleware to verify JWT Token for protected routes
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Format: "Bearer TOKEN"
    
    if (!token) return res.status(401).json({ error: 'Access denied. Please log in.' });

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: 'Invalid or expired token. Please log in again.' });
        req.user = user;
        next(); // Allow the request to proceed
    });
};

// ==========================================
// SENSOR ROUTES
// ==========================================

// ROUTE 1: Receive data from IoT Sensors (POST) - Open to hardware
app.post('/api/sensors', (req, res) => {
    const { device_id, field_id, nitrogen, phosphorus, potassium, ec, ph, moisture, temperature } = req.body;

    const query = `INSERT INTO sensor_readings 
        (device_id, field_id, nitrogen, phosphorus, potassium, ec, ph, moisture, temperature) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;
        
    const values = [
        device_id || 'pole-001', 
        field_id || 'field-01', 
        nitrogen, phosphorus, potassium, ec, ph, moisture, temperature
    ];

    db.query(query, values, (err, result) => {
        if (err) {
            console.error('Error inserting data:', err);
            return res.status(500).json({ error: 'Database error' });
        }
        console.log('📥 New sensor reading saved to DB');
        res.status(201).json({ message: 'Data saved successfully', id: result.insertId });
    });
});

// ROUTE 2: Get latest data for the Dashboard (GET) - 🔒 NOW PROTECTED BY JWT
app.get('/api/sensors/latest', authenticateToken, (req, res) => {
    const query = `SELECT * FROM sensor_readings ORDER BY created_at DESC LIMIT 10`;

    db.query(query, (err, results) => {
        if (err) {
            console.error('Error fetching data:', err);
            return res.status(500).json({ error: 'Database error' });
        }
        
        const chronologicalData = results.reverse();
        res.json(chronologicalData);
    });
});

// Start Server
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`🚀 Backend server running on http://localhost:${PORT}`);
});