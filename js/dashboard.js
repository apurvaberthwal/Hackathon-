// dashboard.js - Client-side script for the dashboard

document.addEventListener('DOMContentLoaded', function() {
    // Initialize Bootstrap components
    const taskModal = new bootstrap.Modal(document.getElementById('taskModal'));
    const optimizeModal = new bootstrap.Modal(document.getElementById('optimizeModal'));
    
    // DOM Elements
    const newTaskBtn = document.getElementById('newTaskBtn');
    const optimizeBtn = document.getElementById('optimizeBtn');
    const saveTaskBtn = document.getElementById('saveTaskBtn');
    const getSuggestionsBtn = document.getElementById('getSuggestionsBtn');
    const generateRoadmapBtn = document.getElementById('generateRoadmapBtn');
    const scheduleDate = document.getElementById('scheduleDate');
    const taskFilter = document.getElementById('taskFilter');
    const applyOptimizationsBtn = document.getElementById('applyOptimizationsBtn');
    
    // Event Listeners
    if (newTaskBtn) newTaskBtn.addEventListener('click', openNewTaskModal);
    if (optimizeBtn) optimizeBtn.addEventListener('click', optimizeSchedule);
    if (saveTaskBtn) saveTaskBtn.addEventListener('click', saveTask);
    if (getSuggestionsBtn) getSuggestionsBtn.addEventListener('click', getTimeSuggestions);
    if (generateRoadmapBtn) generateRoadmapBtn.addEventListener('click', generateRoadmap);
    if (scheduleDate) scheduleDate.addEventListener('change', updateSchedule);
    if (taskFilter) taskFilter.addEventListener('change', filterTasks);
    if (applyOptimizationsBtn) applyOptimizationsBtn.addEventListener('click', applyOptimizations);
    
    // Setup task checkboxes
    setupTaskCheckboxes();
    
    // Setup task edit buttons
    setupTaskEditButtons();
    
    // Initialize task tracking
    let currentTaskId = null;
    
    // Function to open new task modal
    function openNewTaskModal() {
      // Reset form
      document.getElementById('taskForm').reset();
      document.getElementById('taskId').value = '';
      document.querySelector('#taskModal .modal-title').textContent = 'New Task';
      document.querySelector('.time-suggestions').classList.add('d-none');
      document.getElementById('timeSuggestions').innerHTML = '';
      currentTaskId = null;
      
      // Set default datetime to now + 1 hour, rounded to nearest 15 minutes
      const now = new Date();
      now.setHours(now.getHours() + 1);
      now.setMinutes(Math.ceil(now.getMinutes() / 15) * 15);
      const dateStr = now.toISOString().slice(0, 16);
      document.getElementById('taskScheduled').value = dateStr;
      
      taskModal.show();
    }
    
    // Function to open task edit modal with existing task data
    function openEditTaskModal(taskId) {
      currentTaskId = taskId;
      
      // Fetch task data
      fetch(`/tasks/${taskId}`)
        .then(response => {
          if (!response.ok) throw new Error('Failed to fetch task');
          return response.json();
        })
        .then(task => {
          // Fill form with task data
          document.getElementById('taskId').value = task.id;
          document.getElementById('taskTitle').value = task.title || '';
          document.getElementById('taskDescription').value = task.description || '';
          document.getElementById('taskType').value = task.task_type || 'work';
          document.getElementById('taskPriority').value = task.priority || 3;
          document.getElementById('taskDuration').value = task.duration || 30;
          
          if (task.scheduled_time) {
            const date = new Date(task.scheduled_time);
            const dateStr = date.toISOString().slice(0, 16);
            document.getElementById('taskScheduled').value = dateStr;
          } else {
            document.getElementById('taskScheduled').value = '';
          }
          
          document.querySelector('#taskModal .modal-title').textContent = 'Edit Task';
          document.querySelector('.time-suggestions').classList.add('d-none');
          document.getElementById('timeSuggestions').innerHTML = '';
          
          taskModal.show();
        })
        .catch(error => {
          console.error('Error fetching task:', error);
          showToast('Error', 'Failed to load task data');
        });
    }
    
    // Function to save task (create or update)
    function saveTask() {
      const taskId = document.getElementById('taskId').value;
      const title = document.getElementById('taskTitle').value;
      const description = document.getElementById('taskDescription').value;
      const task_type = document.getElementById('taskType').value;
      const priority = document.getElementById('taskPriority').value;
      const duration = document.getElementById('taskDuration').value;
      const scheduled_time = document.getElementById('taskScheduled').value;
      
      if (!title) {
        alert('Task title is required');
        return;
      }
      
      const taskData = {
        title,
        description,
        task_type,
        priority,
        duration,
        scheduled_time
      };
      
      const url = taskId ? `/tasks/${taskId}` : '/tasks';
      const method = taskId ? 'PUT' : 'POST';
      
      fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(taskData)
      })
        .then(response => {
          if (!response.ok) throw new Error('Failed to save task');
          return response.json();
        })
        .then(data => {
          taskModal.hide();
          // Refresh the page to show updated tasks
          window.location.reload();
        })
        .catch(error => {
          console.error('Error saving task:', error);
          showToast('Error', 'Failed to save task');
        });
    }
    
    // Function to get AI time suggestions
    function getTimeSuggestions() {
      const task_type = document.getElementById('taskType').value;
      const duration = document.getElementById('taskDuration').value;
      
      document.getElementById('timeSuggestions').innerHTML = '<div class="spinner-border spinner-border-sm" role="status"></div> Getting suggestions...';
      document.querySelector('.time-suggestions').classList.remove('d-none');
      
      fetch('/tasks/suggest-time', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ task_type, duration })
      })
        .then(response => {
          if (!response.ok) throw new Error('Failed to get suggestions');
          return response.json();
        })
        .then(suggestions => {
          const suggestionsContainer = document.getElementById('timeSuggestions');
          suggestionsContainer.innerHTML = '';
          
          if (!suggestions || suggestions.length === 0) {
            suggestionsContainer.innerHTML = '<p>No suggestions available</p>';
            return;
          }
          
          suggestions.forEach(suggestion => {
            const startTime = new Date(suggestion.start_time);
            
            const suggestionButton = document.createElement('button');
            suggestionButton.className = 'btn btn-sm btn-outline-secondary';
            suggestionButton.textContent = formatTimeForDisplay(startTime);
            suggestionButton.setAttribute('data-time', suggestion.start_time);
            suggestionButton.setAttribute('title', suggestion.reason);
            
            suggestionButton.addEventListener('click', function() {
              document.getElementById('taskScheduled').value = startTime.toISOString().slice(0, 16);
            });
            
            suggestionsContainer.appendChild(suggestionButton);
          });
        })
        .catch(error => {
          console.error('Error getting suggestions:', error);
          document.querySelector('.time-suggestions').classList.remove('d-none');
          document.getElementById('timeSuggestions').innerHTML = '<p class="text-danger">Failed to get suggestions</p>';
        });
    }
    
    // Function to optimize the daily schedule
    function optimizeSchedule() {
      // Show the optimization modal with loading state
      document.getElementById('optimizationSpinner').classList.remove('d-none');
      document.getElementById('optimizationResults').classList.add('d-none');
      document.getElementById('optimizationEmpty').classList.add('d-none');
      document.getElementById('applyOptimizationsBtn').classList.add('d-none');
      optimizeModal.show();
      
      // Call the optimization API
      fetch('/ai/quick-optimize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          applyChanges: false
        })
      })
        .then(response => {
          if (!response.ok) throw new Error('Failed to optimize schedule');
          return response.json();
        })
        .then(data => {
          document.getElementById('optimizationSpinner').classList.add('d-none');
          
          if (!data.success || !data.optimizations || data.optimizations.length === 0) {
            document.getElementById('optimizationEmpty').classList.remove('d-none');
            return;
          }
          
          const optimizationList = document.getElementById('optimizationList');
          optimizationList.innerHTML = '';
          
          data.optimizations.forEach(opt => {
            const originalTime = new Date(opt.original_time);
            const suggestedTime = new Date(opt.suggested_time);
            
            const item = document.createElement('div');
            item.className = 'list-group-item';
            item.innerHTML = `
              <div class="d-flex justify-content-between align-items-center">
                <div>
                  <h6 class="mb-1">${opt.task_title}</h6>
                  <p class="mb-1">
                    Move from <strong>${formatTimeForDisplay(originalTime)}</strong> to 
                    <strong>${formatTimeForDisplay(suggestedTime)}</strong>
                  </p>
                  <small>${opt.reason}</small>
                </div>
                <div class="form-check">
                  <input class="form-check-input optimization-checkbox" type="checkbox" value="${opt.task_id}" 
                    id="opt${opt.task_id}" checked>
                </div>
              </div>
            `;
            
            optimizationList.appendChild(item);
          });
          
          document.getElementById('optimizationResults').classList.remove('d-none');
          document.getElementById('applyOptimizationsBtn').classList.remove('d-none');
        })
        .catch(error => {
          console.error('Error optimizing schedule:', error);
          document.getElementById('optimizationSpinner').classList.add('d-none');
          document.getElementById('optimizationEmpty').classList.remove('d-none');
          document.getElementById('optimizationEmpty').innerHTML = 
            '<p class="text-danger">Error: Failed to optimize schedule</p>';
        });
    }
    
    // Function to apply the optimizations
    function applyOptimizations() {
      const checkboxes = document.querySelectorAll('.optimization-checkbox:checked');
      const taskIds = Array.from(checkboxes).map(cb => cb.value);
      
      if (taskIds.length === 0) {
        optimizeModal.hide();
        return;
      }
      
      // Show loading state
      document.getElementById('applyOptimizationsBtn').disabled = true;
      document.getElementById('applyOptimizationsBtn').innerHTML = 
        '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Applying...';
      
      // Call optimization API with selected task IDs
      fetch('/ai/quick-optimize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          applyChanges: true,
          taskIds
        })
      })
        .then(response => {
          if (!response.ok) throw new Error('Failed to apply optimizations');
          return response.json();
        })
        .then(data => {
          optimizeModal.hide();
          // Refresh the page to show updated schedule
          window.location.reload();
        })
        .catch(error => {
          console.error('Error applying optimizations:', error);
          document.getElementById('applyOptimizationsBtn').disabled = false;
          document.getElementById('applyOptimizationsBtn').textContent = 'Apply All Changes';
          showToast('Error', 'Failed to apply optimizations');
        });
    }
    
    // Function to generate a new productivity roadmap
    function generateRoadmap() {
      if (!generateRoadmapBtn) return;
      
      generateRoadmapBtn.disabled = true;
      generateRoadmapBtn.innerHTML = 
        '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Generating...';
      
      fetch('/ai/generate-roadmap', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          goals: [
            'Improve work-life balance',
            'Reduce meeting fatigue',
            'Increase focus time',
            'Make time for exercise'
          ]
        })
      })
        .then(response => {
          if (!response.ok) throw new Error('Failed to generate roadmap');
          return response.json();
        })
        .then(data => {
          // Redirect to roadmap page
          window.location.href = '/dashboard/roadmap';
        })
        .catch(error => {
          console.error('Error generating roadmap:', error);
          generateRoadmapBtn.disabled = false;
          generateRoadmapBtn.textContent = 'Generate Roadmap';
          showToast('Error', 'Failed to generate roadmap');
        });
    }
    
    // Function to update the schedule when date changes
    function updateSchedule() {
      const selectedDate = scheduleDate.value;
      window.location.href = `/dashboard?date=${selectedDate}`;
    }
    
    // Function to filter tasks
    function filterTasks() {
      const filterValue = taskFilter.value;
      const today = new Date().toISOString().split('T')[0];
      const taskItems = document.querySelectorAll('.task-item');
      
      taskItems.forEach(item => {
        const