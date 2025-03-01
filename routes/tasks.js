// routes/tasks.js
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

// Get all tasks
router.get('/', isAuthenticated, async (req, res) => {
  try {
    const tasks = await Task.findAll({
      where: {
        user_id: req.user.id
      },
      order: [
        ['status', 'ASC'],
        ['priority', 'ASC'],
        ['scheduled_time', 'ASC']
      ]
    });
    
    res.json(tasks);
  } catch (error) {
    console.error('Error fetching tasks:', error);
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

// Create new task
router.post('/', isAuthenticated, async (req, res) => {
  try {
    const {
      title,
      description,
      task_type,
      priority,
      duration,
      scheduled_time
    } = req.body;
    
    const newTask = await Task.create({
      user_id: req.user.id,
      title,
      description,
      task_type,
      priority: parseInt(priority) || 3,
      duration: parseInt(duration) || 30,
      scheduled_time: scheduled_time ? new Date(scheduled_time) : null,
      status: 'pending'
    });
    
    // If there's a scheduled time, create a calendar event
    if (scheduled_time) {
      try {
        const user = await User.findByPk(req.user.id);
        const userTimezone = user.preferences.timezone || 'UTC';
        
        const calendarService = await new CalendarService(req.user.id).initialize();
        
        const startTime = new Date(scheduled_time);
        const endTime = new Date(startTime);
        endTime.setMinutes(endTime.getMinutes() + parseInt(duration));
        
        await calendarService.createEvent({
          title,
          description,
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
          timeZone: userTimezone,
          taskType: task_type
        });
      } catch (calendarError) {
        console.error('Error creating calendar event:', calendarError);
        // Continue even if calendar event creation fails
      }
    }
    
    res.status(201).json(newTask);
  } catch (error) {
    console.error('Error creating task:', error);
    res.status(500).json({ error: 'Failed to create task' });
  }
});

// Get a specific task
router.get('/:id', isAuthenticated, async (req, res) => {
  try {
    const task = await Task.findOne({
      where: {
        id: req.params.id,
        user_id: req.user.id
      }
    });
    
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    res.json(task);
  } catch (error) {
    console.error('Error fetching task:', error);
    res.status(500).json({ error: 'Failed to fetch task' });
  }
});

// Update a task
router.put('/:id', isAuthenticated, async (req, res) => {
  try {
    const task = await Task.findOne({
      where: {
        id: req.params.id,
        user_id: req.user.id
      }
    });
    
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    // Update task fields
    const {
      title,
      description,
      task_type,
      priority,
      duration,
      scheduled_time,
      status
    } = req.body;
    
    const oldScheduledTime = task.scheduled_time;
    
    task.title = title || task.title;
    task.description = description || task.description;
    task.task_type = task_type || task.task_type;
    task.priority = priority !== undefined ? parseInt(priority) : task.priority;
    task.duration = duration !== undefined ? parseInt(duration) : task.duration;
    task.scheduled_time = scheduled_time ? new Date(scheduled_time) : task.scheduled_time;
    task.status = status || task.status;
    
    await task.save();
    
    // If the scheduled time has changed, update the calendar event
    if (scheduled_time && oldScheduledTime !== scheduled_time) {
      try {
        const user = await User.findByPk(req.user.id);
        const userTimezone = user.preferences.timezone || 'UTC';
        
        const calendarService = await new CalendarService(req.user.id).initialize();
        
        const startTime = new Date(scheduled_time);
        const endTime = new Date(startTime);
        endTime.setMinutes(endTime.getMinutes() + task.duration);
        
        // TODO: Handle updating existing calendar event if we have the event ID stored
        // For now, we'll just create a new event
        await calendarService.createEvent({
          title: task.title,
          description: task.description,
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
          timeZone: userTimezone,
          taskType: task.task_type
        });
      } catch (calendarError) {
        console.error('Error updating calendar event:', calendarError);
        // Continue even if calendar event update fails
      }
    }
    
    res.json(task);
  } catch (error) {
    console.error('Error updating task:', error);
    res.status(500).json({ error: 'Failed to update task' });
  }
});

// Delete a task
router.delete('/:id', isAuthenticated, async (req, res) => {
  try {
    const task = await Task.findOne({
      where: {
        id: req.params.id,
        user_id: req.user.id
      }
    });
    
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    await task.destroy();
    
    // TODO: Delete associated calendar event if we have the event ID stored
    
    res.json({ message: 'Task deleted successfully' });
  } catch (error) {
    console.error('Error deleting task:', error);
    res.status(500).json({ error: 'Failed to delete task' });
  }
});

// Get AI suggestions for task timing
router.post('/suggest-time', isAuthenticated, async (req, res) => {
  try {
    const { task_type, duration } = req.body;
    
    // Get user preferences
    const user = await User.findByPk(req.user.id);
    const userTimezone = user.preferences.timezone || 'UTC';
    
    // Get date range for next 7 days
    const startDate = DateTime.now().setZone(userTimezone).startOf('day');
    const endDate = startDate.plus({ days: 7 }).endOf('day');
    
    // Initialize calendar service
    const calendarService = await new CalendarService(req.user.id).initialize();
    
    // Get events for the next 7 days
    const events = await calendarService.getEvents(startDate.toJSDate(), endDate.toJSDate());
    
    // Get free time slots
    const freeSlots = await calendarService.getFreeSlots(
      startDate.toJSDate(),
      endDate.toJSDate(),
      parseInt(duration) || 30
    );
    
    // Initialize Gemini service for AI recommendations
    const geminiService = new GeminiService();
    
    // Get task suggestions from Gemini
    const suggestions = await geminiService.suggestTimeSlots(
      events,
      freeSlots,
      task_type,
      parseInt(duration) || 30,
      user.preferences
    );
    
    res.json(suggestions);
  } catch (error) {
    console.error('Error getting time suggestions:', error);
    res.status(500).json({ error: 'Failed to get time suggestions' });
  }
});

module.exports = router;