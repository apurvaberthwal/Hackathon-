// app.js
const express = require('express');
const session = require('express-session');
const passport = require('./config/passport');
const path = require('path');
const { sequelize, testConnection } = require('./config/db');
const MySQLStore = require('express-mysql-session')(session);
const morgan = require('morgan');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

// Import routes
const authRoutes = require('./routes/auth');
const dashboardRoutes = require('./routes/dashboard');
const tasksRoutes = require('./routes/tasks');
const aiRoutes = require('./routes/ai');

const app = express();

// Test database connection
testConnection();

// Session store options
const sessionStore = new MySQLStore({
  host: process.env.DB_HOST,
  port: 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
});

// Middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "https://cdnjs.cloudflare.com"],
      styleSrc: ["'self'", "https://cdnjs.cloudflare.com", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:"],
      connectSrc: ["'self'", "https://www.googleapis.com"],
      fontSrc: ["'self'", "https://cdnjs.cloudflare.com"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: []
    }
  }
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false
});

app.use(limiter);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(morgan('dev'));

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET,
  store: sessionStore,
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 24 * 60 * 60 * 1000, // 1 day
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true
  }
}));

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

// Set view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Routes
app.use('/auth', authRoutes);
app.use('/dashboard', dashboardRoutes);
app.use('/tasks', tasksRoutes);
app.use('/ai', aiRoutes);

// Home route
app.get('/', (req, res) => {
  if (req.isAuthenticated()) {
    return res.redirect('/dashboard');
  }
  res.render('index');
});

app.use((err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Something went wrong';
  
  res.status(statusCode).render('error', {
    statusCode,
    message,
    error: err,
    backUrl: '/',
    backText: 'Back to Dashboard'
  });
});

// For 404 errors
app.use((req, res) => {
  res.status(404).render('error', {
    statusCode: 404,
    message: 'Page not found',
    backUrl: '/',
    backText: 'Back to Dashboard'
  });
});


module.exports = app;