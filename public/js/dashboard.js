/**
 * Dashboard functionality for AI Work-Life Balance Assistant
 */

document.addEventListener('DOMContentLoaded', function() {
    // Initialize timeline
    initializeTimeline();
    
    // Set up AI optimization button
    setupOptimizeButton();
    
    // Set up task creation and dragging
    setupTaskHandling();
    
    // Initialize wellness score display
    initializeWellnessScore();
    
    // Setup realtime updates
    setupRealtimeUpdates();
  });
  
  /**
   * Initialize timeline visualization
   */
  function initializeTimeline() {
    const timelineContainer = document.querySelector('.timeline-container');
    if (!timelineContainer) return;
    
    // Add click event listeners to time slots
    const timeSlots = document.querySelectorAll('.time-slot');
    timeSlots.forEach(slot => {
      slot.addEventListener('click', function() {
        showSlotDetails(this.dataset.slotId);
      });
      
      // Setup tooltip with AI recommendations if available
      if (slot.dataset.aiRecommendation) {
        const score = parseInt(slot.dataset.aiRecommendation);
        let recommendationClass = 'neutral';
        
        if (score >= 80) recommendationClass = 'high';
        else if (score >= 60) recommendationClass = 'good';
        else if (score <= 30) recommendationClass = 'low';
        
        const recommendationEl = document.createElement('div');
        recommendationEl.className = `ai-suggestion ${recommendationClass}`;
        recommendationEl.innerHTML = `
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-zap">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
          </svg>
          <span>${score}%</span>
        `;
        
        // Add tooltip with detailed AI recommendation
        const tooltip = document.createElement('div');
        tooltip.className = 'tooltip-text';
        tooltip.textContent = getRecommendationText(score);
        
        const tooltipContainer = document.createElement('div');
        tooltipContainer.className = 'tooltip';
        tooltipContainer.appendChild(recommendationEl);
        tooltipContainer.appendChild(tooltip);
        
        const slotHeader = slot.querySelector('.slot-header');
        slotHeader.appendChild(tooltipContainer);
      }
    });
    
    // Make timeline scrollable to current time
    scrollToCurrentTime();
  }
  
  /**
   * Get recommendation text based on score
   * @param {number} score - AI recommendation score
   * @returns {string} Recommendation text
   */
  function getRecommendationText(score) {
    if (score >= 80) {
      return 'Optimal time slot for high productivity';
    } else if (score >= 60) {
      return 'Good time slot for focused work';
    } else if (score >= 40) {
      return 'Moderate productivity expected';
    } else {
      return 'Consider rescheduling for better focus';
    }
  }
  
  /**
   * Show details for a specific time slot
   * @param {string} slotId - ID of the time slot
   */
  function showSlotDetails(slotId) {
    // Get slot details via API
    fetch(`/api/slots/${slotId}`)
      .then(response => response.json())
      .then(data => {
        // Display slot details in a modal or sidebar
        const detailsContainer = document.getElementById('slot-details');
        if (detailsContainer) {
          detailsContainer.innerHTML = `
            <div class="card fade-in">
              <div class="card-header">
                <h3 class="card-title">${data.title}</h3>
                <span class="slot-time">${data.startTime} - ${data.endTime}</span>
              </div>
              <div class="card-body">
                <p>${data.description || 'No description available'}</p>
                ${data.aiInsights ? `
                  <div class="ai-section mt-4">
                    <h4>AI Insights</h4>
                    <p>${data.aiInsights}</p>
                  </div>
                ` : ''}
                <div class="actions mt-4">
                  <button class="btn btn-primary" onclick="editSlot('${slotId}')">Edit</button>
                  <button class="btn" onclick="rescheduleSlot('${slotId}')">Reschedule</button>
                </div>
              </div>
            </div>
          `;
          
          // Show the details container
          detailsContainer.style.display = 'block';
        }
      })
      .catch(error => {
        console.error('Error fetching slot details:', error);
      });
  }
  
  /**
   * Scroll timeline to current time
   */
  function scrollToCurrentTime() {
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    
    // Find the closest time slot
    const timeSlots = document.querySelectorAll('.time-slot');
    let closestSlot = null;
    let minDifference = Infinity;
    
    timeSlots.forEach(slot => {
      const startTime = slot.dataset.startTime;
      if (startTime) {
        const [hours, minutes] = startTime.split(':').map(num => parseInt(num, 10));
        const slotTotalMinutes = hours * 60 + minutes;
        const currentTotalMinutes = currentHour * 60 + currentMinute;
        
        const difference = Math.abs(slotTotalMinutes - currentTotalMinutes);
        if (difference < minDifference) {
          minDifference = difference;
          closestSlot = slot;
        }
      }
    });
    
    // Scroll to the closest time slot
    if (closestSlot) {
      closestSlot.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      });
      
      // Highlight current slot
      closestSlot.classList.add('current-time');
    }
  }
  
  /**
   * Set up AI optimization button
   */
  function setupOptimizeButton() {
    const optimizeButton = document.getElementById('optimize-schedule');
    if (!optimizeButton) return;
    
    optimizeButton.addEventListener('click', function() {
      // Show loading indicator
      this.innerHTML = `
        <span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
        Optimizing...
      `;
      this.disabled = true;
      
      // Call API to optimize schedule
      fetch('/api/schedule/optimize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      })
        .then(response => response.json())
        .then(data => {
          // Reset button
          optimizeButton.innerHTML = 'Quick Optimize';
          optimizeButton.disabled = false;
          
          // Show optimization results
          showOptimizationResults(data);
          
          // Update wellness score
          updateWellnessScore(data.wellness_score);
        })
        .catch(error => {
          console.error('Error optimizing schedule:', error);
          
          // Reset button
          optimizeButton.innerHTML = 'Quick Optimize';
          optimizeButton.disabled = false;
          
          // Show error notification
          showNotification('Error optimizing schedule. Please try again.', 'error');
        });
    });
  }
  
  /**
   * Show optimization results
   * @param {Object} data - Optimization results
   */
  function showOptimizationResults(data) {
    const resultsContainer = document.getElementById('optimization-results');
    if (!resultsContainer) return;
    
    // Create HTML for optimization suggestions
    let suggestionsHTML = '';
    
    // Add optimal time slots
    if (data.optimal_slots && data.optimal_slots.length > 0) {
      suggestionsHTML += '<h4>Suggested Focus Blocks</h4><ul>';
      data.optimal_slots.forEach(slot => {
        suggestionsHTML += `
          <li>
            <strong>${slot.start} - ${slot.end}</strong>: 
            ${slot.type === 'deep_work' ? 'Deep work' : slot.type} 
            <button class="btn btn-sm" onclick="applySlot('${encodeURIComponent(JSON.stringify(slot))}')">Apply</button>
          </li>
        `;
      });
      suggestionsHTML += '</ul>';
    }
    
    // Add suggested breaks
    if (data.suggested_breaks && data.suggested_breaks.length > 0) {
      suggestionsHTML += '<h4>Suggested Breaks</h4><ul>';
      data.suggested_breaks.forEach(breakSlot => {
        suggestionsHTML += `
          <li>
            <strong>${breakSlot.start} - ${breakSlot.end}</strong>: 
            Break
            <button class="btn btn-sm" onclick="applyBreak('${encodeURIComponent(JSON.stringify(breakSlot))}')">Apply</button>
          </li>
        `;
      });
      suggestionsHTML += '</ul>';
    }
    
    // Add recommendations
    if (data.recommendations && data.recommendations.length > 0) {
      suggestionsHTML += '<h4>AI Recommendations</h4><ul>';
      data.recommendations.forEach(recommendation => {
        suggestionsHTML += `<li>${recommendation}</li>`;
      });
      suggestionsHTML += '</ul>';
    }
    
    // Show results in container
    resultsContainer.innerHTML = `
      <div class="card fade-in">
        <div class="card-header">
          <h3 class="card-title">Schedule Optimization</h3>
          <button type="button" class="btn-close" aria-label="Close" onclick="document.getElementById('optimization-results').innerHTML = ''"></button>
        </div>
        <div class="card-body">
          ${suggestionsHTML}
          <div class="mt-4">
            <button class="btn btn-primary" onclick="applyAllSuggestions('${encodeURIComponent(JSON.stringify(data))}')">Apply All</button>
            <button class="btn" onclick="document.getElementById('optimization-results').innerHTML = ''">Dismiss</button>
          </div>
        </div>
      </div>
    `;
  }
  
  /**
   * Apply a suggested time slot to the schedule
   * @param {string} slotJSON - JSON string of the slot
   */
  function applySlot(slotJSON) {
    const slot = JSON.parse(decodeURIComponent(slotJSON));
    
    // Call API to add slot to schedule
    fetch('/api/slots', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        start_time: slot.start,
        end_time: slot.end,
        type: slot.type,
        title: `${slot.type === 'deep_work' ? 'Deep Work' : 'Focus Time'}`
      })
    })
      .then(response => response.json())
      .then(data => {
        // Show success notification
        showNotification('Time slot added to schedule', 'success');
        
        // Refresh timeline
        refreshTimeline();
      })
      .catch(error => {
        console.error('Error applying slot:', error);
        showNotification('Error adding time slot', 'error');
      });
  }
  
  /**
   * Apply all suggestions to the schedule
   * @param {string} dataJSON - JSON string of all optimization data
   */
  function applyAllSuggestions(dataJSON) {
    const data = JSON.parse(decodeURIComponent(dataJSON));
    
    // Call API to apply all suggestions
    fetch('/api/schedule/apply-suggestions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    })
      .then(response => response.json())
      .then(result => {
        // Show success notification
        showNotification('All suggestions applied to schedule', 'success');
        
        // Close suggestions container
        document.getElementById('optimization-results').innerHTML = '';
        
        // Refresh timeline
        refreshTimeline();
      })
      .catch(error => {
        console.error('Error applying suggestions:', error);
        showNotification('Error applying suggestions', 'error');
      });
  }
  
  /**
   * Initialize wellness score display
   */
  function initializeWellnessScore() {
    const wellnessContainer = document.querySelector('.wellness-score');
    if (!wellnessContainer) return;
    
    // Get wellness score from API
    fetch('/api/wellness-score')
      .then(response => response.json())
      .then(data => {
        updateWellnessScore(data.score);
      })
      .catch(error => {
        console.error('Error fetching wellness score:', error);
      });
  }
  
  /**
   * Update wellness score display
   * @param {number} score - Wellness score (0-100)
   */
  function updateWellnessScore(score) {
    const scoreElement = document.querySelector('.score-value');
    const scoreCircle = document.querySelector('.score-circle');
    
    if (scoreElement && scoreCircle) {
      // Update score text
      scoreElement.textContent = Math.round(score);
      
      // Update circle fill
      scoreCircle.style.setProperty('--score', score);
      
      // Update score color based on value
      let scoreColor = '#22c55e'; // Green for high scores
      
      if (score < 40) {
        scoreColor = '#ef4444'; // Red for low scores
      } else if (score < 70) {
        scoreColor = '#f59e0b'; // Orange for medium scores
      }
      
      scoreCircle.style.setProperty('--score-color', scoreColor);
    }
  }
  
  /**
   * Set up task creation and dragging
   */
  function setupTaskHandling() {
    // Set up new task form
    const newTaskForm = document.getElementById('new-task-form');
    if (newTaskForm) {
      newTaskForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
        const taskData = {
          title: this.elements['title'].value,
          description: this.elements['description'].value,
          duration: parseInt(this.elements['duration'].value, 10),
          task_type: this.elements['task_type'].value,
          priority: parseInt(this.elements['priority'].value, 10)
        };
        
        // Submit task to API
        fetch('/api/tasks', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(taskData)
        })
          .then(response => response.json())
          .then(data => {
            // Reset form
            newTaskForm.reset();
            
            // Show success notification
            showNotification('Task created successfully', 'success');
            
            // Get AI suggestions for task
            getTaskSuggestions(data.id);
          })
          .catch(error => {
            console.error('Error creating task:', error);
            showNotification('Error creating task', 'error');
          });
      });
    }
    
    // Set up drag and drop for tasks
    setupDragDrop();
  }
  
  /**
   * Get AI suggestions for a newly created task
   * @param {string} taskId - ID of the task
   */
  function getTaskSuggestions(taskId) {
    fetch(`/api/tasks/${taskId}/suggestions`)
      .then(response => response.json())
      .then(data => {
        // Show suggestions in a modal or container
        const suggestionsContainer = document.getElementById('task-suggestions');
        if (suggestionsContainer && data.suggestions && data.suggestions.length > 0) {
          let suggestionsHTML = '<h4>AI-Suggested Time Slots</h4><ul>';
          
          data.suggestions.forEach(suggestion => {
            suggestionsHTML += `
              <li>
                <strong>${suggestion.start} - ${suggestion.end}</strong>
                <span class="quality-score">${suggestion.quality_score}% optimal</span>
                <button class="btn btn-sm" onclick="scheduleTask('${taskId}', '${suggestion.start}', '${suggestion.end}')">
                  Schedule
                </button>
              </li>
            `;
          });
          
          suggestionsHTML += '</ul>';
          
          suggestionsContainer.innerHTML = `
            <div class="card fade-in">
              <div class="card-header">
                <h3 class="card-title">Scheduling Suggestions for "${data.task.title}"</h3>
                <button type="button" class="btn-close" aria-label="Close" onclick="document.getElementById('task-suggestions').innerHTML = ''"></button>
              </div>
              <div class="card-body">
                ${suggestionsHTML}
              </div>
            </div>
          `;
          
          // Show suggestions container
          suggestionsContainer.style.display = 'block';
        }
      })
      .catch(error => {
        console.error('Error getting task suggestions:', error);
      });
  }
  
  /**
   * Schedule a task at a specific time
   * @param {string} taskId - ID of the task
   * @param {string} startTime - Start time
   * @param {string} endTime - End time
   */
  function scheduleTask(taskId, startTime, endTime) {
    fetch(`/api/tasks/${taskId}/schedule`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        start_time: startTime,
        end_time: endTime
      })
    })
      .then(response => response.json())
      .then(data => {
        // Show success notification
        showNotification('Task scheduled successfully', 'success');
        
        // Close suggestions container
        document.getElementById('task-suggestions').innerHTML = '';
        
        // Refresh timeline
        refreshTimeline();
      })
      .catch(error => {
        console.error('Error scheduling task:', error);
        showNotification('Error scheduling task', 'error');
      });
  }
  
  /**
   * Set up drag and drop functionality
   */
  function setupDragDrop() {
    // Make tasks draggable
    const draggableTasks = document.querySelectorAll('.task.draggable');
    draggableTasks.forEach(task => {
      task.setAttribute('draggable', true);
      
      task.addEventListener('dragstart', function(e) {
        e.dataTransfer.setData('text/plain', this.dataset.taskId);
        this.classList.add('dragging');
      });
      
      task.addEventListener('dragend', function() {
        this.classList.remove('dragging');
      });
    });
    
    // Make time slots droppable
    const timeSlots = document.querySelectorAll('.time-slot');
    timeSlots.forEach(slot => {
      slot.addEventListener('dragover', function(e) {
        e.preventDefault();
        this.classList.add('drag-over');
      });
      
      slot.addEventListener('dragleave', function() {
        this.classList.remove('drag-over');
      });
      
      slot.addEventListener('drop', function(e) {
        e.preventDefault();
        this.classList.remove('drag-over');
        
        const taskId = e.dataTransfer.getData('text/plain');
        const slotId = this.dataset.slotId;
        
        // Call API to assign task to slot
        fetch(`/api/tasks/${taskId}/assign`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            slot_id: slotId
          })
        })
          .then(response => response.json())
          .then(data => {
            // Show success notification
            showNotification('Task assigned to time slot', 'success');
            
            // Refresh timeline
            refreshTimeline();
          })
          .catch(error => {
            console.error('Error assigning task:', error);
            showNotification('Error assigning task', 'error');
          });
      });
    });
  }
  
  /**
   * Set up realtime updates
   */
  function setupRealtimeUpdates() {
    // Check if WebSocket is supported
    if ('WebSocket' in window) {
      // Connect to WebSocket server
      const socket = new WebSocket(getWebSocketUrl());
      
      // Connection opened
      socket.addEventListener('open', function(event) {
        console.log('Connected to WebSocket server');
      });
      
      // Listen for messages
      socket.addEventListener('message', function(event) {
        const data = JSON.parse(event.data);
        
        // Handle different message types
        switch (data.type) {
          case 'schedule_update':
            refreshTimeline();
            break;
          case 'wellness_update':
            updateWellnessScore(data.score);
            break;
          case 'notification':
            showNotification(data.message, data.notificationType);
            break;
        }
      });
      
      // Connection closed
      socket.addEventListener('close', function(event) {
        console.log('Disconnected from WebSocket server');
        
        // Try to reconnect after 5 seconds
        setTimeout(setupRealtimeUpdates, 5000);
      });
      
      // Connection error
      socket.addEventListener('error', function(event) {
        console.error('WebSocket error:', event);
      });
    }
  }
  
  /**
   * Get WebSocket URL based on current protocol and host
   * @returns {string} WebSocket URL
   */
  function getWebSocketUrl() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    
    return `${protocol}//${host}/ws`;
  }
  
  /**
   * Refresh timeline view
   */
  function refreshTimeline() {
    fetch('/api/schedule/timeline')
      .then(response => response.json())
      .then(data => {
        // Update timeline HTML
        const timelineContainer = document.querySelector('.timeline-container');
        if (timelineContainer) {
          timelineContainer.innerHTML = '';
          
          // Add time slots to timeline
          data.timeSlots.forEach(slot => {
            const slotElement = document.createElement('div');
            slotElement.className = `time-slot ${slot.type}`;
            slotElement.dataset.slotId = slot.id;
            slotElement.dataset.startTime = slot.start_time;
            slotElement.dataset.endTime = slot.end_time;
            slotElement.dataset.duration = slot.duration;
            
            if (slot.ai_score) {
              slotElement.dataset.aiRecommendation = slot.ai_score;
            }
            
            slotElement.innerHTML = `
              <div class="slot-header">
                <span class="slot-time">${slot.start_time} - ${slot.end_time}</span>
              </div>
              <div class="slot-title">${slot.title}</div>
              ${slot.description ? `<div class="slot-description">${slot.description}</div>` : ''}
            `;
            
            timelineContainer.appendChild(slotElement);
          });
          
          // Re-initialize timeline
          initializeTimeline();
        }
      })
      .catch(error => {
        console.error('Error refreshing timeline:', error);
      });
  }
  
  /**
   * Show a notification
   * @param {string} message - Notification message
   * @param {string} type - Notification type (success, error, info)
   */
  function showNotification(message, type = 'info') {
    const notificationsContainer = document.getElementById('notifications');
    if (!notificationsContainer) return;
    
    const notification = document.createElement('div');
    notification.className = `notification ${type} fade-in`;
    
    let icon = '';
    switch (type) {
      case 'success':
        icon = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-check-circle"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>';
        break;
      case 'error':
        icon = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-alert-circle"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>';
        break;
      default:
        icon = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-info"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>';
    }
    
    notification.innerHTML = `
      <div class="notification-icon">${icon}</div>
      <div class="notification-content">${message}</div>
      <button type="button" class="notification-close" aria-label="Close">&times;</button>
    `;
    
    // Add close button functionality
    notification.querySelector('.notification-close').addEventListener('click', function() {
      notification.classList.add('fade-out');
      setTimeout(() => {
        notification.remove();
      }, 300);
    });
    
    // Add to notifications container
    notificationsContainer.appendChild(notification);
    
    // Automatically remove after 5 seconds
    setTimeout(() => {
      if (notification.parentNode) {
        notification.classList.add('fade-out');
        setTimeout(() => {
          if (notification.parentNode) {
            notification.remove();
          }
        }, 300);
      }
    }, 5000);
  }