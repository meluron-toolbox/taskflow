// Initialize the app and set the current date
document.addEventListener('DOMContentLoaded', initializeApp);

// Global variables
let taskList = document.getElementById('task-list');
let floatingTimer = null;
let activeStopwatch = null;

// Initialize the application
function initializeApp() {
  // Set the current date
  updateCurrentDate();
  
  // Get task list element
  taskList = document.getElementById('task-list');
  
  // Clean up old time logs - keeping only last 7 days
  const logsKept = cleanUpTimeLogs();
  console.log(`Time logs cleaned up: keeping the last 7 days (${logsKept} entries)`);
  
  // Load tasks from local storage
  loadFromLocalStorage();
  
  // Set up event listeners
  setupEventListeners();
}

// Update and format the current date
function updateCurrentDate() {
  const options = { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  };
  document.getElementById('current-date').innerText = new Date().toLocaleDateString(undefined, options);
}

// Set up all event listeners
function setupEventListeners() {
  // Listen for task input
  const targetInput = document.getElementById('target-input');
  targetInput.addEventListener('keydown', function(event) {
    if (event.key === 'Enter') {
      addTarget(event);
    }
  });
  
  // Listen for blockquote changes
  const blockquote = document.querySelector('.beliefs');
  if (blockquote) {
    blockquote.addEventListener('input', function() {
      localStorage.setItem('blockquote', blockquote.innerText.trim());
    });
  }
  
  // Listen for changes to task or subtask text
  document.addEventListener('input', function(event) {
    if (event.target.classList.contains('task-text') || 
        event.target.classList.contains('subtask-text')) {
      saveToLocalStorage();
    }
  });
}

// Handle adding a new task when Enter is pressed
function addTarget(event) {
  if (event.key === 'Enter') {
    const targetInput = document.getElementById('target-input');
    if (targetInput.value.trim()) {
      addTask(targetInput.value.trim());
      targetInput.value = '';
      saveToLocalStorage();
      
      // Provide visual feedback
      targetInput.classList.add('success-flash');
      setTimeout(() => {
        targetInput.classList.remove('success-flash');
      }, 300);
    }
  }
}

// Create and add a new task to the list
function addTask(taskText, completed = false, subtasks = [], expectedDuration = 0, elapsedTime = 0) {
  const newTask = document.createElement('li');
  newTask.classList.add('task');
  
  // Format the duration display text
  const durationDisplayText = formatExpectedDuration(expectedDuration);
  
  newTask.innerHTML = `
    <div class="task-promotion-indicator"><i class="fas fa-angle-right"></i></div>
    <input type="checkbox" class="task-checkbox" ${completed ? 'checked' : ''} onclick="toggleTaskCompletion(this)">
    <span class="task-text" contenteditable="true" ondblclick="toggleSubtaskCard(this)">${taskText}</span>
    <div class="task-time-container">
      <span class="task-duration">
        <i class="fas fa-clock duration-icon" onclick="showDurationDialog(this)"></i>
        <span class="expected-duration-display">${durationDisplayText}</span>
        <input type="hidden" class="expected-duration" value="${expectedDuration}">
      </span>
      <span class="task-stopwatch" data-time="${elapsedTime}">00:00:00</span>
    </div>
    <button class="task-delete" onclick="deleteTask(this)" aria-label="Delete task">
      <i class="fas fa-trash-alt"></i>
    </button>
  `;
  taskList.appendChild(newTask);
  
  // Create subtask container
  const subtaskContainer = document.createElement('div');
  subtaskContainer.classList.add('subtask-container');
  subtaskContainer.innerHTML = `
    <input type="text" class="subtask-input" placeholder="Enter subtasks..." onkeydown="addSubtask(event, this)">
    <ul class="subtask-list"></ul>
  `;
  newTask.insertAdjacentElement('afterend', subtaskContainer);
  
  // Update the task's stopwatch display
  updateStopwatchDisplay(newTask.querySelector('.task-stopwatch'));
  
  // Add subtasks if they exist
  subtasks.forEach(sub => addSubtaskFromStorage(subtaskContainer, sub.text, sub.completed, sub.elapsedTime));
  
  // Apply strike-through if the task is completed
  if (completed) {
    newTask.querySelector('.task-text').classList.add('strike-through');
  }
  
  // Animate the new task
  newTask.style.opacity = '0';
  newTask.style.transform = 'translateY(-10px)';
  
  // Trigger animation after a short delay
  setTimeout(() => {
    newTask.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
    newTask.style.opacity = '1';
    newTask.style.transform = 'translateY(0)';
  }, 10);
}

// Format the expected duration for display
function formatExpectedDuration(totalMinutes) {
  if (totalMinutes <= 0) return "Set time";
  
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  
  let result = "";
  if (hours > 0) {
    result += `${hours}h`;
  }
  if (minutes > 0 || hours === 0) {
    result += `${minutes}m`;
  }
  
  return result;
}

// Show dialog to set expected duration
function showDurationDialog(element) {
  // Create the dialog overlay
  const overlay = document.createElement('div');
  overlay.classList.add('duration-overlay');
  
  // Create the dialog content
  const dialog = document.createElement('div');
  dialog.classList.add('duration-dialog');
  
  // Get the current expected duration
  const task = element.closest('.task');
  const expectedDurationInput = task.querySelector('.expected-duration');
  const currentDuration = parseInt(expectedDurationInput.value) || 0;
  
  // Calculate hours and minutes
  const currentHours = Math.floor(currentDuration / 60);
  const currentMinutes = currentDuration % 60;
  
  dialog.innerHTML = `
    <h3>Set Expected Duration</h3>
    <div class="duration-inputs">
      <div class="duration-input-group">
        <label for="duration-hours">Hours</label>
        <input type="number" id="duration-hours" min="0" value="${currentHours}">
      </div>
      <div class="duration-input-group">
        <label for="duration-minutes">Minutes</label>
        <input type="number" id="duration-minutes" min="0" max="59" value="${currentMinutes}">
      </div>
    </div>
    <div class="duration-actions">
      <button class="duration-cancel">Cancel</button>
      <button class="duration-save">Save</button>
    </div>
  `;
  
  // Add the dialog to the overlay
  overlay.appendChild(dialog);
  
  // Add the overlay to the document
  document.body.appendChild(overlay);
  
  // Focus on the hours input
  setTimeout(() => {
    document.getElementById('duration-hours').focus();
  }, 100);
  
  // Set up event listeners
  const hoursInput = dialog.querySelector('#duration-hours');
  const minutesInput = dialog.querySelector('#duration-minutes');
  
  // Handle number input constraints
  hoursInput.addEventListener('input', () => {
    if (hoursInput.value < 0) hoursInput.value = 0;
    // No upper limit on hours
  });
  
  minutesInput.addEventListener('input', () => {
    if (minutesInput.value < 0) minutesInput.value = 0;
    if (minutesInput.value > 59) minutesInput.value = 59;
  });
  
  // Handle cancel button
  dialog.querySelector('.duration-cancel').addEventListener('click', () => {
    overlay.classList.add('fade-out');
    setTimeout(() => {
      document.body.removeChild(overlay);
    }, 200);
  });
  
  // Handle save button
  dialog.querySelector('.duration-save').addEventListener('click', () => {
    const hours = parseInt(hoursInput.value) || 0;
    const minutes = parseInt(minutesInput.value) || 0;
    const totalMinutes = (hours * 60) + minutes;
    
    // Update the expected duration hidden input
    expectedDurationInput.value = totalMinutes;
    
    // Update the display span with the formatted time
    const durationDisplay = task.querySelector('.expected-duration-display');
    durationDisplay.textContent = formatExpectedDuration(totalMinutes);
    
    // Update clock icon color
    updateClockIconColor(task);
    
    // Animate and close the dialog
    overlay.classList.add('fade-out');
    setTimeout(() => {
      document.body.removeChild(overlay);
    }, 200);
    
    // Save to local storage
    saveToLocalStorage();
  });
  
  // Close when clicking outside the dialog
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      overlay.classList.add('fade-out');
      setTimeout(() => {
        document.body.removeChild(overlay);
      }, 200);
    }
  });
  
  // Handle keyboard shortcuts
  overlay.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      // Close on Escape key
      overlay.classList.add('fade-out');
      setTimeout(() => {
        document.body.removeChild(overlay);
      }, 200);
    } else if (e.key === 'Enter') {
      // Save on Enter key
      dialog.querySelector('.duration-save').click();
    }
  });
}

// Update the clock icon color based on task status
function updateClockIconColor(task) {
  const expectedDuration = parseInt(task.querySelector('.expected-duration').value) || 0;
  const elapsedTime = parseInt(task.querySelector('.task-stopwatch').dataset.time) || 0;
  const expectedSeconds = expectedDuration * 60;
  const isRunning = task.querySelector('.task-stopwatch').dataset.running === "true";
  
  const clockIcon = task.querySelector('.duration-icon');
  const currentClass = clockIcon.className.match(/time-(normal|running|exceeded)/)?.[0];
  
  // Determine new class
  let newClass;
  if (isRunning) {
    newClass = 'time-running';
  } else if (expectedSeconds > 0 && elapsedTime > expectedSeconds) {
    newClass = 'time-exceeded';
  } else {
    newClass = 'time-normal';
  }
  
  // Only update if the class has changed
  if (!currentClass || !currentClass.includes(newClass)) {
    // Remove existing classes
    clockIcon.classList.remove('time-normal', 'time-running', 'time-exceeded');
    
    // Apply appropriate class
    clockIcon.classList.add(newClass);
  }
}

// Move active task to the top of the list
function moveActiveTaskToTop(subtask) {
  // This function has been removed as it caused performance issues
  // The task promotion functionality is no longer needed
  
  // If you want to keep some functionality without the animations, you could simply
  // save the state here:
  saveToLocalStorage();
}

// Add a subtask when Enter is pressed
function addSubtask(event, input) {
  if (event.key === 'Enter' && input.value.trim()) {
    addSubtaskFromStorage(input.closest('.subtask-container'), input.value.trim());
    input.value = '';
    saveToLocalStorage();
  }
}

// Create and add a subtask from storage data
function addSubtaskFromStorage(container, text, completed = false, elapsedTime = 0) {
  const subtaskList = container.querySelector('.subtask-list');
  const newSubtask = document.createElement('li');
  newSubtask.classList.add('subtask');
  newSubtask.draggable = true;
  newSubtask.innerHTML = `
    <input type="checkbox" class="subtask-checkbox" ${completed ? 'checked' : ''} onclick="toggleSubtaskCompletion(this)">
    <span class="subtask-text" contenteditable="true">${text}</span>
    <span class="stopwatch" data-time="${elapsedTime}">00:00:00</span>
    <button class="stopwatch-btn" onclick="toggleStopwatch(this)" aria-label="Start/stop timer">
      <i class="fas fa-play"></i>
    </button>
    <button class="subtask-delete" onclick="deleteSubtask(this)" aria-label="Delete subtask">
      <i class="fas fa-trash-alt"></i>
    </button>
  `;
  subtaskList.appendChild(newSubtask);
  addDragAndDropHandlers(newSubtask);
  updateStopwatchDisplay(newSubtask.querySelector('.stopwatch'));
  
  // Apply strike-through if completed
  if (completed) {
    newSubtask.querySelector('.subtask-text').classList.add('strike-through');
  }
  
  // Animate the new subtask
  newSubtask.style.opacity = '0';
  newSubtask.style.transform = 'translateY(-5px)';
  
  // Trigger animation after a short delay
  setTimeout(() => {
    newSubtask.style.transition = 'opacity 0.2s ease, transform 0.2s ease';
    newSubtask.style.opacity = '1';
    newSubtask.style.transform = 'translateY(0)';
  }, 10);
}

// Toggle the subtask timer
function toggleStopwatch(button) {
  const subtask = button.closest('.subtask');
  const stopwatch = subtask.querySelector('.stopwatch');
  const parentTask = subtask.closest('.subtask-list').closest('.subtask-container').previousElementSibling;
  const parentStopwatch = parentTask.querySelector('.task-stopwatch');
  
  // Stop any currently running stopwatch
  if (activeStopwatch && activeStopwatch !== stopwatch) {
    const activeButton = activeStopwatch.nextElementSibling;
    clearInterval(activeStopwatch.dataset.timer);
    activeStopwatch.dataset.running = "false";
    activeButton.innerHTML = `<i class="fas fa-play"></i>`;
    
    // Record the time log for the stopped timer
    const prevSubtask = activeStopwatch.closest('.subtask');
    const prevTaskText = prevSubtask.closest('.subtask-list')
      .closest('.subtask-container').previousElementSibling.querySelector('.task-text').innerText;
    const prevSubtaskText = prevSubtask.querySelector('.subtask-text').innerText;
    
    // Get the elapsed time for this session only
    const sessionTime = parseInt(activeStopwatch.dataset.sessionTime) || 0;
    
    // Record time directly with current date - only for the subtask, not for the parent task
    if (sessionTime > 0) {
      recordTimeLog(prevTaskText, prevSubtaskText, sessionTime);
    }
    
    // Reset session time
    activeStopwatch.dataset.sessionTime = "0";
    
    // If there was an active parent task stopwatch, update its display
    const prevParentTask = prevSubtask.closest('.subtask-list')
      .closest('.subtask-container').previousElementSibling;
    const prevParentStopwatch = prevParentTask.querySelector('.task-stopwatch');
    if (prevParentStopwatch) {
      clearInterval(prevParentStopwatch.dataset.timer);
      prevParentStopwatch.dataset.running = "false";
      updateStopwatchDisplay(prevParentStopwatch);
    }
    
    // Hide floating timer if it's visible
    hideFloatingTimer();
  }
  
  if (stopwatch.dataset.running === "true") {
    // Stop the stopwatch
    clearInterval(stopwatch.dataset.timer);
    stopwatch.dataset.running = "false";
    button.innerHTML = `<i class="fas fa-play"></i>`;
    
    // Record the time spent for this session only
    const taskText = parentTask.querySelector('.task-text').innerText;
    const subtaskText = subtask.querySelector('.subtask-text').innerText;
    const sessionTime = parseInt(stopwatch.dataset.sessionTime) || 0;
    
    // Record time directly with current date - only for the subtask, not for the parent task
    if (sessionTime > 0) {
      recordTimeLog(taskText, subtaskText, sessionTime);
    }
    
    // Reset session time
    stopwatch.dataset.sessionTime = "0";
    
    // Stop the parent task stopwatch
    clearInterval(parentStopwatch.dataset.timer);
    parentStopwatch.dataset.running = "false";
    
    // Update the parent task stopwatch display to update the clock icon color
    updateStopwatchDisplay(parentStopwatch);
    
    // Hide floating timer
    hideFloatingTimer();
    
    activeStopwatch = null;
  } else {
    // Start the stopwatch
    stopwatch.dataset.running = "true";
    stopwatch.dataset.sessionTime = "0"; // Reset session time
    button.innerHTML = `<i class="fas fa-pause"></i>`;
    startStopwatch(stopwatch);
    
    // Start the parent task stopwatch
    parentStopwatch.dataset.running = "true";
    startStopwatch(parentStopwatch);
    
    // Update display to change clock icon color immediately
    updateStopwatchDisplay(parentStopwatch);
    
    // Show floating timer
    showFloatingTimer(subtask.querySelector('.subtask-text').innerText, stopwatch);
    
    activeStopwatch = stopwatch;
  }
  
  // Save state
  saveToLocalStorage();
}


// Start the stopwatch timer
function startStopwatch(stopwatch) {
  let elapsedTime = parseInt(stopwatch.dataset.time) || 0;
  let sessionTime = parseInt(stopwatch.dataset.sessionTime) || 0;
  
  const update = () => {
    elapsedTime++;
    sessionTime++;
    
    stopwatch.dataset.time = elapsedTime;
    stopwatch.dataset.sessionTime = sessionTime;
    
    // Only update display once per second, not the parent task every time
    updateStopwatchDisplay(stopwatch);
    
    // Only update parent task display every 5 seconds to improve performance
    if (stopwatch.classList.contains('stopwatch') && sessionTime % 5 === 0) {
      const parentTask = stopwatch.closest('.subtask').closest('.subtask-list')
        .closest('.subtask-container').previousElementSibling;
      const parentStopwatch = parentTask.querySelector('.task-stopwatch');
      updateStopwatchDisplay(parentStopwatch);
    }
    
    // Update floating timer if this is the active stopwatch
    if (activeStopwatch === stopwatch && floatingTimer) {
      updateFloatingTimerDisplay(stopwatch);
    }
    
    // Only save to localStorage every 30 seconds to improve performance
    if (sessionTime % 30 === 0) {
      saveToLocalStorage();
    }
  };
  stopwatch.dataset.timer = setInterval(update, 1000);
}

// Update the stopwatch display
function updateStopwatchDisplay(stopwatch) {
  let elapsedTime = parseInt(stopwatch.dataset.time) || 0;
  let hours = Math.floor(elapsedTime / 3600);
  let minutes = Math.floor((elapsedTime % 3600) / 60);
  let seconds = elapsedTime % 60;
  stopwatch.innerText = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  
  // Check if this is a task stopwatch - only update colors if needed
  if (stopwatch.classList.contains('task-stopwatch')) {
    // Only update icon color if really needed
    updateClockIconColor(stopwatch.closest('.task'));
  }
}

// Show the floating timer
function showFloatingTimer(taskText, stopwatch) {
  // Create floating timer if it doesn't exist
  if (!floatingTimer) {
    floatingTimer = document.createElement('div');
    floatingTimer.classList.add('floating-timer');
    floatingTimer.innerHTML = `
      <div class="timer-header">
        <span class="timer-task-text"></span>
        <button class="close-timer" onclick="hideFloatingTimer()" aria-label="Close timer">×</button>
      </div>
      <div class="timer-display">00:00:00</div>
    `;
    document.body.appendChild(floatingTimer);
    
    // Make floating timer draggable
    makeFloatingTimerDraggable();
    
    // Position it on the left side of the screen
    floatingTimer.style.left = "20px";
    floatingTimer.style.right = "auto";
  }
  
  // Update task text
  floatingTimer.querySelector('.timer-task-text').innerText = taskText;
  
  // Update timer display
  updateFloatingTimerDisplay(stopwatch);
  
  // Show the timer with animation
  floatingTimer.style.display = 'block';
  floatingTimer.style.opacity = '0';
  
  // Trigger animation after a short delay
  setTimeout(() => {
    floatingTimer.style.opacity = '1';
  }, 10);
}

// Update the floating timer display
function updateFloatingTimerDisplay(stopwatch) {
  if (floatingTimer) {
    const timerDisplay = floatingTimer.querySelector('.timer-display');
    timerDisplay.innerText = stopwatch.innerText;
  }
}

// Hide the floating timer and stop any active timer
function hideFloatingTimer() {
  if (floatingTimer) {
    floatingTimer.style.opacity = '0';
    
    // Stop the active timer if there is one
    if (activeStopwatch) {
      // Find the play/pause button
      const activeButton = activeStopwatch.nextElementSibling;
      
      // Get the parent task
      const subtask = activeStopwatch.closest('.subtask');
      const parentTask = subtask.closest('.subtask-list')
        .closest('.subtask-container').previousElementSibling;
      const parentStopwatch = parentTask.querySelector('.task-stopwatch');
      
      // Record the time spent for this session
      const taskText = parentTask.querySelector('.task-text').innerText;
      const subtaskText = subtask.querySelector('.subtask-text').innerText;
      const sessionTime = parseInt(activeStopwatch.dataset.sessionTime) || 0;
      
      // Record time directly with current date - only for the subtask
      if (sessionTime > 0) {
        recordTimeLog(taskText, subtaskText, sessionTime);
      }
      
      // Reset session time
      activeStopwatch.dataset.sessionTime = "0";
      
      // Stop the subtask timer
      clearInterval(activeStopwatch.dataset.timer);
      activeStopwatch.dataset.running = "false";
      activeButton.innerHTML = `<i class="fas fa-play"></i>`;
      
      // Stop the parent task timer
      clearInterval(parentStopwatch.dataset.timer);
      parentStopwatch.dataset.running = "false";
      
      // Update displays
      updateStopwatchDisplay(activeStopwatch);
      updateStopwatchDisplay(parentStopwatch);
      
      // Clear active stopwatch reference
      activeStopwatch = null;
    }
    
    // Remove from DOM after animation completes
    setTimeout(() => {
      floatingTimer.style.display = 'none';
    }, 300);
  }
}

// Make the floating timer draggable
function makeFloatingTimerDraggable() {
  let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
  const header = floatingTimer.querySelector('.timer-header');
  
  header.onmousedown = dragMouseDown;
  header.ontouchstart = dragTouchStart;
  
  function dragMouseDown(e) {
    e.preventDefault();
    // Get the mouse cursor position at startup
    pos3 = e.clientX;
    pos4 = e.clientY;
    document.onmouseup = closeDragElement;
    // Call a function whenever the cursor moves
    document.onmousemove = elementDrag;
  }
  
  function dragTouchStart(e) {
    const touch = e.touches[0];
    pos3 = touch.clientX;
    pos4 = touch.clientY;
    document.ontouchend = closeTouchDrag;
    document.ontouchmove = elementTouchDrag;
  }
  
  function elementDrag(e) {
    e.preventDefault();
    // Calculate the new cursor position
    pos1 = pos3 - e.clientX;
    pos2 = pos4 - e.clientY;
    pos3 = e.clientX;
    pos4 = e.clientY;
    // Set the element's new position
    moveElement();
  }
  
  function elementTouchDrag(e) {
    const touch = e.touches[0];
    pos1 = pos3 - touch.clientX;
    pos2 = pos4 - touch.clientY;
    pos3 = touch.clientX;
    pos4 = touch.clientY;
    moveElement();
  }
  
  function moveElement() {
    // Calculate new position while keeping within viewport
    let newTop = floatingTimer.offsetTop - pos2;
    let newLeft = floatingTimer.offsetLeft - pos1;
    
    // Set boundaries to keep within viewport
    const maxTop = window.innerHeight - floatingTimer.offsetHeight;
    const maxLeft = window.innerWidth - floatingTimer.offsetWidth;
    
    newTop = Math.max(0, Math.min(newTop, maxTop));
    newLeft = Math.max(0, Math.min(newLeft, maxLeft));
    
    // Apply new position
    floatingTimer.style.top = newTop + "px";
    floatingTimer.style.left = newLeft + "px";
  }
  
  function closeDragElement() {
    // Stop moving when mouse button is released
    document.onmouseup = null;
    document.onmousemove = null;
  }
  
  function closeTouchDrag() {
    document.ontouchend = null;
    document.ontouchmove = null;
  }
}

// Toggle task completion
function toggleTaskCompletion(checkbox) {
  const task = checkbox.closest('.task');
  const taskText = task.querySelector('.task-text');
  
  if (checkbox.checked) {
    taskText.classList.add('strike-through');
  } else {
    taskText.classList.remove('strike-through');
  }
  
  saveToLocalStorage();
}

// Toggle subtask completion
function toggleSubtaskCompletion(checkbox) {
  const subtask = checkbox.closest('.subtask');
  const subtaskText = subtask.querySelector('.subtask-text');
  
  if (checkbox.checked) {
    subtaskText.classList.add('strike-through');
  } else {
    subtaskText.classList.remove('strike-through');
  }
  
  saveToLocalStorage();
}

// Delete a task and its subtasks
function deleteTask(button) {
  const task = button.closest('.task');
  const subtaskContainer = task.nextElementSibling;
  
  // Clear any running timers for this task
  const taskStopwatch = task.querySelector('.task-stopwatch');
  if (taskStopwatch.dataset.timer) {
    clearInterval(taskStopwatch.dataset.timer);
  }
  
  // Clear any running timers for subtasks
  const subtaskStopwatches = subtaskContainer.querySelectorAll('.stopwatch');
  subtaskStopwatches.forEach(sw => {
    if (sw.dataset.timer) {
      clearInterval(sw.dataset.timer);
    }
  });
  
  // Animate removal
  task.style.opacity = '0';
  task.style.transform = 'translateX(20px)';
  subtaskContainer.style.opacity = '0';
  
  // Remove after animation completes
  setTimeout(() => {
    subtaskContainer.remove();
    task.remove();
    
    // Hide floating timer if it was for this task's subtask
    if (activeStopwatch && !document.body.contains(activeStopwatch)) {
      hideFloatingTimer();
      activeStopwatch = null;
    }
    
    saveToLocalStorage();
  }, 300);
}

// Delete a subtask
function deleteSubtask(button) {
  const subtask = button.closest('.subtask');
  const stopwatch = subtask.querySelector('.stopwatch');
  
  // Clear the interval if it's running
  if (stopwatch.dataset.timer) {
    clearInterval(stopwatch.dataset.timer);
  }
  
  // If this is the active stopwatch, hide the floating timer
  if (activeStopwatch === stopwatch) {
    hideFloatingTimer();
    activeStopwatch = null;
  }
  
  // Animate removal
  subtask.style.opacity = '0';
  subtask.style.transform = 'translateX(20px)';
  
  // Remove after animation completes
  setTimeout(() => {
    subtask.remove();
    saveToLocalStorage();
  }, 300);
}

// Toggle subtask container visibility
function toggleSubtaskCard(taskText) {
  const task = taskText.closest('.task');
  const subtaskContainer = task.nextElementSibling;
  
  // Toggle display with animation
  if (subtaskContainer.style.display === 'none' || subtaskContainer.style.display === '') {
    // Show subtask container
    subtaskContainer.style.display = 'block';
    subtaskContainer.style.maxHeight = '0';
    subtaskContainer.style.opacity = '0';
    
    // Trigger animation after a short delay
    setTimeout(() => {
      subtaskContainer.style.maxHeight = '500px';
      subtaskContainer.style.opacity = '1';
      
      // Focus on the input field
      const subtaskInput = subtaskContainer.querySelector('.subtask-input');
      subtaskInput.focus();
    }, 10);
  } else {
    // Hide subtask container with animation
    subtaskContainer.style.maxHeight = '0';
    subtaskContainer.style.opacity = '0';
    
    // Remove from flow after animation completes
    setTimeout(() => {
      subtaskContainer.style.display = 'none';
    }, 300);
  }
}

// Set flag when stopping a timer to record in the log
function setTimerStopFlag(taskText, subtaskText, sessionTime) {
  window.justStoppedTimer = {
    task: taskText,
    subtask: subtaskText,
    duration: sessionTime, // This is now the session time only
    timestamp: new Date().toISOString()
  };
}

// Modified saveToLocalStorage to track time logs
function saveToLocalStorage() {
  const tasks = [];
  
  // Save tasks with subtasks, expected duration, and stopwatch data
  document.querySelectorAll('.task').forEach(task => {
    const taskText = task.querySelector('.task-text').innerText;
    const completed = task.querySelector('.task-checkbox').checked;
    const expectedDuration = task.querySelector('.expected-duration').value || 0;
    const elapsedTime = task.querySelector('.task-stopwatch').dataset.time || 0;
    
    // Check if page is being unloaded/refreshed (we'll detect this to prevent auto-start)
    const isUnloading = document.visibilityState === 'hidden' || window.isPageUnloading;
    
    // If page is being unloaded, save timers as NOT running regardless of current state
    // This ensures they won't auto-start on refresh
    const isRunning = isUnloading ? false : task.querySelector('.task-stopwatch').dataset.running === "true";
    
    const subtasks = [...task.nextElementSibling.querySelectorAll('.subtask')].map(sub => ({
      text: sub.querySelector('.subtask-text').innerText,
      completed: sub.querySelector('.subtask-checkbox').checked,
      elapsedTime: sub.querySelector('.stopwatch').dataset.time || 0,
      // Set subtasks to not running if page is being unloaded
      isRunning: isUnloading ? false : sub.querySelector('.stopwatch').dataset.running === "true"
    }));
    
    tasks.push({ 
      text: taskText, 
      completed, 
      expectedDuration, 
      elapsedTime,
      isRunning,
      subtasks 
    });
  });
  
  // Save blockquote content if present
  const blockquote = document.querySelector('.beliefs');
  const blockquoteText = blockquote ? blockquote.innerText.trim() : '';
  
  // Store tasks and blockquote in local storage
  localStorage.setItem('tasks', JSON.stringify(tasks));
  localStorage.setItem('blockquote', blockquoteText);
}

// A utility function to ensure the time logs are valid and recent
function cleanUpTimeLogs() {
  const timeLogs = JSON.parse(localStorage.getItem('timeLogs') || '[]');
  
  // Keep only the last 7 days of logs
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const sevenDaysAgoString = sevenDaysAgo.toISOString().split('T')[0];
  
  // Filter out logs older than 7 days
  const recentLogs = timeLogs.filter(log => {
    // Ensure log has valid date property
    if (!log.date) {
      if (log.timestamp) {
        // Extract date from timestamp if available
        log.date = log.timestamp.split('T')[0];
      } else {
        // Skip invalid logs
        return false;
      }
    }
    return log.date >= sevenDaysAgoString;
  });
  
  // Save back to local storage
  localStorage.setItem('timeLogs', JSON.stringify(recentLogs));
  
  return recentLogs.length;
}

// Record time log entry to local storage
function recordTimeLog(taskName, subtaskName, duration) {
  // Debug date issue
  console.log("Recording time log with date:", new Date().toISOString());
  
  // Only record if there's actual time spent
  if (duration <= 0) return;
  
  // Get existing logs or initialize new array
  const timeLogs = JSON.parse(localStorage.getItem('timeLogs') || '[]');
  
  // IMPORTANT: Create a fresh date object for today
  const currentDate = new Date();
  
  // Format YYYY-MM-DD using current date (not stored date)
  const year = currentDate.getFullYear();
  const month = String(currentDate.getMonth() + 1).padStart(2, '0');
  const day = String(currentDate.getDate()).padStart(2, '0');
  const todayString = `${year}-${month}-${day}`;
  
  console.log("Current date string:", todayString);
  
  // Create new log entry with clear current date
  const logEntry = {
    id: Date.now().toString() + Math.random().toString(36).substring(2, 5),
    date: todayString, // Use today's date explicitly
    timestamp: currentDate.toISOString(),
    taskName: taskName,
    subtaskName: subtaskName,
    duration: duration
  };
  
  console.log("New log entry:", logEntry);
  
  // Add to logs
  timeLogs.push(logEntry);
  
  // Filter for only last 7 days
  const filteredLogs = filterLastSevenDays(timeLogs);
  
  // Save back to local storage
  localStorage.setItem('timeLogs', JSON.stringify(filteredLogs));
}

// Helper function to filter logs to last 7 days
function filterLastSevenDays(logs) {
  // Calculate date 7 days ago
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  
  // Format as YYYY-MM-DD
  const year = sevenDaysAgo.getFullYear();
  const month = String(sevenDaysAgo.getMonth() + 1).padStart(2, '0');
  const day = String(sevenDaysAgo.getDate()).padStart(2, '0');
  const cutoffDate = `${year}-${month}-${day}`;
  
  console.log("Cutoff date for 7 days:", cutoffDate);
  
  // Filter logs to last 7 days
  return logs.filter(log => {
    // Make sure log has a valid date
    if (!log.date && log.timestamp) {
      // Extract date from timestamp if no date field
      log.date = log.timestamp.split('T')[0];
    }
    
    // Keep only recent logs
    return log.date >= cutoffDate;
  });
}

// 3. Update setTimerStopFlag to ensure it triggers when a timer stops
function setTimerStopFlag(taskText, subtaskText, duration, startTime) {
  console.log(`Timer stopped: ${taskText} / ${subtaskText}: ${duration}s`); // Debugging
  
  // Record time immediately instead of using a flag
  recordTimeLog(taskText, subtaskText, duration);
}

// Function to clear all time logs
function clearAllTimeLogs() {
  // Show confirmation dialog
  if (!confirm('Are you sure you want to clear all time logs? This cannot be undone.')) {
    return;
  }
  
  // Remove time logs from localStorage
  localStorage.removeItem('timeLogs');
  
  // Show success message
  alert('All time logs have been cleared successfully.');
  
  // If a time report is currently open, close it
  const reportOverlay = document.querySelector('.report-overlay');
  if (reportOverlay) {
    closeTimeReport();
  }
}



// Generate time report with graph
function generateTimeReport() {
  // Create the report overlay
  const overlay = document.createElement('div');
  overlay.classList.add('report-overlay');
  
  // Create the report content
  const reportPanel = document.createElement('div');
  reportPanel.classList.add('report-panel');
  
  // Get time logs
  const timeLogs = JSON.parse(localStorage.getItem('timeLogs') || '[]');
  
  // Group logs by date
  const logsByDate = groupLogsByDate(timeLogs);
  
  // Get the date for today and the past 6 days (for 7 days total)
  const chartLabels = [];
  const chartData = [];
  
  // Get last 7 days (including today)
  const today = new Date();
  for (let i = 6; i >= 0; i--) {
    const date = new Date();
    date.setDate(today.getDate() - i);
    
    // Format as YYYY-MM-DD to match our log format
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateString = `${year}-${month}-${day}`;
    
    // Format for display (e.g., "May 4")
    chartLabels.push(formatDateForDisplay(date));
    
    // Get duration for this date or 0 if no data
    const duration = logsByDate[dateString] ? logsByDate[dateString].totalDuration : 0;
    // Convert seconds to hours for better visualization
    chartData.push((duration / 3600).toFixed(2));
  }
  
  console.log("Chart dates:", chartLabels);
  console.log("Chart data:", chartData);
  
  // Get total time for past 7 days
  const weeklyTotal = calculateWeeklyTotal(logsByDate);
  
  // Build HTML for the report
  reportPanel.innerHTML = `
    <div class="report-header">
      <h2>Time Report</h2>
      <div class="report-header-actions">
        <button class="clear-logs-btn" onclick="clearAllTimeLogs()">
          <i class="fas fa-eraser"></i> Clear Logs
        </button>
        <button class="close-report" onclick="closeTimeReport()" aria-label="Close report">×</button>
      </div>
    </div>
    <div class="report-content">
      <div class="report-summary">
        <div class="summary-item">
          <h3>Past 7 Days</h3>
          <div class="summary-time">${formatDurationHMS(weeklyTotal)}</div>
        </div>
      </div>
      
      <div class="report-chart-container">
        <canvas id="timeReportChart" width="700" height="400"></canvas>
      </div>
      
      <h3>Daily Time Log</h3>
      <div class="daily-logs">
        ${generateDailyLogs(logsByDate, Object.keys(logsByDate).sort().reverse())}
      </div>
    </div>
  `;
  
  // Add to overlay
  overlay.appendChild(reportPanel);
  
  // Add to document
  document.body.appendChild(overlay);
  
  // Make overlay fade in
  setTimeout(() => {
    overlay.style.opacity = '1';
    
    // Create chart
    createTimeChart('timeReportChart', chartLabels, chartData);
  }, 10);
}


// Helper function to format date for display in chart
function formatDateForDisplay(dateInput) {
  let date;
  if (typeof dateInput === 'string') {
    // If it's a string, convert to Date object
    date = new Date(dateInput);
  } else {
    // If it's already a Date object, use as is
    date = dateInput;
  }
  
  // Format as "Month Day" (e.g. "May 5")
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// Enhanced createTimeChart to better handle empty data
function createTimeChart(canvasId, labels, data) {
  const ctx = document.getElementById(canvasId).getContext('2d');
  
  // Find the maximum value in the data to set appropriate y-axis max
  const maxValue = Math.max(...data.map(val => parseFloat(val)), 0.2); // At least 0.2 for visibility
  const yAxisMax = Math.ceil(maxValue * 1.2); // Add 20% padding
  
  // Create the chart
  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Hours Worked',
        data: data,
        backgroundColor: 'rgba(25, 118, 210, 0.6)',
        borderColor: 'rgba(25, 118, 210, 1)',
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
          max: yAxisMax,
          title: {
            display: true,
            text: 'Hours'
          },
          ticks: {
            callback: function(value) {
              return value.toFixed(1) + 'h';
            }
          }
        },
        x: {
          title: {
            display: true,
            text: 'Date'
          }
        }
      },
      plugins: {
        legend: {
          display: true,
          position: 'top'
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              const hours = parseFloat(context.raw);
              if (hours === 0) return 'No time logged';
              
              // Convert back to seconds
              const seconds = hours * 3600;
              return formatDurationHMS(seconds);
            },
            title: function(context) {
              return context[0].label;
            }
          }
        }
      }
    }
  });
}

// Create time chart using Chart.js
function createTimeChart(canvasId, labels, data) {
  const ctx = document.getElementById(canvasId).getContext('2d');
  
  // Find the maximum value in the data to set appropriate y-axis max
  const maxValue = Math.max(...data.map(val => parseFloat(val)), 0.2); // At least 0.2 for visibility
  const yAxisMax = Math.ceil(maxValue * 1.2); // Add 20% padding
  
  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Hours Worked',
        data: data,
        backgroundColor: 'rgba(25, 118, 210, 0.6)',
        borderColor: 'rgba(25, 118, 210, 1)',
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
          max: yAxisMax,
          title: {
            display: true,
            text: 'Hours'
          }
        },
        x: {
          title: {
            display: true,
            text: 'Date'
          }
        }
      },
      plugins: {
        legend: {
          display: true,
          position: 'top'
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              const hours = parseFloat(context.raw);
              if (hours === 0) return 'No time logged';
              return `${hours} hours`;
            }
          }
        }
      }
    }
  });
}

// Helper function to group logs by date
function groupLogsByDate(logs) {
  const result = {};
  
  logs.forEach(log => {
    // Get the date (ensure it's in YYYY-MM-DD format)
    const date = log.date || (log.timestamp ? log.timestamp.split('T')[0] : null);
    
    if (!date) return; // Skip logs with no date
    
    if (!result[date]) {
      result[date] = {
        totalDuration: 0,
        tasks: {}
      };
    }
    
    result[date].totalDuration += log.duration;
    
    if (!result[date].tasks[log.taskName]) {
      result[date].tasks[log.taskName] = 0;
    }
    
    result[date].tasks[log.taskName] += log.duration;
  });
  
  return result;
}

// Calculate total for the past 7 days
function calculateWeeklyTotal(logsByDate) {
  let total = 0;
  
  // Calculate the date 7 days ago
  const today = new Date();
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(today.getDate() - 6); // 7 days including today
  
  // Format as YYYY-MM-DD
  const year = sevenDaysAgo.getFullYear();
  const month = String(sevenDaysAgo.getMonth() + 1).padStart(2, '0');
  const day = String(sevenDaysAgo.getDate()).padStart(2, '0');
  const sevenDaysAgoString = `${year}-${month}-${day}`;
  
  Object.keys(logsByDate).forEach(date => {
    if (date >= sevenDaysAgoString) {
      total += logsByDate[date].totalDuration;
    }
  });
  
  return total;
}

// Generate HTML for daily logs
function generateDailyLogs(logsByDate, sortedDates) {
  if (sortedDates.length === 0) {
    return '<div class="no-data">No time logged yet. Start a timer on any subtask to begin tracking your time.</div>';
  }
  
  let html = '';
  
  sortedDates.forEach(date => {
    const dayData = logsByDate[date];
    const dateObj = new Date(date);
    const formattedDate = dateObj.toLocaleDateString(undefined, { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
    
    html += `
      <div class="day-log">
        <div class="day-header">
          <div class="day-date">${formattedDate}</div>
          <div class="day-total">${formatDurationHMS(dayData.totalDuration)}</div>
        </div>
        <div class="day-tasks">
    `;
    
    // Sort tasks by time spent (descending)
    const sortedTasks = Object.entries(dayData.tasks)
      .sort((a, b) => b[1] - a[1]);
    
    sortedTasks.forEach(([taskName, duration]) => {
      html += `
        <div class="day-task">
          <div class="task-name">${taskName}</div>
          <div class="task-time">${formatDurationHMS(duration)}</div>
        </div>
      `;
    });
    
    html += `
        </div>
      </div>
    `;
  });
  
  return html;
}

// Format seconds into HH:MM:SS
function formatDurationHMS(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;
  
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
}

// Close time report
function closeTimeReport() {
  const overlay = document.querySelector('.report-overlay');
  if (overlay) {
    overlay.style.opacity = '0';
    setTimeout(() => {
      document.body.removeChild(overlay);
    }, 300);
  }
}

// Load data from local storage
function loadFromLocalStorage() {
  const tasks = JSON.parse(localStorage.getItem('tasks') || '[]');
  
  // Restore tasks with all their properties
  tasks.forEach((task, index) => {
    addTask(
      task.text, 
      task.completed, 
      task.subtasks, 
      task.expectedDuration || 0, 
      task.elapsedTime || 0
    );
    
    // Important: Do NOT auto-restart any timers when loading from storage
    // The next two blocks have been modified to prevent auto-starting
    
    // Update elapsed time display for task but don't start timer
    if (task.isRunning) {
      const taskElement = document.querySelectorAll('.task')[index];
      const taskStopwatch = taskElement.querySelector('.task-stopwatch');
      // Set to NOT running - overriding the saved state
      taskStopwatch.dataset.running = "false";
      // Just update the display
      updateStopwatchDisplay(taskStopwatch);
    }
    
    // Update elapsed time for subtasks but don't start any timers
    task.subtasks.forEach((subtask, subIndex) => {
      // Even if the subtask was running, don't restart it
      if (subtask.isRunning) {
        const taskElement = document.querySelectorAll('.task')[index];
        const subtaskContainer = taskElement.nextElementSibling;
        const subtaskElements = subtaskContainer.querySelectorAll('.subtask');
        
        if (subtaskElements[subIndex]) {
          const stopwatch = subtaskElements[subIndex].querySelector('.stopwatch');
          const button = stopwatch.nextElementSibling;
          
          // Set to NOT running - overriding the saved state
          stopwatch.dataset.running = "false";
          button.innerHTML = `<i class="fas fa-play"></i>`;
          
          // Just update the display without starting timer
          updateStopwatchDisplay(stopwatch);
        }
      }
    });
  });
  
  // Restore blockquote content
  const blockquote = document.querySelector('.beliefs');
  const savedBlockquoteText = localStorage.getItem('blockquote');
  if (blockquote && savedBlockquoteText) {
    blockquote.innerText = savedBlockquoteText;
  }
}

// Add drag and drop handlers for subtasks
function addDragAndDropHandlers(item) {
  item.addEventListener('dragstart', () => {
    item.classList.add('dragging');
  });
  
  item.addEventListener('dragend', () => {
    item.classList.remove('dragging');
    saveToLocalStorage();
  });
  
  item.addEventListener('dragover', (e) => {
    e.preventDefault();
    const draggingItem = document.querySelector('.dragging');
    if (!draggingItem) return;
    
    const subtaskList = item.parentElement;
    const siblings = [...subtaskList.querySelectorAll('.subtask:not(.dragging)')];
    
    let nextSibling = siblings.find(sibling => {
      return e.clientY < sibling.getBoundingClientRect().top + sibling.offsetHeight / 2;
    });
    
    if (nextSibling) {
      subtaskList.insertBefore(draggingItem, nextSibling);
    } else {
      subtaskList.appendChild(draggingItem);
    }
  });
}

// Clear all tasks
function clearAllTasks() {
  // Confirm before clearing
  if (!confirm('Are you sure you want to clear all tasks? Time logs will be preserved.')) {
    return;
  }
  
  // Clear any running timers
  document.querySelectorAll('.stopwatch, .task-stopwatch').forEach(sw => {
    if (sw.dataset.timer) {
      clearInterval(sw.dataset.timer);
    }
  });
  
  // Hide floating timer
  hideFloatingTimer();
  activeStopwatch = null;
  
  // Clear the task list with animation
  const tasks = document.querySelectorAll('.task');
  const subtaskContainers = document.querySelectorAll('.subtask-container');
  
  // Animate all tasks and containers
  tasks.forEach(task => {
    task.style.opacity = '0';
    task.style.transform = 'translateY(20px)';
  });
  
  subtaskContainers.forEach(container => {
    container.style.opacity = '0';
  });

  // Remove only task-related localStorage entries
  localStorage.removeItem("tasks");       // or "taskData" if that’s what you use
  localStorage.removeItem("subtasks");    // if applicable
  localStorage.removeItem("activeTask");  // optional if you track this
}

//-------------------------------------------------------
// Add event listeners to detect page unload/refresh
document.addEventListener('DOMContentLoaded', function() {
  // Flag to track if page is being unloaded
  window.isPageUnloading = false;
  
  // Set flag when page is being unloaded or refreshed
  window.addEventListener('beforeunload', function() {
    window.isPageUnloading = true;
    
    // Stop all running timers before the page unloads
    document.querySelectorAll('.stopwatch[data-running="true"], .task-stopwatch[data-running="true"]').forEach(sw => {
      if (sw.dataset.timer) {
        clearInterval(sw.dataset.timer);
      }
      sw.dataset.running = "false";
    });
    
    // Set activeStopwatch to null
    activeStopwatch = null;
    
    // Save the state with all timers marked as not running
    saveToLocalStorage();
  });
  
  // Also handle visibility change for browser tab switching
  document.addEventListener('visibilitychange', function() {
    if (document.visibilityState === 'hidden') {
      // If tab is being hidden, save state but keep timers running
      saveToLocalStorage();
    }
  });
});

