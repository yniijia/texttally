// TextTally Content Script

// Track mouse position on right-click
document.addEventListener('mousedown', function(e) {
  if (e.button === 2) { // Right mouse button
    window.lastRightClickX = e.clientX;
    window.lastRightClickY = e.clientY;
    console.log('Right-click position saved:', window.lastRightClickX, window.lastRightClickY);
  }
}, true);

// Listen for messages from the background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Content script received message:', request);
  
  if (request.action === "analyzeText" && request.text) {
    console.log('Analyzing text:', request.text.substring(0, 50) + '...');
    
    try {
      const stats = analyzeText(request.text);
      console.log('Analysis complete, stats:', stats);
      
      // Send stats to background script for storage
      chrome.runtime.sendMessage({
        action: "getStats",
        stats: stats
      });
      
      // Display the results in a popup
      showResultsPopup(stats, request.text, window.location.href, request.clickX, request.clickY);
      
      // Send response to confirm receipt
      sendResponse({success: true});
      console.log('Response sent to background script');
      return true;
    } catch (error) {
      console.error('Error analyzing text:', error);
      sendResponse({success: false, error: error.message});
      return true;
    }
  }
  return true; // Keep the message channel open for async responses
});

/**
 * Analyzes text and returns statistics
 * @param {string} text - The text to analyze
 * @returns {Object} Text statistics
 */
function analyzeText(text) {
  // Basic stats
  const words = text.trim().split(/\\s+/).filter(word => word.length > 0);
  const wordCount = words.length;
  const charCountWithSpaces = text.length;
  const charCountWithoutSpaces = text.replace(/\\s+/g, '').length;
  const readingTimeMinutes = Math.max(1, Math.round((wordCount / 200) * 10) / 10);
  
  // Sentences
  const sentences = text.split(/[.!?]+/).filter(sentence => sentence.trim().length > 0);
  const sentenceCount = sentences.length;
  
  // Find long sentences (more than 25 words)
  const longSentences = sentences
    .map(sentence => {
      const wordCount = sentence.trim().split(/\\s+/).filter(word => word.length > 0).length;
      return { text: sentence.trim(), wordCount };
    })
    .filter(sentence => sentence.wordCount > 25);
  
  // Calculate readability (Flesch-Kincaid)
  const avgWordsPerSentence = wordCount / Math.max(1, sentenceCount);
  const syllableCount = countSyllables(text);
  const avgSyllablesPerWord = syllableCount / Math.max(1, wordCount);
  const readabilityScore = 206.835 - (1.015 * avgWordsPerSentence) - (84.6 * avgSyllablesPerWord);
  
  // Get grade level from readability score
  const gradeLevel = getGradeLevel(readabilityScore);
  
  // Keyword analysis
  const keywordCloud = getKeywordCloud(words);
  
  return {
    wordCount,
    charCountWithSpaces,
    charCountWithoutSpaces,
    readingTimeMinutes,
    sentenceCount,
    longSentences,
    readabilityScore: Math.round(readabilityScore),
    gradeLevel,
    keywordCloud
  };
}

/**
 * Counts syllables in text (simplified algorithm)
 * @param {string} text - The text to analyze
 * @returns {number} Estimated syllable count
 */
function countSyllables(text) {
  // Simple syllable counting algorithm
  // This is a simplified version and not 100% accurate
  const words = text.toLowerCase().split(/\\s+/);
  let count = 0;
  
  for (const word of words) {
    if (word.length <= 3) {
      count += 1;
      continue;
    }
    
    // Count vowel groups as syllables
    let wordCount = word.replace(/(?:[^laeiouy]|ed|[^laeiouy]e)$/, '')
      .replace(/^y/, '')
      .match(/[aeiouy]{1,2}/g);
    
    count += wordCount ? wordCount.length : 1;
  }
  
  return count;
}

/**
 * Converts readability score to grade level
 * @param {number} score - Flesch-Kincaid readability score
 * @returns {string} Grade level description
 */
function getGradeLevel(score) {
  if (score >= 90) return "Grade 5 (Very Easy)";
  if (score >= 80) return "Grade 6 (Easy)";
  if (score >= 70) return "Grade 7 (Fairly Easy)";
  if (score >= 60) return "Grade 8-9 (Standard)";
  if (score >= 50) return "Grade 10-12 (Fairly Difficult)";
  if (score >= 30) return "College (Difficult)";
  return "College Graduate (Very Difficult)";
}

/**
 * Generates keyword cloud from words
 * @param {string[]} words - Array of words
 * @returns {Object[]} Top keywords with counts
 */
function getKeywordCloud(words) {
  // Common words to ignore (stop words)
  const stopWords = new Set([
    'the', 'and', 'a', 'an', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 
    'by', 'as', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 
    'has', 'had', 'do', 'does', 'did', 'but', 'or', 'if', 'then', 'else', 
    'when', 'up', 'down', 'this', 'that', 'these', 'those', 'it', 'its'
  ]);
  
  // Count word frequencies
  const wordCounts = {};
  words.forEach(word => {
    const cleanWord = word.toLowerCase().replace(/[^\\w]/g, '');
    if (cleanWord.length > 2 && !stopWords.has(cleanWord)) {
      wordCounts[cleanWord] = (wordCounts[cleanWord] || 0) + 1;
    }
  });
  
  // Convert to array and sort by frequency
  const sortedWords = Object.entries(wordCounts)
    .map(([word, count]) => ({ word, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5); // Get top 5 keywords
  
  return sortedWords;
}

/**
 * Shows a popup with the analysis results
 * @param {Object} stats - The text statistics
 * @param {string} originalText - The original text
 * @param {string} sourceUrl - The URL of the page
 * @param {number} clickX - The x-coordinate of the click
 * @param {number} clickY - The y-coordinate of the click
 */
function showResultsPopup(stats, originalText, sourceUrl, clickX, clickY) {
  // Remove any existing popup
  const existingPopup = document.getElementById('textTallyPopup');
  if (existingPopup) {
    existingPopup.remove();
  }
  
  // Create popup container
  const popup = document.createElement('div');
  popup.id = 'textTallyPopup';
  popup.className = 'texttally-popup';
  
  // Add popup content
  popup.innerHTML = `
    <div class="texttally-popup-header">
      <div class="texttally-popup-title">
        <img src="${chrome.runtime.getURL('assets/icon16.png')}" alt="TextTally Icon">
        <h2>TextTally Analysis</h2>
      </div>
      <button class="texttally-close-button">&times;</button>
    </div>
    
    <div class="texttally-popup-content">
      <div class="texttally-section texttally-basic-stats">
        <h3>Basic Counts</h3>
        <div class="texttally-stats-grid">
          <div class="texttally-stat-item">
            <div class="texttally-stat-value">${stats.wordCount}</div>
            <div class="texttally-stat-label">Words</div>
          </div>
          <div class="texttally-stat-item">
            <div class="texttally-stat-value">${stats.charCountWithoutSpaces}</div>
            <div class="texttally-stat-label">Characters (no spaces)</div>
          </div>
          <div class="texttally-stat-item">
            <div class="texttally-stat-value">${stats.charCountWithSpaces}</div>
            <div class="texttally-stat-label">Characters (with spaces)</div>
          </div>
          <div class="texttally-stat-item">
            <div class="texttally-stat-value">${stats.readingTimeMinutes} min</div>
            <div class="texttally-stat-label">Reading time</div>
          </div>
        </div>
      </div>
      
      <div class="texttally-section texttally-readability">
        <h3>Readability</h3>
        <div class="texttally-readability-score">
          <div class="texttally-score-label">Score: ${stats.readabilityScore}</div>
          <div class="texttally-score-grade">${stats.gradeLevel}</div>
          <div class="texttally-progress-container">
            <div class="texttally-progress-bar" style="width: ${Math.min(100, stats.readabilityScore)}%"></div>
          </div>
          <div class="texttally-scale-labels">
            <span>Difficult</span>
            <span>Easy</span>
          </div>
        </div>
      </div>
      
      ${stats.longSentences.length > 0 ? `
        <div class="texttally-section texttally-long-sentences">
          <h3>Long Sentence Alert</h3>
          <div class="texttally-long-sentence-message">
            <span class="texttally-alert-icon">⚠️</span>
            Found ${stats.longSentences.length} sentence${stats.longSentences.length > 1 ? 's' : ''} that may be too long (over 25 words).
          </div>
          <div class="texttally-long-sentence-example">
            <strong>Example:</strong> ${stats.longSentences[0].text.substring(0, 100)}${stats.longSentences[0].text.length > 100 ? '...' : ''}
          </div>
        </div>
      ` : ''}
      
      <div class="texttally-section texttally-keywords">
        <h3>Keyword Cloud</h3>
        <div class="texttally-keyword-cloud">
          ${stats.keywordCloud.map(kw => `
            <div class="texttally-keyword" style="font-size: ${100 + (kw.count * 20)}%;">
              ${kw.word} (${kw.count})
            </div>
          `).join('')}
        </div>
      </div>
      
      <div class="texttally-export-footer">
        <button class="texttally-export-button" data-format="txt">Export as TXT</button>
        <button class="texttally-export-button" data-format="csv">Export as CSV</button>
        <button class="texttally-export-button" data-format="json">Export as JSON</button>
      </div>
    </div>
  `;
  
  // Add to document
  document.body.appendChild(popup);
  
  // Position the popup at the click coordinates
  positionPopupAtClick(popup, clickX, clickY);
  
  // Make the popup draggable and add event listeners
  makeDraggable(popup, popup.querySelector('.texttally-popup-header'));
  setupPopupEventListeners(popup, stats, originalText, sourceUrl);
}

/**
 * Makes an element draggable
 * @param {HTMLElement} element - The element to make draggable
 * @param {HTMLElement} handle - The handle element for dragging
 */
function makeDraggable(element, handle) {
  let posX = 0, posY = 0, posX1 = 0, posY1 = 0;
  
  if (handle) {
    handle.style.cursor = 'move';
    handle.onmousedown = dragMouseDown;
  } else {
    element.onmousedown = dragMouseDown;
  }
  
  function dragMouseDown(e) {
    e.preventDefault();
    // Get the mouse cursor position
    posX1 = e.clientX;
    posY1 = e.clientY;
    document.onmouseup = closeDragElement;
    document.onmousemove = elementDrag;
  }
  
  function elementDrag(e) {
    e.preventDefault();
    // Calculate the new position
    posX = posX1 - e.clientX;
    posY = posY1 - e.clientY;
    posX1 = e.clientX;
    posY1 = e.clientY;
    // Set the element's new position
    element.style.top = (element.offsetTop - posY) + "px";
    element.style.left = (element.offsetLeft - posX) + "px";
  }
  
  function closeDragElement() {
    // Stop moving when mouse button is released
    document.onmouseup = null;
    document.onmousemove = null;
  }
}

/**
 * Sets up event listeners for the popup
 * @param {HTMLElement} popup - The popup element
 * @param {Object} stats - The text statistics
 * @param {string} originalText - The original text
 * @param {string} sourceUrl - The URL of the page
 */
function setupPopupEventListeners(popup, stats, originalText, sourceUrl) {
  // Close button
  const closeButton = popup.querySelector('.texttally-close-button');
  closeButton.addEventListener('click', () => closePopup(popup));
  
  // Export buttons
  const exportButtons = popup.querySelectorAll('.texttally-export-button');
  exportButtons.forEach(button => {
    button.addEventListener('click', () => {
      const format = button.getAttribute('data-format');
      handleExport(format, stats, originalText, sourceUrl);
    });
  });
  
  // Close on escape key
  document.addEventListener('keydown', function escapeHandler(e) {
    if (e.key === 'Escape') {
      closePopup(popup);
      document.removeEventListener('keydown', escapeHandler);
    }
  });
  
  // Close when clicking outside
  document.addEventListener('mousedown', function clickOutsideHandler(e) {
    if (!popup.contains(e.target) && e.target.id !== 'textTallyPopup') {
      closePopup(popup);
      document.removeEventListener('mousedown', clickOutsideHandler);
    }
  });
  
  // Reposition on scroll
  window.addEventListener('scroll', function scrollHandler() {
    positionPopup(popup);
  });
  
  // Reposition on resize
  window.addEventListener('resize', function resizeHandler() {
    positionPopup(popup);
  });
}

/**
 * Closes and removes the popup
 * @param {HTMLElement} popup - The popup element
 */
function closePopup(popup) {
  // Add a fade-out animation
  popup.style.opacity = '0';
  popup.style.transform = 'scale(0.95)';
  
  // Remove after animation completes
  setTimeout(() => {
    if (popup && popup.parentNode) {
      popup.parentNode.removeChild(popup);
    }
  }, 200);
}

/**
 * Positions the popup to keep it in view
 * @param {HTMLElement} popup - The popup element
 */
function positionPopup(popup) {
  const rect = popup.getBoundingClientRect();
  const windowWidth = window.innerWidth;
  const windowHeight = window.innerHeight;
  
  // Keep popup within horizontal bounds
  if (rect.right > windowWidth) {
    popup.style.left = Math.max(0, windowWidth - rect.width - 20) + 'px';
  } else if (rect.left < 0) {
    popup.style.left = '20px';
  }
  
  // Keep popup within vertical bounds
  if (rect.bottom > windowHeight) {
    popup.style.top = Math.max(0, windowHeight - rect.height - 20) + 'px';
  } else if (rect.top < 0) {
    popup.style.top = '20px';
  }
}

/**
 * Positions the popup near the click coordinates
 * @param {HTMLElement} popup - The popup element
 * @param {number} clickX - The x-coordinate of the click
 * @param {number} clickY - The y-coordinate of the click
 */
function positionPopupAtClick(popup, clickX, clickY) {
  // Default position in case coordinates are invalid
  let posX = window.innerWidth / 2 - popup.offsetWidth / 2;
  let posY = window.innerHeight / 2 - popup.offsetHeight / 2;
  
  // Use click coordinates if valid
  if (clickX && clickY) {
    // Position the popup slightly below and to the right of the click
    posX = clickX + 10;
    posY = clickY + 10;
    
    // Ensure the popup is fully visible
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;
    
    if (posX + popup.offsetWidth > windowWidth) {
      posX = windowWidth - popup.offsetWidth - 20;
    }
    
    if (posY + popup.offsetHeight > windowHeight) {
      posY = windowHeight - popup.offsetHeight - 20;
    }
  }
  
  // Set the popup position
  popup.style.left = Math.max(20, posX) + 'px';
  popup.style.top = Math.max(20, posY) + 'px';
  
  // Add entrance animation
  popup.style.opacity = '0';
  popup.style.transform = 'scale(0.95)';
  
  setTimeout(() => {
    popup.style.opacity = '1';
    popup.style.transform = 'scale(1)';
  }, 10);
}