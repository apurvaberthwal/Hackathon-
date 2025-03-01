// routes/dashboard.js
const express = require('express');
const router = express.Router();
const { Task, User } = require('../models');
const CalendarService = require('../services/calendarService');
const GeminiService = require('../services/geminiService');
const { DateTime } = require('luxon');

// Authentication middleware
const isAuthenticated = (req, res, next) => {
  if (req.isAuthenticated()) {
    return next();
  }
  res.redirect('/auth/login');
};

// Main dashboard
router.get('/', isAuthenticated, async (req, res) => {
  try {
    // Get today's date in user's timezone
    const user = await User.findByPk(req.user.id);
    const userTimezone = user.preferences.timezone || 'UTC';
    const today = DateTime.now().setZone(userTimezone).startOf('day');
    const endOfWeek = today.plus({ days: 7 }).endOf('day');
    
    // Initialize calendar service
    const calendarService = await new CalendarService(req.user.id).initialize();
    res.locals.getColorFromId = function(colorId) {
        const colorMap = {
          '1': '#7986CB', // Blue
          '2': '#33B679', // Green
          '3': '#8E24AA', // Purple
          '4': '#E67C73', // Red
          '5': '#F6BF26', // Yellow
          '6': '#F4511E', // Orange
          '7': '#039BE5', // Cyan
          '8': '#616161', // Grey
          '9': '#3F51B5', // Indigo
          '10': '#0B8043', // Dark green
          '11': '#D50000'  // Dark red
        };
        return colorMap[colorId] || '#039BE5'; // Default to blue
      };
      
    // Get events for the next 7 days
    const events = await calendarService.getEvents(today.toJSDate(), endOfWeek.toJSDate());
    const metrics = {
        productivity: 75,
        productivityTrend: 10,
        wellness: 80,
        wellnessTrend: 5,
        focusHours: 4,
        focusGoal: 8,
        balance: 60,
        workPercentage: 70,
        lifePercentage: 30
      };
    // Get tasks for the user
    const tasks = await Task.findAll({
      where: {
        user_id: req.user.id,
        status: 'pending'
      },
      order: [['priority', 'ASC'], ['scheduled_time', 'ASC']]
    });
    
    // Render dashboard with data
    res.render('dashboard', {
      user: req.user,
      events,
      tasks,
      metrics,  
      currentDate: today.toFormat('yyyy-MM-dd'),
      endOfWeek: endOfWeek.toFormat('yyyy-MM-dd'),
      getColorFromId: getColorFromId  // Add this line to pass the function
     
    });
  } catch (error) {
    console.error('Error loading dashboard:', error);
    res.status(500).render('error', {
      message: 'Error loading dashboard',
      error: process.env.NODE_ENV === 'development' ? error : {}
    });
  }
});

// Calendar view
router.get('/calendar', isAuthenticated, async (req, res) => {
  try {
    // Get date range from query params or default to current week
    const startDate = req.query.start 
      ? DateTime.fromISO(req.query.start) 
      : DateTime.now().startOf('week');
    
    const endDate = req.query.end 
      ? DateTime.fromISO(req.query.end) 
      : startDate.plus({ days: 7 });
    
    // Initialize calendar service
    const calendarService = await new CalendarService(req.user.id).initialize();
    
    // Get events for the date range
    const events = await calendarService.getEvents(startDate.toJSDate(), endDate.toJSDate());
    
    // Format events for full calendar
    const formattedEvents = events.map(event => ({
      id: event.id,
      title: event.summary,
      start: event.start.dateTime,
      end: event.end.dateTime,
      color: getColorFromId(event.colorId)
    }));
    
    // Render calendar view
    res.render('calendar', {
      user: req.user,
      events: JSON.stringify(formattedEvents),
      startDate: startDate.toFormat('yyyy-MM-dd'),
      endDate: endDate.toFormat('yyyy-MM-dd')
    });
  } catch (error) {
    console.error('Error loading calendar:', error);
    res.status(500).render('error', {
      message: 'Error loading calendar',
      error: process.env.NODE_ENV === 'development' ? error : {}
    });
  }
});

// Helper function to convert Google Calendar color IDs to hex colors
function getColorFromId(colorId) {
  const colorMap = {
    '1': '#7986CB', // Blue
    '2': '#33B679', // Green
    '3': '#8E24AA', // Purple
    '4': '#E67C73', // Red
    '5': '#F6BF26', // Yellow
    '6': '#F4511E', // Orange
    '7': '#039BE5', // Cyan
    '8': '#616161', // Grey
    '9': '#3F51B5', // Indigo
    '10': '#0B8043', // Dark green
    '11': '#D50000'  // Dark red
  };
  return colorMap[colorId] || '#039BE5'; // Default to blue
}

// Roadmap view
router.get('/roadmap', isAuthenticated, async (req, res) => {
  try {
    // Get user roadmap from database
    const user = await User.findByPk(req.user.id, {
      include: ['Roadmaps']
    });
    
    // Get latest roadmap or null if none exists
    const latestRoadmap = user.Roadmaps && user.Roadmaps.length > 0
      ? user.Roadmaps.sort((a, b) => b.version - a.version)[0]
      : null;
    
    res.render('roadmap', {
      user: req.user,
      roadmap: latestRoadmap ? latestRoadmap.roadmap : null,
      lastGenerated: latestRoadmap ? latestRoadmap.created_at : null
    });
  } catch (error) {
    console.error('Error loading roadmap:', error);
    res.status(500).render('error', {
      message: 'Error loading roadmap',
      error: process.env.NODE_ENV === 'development' ? error : {}
    });
  }
});

// Settings view
router.get('/settings', isAuthenticated, async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);
    
    res.render('settings', {
      user: req.user,
      preferences: user.preferences
    });
  } catch (error) {
    console.error('Error loading settings:', error);
    res.status(500).render('error', {
      message: 'Error loading settings',
      error: process.env.NODE_ENV === 'development' ? error : {}
    });
  }
});

// Save settings
router.post('/settings', isAuthenticated, async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);
    
    // Update user preferences
    user.preferences = {
      ...user.preferences,
      theme: req.body.theme || user.preferences.theme,
      timezone: req.body.timezone || user.preferences.timezone,
      chronotype: req.body.chronotype || user.preferences.chronotype,
      workStartHour: parseInt(req.body.workStartHour) || user.preferences.workStartHour,
      workEndHour: parseInt(req.body.workEndHour) || user.preferences.workEndHour,
      focusHours: req.body.focusHours ? JSON.parse(req.body.focusHours) : user.preferences.focusHours
    };
    
    await user.save();
    
    res.redirect('/dashboard/settings');
  } catch (error) {
    console.error('Error saving settings:', error);
    res.status(500).render('error', {
      message: 'Error saving settings',
      error: process.env.NODE_ENV === 'development' ? error : {}
    });
  }
});

module.exports = router;