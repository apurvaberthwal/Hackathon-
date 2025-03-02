// routes/dashboard.js
const express = require('express');
const router = express.Router();
const { Task, User,Roadmap } = require('../models');
const CalendarService = require('../services/calendarService');
const GeminiService = require('../services/geminiService');
const { DateTime } = require('luxon');
const { sequelize, Sequelize } = require('../config/db');
const { Op } = require('sequelize');  // Add this import for operators

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
      const user = await User.findByPk(req.user.id);
      const userTimezone = user.preferences.timezone || 'UTC';
      const today = DateTime.now().setZone(userTimezone).startOf('day');
      const endOfWeek = today.plus({ days: 7 }).endOf('day');
      const calendarService = await new CalendarService(req.user.id).initialize();
      const geminiService = new GeminiService();
  
      // Fetch events
      const events = await calendarService.getEvents(today.toJSDate(), endOfWeek.toJSDate());
  
      // Fetch tasks
      const tasks = await Task.findAll({
        where: { user_id: req.user.id, status: 'pending' },
        order: [['priority', 'ASC'], ['scheduled_time', 'ASC']]
      });
  
      // Calculate productivity metrics (simplified for now)
      const completedTasks = await Task.count({
        where: { 
          user_id: req.user.id, 
          status: 'completed',
          created_at: {
            [Op.gte]: today.minus({ days: 7 }).toJSDate()
          }
        }
      });
      
      // In the totalTasks query:
      const totalTasks = await Task.count({
        where: { 
          user_id: req.user.id,
          created_at: {
            [Op.gte]: today.minus({ days: 7 }).toJSDate()
          }
        }
      });
      const metrics = {
        focusScore: Math.round((completedTasks / (totalTasks || 1)) * 100), // Simplified
        taskCompletion: totalTasks ? Math.round((completedTasks / totalTasks) * 100) : 0,
        dailyFocusTime: 3.2, // Placeholder; calculate from events later
        workLifeBalance: 76 // Placeholder; calculate later
      };
  
      // Fetch AI insights
      const insights = await geminiService.generateInsights(events, tasks, user.preferences);
  
      // Fetch roadmap progress
      const latestRoadmap = await Roadmap.findOne({
        where: { user_id: req.user.id },
        order: [['version', 'DESC']]
      });
      const roadmapProgress = latestRoadmap ? parseRoadmapProgress(latestRoadmap.roadmap) : [];
  
      res.render('dashboard', {
        user: req.user,
        events,
        tasks,
        metrics,
        insights,
        roadmapProgress,
        currentDate: today.toFormat('yyyy-MM-dd'),
        endOfWeek: endOfWeek.toFormat('yyyy-MM-dd'),
        getColorFromId
      });
    } catch (error) {
      console.error('Error loading dashboard:', error);
      res.status(500).render('error', { message: 'Error loading dashboard' });
    }
  });
  
  // Helper to parse roadmap progress (example implementation)
  function parseRoadmapProgress(roadmap) {
    // Assuming roadmap is an object with goals and progress
    return roadmap.goals ? roadmap.goals.map(goal => ({
      name: goal.name,
      progress: goal.progress || 0
    })) : [
      { name: 'Reduce Meeting Time', progress: 65 },
      { name: 'Increase Focus Time', progress: 42 },
      { name: 'Work-Life Balance', progress: 78 }
    ];
  }

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