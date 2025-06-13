document.addEventListener('DOMContentLoaded', () => {
  const uploadForm = document.getElementById('upload-form');
  const videoInput = document.getElementById('video-input');
  const fileName = document.getElementById('file-name');
  const progressContainer = document.getElementById('progress-container');
  const progressBarFill = document.getElementById('progress-bar-fill');
  const progressText = document.getElementById('progress-text');
  const resultContainer = document.getElementById('result-container');
  const resultVideo = document.getElementById('result-video');
  const downloadLink = document.getElementById('download-link');
  const processAnother = document.getElementById('process-another');
  const errorContainer = document.getElementById('error-container');
  const errorText = document.getElementById('error-text');
  const tryAgain = document.getElementById('try-again');
  
  // Clear any stored interval on page load
  if (window.progressInterval) {
    clearInterval(window.progressInterval);
  }
  
  // Display selected file name
  videoInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      const file = e.target.files[0];
      // Validate file size client-side too
      if (file.size > 500 * 1024 * 1024) {
        showError('File is too large. Maximum size is 500MB.');
        videoInput.value = '';
        fileName.textContent = 'No file chosen';
        return;
      }
      fileName.textContent = file.name;
    } else {
      fileName.textContent = 'No file chosen';
    }
  });
  
  // Handle form submission
  uploadForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    if (!videoInput.files.length) {
      showError('Please select a video file first.');
      return;
    }
    
    const file = videoInput.files[0];
    if (!file.type.startsWith('video/')) {
      showError('Please select a valid video file.');
      return;
    }
    
    // Create FormData object to send the file
    const formData = new FormData();
    formData.append('video', file);
    
    // Show progress indicator
    uploadForm.classList.add('hidden');
    progressContainer.classList.remove('hidden');
    
    // Clear any existing progress simulation
    if (window.progressInterval) {
      clearInterval(window.progressInterval);
    }
    
    simulateProgress();
    
    try {
      const response = await fetch('/api/process-video', {
        method: 'POST',
        body: formData
      });
      
      // Clear progress interval when response received
      if (window.progressInterval) {
        clearInterval(window.progressInterval);
        window.progressInterval = null;
      }
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to process video');
      }
      
      const data = await response.json();
      
      // Validate URL format before using (prevent XSS)
      if (!/^\/processed\/fixed-[\w-]+-[^/]+$/.test(data.videoUrl)) {
        throw new Error('Invalid video URL received from server');
      }
      
      // Show the processed video
      progressContainer.classList.add('hidden');
      resultContainer.classList.remove('hidden');
      
      resultVideo.src = data.videoUrl;
      downloadLink.href = data.videoUrl;
      
    } catch (error) {
      progressContainer.classList.add('hidden');
      showError(error.message || 'An error occurred during processing.');
    }
  });
  
  // Process another video button
  processAnother.addEventListener('click', () => {
    resetForm();
  });
  
  // Try again button
  tryAgain.addEventListener('click', () => {
    resetForm();
  });
  
  // Show error message
  function showError(message) {
    errorText.textContent = message;
    errorContainer.classList.remove('hidden');
  }
  
  // Reset the form to initial state
  function resetForm() {
    if (window.progressInterval) {
      clearInterval(window.progressInterval);
      window.progressInterval = null;
    }
    
    uploadForm.classList.remove('hidden');
    resultContainer.classList.add('hidden');
    errorContainer.classList.add('hidden');
    progressContainer.classList.add('hidden');
    videoInput.value = '';
    fileName.textContent = 'No file chosen';
    progressBarFill.style.width = '0%';
    progressText.textContent = 'Processing: 0%';
    
    // Clear video source to prevent memory leaks
    resultVideo.src = '';
  }
  
  // Simulate progress since we can't get real-time progress from the server easily
  function simulateProgress() {
    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.random() * 5;
      if (progress > 95) {
        progress = 95; // Cap at 95% until actual completion
        clearInterval(interval);
      }
      progressBarFill.style.width = `${progress}%`;
      progressText.textContent = `Processing: ${Math.floor(progress)}%`;
    }, 500);
    
    // Store interval ID in window object so we can clear it if needed
    window.progressInterval = interval;
  }
});
