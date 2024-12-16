require('dotenv').config(); // Load environment variables

const express = require('express');
const session = require('express-session');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const multer = require('multer');
const path = require('path');
const mongoose = require('mongoose');
const Item = require('./models/Item'); // Import the Item model

const app = express();
const port = 3000;

// ==================================
// Database Connection
// ==================================
const dbURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/lost-and-found';
mongoose.connect(dbURI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

// ==================================
// Middleware
// ==================================
// Session setup
app.use(session({
  secret: 'lost$found',
  resave: false,
  saveUninitialized: true,
}));

// Static files and uploaded images
app.use(express.static('public'));
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));
app.use(express.urlencoded({ extended: true }));

// Multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'public/uploads/');
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});
const upload = multer({ storage: storage });

// Passport.js setup for Google OAuth
app.use(passport.initialize());
app.use(passport.session());

passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: 'http://localhost:3000/auth/google/callback'
}, (accessToken, refreshToken, profile, done) => {
  return done(null, profile);
}));

passport.serializeUser((user, done) => {
  done(null, user);
});

passport.deserializeUser((user, done) => {
  done(null, user);
});

// Middleware to check if user is authenticated
function isLoggedIn(req, res, next) {
  if (req.isAuthenticated()) return next();
  res.redirect('/auth/google');
}

// ==================================
// Routes
// ==================================

// Home Route
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/views/index.html');
});

// Account Page Route
app.get('/account', isLoggedIn, async (req, res) => {
  const user = req.user;

  try {
    // Fetch user items
    const userItems = await Item.find({ user: user.displayName });
    let itemsHtml = userItems.map(item => `
      <div class="item-card">
        <h3>${item.type}</h3>
        <p>${item.description}</p>
        <p>Location: ${item.location}</p>
      </div>
    `).join('');

    // Render account.html with placeholders replaced
    let html = await fs.promises.readFile(__dirname + '/public/views/account.html', 'utf-8');
    html = html.replace('{{userName}}', user.displayName)
               .replace('{{userEmail}}', user.emails[0].value)
               .replace('{{userItems}}', itemsHtml);

    res.send(html);
  } catch (err) {
    res.status(500).send('Error loading account page');
  }
});

app.get('/account/:username', isLoggedIn, async (req, res) => {
  const { username } = req.params;

  try {
    // Fetch the items reported by this user
    const userItems = await Item.find({ user: username });

    if (userItems.length === 0) {
      return res.status(404).send('User has not reported any items.');
    }

    // Generate HTML for the user's items
    const itemsHtml = userItems.map(item => `
      <div class="item-card">
        <h3>${item.type}</h3>
        <p>${item.description}</p>
        <p>Location: ${item.location}</p>
      </div>
    `).join('');

    // Render the account page for the user
    let html = await fs.promises.readFile(__dirname + '/public/views/viewAccount.html', 'utf-8');
    html = html.replace('{{userName}}', username)  // Replace placeholders with the actual data
               .replace('{{userItems}}', itemsHtml);

    res.send(html);
  } catch (err) {
    console.error('Error loading account page for user:', err);
    res.status(500).send('Error loading account page.');
  }
});


// Report Page Route
app.get('/report', isLoggedIn, (req, res) => {
  res.sendFile(__dirname + '/public/views/report.html');
});

// Handle Reporting of Items
app.post('/report', isLoggedIn, upload.single('image'), async (req, res) => {
  const selectedTags = Array.isArray(req.body.tags) ? req.body.tags : (req.body.tags ? [req.body.tags] : []);
  const itemData = {
    type: req.body.type,
    description: req.body.description,
    location: req.body.location,
    date: req.body.date,
    time: req.body.time,
    image: req.file ? `/uploads/${req.file.filename}` : null,
    user: req.user.displayName,
    tags: selectedTags
  };

  try {
    await Item.create(itemData);
    res.redirect('/items');
  } catch (err) {
    console.error('Error reporting item:', err);
    res.status(500).send('Error submitting report.');
  }
});

// View All Items Route
const fs = require('fs'); // To read files

app.get('/items', isLoggedIn, async (req, res) => {
  const filterTag = req.query.tag || null;
  const query = filterTag ? { tags: filterTag } : {};

  try {
    const items = await Item.find(query);
    
    // Generate HTML for items dynamically
    const itemsHtml = items.length === 0
      ? '<p>No items have been reported yet.</p>'
      : items.map(item => `
          <div class="item-card">
              <h3>${item.type.charAt(0).toUpperCase() + item.type.slice(1)} Item</h3>
              <p><strong>Description:</strong> ${item.description}</p>
              <p><strong>Location:</strong> ${item.location}</p>
              <p><strong>Date:</strong> ${item.date}</p>
              <p><strong>Time:</strong> ${item.time}</p>
              <p><strong>Tags:</strong> ${item.tags.join(', ')}</p>
              <p><strong>Reported by:</strong> <a href="/account/${encodeURIComponent(item.user)}">${item.user}</a></p>
              ${item.image ? `<img src="${item.image}" alt="Item image" class="item-image">` : ''}
          </div>
      `).join('');

    // Read the items.html file
    let html = await fs.promises.readFile(__dirname + '/public/views/items.html', 'utf-8');

    // Inject the dynamic items HTML into the placeholder
    html = html.replace('{{items}}', itemsHtml);

    res.send(html);
  } catch (err) {
    console.error('Error fetching items:', err);
    res.status(500).send('Error fetching reported items. Please try again.');
  }
});


// Google Authentication
app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

app.get('/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/' }),
  (req, res) => res.redirect('/')
);

// Logout
app.get('/logout', (req, res) => {
  req.logout(err => {
    if (err) console.error('Logout error:', err);
    res.redirect('/');
  });
});

// ==================================
// Start Server
// ==================================
app.listen(port, () => {
  console.log(`✅ Server running on http://localhost:${port}`);
});
