// server.js
const express = require('express');
//const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bodyParser = require('body-parser');
const multer = require('multer');
const session = require('express-session');

const app = express();
const PORT = 3000;

//const db = new sqlite3.Database(path.join(__dirname, 'LifeBrite.db'));
const { Pool } = require('pg');
const db = new Pool({
  user: 'redlightuser',
  host: 'localhost',
  database: 'redlightdb',
  password: 'yourpassword',
  port: 5432,
});


// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'public/images');
  },
  filename: function (req, file, cb) {
    const title = req.body.title || 'upload';
    const cleanTitle = title.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_\-]/g, '');
    const ext = path.extname(file.originalname);
    cb(null, `${cleanTitle}${ext}`);
  }
});
const upload = multer({ storage: storage });

app.use(session({
  secret: 'your-secret-password', // 🔐 change this to something secure!
  resave: false,
  saveUninitialized: true
}));

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Page 1 - English
app.get('/', (req, res) => {
  db.query('SELECT * FROM items', (err, rows) => {
    if (err) return res.send('Database error');
    res.render('page1', { items: rows });
  });
});

// Page 2 - Chinese
app.get('/cn', (req, res) => {
  db.query('SELECT * FROM items', (err, rows) => {
    if (err) return res.send('Database error');
    res.render('page2', { items: rows });
  });
});

// Login Page
app.get('/login', (req, res) => {
  res.send(`
    <form method="POST" action="/login" style="max-width:300px;margin:5rem auto;">
      <h4>Admin Login</h4>
      <input type="password" name="password" placeholder="Password" class="form-control mb-2" required />
      <button type="submit" class="btn btn-primary">Login</button>
    </form>
  `);
});

app.post('/login', (req, res) => {
  const { password } = req.body;
  if (password === 'admin123') { // 🔑 Change this password!
    req.session.loggedIn = true;
    res.redirect('/admin');
  } else {
    res.send('Incorrect password. <a href="/login">Try again</a>.');
  }
});

// Admin Page
app.get('/admin', (req, res) => {
  if (!req.session.loggedIn) return res.redirect('/login');

  db.query('SELECT * FROM items', (err, rows) => {
    if (err) return res.send('Database error');
    res.render('admin', { items: rows, itemToEdit: null });
  });
});

// Admin: Edit item - load item into form
app.post('/admin/edit', (req, res) => {
  const id = req.body.id;
  db.get('SELECT * FROM items WHERE id = ?', [id], (err, item) => {
    if (err) return res.send('Database error');
    db.query('SELECT * FROM items', (err, rows) => {
      if (err) return res.send('Database error');
      res.render('admin', { items: rows, itemToEdit: item });
    });
  });
});

// Admin: Add or Update item (with image upload)
app.post('/admin/save', upload.single('image'), (req, res) => {
  const { id, title, description, c_title, c_description } = req.body;
  let image_url = req.file ? `/images/${req.file.filename}` : req.body.existing_image_url || '';

  if (id) {
    db.run(`UPDATE items SET title=?, description=?, image_url=?, c_title=?, c_description=? WHERE id=?`,
      [title, description, image_url, c_title, c_description, id],
      function (err) {
        if (err) return res.send('Update failed');
        res.redirect('/admin');
      });
  } else {
    db.run(`INSERT INTO items (title, description, image_url, c_title, c_description) VALUES (?, ?, ?, ?, ?)`,
      [title, description, image_url, c_title, c_description],
      function (err) {
        if (err) return res.send('Insert failed');
        res.redirect('/admin');
      });
  }
});

// Admin: Delete item
app.post('/admin/delete', (req, res) => {
  const { id } = req.body;
  db.run('DELETE FROM items WHERE id = ?', [id], function (err) {
    if (err) return res.send('Delete failed');
    res.redirect('/admin');
  });
});

// Logout
app.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/');
  });
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

