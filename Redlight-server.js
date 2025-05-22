// server.js - PostgreSQL version
const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const multer = require('multer');
const session = require('express-session');
const { Pool } = require('pg');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }  // Needed for Render’s PostgreSQL
});

const app = express();
// const PORT = 3000;
const PORT = process.env.PORT || 3000;

// PostgreSQL connection
const db = new Pool({
  user: 'reduser',
  host: 'localhost',
  database: 'redlight',
  password: 'redpass',
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
  secret: 'your-secret-password',
  resave: false,
  saveUninitialized: true
}));

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.get('/', (req, res) => {
  db.query('SELECT * FROM items', (err, result) => {
    if (err) return res.send('Database error');
    res.render('page', { items: result.rows });
  });
});


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
  if (password === 'admin123') {
    req.session.loggedIn = true;
    res.redirect('/admin');
  } else {
    res.send('Incorrect password. <a href="/login">Try again</a>.');
  }
});

app.get('/admin', (req, res) => {
  if (!req.session.loggedIn) return res.redirect('/login');

  db.query('SELECT * FROM items', (err, result) => {
    if (err) return res.send('Database error');
    res.render('admin', { items: result.rows, itemToEdit: null });
  });
});

app.post('/admin/edit', (req, res) => {
  const id = req.body.id;
  db.query('SELECT * FROM items WHERE id = $1', [id], (err, result1) => {
    if (err) return res.send('Database error');
    db.query('SELECT * FROM items', (err, result2) => {
      if (err) return res.send('Database error');
      res.render('admin', { items: result2.rows, itemToEdit: result1.rows[0] });
    });
  });
});

app.post('/admin/save', upload.single('image'), (req, res) => {
  const { id, title, description, c_title, c_description } = req.body;
  let image_url = req.file ? `/images/${req.file.filename}` : req.body.existing_image_url || '';

  if (id) {
    db.query(`UPDATE items SET title=$1, description=$2, image_url=$3, c_title=$4, c_description=$5 WHERE id=$6`,
      [title, description, image_url, c_title, c_description, id],
      (err) => {
        if (err) return res.send('Update failed');
        res.redirect('/admin');
      });
  } else {
    db.query(`INSERT INTO items (title, description, image_url, c_title, c_description) VALUES ($1, $2, $3, $4, $5)`,
      [title, description, image_url, c_title, c_description],
      (err) => {
        if (err) return res.send('Insert failed');
        res.redirect('/admin');
      });
  }
});

app.post('/admin/delete', (req, res) => {
  const { id } = req.body;
  db.query('DELETE FROM items WHERE id = $1', [id], (err) => {
    if (err) return res.send('Delete failed');
    res.redirect('/admin');
  });
});

app.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/');
  });
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
  console.log(`Server running on port ${PORT}`);
});

