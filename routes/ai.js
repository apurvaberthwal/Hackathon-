// routes/ai.js
const express = require('express');
const router = express.Router();
const { Task, User, Roadmap } = require('../models');
const GeminiService = require('../services/geminiService');
const CalendarService = require('../services/calendarService');
const { DateTime } = require('luxon');

// Authentication middleware
const isAuthenticated = (req, res, next) => {
  if (req.isAuthenticated()) {
    return next();
  }
  res.redirect('/auth/login');
};

// Generate a productivity roadmap
router.post('/generate-roadmap', isAuthenticated, async (req, res) => {
  try {
    // Get user data
    const user = await User.findByPk(req.user.id);
    
    // Get user's pending tasks
    const tasks = await Task.findAll({
      where: {
        user_id: req.user.id
      }
    });
    
    // Get historical calendar data for the last 30 days
    const calendarService = await new CalendarService(req.user.id).initialize();
    const now = DateTime.now();
    const thirtyDaysAgo = now.minus({ days: 30 });
    const events = await calendarService.getEvents(
      thirtyDaysAgo.toJSDate(),
      now.toJSDate()
    );
    
    // Prepare data for AI
    const userProfile = {
      preferences: user.preferences,
      currentTaskCount: tasks.length,
      tasksByType: countTasksByType(tasks)
    };
    
    const historicalData = {
      events: events.map(e => ({
        title: e.summary,
        start: e.start.dateTime,
        end: e.end.dateTime,
        type: getEventType(e)
      })),
      completedTasks: tasks.filter(t => t.status === 'completed').length,
      averageTasksPerDay: tasks.filter(t => t.status === 'completed').length / 30
    };
    
    const userGoals = req.body.goals || [
      'Improve work-life balance',
      'Reduce meeting fatigue',
      'Increase focus time',
      'Make time for exercise'
    ];
    
    // Initialize Gemini service
    const geminiService = new GeminiService();
    
    // Generate roadmap using AI
    const roadmap = await geminiService.generateRoadmap(
      userProfile,
      historicalData,
      userGoals
    );
    
    // Save roadmap to database
    const latestRoadmap = await Roadmap.findOne({
      where: {
        user_id: req.user.id
      },
      order: [['version', 'DESC']]
    });
    
    const newVersion = latestRoadmap ? latestRoadmap.version + 1 : 1;
    
    await Roadmap.create({
      user_id: req.user.id,
      roadmap,
      version: newVersion
    });
    
    res.json({
      success: true,
      roadmap
    });
  } catch (error) {
    console.error('Error generating roadmap:', error);
    res.status(500).json({ error: 'Failed to generate roadmap' });
  }
});

// Helper function to count tasks by type
function countTasksByType(tasks) {
  return tasks.reduce((counts, task) => {
    const type = task.task_type;
    counts[type] = (counts[type] || 0) + 1;
    return counts;
  }, {});
}

// Helper function to determine event type
function getEventType(event) {
  // Simple heuristic based on color ID
  const colorId = event.colorId;
  
  switch (colorId) {
    case '1': // Blue
      return 'work';
    case '2': // Green
      return 'health';
    case '4': // Purple
      return 'personal';
    default:
      return 'other';
  }
}

// Prioritize tasks using AI
router.post('/prioritize', isAuthenticated, async (req, res) => {
  try {
    // Get user's pending tasks
    const tasks = await Task.findAll({
      where: {
        user_id: req.user.id,
        status: 'pending'
      }
    });
    
    // Get user goals (from request or default)
    const userGoals = req.body.goals || [
      'Complete high-priority work tasks',
      'Maintain work-life balance',
      'Progress on long-term projects'
    ];
    
    // Prepare deadline information
    const deadlines = tasks
      .filter(task => task.scheduled_time)
      .map(task => ({
        task_id: task.id,
        deadline: task.scheduled_time
      }));
    
    // Initialize Gemini service
    const geminiService = new GeminiService();
    
    // Get AI prioritization
    const prioritizedTasks = await geminiService.prioritizeTasks(
      tasks,
      userGoals,
      deadlines
    );
    
    // Update task priorities in database if requested
    if (req.body.updateDatabase) {
      for (const ptask of prioritizedTasks) {
        await Task.update(
          { 
            priority: Math.round(ptask.priority_score)
          },
          {
            where: {
              id: ptask.task_id,
              user_id: req.user.id
            }
          }
        );
      }
    }
    
    res.json(prioritizedTasks);
  } catch (error) {
    console.error('Error prioritizing tasks:', error);
    res.status(500).json({ error: 'Failed to prioritize tasks' });
  }
});

// Quick optimize the day's schedule
router.post('/quick-optimize', isAuthenticated, async (req, res) => {
  try {
    // Get user data
    const user = await User.findByPk(req.user.id);
    const userTimezone = user.preferences.timezone || 'UTC';
    
    // Get today's date in user's timezone
    const today = DateTime.now().setZone(userTimezone).startOf('day');
    const tomorrow = today.plus({ days: 1 }).endOf('day');
    
    // Initialize services
    const calendarService = await new CalendarService(req.user.id).initialize();
    const geminiService = new GeminiService();
    
    // Get calendar events for today/tomorrow
    const events = await calendarService.getEvents(
      today.toJSDate(),
      tomorrow.toJSDate()
    );
    
    // Get pending tasks for today
    const tasks = await Task.findAll({
      where: {
        user_id: req.user.id,
        status: 'pending',
        scheduled_time: {
          [sequelize.Op.between]: [
            today.toJSDate(),
            tomorrow.toJSDate()
          ]
        }
      }
    });
    
    // If no tasks to optimize, return early
    if (tasks.length === 0) {
      return res.json({
        success: false,
        message: 'No tasks scheduled for today to optimize'
      });
    }
    
    // Get free time slots
    const freeSlots = await calendarService.getFreeSlots(
      today.toJSDate(),
      tomorrow.toJSDate(),
      30 // Minimum 30-minute slots
    );
    
    // Prioritize tasks
    const prioritizedTasks = await geminiService.prioritizeTasks(
      tasks,
      [
        'Complete high-priority tasks',
        'Maintain energy levels throughout the day',
        'Allow for breaks between focused work'
      ],
      tasks
        .filter(task => task.scheduled_time)
        .map(task => ({
          task_id: task.id,
          deadline: task.scheduled_time
        }))
    );
    
    // Sort tasks by priority score
    prioritizedTasks.sort((a, b) => b.priority_score - a.priority_score);
    
    // Optimize schedule by suggesting new time slots for each task
    const optimizations = [];
    
    for (const ptask of prioritizedTasks) {
      const task = tasks.find(t => t.id === ptask.task_id);
      
      if (!task) continue;
      
      // Get optimal slot suggestions for this task
      const suggestions = await geminiService.suggestTimeSlots(
        events,
        freeSlots,
        task.task_type,
        task.duration,
        user.preferences
      );
      
      if (suggestions && suggestions.length > 0) {
        // Add the best suggestion to optimizations
        optimizations.push({
          task_id: task.id,
          task_title: task.title,
          original_time: task.scheduled_time,
          suggested_time: suggestions[0].start_time,
          reason: suggestions[0].reason,
          score: suggestions[0].score
        });
        
        // Update free slots (remove this slot from available slots)
        freeSlots = freeSlots.filter(slot => {
          const slotStart = DateTime.fromISO(slot.start);
          const slotEnd = DateTime.fromISO(slot.end);
          const suggStart = DateTime.fromISO(suggestions[0].start_time);
          const suggEnd = suggStart.plus({ minutes: task.duration });
          
          // Remove if there's significant overlap
          return !(suggStart < slotEnd && suggEnd > slotStart);
        });
      }
    }
    
    // If requested, apply the optimizations to the database
    if (req.body.applyChanges) {
      for (const opt of optimizations) {
        const suggestedStart = DateTime.fromISO(opt.suggested_time);
        
        await Task.update(
          { scheduled_time: suggestedStart.toJSDate() },
          {
            where: {
              id: opt.task_id,
              user_id: req.user.id
            }
          }
        );
      }
    }
    
    res.json({
      success: true,
      optimizations
    });
  } catch (error) {
    console.error('Error optimizing schedule:', error);
    res.status(500).json({ error: 'Failed to optimize schedule' });
  }
});

module.exports = router;