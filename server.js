require('dotenv').config(); // Load environment variables

const express = require('express');
const session = require('express-session');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const multer = require('multer');
const path = require('path');
const app = express();
const port = 3000;

// Middleware for session management
app.use(session({
  secret: 'lost$found', 
  resave: false,
  saveUninitialized: true,
}));

// Middleware for serving static files
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true })); 

// Set up multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'public/uploads/'); 
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname)); 
  }
});

const upload = multer({ storage: storage });

// Initialize Passport middleware
app.use(passport.initialize());
app.use(passport.session());

// Google OAuth Strategy setup
passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,  
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,  
  callbackURL: 'http://localhost:3000/auth/google/callback'
},
function(accessToken, refreshToken, profile, done) {
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
  if (req.isAuthenticated()) {
    return next();
  }
  res.redirect('/auth/google');
}

// Routes
app.get('/', isLoggedIn, (req, res) => {
  res.sendFile(__dirname + '/public/views/index.html');
});

app.get('/report', isLoggedIn, (req, res) => {
  res.sendFile(__dirname + '/public/views/report.html');  // Serve the report.html form
});

// Array to hold reported items (this will be replaced by a database later)
let reportedItems = [];

// Modify the POST /report route to store items
app.post('/report', isLoggedIn, upload.single('image'), (req, res) => {
  const itemData = {
    type: req.body.type,
    description: req.body.description,
    location: req.body.location,
    date: req.body.date,
    time: req.body.time,
    image: req.file ? `/uploads/${req.file.filename}` : null,
    user: req.user.displayName // Store the name of the user who reported the item
  };

  // Add the reported item to the array
  reportedItems.push(itemData);

  console.log(itemData);

  res.send(`
    <div style="text-align: center; margin-top: 20px;">
      <h1>Item Reported Successfully!</h1>
      <p>Thank you for your submission.</p>
      <a href="/" style="padding: 10px 20px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px;">Return to Home</a>
    </div>
  `);
});

// New GET /items route to display all reported items
app.get('/items', isLoggedIn, (req, res) => {
  // Display the items in a simple HTML format
  let itemsHtml = `
    <div class="items-container">
      <h1>Reported Items</h1>
  `;

  if (reportedItems.length === 0) {
    itemsHtml += '<p>No items have been reported yet.</p>';
  } else {
    reportedItems.forEach(item => {
      itemsHtml += `
        <div class="item-card">
          <h3>${item.type.charAt(0).toUpperCase() + item.type.slice(1)} Item</h3>
          <p><strong>Description:</strong> ${item.description}</p>
          <p><strong>Location:</strong> ${item.location}</p>
          <p><strong>Date:</strong> ${item.date}</p>
          <p><strong>Time:</strong> ${item.time}</p>
          <p><strong>Reported by:</strong> ${item.user.displayName}</p>
          ${item.image ? `<img src="${item.image}" alt="Item image" class="item-image">` : ''}
        </div>
        <hr>`;
    });
  }

  itemsHtml += `
      <a href="/" class="btn">Return to Home</a>
      <br>
      <a href="/report?type=lost" class="btn">Report Lost Item</a>
      <br>
      <a href="/report?type=found" class="btn">Report Found Item</a>
    </div>
  `;

  res.send(itemsHtml); // Send the HTML response to the user
});




app.get('/auth/google', passport.authenticate('google', {
  scope: ['profile', 'email']
}));

app.get('/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/' }),
  (req, res) => {
    res.redirect('/'); 
  });

app.get('/profile', isLoggedIn, (req, res) => {
  res.send(`Hello, ${req.user.displayName}!<br>Email: ${req.user.emails[0].value}`);
});

app.get('/logout', (req, res) => {
  req.logout(() => {
    res.redirect('/');
  });
});

// View all items (this will be expanded later for a real database)
app.get('/items', isLoggedIn, (req, res) => {
  // This would show all the reported items (you can modify this to retrieve from a database)
  res.send('Viewing all lost and found items (to be implemented).');
});

// Start the server
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
