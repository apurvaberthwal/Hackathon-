/**
 * Schedule optimization service
 * Handles AI-powered scheduling recommendations and optimizations
 */

const { DateTime } = require('luxon');
const geminiService = require('./geminiService');
const calendarService = require('./calendarService');
const User = require('../models/User');
const Task = require('../models/Task');

/**
 * Analyzes a user's schedule and provides optimization recommendations
 * @param {string} userId - The ID of the user
 * @returns {Object} Optimization recommendations
 */
async function analyzeSchedule(userId) {
  try {
    // Get user data and preferences
    const user = await User.findByPk(userId, { 
      include: { model: Task }
    });
    
    if (!user) {
      throw new Error('User not found');
    }
    
    // Fetch calendar events from Google Calendar
    const events = await calendarService.getUpcomingEvents(user);
    
    // Get user preferences
    const preferences = user.preferences || {};
    
    // Prepare data for AI analysis
    const schedule = {
      events: events,
      tasks: user.Tasks,
      preferences: {
        chronotype: preferences.chronotype || 'neutral',
        workHours: preferences.workHours || { start: '09:00', end: '17:00' },
        breakDuration: preferences.breakDuration || 15,
        focusTime: preferences.focusTime || 45,
        timezone: preferences.timezone || 'UTC',
      },
      taskBacklog: await Task.count({ where: { userId, status: 'pending' } })
    };
    
    // Get AI recommendations
    const recommendations = await getAIRecommendations(schedule);
    
    return recommendations;
  } catch (error) {
    console.error('Error analyzing schedule:', error);
    // Fallback to traditional algorithm if AI fails
    return fallbackScheduleAnalysis(userId);
  }
}

/**
 * Gets AI recommendations using Gemini API
 * @param {Object} schedule - User schedule data
 * @returns {Object} AI recommendations
 */
async function getAIRecommendations(schedule) {
  const prompt = `Analyze this schedule considering:
  - Chronotype (${schedule.preferences.chronotype} person)
  - Meeting fatigue patterns
  - Historical productivity data
  - Current task backlog (${schedule.taskBacklog} pending tasks)
  
  Schedule: ${JSON.stringify(schedule.events)}
  Work hours: ${schedule.preferences.workHours.start} to ${schedule.preferences.workHours.end}
  Focus time preference: ${schedule.preferences.focusTime} minutes
  Break preference: ${schedule.preferences.breakDuration} minutes
  
  Required output format:
  {
    optimal_slots: [], // Array of suggested time slots for deep work
    suggested_breaks: [], // Array of suggested break times
    priority_adjustments: [], // Tasks that should be reprioritized
    wellness_score: 0-100, // Overall schedule wellness score
    recommendations: [] // Array of textual recommendations
  }`;

  // Define the functions that Gemini can call
  const functions = [
    {
      name: "suggest_time_slots",
      description: "Find optimal time slots for tasks considering energy levels",
      parameters: {
        type: "object",
        properties: {
          schedule: { type: "array" },
          task_type: { 
            type: "string",
            enum: ["deep_work", "meeting", "creative", "physical"]
          },
          duration: { type: "number" }
        },
        required: ["schedule", "task_type", "duration"]
      }
    },
    {
      name: "generate_wellness_score",
      description: "Calculate wellness score based on schedule balance",
      parameters: {
        type: "object",
        properties: {
          work_events: { type: "number" },
          breaks: { type: "number" },
          longest_stretch: { type: "number" },
          after_hours: { type: "number" }
        },
        required: ["work_events", "breaks", "longest_stretch"]
      }
    }
  ];

  // Call Gemini API with function calling capability
  const response = await geminiService.generateWithFunctions(prompt, functions);
  
  // Validate and parse the response
  return validateAndParseAIResponse(response);
}

/**
 * Validates and parses AI response
 * @param {Object} response - Raw AI response
 * @returns {Object} Validated and parsed response
 */
function validateAndParseAIResponse(response) {
  try {
    // If response is a string, try to parse it as JSON
    const data = typeof response === 'string' ? JSON.parse(response) : response;
    
    // Validate required fields
    const requiredFields = ['optimal_slots', 'suggested_breaks', 'wellness_score'];
    for (const field of requiredFields) {
      if (!data.hasOwnProperty(field)) {
        throw new Error(`Missing required field: ${field}`);
      }
    }
    
    // Validate wellness score is within range
    if (typeof data.wellness_score !== 'number' || data.wellness_score < 0 || data.wellness_score > 100) {
      data.wellness_score = 50; // Default to neutral if invalid
    }
    
    return data;
  } catch (error) {
    console.error('Error parsing AI response:', error);
    // Return fallback data
    return {
      optimal_slots: [],
      suggested_breaks: [],
      priority_adjustments: [],
      wellness_score: 50,
      recommendations: ['Unable to process AI recommendations. Using default scheduling.']
    };
  }
}

/**
 * Fallback algorithm for schedule analysis when AI fails
 * @param {string} userId - The ID of the user
 * @returns {Object} Basic schedule recommendations
 */
async function fallbackScheduleAnalysis(userId) {
  try {
    const user = await User.findByPk(userId, { 
      include: { model: Task }
    });
    
    if (!user) {
      throw new Error('User not found');
    }
    
    const preferences = user.preferences || {};
    const workStart = preferences.workHours?.start || '09:00';
    const workEnd = preferences.workHours?.end || '17:00';
    
    // Create a basic schedule with standard breaks
    const optimalSlots = [];
    const suggestedBreaks = [];
    
    // Parse work hours
    const start = DateTime.fromFormat(workStart, 'HH:mm');
    const end = DateTime.fromFormat(workEnd, 'HH:mm');
    
    // Add standard focus blocks (2-hour blocks with breaks)
    let currentTime = start;
    while (currentTime < end) {
      // Add 90-minute focus block
      optimalSlots.push({
        start: currentTime.toFormat('HH:mm'),
        end: currentTime.plus({ minutes: 90 }).toFormat('HH:mm'),
        type: 'deep_work'
      });
      
      // Add 15-minute break
      currentTime = currentTime.plus({ minutes: 90 });
      suggestedBreaks.push({
        start: currentTime.toFormat('HH:mm'),
        end: currentTime.plus({ minutes: 15 }).toFormat('HH:mm'),
        type: 'break'
      });
      
      currentTime = currentTime.plus({ minutes: 15 });
    }
    
    return {
      optimal_slots: optimalSlots,
      suggested_breaks: suggestedBreaks,
      priority_adjustments: [],
      wellness_score: 65, // Default moderate score
      recommendations: [
        'Alternate 90-minute focus blocks with 15-minute breaks',
        'Schedule high-priority tasks during morning hours',
        'Reserve afternoon for meetings and collaborative work'
      ]
    };
  } catch (error) {
    console.error('Error in fallback schedule analysis:', error);
    return {
      optimal_slots: [],
      suggested_breaks: [],
      priority_adjustments: [],
      wellness_score: 50,
      recommendations: ['Basic scheduling recommended. Please try again later.']
    };
  }
}

/**
 * Suggests optimal time for a specific task
 * @param {string} userId - The user ID
 * @param {Object} task - Task details
 * @returns {Array} Array of suggested time slots
 */
async function suggestTimeForTask(userId, task) {
  try {
    const schedule = await analyzeSchedule(userId);
    const user = await User.findByPk(userId);
    const preferences = user.preferences || {};
    
    // Prepare request for Gemini
    const prompt = `Based on this analyzed schedule:
    ${JSON.stringify(schedule)}
    
    Suggest the best time slot for a ${task.duration} minute ${task.task_type} task titled "${task.title}".
    Consider:
    - User's chronotype: ${preferences.chronotype || 'neutral'}
    - Existing optimal slots
    - Task priority: ${task.priority}
    
    Return exactly 3 suggested time slots in format: [
      { start: "HH:MM", end: "HH:MM", quality_score: 0-100 }
    ]`;
    
    const response = await geminiService.generate(prompt);
    
    // Parse and validate response
    try {
      const suggestions = JSON.parse(response);
      return Array.isArray(suggestions) ? suggestions.slice(0, 3) : [];
    } catch (error) {
      console.error('Error parsing time suggestions:', error);
      // Fallback to basic suggestions from optimal slots
      return schedule.optimal_slots.slice(0, 3).map(slot => ({
        start: slot.start,
        end: slot.end,
        quality_score: 70
      }));
    }
  } catch (error) {
    console.error('Error suggesting time for task:', error);
    return [];
  }
}

/**
 * Generates a long-term productivity roadmap
 * @param {string} userId - The user ID
 * @param {number} days - Number of days to plan (default 30)
 * @returns {Object} Generated roadmap
 */
async function generateRoadmap(userId, days = 30) {
  try {
    const user = await User.findByPk(userId);
    if (!user) {
      throw new Error('User not found');
    }
    
    const preferences = user.preferences || {};
    const tasks = await Task.findAll({ 
      where: { userId, status: 'pending' },
      order: [['priority', 'DESC']]
    });
    
    // Get long-term goals if available in preferences
    const goals = preferences.goals || [];
    
    // Prepare request for Gemini
    const prompt = `Create a ${days}-day productivity roadmap for a user with these goals:
    ${JSON.stringify(goals)}
    
    And these pending tasks:
    ${JSON.stringify(tasks.map(t => ({ title: t.title, priority: t.priority, type: t.task_type })))}
    
    The user's chronotype is: ${preferences.chronotype || 'neutral'}
    Consider work-life balance, preventing burnout, and progressive improvement.
    
    Return a JSON object with:
    {
      weekly_themes: [String], // Theme for each week
      daily_focus_areas: [{ day: Number, focus: String, tasks: [String] }],
      wellness_activities: [{ day: Number, activity: String }],
      metrics: { /* Key metrics to track progress */ }
    }`;
    
    const response = await geminiService.generate(prompt);
    
    // Parse and validate roadmap
    try {
      return JSON.parse(response);
    } catch (error) {
      console.error('Error parsing roadmap:', error);
      // Return basic roadmap structure
      return generateBasicRoadmap(days, tasks);
    }
  } catch (error) {
    console.error('Error generating roadmap:', error);
    return null;
  }
}

/**
 * Generates a basic roadmap when AI fails
 * @param {number} days - Number of days
 * @param {Array} tasks - Array of pending tasks
 * @returns {Object} Basic roadmap
 */
function generateBasicRoadmap(days, tasks) {
  const weeks = Math.ceil(days / 7);
  const weeklyThemes = Array(weeks).fill().map((_, i) => `Week ${i+1}: Productivity Focus`);
  
  // Distribute tasks across days
  const dailyFocusAreas = [];
  for (let day = 1; day <= days; day++) {
    dailyFocusAreas.push({
      day,
      focus: day % 7 === 5 ? 'Review and Plan' : 'Focus and Execute',
      tasks: tasks.slice(0, 3).map(t => t.title)
    });
  }
  
  // Add wellness activities
  const wellnessActivities = [];
  for (let day = 1; day <= days; day++) {
    if (day % 3 === 0) {
      wellnessActivities.push({
        day,
        activity: ['Walking', 'Meditation', 'Reading', 'Exercise'][Math.floor(Math.random() * 4)]
      });
    }
  }
  
  return {
    weekly_themes: weeklyThemes,
    daily_focus_areas: dailyFocusAreas,
    wellness_activities: wellnessActivities,
    metrics: {
      tasks_completed: 'Track daily',
      focus_time: 'Hours per day',
      breaks_taken: 'Count per day',
      satisfaction: 'Scale 1-10'
    }
  };
}

module.exports = {
  analyzeSchedule,
  suggestTimeForTask,
  generateRoadmap
};