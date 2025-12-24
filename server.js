// server.js - FIXED VERSION FOR VERCEL
require('dotenv').config();
const express = require('express');
const { createClient } = require('@libsql/client');
const cors = require('cors');
const fetch = require('node-fetch');
const { URL } = require('url');
const path = require('path');

const app = express();

// PENTING: Definisi PORT (Ini yang bikin error sebelumnya karena tidak ada)
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Serving Static Files (HTML/CSS)
// Prioritas 1: Cek folder public
app.use(express.static(path.join(__dirname, 'public')));
// Prioritas 2: Cek root folder (untuk index.html jika ada di luar)
app.use(express.static(path.join(__dirname)));

// --- 1. KONEKSI DATABASE TURSO (DIPERBAIKI) ---
// Menggunakan 'TURSO_DB_URL' sesuai settingan Vercel Anda
const dbUrl = process.env.TURSO_DB_URL || process.env.TURSO_DATABASE_URL;
const dbToken = process.env.TURSO_DB_TOKEN || process.env.TURSO_AUTH_TOKEN;

if (!dbUrl || !dbToken) {
    console.error("❌ ERROR: Kunci Rahasia Database (Environment Variables) belum terbaca!");
}

const db = createClient({
    url: dbUrl,
    authToken: dbToken
});

const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxCpzF6e3ii_aAPaFmU2bhlaeskNlUeIgJdZSo1wnECGhNaUoVVfinlhyE2W5MKwj83eg/exec';
const SCRIPT_TOKEN = 'L0k3rS3cr3t2025!#';

// --- 2. INISIALISASI DATABASE ---
async function initializeDatabase() {
    try {
        console.log("🔄 Menghubungkan ke Turso Cloud...");
        await db.execute(`
            CREATE TABLE IF NOT EXISTS lockers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                ownerName TEXT, itemName TEXT, locationCode TEXT, locationType TEXT DEFAULT 'Locker',
                entryDate TEXT, expirationDate TEXT, status TEXT, keterangan TEXT,
                manualStatus TEXT, manualNote TEXT, fileIndex TEXT
            )
        `);
        await db.execute(`CREATE TABLE IF NOT EXISTS master_owners (id INTEGER PRIMARY KEY, name TEXT UNIQUE)`);
        await db.execute(`CREATE TABLE IF NOT EXISTS master_locations (id INTEGER PRIMARY KEY, code TEXT UNIQUE, type TEXT, current_owner TEXT)`);
        console.log(`✅ Database Turso Siap.`);
    } catch (err) {
        console.error("❌ Gagal connect database:", err);
    }
}

// ==========================================
// 🚀 ROUTE HALAMAN WEB
// ==========================================

app.get('/', (req, res) => {
    const indexPath = path.join(__dirname, 'index.html');
    res.sendFile(indexPath, (err) => {
        if (err) {
            res.status(500).send('<h1>Server Jalan! 🚀</h1><p>Tapi file <b>index.html</b> tidak ketemu. Pastikan sudah diupload.</p>');
        }
    });
});

app.get('/loker', (req, res) => {
    res.redirect('/api/lockers');
});

// ==========================================
// 🔌 API ENDPOINTS
// ==========================================

app.get('/api/lockers', async (req, res) => {
    try {
        const result = await db.execute(`SELECT *, locationCode AS lockerNumber, fileIndex AS fileIdx FROM lockers`);
        const items = result.rows.map(r => ({ ...r, index: r.fileIdx }));
        items.sort((a, b) => (a.lockerNumber || '').localeCompare(b.lockerNumber || '', undefined, { numeric: true }));
        res.json(items);
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/lockers/export', async (req, res) => {
    const type = req.query.type;
    try {
        let sql = `
            SELECT CASE WHEN locationType = 'Rack' THEN 'RK-' || id ELSE 'LK-' || id END AS "ID Sistem",
            locationCode AS "Kode Lokasi", locationType AS "Tipe", ownerName AS "Owner Name", 
            itemName AS "Item Name", entryDate AS "Tanggal Masuk", expirationDate AS "Tanggal Exp", 
            manualStatus AS "Status Manual", manualNote AS "Keterangan Status", keterangan AS "Keterangan", fileIndex AS "Index"
            FROM lockers`;

        const args = [];
        if (type) { sql += ` WHERE locationType = ?`; args.push(type); }

        const result = await db.execute({ sql, args });
        
        // Kirim ke Apps Script
        const url = new URL(APPS_SCRIPT_URL);
        url.searchParams.append('key', SCRIPT_TOKEN);
        const resp = await fetch(url.toString(), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(result.rows)
        });

        if (resp.ok) res.json({ msg: `Export ${type || 'ALL'} OK` });
        else throw new Error('Fail to send to Apps Script');
    } catch (e) { res.status(500).json({ error: e.message || e }); }
});

app.post('/api/masters/save-locker', async (req, res) => {
    const { lockerNumber, ownerName, locationType, forceAcquire } = req.body;
    const type = locationType || 'Locker';
    try {
        const checkRes = await db.execute({ sql: 'SELECT * FROM master_locations WHERE code = ?', args: [lockerNumber] });
        const existing = checkRes.rows[0];

        if (existing) {
            if (existing.type !== type) return res.json({ status: 'type_conflict', message: `Kode '${lockerNumber}' conflict.` });
            if (existing.current_owner && existing.current_owner !== ownerName && ownerName && !forceAcquire) {
                return res.json({ status: 'conflict', owner: existing.current_owner });
            }
        }
        if (ownerName) await db.execute({ sql: 'INSERT OR IGNORE INTO master_owners(name) VALUES(?)', args: [ownerName] });

        await db.execute({
            sql: `INSERT INTO master_locations (code, type, current_owner) VALUES (?, ?, ?) 
                  ON CONFLICT(code) DO UPDATE SET current_owner = ?, type = ?`,
            args: [lockerNumber, type, ownerName || null, ownerName || null, type]
        });

        if (forceAcquire || (existing && existing.current_owner !== ownerName && ownerName)) {
            await db.execute({ sql: 'UPDATE lockers SET ownerName = ?, locationType = ? WHERE locationCode = ?', args: [ownerName, type, lockerNumber] });
        }
        res.json({ status: 'success' });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/masters/check-locker', async (req, res) => {
    try {
        const result = await db.execute({ sql: 'SELECT * FROM master_locations WHERE code = ?', args: [req.body.lockerNumber] });
        const locker = result.rows[0];
        if (!locker) return res.json({ status: 'new' });
        if (!locker.current_owner) return res.json({ status: 'vacant' });
        return res.json({ status: 'occupied', owner: locker.current_owner });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/masters/:type/:value', async (req, res) => {
    const { type, value } = req.params;
    const v = decodeURIComponent(value);
    try {
        if (type === 'owner') {
            await db.execute({ sql: 'DELETE FROM master_owners WHERE name=?', args: [v] });
            await db.execute({ sql: 'UPDATE master_locations SET current_owner=NULL WHERE current_owner=?', args: [v] });
        } else {
            await db.execute({ sql: 'DELETE FROM master_locations WHERE code=?', args: [v] });
            await db.execute({ sql: 'DELETE FROM lockers WHERE locationCode=?', args: [v] });
        }
        res.json({ msg: 'Del' });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/masters', async (req, res) => {
    try {
        const resOwners = await db.execute("SELECT name FROM master_owners WHERE name IS NOT NULL ORDER BY name ASC");
        const resLockers = await db.execute("SELECT code AS number, type, current_owner FROM master_locations");
        const l = resLockers.rows;
        l.sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true }));
        res.json({ owners: resOwners.rows, lockers: l });
    } catch (e) { res.status(500).json({ error: e.message }) }
});

app.post('/api/lockers', async (req, r) => {
    const { ownerName, itemName, lockerNumber, locationType, entryDate, expirationDate, keterangan, index } = req.body;
    try {
        await db.execute({
            sql: `INSERT INTO lockers (ownerName, itemName, locationCode, locationType, entryDate, expirationDate, keterangan, manualStatus, manualNote, fileIndex) VALUES (?,?,?,?,?,?,?,?,?,?)`,
            args: [ownerName, itemName, lockerNumber, locationType || 'Locker', entryDate, expirationDate, keterangan, "Auto", "", index || null]
        });
        r.json({ msg: 'Ok' });
    } catch (e) { r.status(500).json({ error: e.message }); }
});

app.put('/api/lockers/:id', async (req, r) => {
    const { ownerName, itemName, lockerNumber, locationType, entryDate, expirationDate, keterangan, manualStatus, manualNote, index } = req.body;
    try {
        await db.execute({
            sql: `UPDATE lockers SET ownerName=?, itemName=?, locationCode=?, locationType=?, entryDate=?, expirationDate=?, keterangan=?, manualStatus=?, manualNote=?, fileIndex=? WHERE id=?`,
            args: [ownerName, itemName, lockerNumber, locationType, entryDate, expirationDate, keterangan, manualStatus, manualNote, index || null, req.params.id]
        });
        r.json({ msg: 'Upd' });
    } catch (e) { r.status(500).json({ error: e.message }); }
});

app.delete('/api/lockers/:id', async (req, r) => {
    try {
        await db.execute({ sql: 'DELETE FROM lockers WHERE id=?', args: [req.params.id] });
        r.json({ msg: 'Del' });
    } catch (e) { r.status(500).json({ error: e.message }); }
});

app.post('/api/masters/owner', async (req, r) => {
    if (!req.body.name) return r.status(400).json({ error: 'Missing name' });
    try {
        await db.execute({ sql: 'INSERT OR IGNORE INTO master_owners(name) VALUES(?)', args: [req.body.name.trim()] });
        r.json({ msg: 'Ok' });
    } catch (e) { r.status(500).json({ error: e.message }); }
});

// --- JALANKAN SERVER (FIXED) ---
// Memulai koneksi database dulu, baru jalankan server
initializeDatabase().then(() => {
    app.listen(port, () => {
        console.log(`🚀 Server Turso Ready on port ${port}`);
    });
}).catch(err => {
    console.error("Gagal inisialisasi awal:", err);
    // Tetap jalankan server agar log bisa terbaca di Vercel
    app.listen(port, () => console.log("Server running in fallback mode"));
});

module.exports = app;