// config/passport.js
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const { User } = require('../models');
require('dotenv').config();

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findByPk(id);
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: process.env.GOOGLE_CALLBACK_URL,
  scope: [
    'email',
    'profile',
    'https://www.googleapis.com/auth/calendar.readonly', // Make sure this matches auth.js
    'https://www.googleapis.com/auth/calendar.events'
  ],
  accessType: 'offline',
  prompt: 'consent'
},
async (accessToken, refreshToken, profile, done) => {
  
    try {
      const existingUser = await User.findOne({ where: { google_id: profile.id } });
      
      if (existingUser) {
        // Update tokens
        existingUser.access_token = accessToken;
        existingUser.refresh_token = refreshToken || existingUser.refresh_token;
        await existingUser.save();
        return done(null, existingUser);
      }
      
      // Create new user
      const newUser = await User.create({
        google_id: profile.id,
        email: profile.emails[0].value,
        access_token: accessToken,
        refresh_token: refreshToken
      });
      
      return done(null, newUser);
    } catch (error) {
      console.error('Error during authentication:', error);
      return done(error, null);
    }
  }
));

module.exports = passport;