/**
 * Environment configuration for AI Work-Life Balance Assistant
 */

// Load environment variables from .env file in development
if (process.env.NODE_ENV !== 'production') {
    require('dotenv').config();
  }
  
  module.exports = {
    // Server configuration
    PORT: process.env.PORT || 3000,
    NODE_ENV: process.env.NODE_ENV || 'development',
    
    // Database configuration
    DB_HOST: process.env.DB_HOST || 'localhost',
    DB_PORT: process.env.DB_PORT || 3306,
    DB_NAME: process.env.DB_NAME || 'work_life_balance',
    DB_USER: process.env.DB_USER || 'root',
    DB_PASSWORD: process.env.DB_PASSWORD || '',
    
    // Google OAuth configuration
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
    GOOGLE_CALLBACK_URL: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3000/auth/google/callback',
    
    // Gemini AI configuration
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    GEMINI_MODEL: process.env.GEMINI_MODEL || 'gemini-pro',
    
    // JWT configuration for session management
    JWT_SECRET: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
    JWT_EXPIRY: process.env.JWT_EXPIRY || '24h',
    
    // Session configuration
    SESSION_SECRET: process.env.SESSION_SECRET || 'work-life-balance-session-secret',
    
    // Timezone defaults
    DEFAULT_TIMEZONE: process.env.DEFAULT_TIMEZONE || 'UTC',
    
    // Rate limiting
    RATE_LIMIT_WINDOW_MS: process.env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000, // 15 minutes
    RATE_LIMIT_MAX: process.env.RATE_LIMIT_MAX || 100, // 100 requests per window
  };