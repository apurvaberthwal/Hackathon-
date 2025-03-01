// routes/auth.js
const express = require('express');
const passport = require('../config/passport');
const router = express.Router();

// Google OAuth login route
router.get('/google', passport.authenticate('google', {
    scope: [
      'email',
      'profile',
      'https://www.googleapis.com/auth/calendar.readonly', // Make sure this matches passport.js
      'https://www.googleapis.com/auth/calendar.events'
    ],
    accessType: 'offline',
    prompt: 'consent'
  }));
  // Google OAuth callback route
  router.get('/google/callback', 
      passport.authenticate('google', { 
        failureRedirect: '/login',
        failureFlash: true
      }), 
      (req, res) => {
        res.redirect('/dashboard');
      }
  );
// Login page
router.get('/login', (req, res) => {
  if (req.isAuthenticated()) {
    return res.redirect('/dashboard');
  }
  res.render('login');
});

// Logout route
router.get('/logout', (req, res) => {
  req.logout((err) => {
    if (err) {
      console.error('Error during logout:', err);
      return next(err);
    }
    req.session.destroy((err) => {
      if (err) {
        console.error('Error destroying session:', err);
      }
      res.redirect('/');
    });
  });
});

// Route to check authentication status
router.get('/status', (req, res) => {
  res.json({
    authenticated: req.isAuthenticated(),
    user: req.isAuthenticated() ? {
      id: req.user.id,
      email: req.user.email
    } : null
  });
});

module.exports = router;