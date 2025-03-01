// services/calendarService.js
const { google } = require('googleapis');
const { User } = require('../models');
const { DateTime } = require('luxon');

class CalendarService {
  constructor(userId) {
    this.userId = userId;
    this.oauth2Client = null;
  }

  async initialize() {
    try {
      const user = await User.findByPk(this.userId);
      if (!user) {
        throw new Error('User not found');
      }

      this.oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        process.env.GOOGLE_CALLBACK_URL
      );

      this.oauth2Client.setCredentials({
        access_token: user.access_token,
        refresh_token: user.refresh_token
      });

      // Set up token refresh handler
      this.oauth2Client.on('tokens', async (tokens) => {
        if (tokens.refresh_token) {
          user.refresh_token = tokens.refresh_token;
        }
        user.access_token = tokens.access_token;
        await user.save();
      });

      this.calendar = google.calendar({ 
        version: 'v3', 
        auth: this.oauth2Client 
      });

      return this;
    } catch (error) {
      console.error('Error initializing calendar service:', error);
      throw error;
    }
  }

  async getEvents(startDate, endDate) {
    try {
      const response = await this.calendar.events.list({
        calendarId: 'primary',
        timeMin: startDate.toISOString(),
        timeMax: endDate.toISOString(),
        singleEvents: true,
        orderBy: 'startTime'
      });

      return response.data.items;
    } catch (error) {
      console.error('Error fetching calendar events:', error);
      throw error;
    }
  }

  async createEvent(event) {
    try {
      const response = await this.calendar.events.insert({
        calendarId: 'primary',
        resource: {
          summary: event.title,
          description: event.description,
          start: {
            dateTime: event.startTime,
            timeZone: event.timeZone
          },
          end: {
            dateTime: event.endTime,
            timeZone: event.timeZone
          },
          colorId: this.getColorIdByTaskType(event.taskType)
        }
      });

      return response.data;
    } catch (error) {
      console.error('Error creating calendar event:', error);
      throw error;
    }
  }

  async updateEvent(eventId, updatedData) {
    try {
      // First, get the existing event
      const existingEvent = await this.calendar.events.get({
        calendarId: 'primary',
        eventId: eventId
      });

      // Merge existing data with updates
      const updatedEvent = {
        ...existingEvent.data,
        summary: updatedData.title || existingEvent.data.summary,
        description: updatedData.description || existingEvent.data.description,
        start: {
          dateTime: updatedData.startTime || existingEvent.data.start.dateTime,
          timeZone: updatedData.timeZone || existingEvent.data.start.timeZone
        },
        end: {
          dateTime: updatedData.endTime || existingEvent.data.end.dateTime,
          timeZone: updatedData.timeZone || existingEvent.data.end.timeZone
        }
      };

      if (updatedData.taskType) {
        updatedEvent.colorId = this.getColorIdByTaskType(updatedData.taskType);
      }

      const response = await this.calendar.events.update({
        calendarId: 'primary',
        eventId: eventId,
        resource: updatedEvent
      });

      return response.data;
    } catch (error) {
      console.error('Error updating calendar event:', error);
      throw error;
    }
  }

  getColorIdByTaskType(taskType) {
    // Google Calendar color IDs
    const colorMap = {
      work: '1',      // Blue
      personal: '4',  // Purple
      health: '2'     // Green
    };
    return colorMap[taskType] || '0';
  }

  async getFreeSlots(startDate, endDate, minDuration = 30) {
    try {
      const events = await this.getEvents(startDate, endDate);
      const user = await User.findByPk(this.userId);
      const { workStartHour, workEndHour } = user.preferences;
      
      const freeSlots = [];
      let currentDate = DateTime.fromJSDate(startDate);
      const endDateTime = DateTime.fromJSDate(endDate);
      
      while (currentDate < endDateTime) {
        // Only consider work hours
        const dayStart = currentDate.set({ 
          hour: workStartHour, 
          minute: 0, 
          second: 0 
        });
        
        const dayEnd = currentDate.set({ 
          hour: workEndHour, 
          minute: 0, 
          second: 0 
        });
        
        // Filter events for current day
        const dayEvents = events.filter(event => {
          const eventStart = DateTime.fromISO(event.start.dateTime);
          return eventStart.hasSame(dayStart, 'day');
        });
        
        // Sort events by start time
        dayEvents.sort((a, b) => {
          return new Date(a.start.dateTime) - new Date(b.start.dateTime);
        });
        
        let timePointer = dayStart;
        
        // Find gaps between events
        for (const event of dayEvents) {
          const eventStart = DateTime.fromISO(event.start.dateTime);
          const eventEnd = DateTime.fromISO(event.end.dateTime);
          
          if (eventStart > timePointer) {
            const gap = eventStart.diff(timePointer, 'minutes').minutes;
            
            if (gap >= minDuration) {
              freeSlots.push({
                start: timePointer.toISO(),
                end: eventStart.toISO(),
                duration: gap
              });
            }
          }
          
          // Move pointer to end of this event
          timePointer = eventEnd > timePointer ? eventEnd : timePointer;
        }
        
        // Check if there's time left until end of day
        if (timePointer < dayEnd) {
          const gap = dayEnd.diff(timePointer, 'minutes').minutes;
          
          if (gap >= minDuration) {
            freeSlots.push({
              start: timePointer.toISO(),
              end: dayEnd.toISO(),
              duration: gap
            });
          }
        }
        
        // Move to next day
        currentDate = currentDate.plus({ days: 1 }).startOf('day');
      }
      
      return freeSlots;
    } catch (error) {
      console.error('Error finding free slots:', error);
      throw error;
    }
  }
}

module.exports = CalendarService;
