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
  const words = text.trim().split(/\s+/).filter(word => word.length > 0);
  const wordCount = words.length;
  const charCountWithSpaces = text.length;
  const charCountWithoutSpaces = text.replace(/\s+/g, '').length;
  const readingTimeMinutes = Math.max(1, Math.round((wordCount / 200) * 10) / 10);
  
  // Sentences
  const sentences = text.split(/[.!?]+/).filter(sentence => sentence.trim().length > 0);
  const sentenceCount = sentences.length;
  
  // Find long sentences (more than 25 words)
  const longSentences = sentences
    .map(sentence => {
      const wordCount = sentence.trim().split(/\s+/).filter(word => word.length > 0).length;
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
  const words = text.toLowerCase().split(/\s+/);
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
    const cleanWord = word.toLowerCase().replace(/[^\w]/g, '');
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
 * Generates exportable content in different formats
 * @param {Object} stats - Text statistics
 * @param {string} originalText - The original analyzed text
 * @param {string} sourceUrl - The URL where the text was analyzed
 * @param {string} format - Export format ('txt', 'csv', or 'json')
 * @returns {string} Formatted content for export
 */
function generateExportContent(stats, originalText, sourceUrl, format) {
  const date = new Date().toLocaleString();
  
  switch (format) {
    case 'txt':
      return `TextTally Analysis Results
Generated: ${date}
Source: ${sourceUrl}

ANALYZED TEXT:
${originalText.substring(0, 150)}${originalText.length > 150 ? '...' : ''}

BASIC COUNTS:
Words: ${stats.wordCount}
Characters (no spaces): ${stats.charCountWithoutSpaces}
Characters (with spaces): ${stats.charCountWithSpaces}
Reading Time: ${stats.readingTimeMinutes} minutes
Sentences: ${stats.sentenceCount}

READABILITY:
Score: ${stats.readabilityScore}
Grade Level: ${stats.gradeLevel}

KEYWORDS:
${stats.keywordCloud.map(k => `${k.word} (${k.count})`).join(', ')}

LONG SENTENCES:
${stats.longSentences.length > 0 
  ? stats.longSentences.map(s => `- "${s.text.substring(0, 100)}..." (${s.wordCount} words)`).join('\n')
  : 'None detected'}

Generated by TextTally - Count smarter, write better.`;

    case 'csv':
      // Basic stats as CSV
      let csv = 'Category,Metric,Value\n';
      csv += `Metadata,Generated,${date}\n`;
      csv += `Metadata,Source,"${sourceUrl}"\n`;
      csv += `Basic,Words,${stats.wordCount}\n`;
      csv += `Basic,Characters (no spaces),${stats.charCountWithoutSpaces}\n`;
      csv += `Basic,Characters (with spaces),${stats.charCountWithSpaces}\n`;
      csv += `Basic,Reading Time (minutes),${stats.readingTimeMinutes}\n`;
      csv += `Basic,Sentences,${stats.sentenceCount}\n`;
      csv += `Readability,Score,${stats.readabilityScore}\n`;
      csv += `Readability,Grade Level,"${stats.gradeLevel}"\n`;
      
      // Keywords
      stats.keywordCloud.forEach((keyword, index) => {
        csv += `Keyword,${keyword.word},${keyword.count}\n`;
      });
      
      // Long sentences
      stats.longSentences.forEach((sentence, index) => {
        csv += `Long Sentence,${index + 1},"${sentence.text.replace(/"/g, '""').substring(0, 100)}..."\n`;
      });
      
      return csv;

    case 'json':
      const exportData = {
        metadata: {
          generatedAt: date,
          source: sourceUrl,
          textSample: originalText.substring(0, 150) + (originalText.length > 150 ? '...' : '')
        },
        statistics: {
          basic: {
            wordCount: stats.wordCount,
            charCountWithSpaces: stats.charCountWithSpaces,
            charCountWithoutSpaces: stats.charCountWithoutSpaces,
            readingTimeMinutes: stats.readingTimeMinutes,
            sentenceCount: stats.sentenceCount
          },
          readability: {
            score: stats.readabilityScore,
            gradeLevel: stats.gradeLevel
          },
          keywords: stats.keywordCloud,
          longSentences: stats.longSentences.map(s => ({
            excerpt: s.text.substring(0, 100) + '...',
            wordCount: s.wordCount
          }))
        }
      };
      
      return JSON.stringify(exportData, null, 2);
      
    default:
      return 'Unsupported format';
  }
}

/**
 * Shows the results popup with analysis
 * @param {Object} stats - The text statistics
 * @param {string} originalText - The original analyzed text
 * @param {string} sourceUrl - The URL of the source page
 * @param {number} clickX - The X coordinate of the click (optional)
 * @param {number} clickY - The Y coordinate of the click (optional)
 */
function showResultsPopup(stats, originalText, sourceUrl, clickX, clickY) {
  // Remove any existing popups
  const existingPopup = document.querySelector('.text-tally-popup');
  
  if (existingPopup) {
    existingPopup.remove();
  }
  
  // Create popup container
  const popup = document.createElement('div');
  popup.className = 'text-tally-popup';
  popup.setAttribute('role', 'dialog');
  popup.setAttribute('aria-labelledby', 'text-tally-title');
  
  // Create popup content
  const header = document.createElement('div');
  header.className = 'text-tally-header';
  
  // Use a more reliable method to get the extension URL
  const iconUrl = chrome.runtime.getURL('assets/buzz.png');
  
  header.innerHTML = `
    <div class="text-tally-title-container">
      <img src="${iconUrl}" alt="TextTally" class="text-tally-logo">
      <h2 id="text-tally-title">Text Analysis</h2>
    </div>
    <button class="text-tally-close-btn" aria-label="Close analysis popup">×</button>
  `;
  
  // Add a tooltip to the header to indicate it can be used to drag
  header.title = "Drag to move";
  
  const content = document.createElement('div');
  content.className = 'text-tally-content';
  
  // Source section
  if (sourceUrl) {
    const sourceSection = document.createElement('div');
    sourceSection.className = 'text-tally-section text-tally-source-section';
    
    // Format the URL for display (truncate if too long)
    let displayUrl = sourceUrl;
    if (displayUrl.length > 40) {
      displayUrl = displayUrl.substring(0, 37) + '...';
    }
    
    sourceSection.innerHTML = `
      <div class="text-tally-source">
        <span class="text-tally-source-label">Source:</span>
        <a href="${sourceUrl}" class="text-tally-source-url" target="_blank" rel="noopener noreferrer">${displayUrl}</a>
      </div>
    `;
    content.appendChild(sourceSection);
  }
  
  // Basic statistics section
  const statsSection = document.createElement('div');
  statsSection.className = 'text-tally-section';
  
  statsSection.innerHTML = `
    <h3>Statistics</h3>
    <div class="text-tally-stats-grid">
      <div class="text-tally-stat">
        <div class="text-tally-stat-value">${stats.wordCount.toLocaleString()}</div>
        <div class="text-tally-stat-label">Words</div>
      </div>
      <div class="text-tally-stat">
        <div class="text-tally-stat-value">${stats.charCountWithSpaces.toLocaleString()}</div>
        <div class="text-tally-stat-label">Characters</div>
      </div>
      <div class="text-tally-stat">
        <div class="text-tally-stat-value">${stats.sentenceCount.toLocaleString()}</div>
        <div class="text-tally-stat-label">Sentences</div>
      </div>
      <div class="text-tally-stat">
        <div class="text-tally-stat-value">${stats.readingTimeMinutes.toLocaleString()}</div>
        <div class="text-tally-stat-label">Reading Time (min)</div>
      </div>
    </div>
  `;
  content.appendChild(statsSection);
  
  // Readability section
  const readabilitySection = document.createElement('div');
  readabilitySection.className = 'text-tally-section';
  
  // Calculate percentage for progress bar (0-100)
  const readabilityScore = Math.min(100, Math.max(0, stats.readabilityScore));
  const readabilityPercentage = readabilityScore;
  
  // Determine readability level description
  let readabilityLevel = '';
  
  if (readabilityScore >= 80) {
    readabilityLevel = 'Very Easy';
  } else if (readabilityScore >= 60) {
    readabilityLevel = 'Easy';
  } else if (readabilityScore >= 40) {
    readabilityLevel = 'Moderate';
  } else if (readabilityScore >= 20) {
    readabilityLevel = 'Difficult';
  } else {
    readabilityLevel = 'Very Difficult';
  }
  
  readabilitySection.innerHTML = `
    <h3>Readability</h3>
    <div class="text-tally-readability">
      <div style="display: flex; justify-content: space-between; margin-bottom: 4px; background: none;">
        <span style="font-size: 14px; color: #3c4043; background: none;">Flesch Reading Ease</span>
        <span style="font-size: 14px; font-weight: 600; color: #202124; background: none;">${readabilityScore.toFixed(1)}/100</span>
      </div>
      
      <div class="text-tally-progress-container">
        <div class="text-tally-progress-bar" style="width: ${readabilityPercentage}%"></div>
      </div>
      
      <div class="text-tally-difficulty-scale">
        <span>Difficult</span>
        <span>Easy</span>
      </div>
      
      <div class="text-tally-readability-label">
        <span style="color: #5f6368; background: none;">Current Level:</span>
        <span style="font-weight: 500; color: #202124; background: none;">${readabilityLevel}</span>
      </div>
      
      <div class="text-tally-readability-label" style="margin-top: 4px; background: none;">
        <span style="color: #5f6368; background: none;">Grade Level:</span>
        <span style="font-weight: 500; color: #202124; background: none;">${stats.gradeLevel}</span>
      </div>
    </div>
  `;
  content.appendChild(readabilitySection);
  
  // Long sentences warning section
  if (stats.longSentences && stats.longSentences.length > 0) {
    const warningsSection = document.createElement('div');
    warningsSection.className = 'text-tally-section';
    
    let warningsHTML = `<h3>Readability Warnings</h3><div class="text-tally-warnings">`;
    
    stats.longSentences.forEach((sentence, index) => {
      // Truncate very long sentences to prevent overflow
      const displayText = sentence.text.length > 100 ? 
        sentence.text.substring(0, 97) + '...' : 
        sentence.text;
        
      warningsHTML += `
        <div class="text-tally-warning">
          <div class="text-tally-warning-icon">⚠️</div>
          <div class="text-tally-warning-text">
            <div style="margin-bottom: 4px; font-weight: 500; color: #202124;">Long sentence ${index + 1}</div>
            <div style="color: #3c4043;">"${displayText}" (${sentence.wordCount} words)</div>
          </div>
        </div>
      `;
    });
    
    warningsHTML += `</div>`;
    warningsSection.innerHTML = warningsHTML;
    content.appendChild(warningsSection);
  }
  
  // Keyword cloud section
  if (stats.keywordCloud && stats.keywordCloud.length > 0) {
    const keywordSection = document.createElement('div');
    keywordSection.className = 'text-tally-section';
    
    let keywordHTML = `<h3>Top Keywords</h3><div class="text-tally-keyword-cloud">`;
    
    // Colors for keyword bubbles - using Google's colors
    const colors = ['#4285F4', '#EA4335', '#34A853', '#FBBC05'];
    
    // Show top keywords
    stats.keywordCloud.slice(0, 3).forEach((keyword, index) => {
      // Ensure the word is not too long by truncating if necessary
      const displayWord = keyword.word.length > 15 ? 
        keyword.word.substring(0, 12) + '...' : 
        keyword.word;
        
      keywordHTML += `
        <div class="text-tally-keyword" style="background-color: ${colors[index % colors.length]};">
          ${displayWord} <span class="text-tally-keyword-count">${keyword.count}</span>
        </div>
      `;
    });
    
    keywordHTML += `</div>`;
    keywordSection.innerHTML = keywordHTML;
    content.appendChild(keywordSection);
  }
  
  // Export section
  const exportSection = document.createElement('div');
  exportSection.className = 'text-tally-section text-tally-export-section';
  exportSection.innerHTML = `
    <h3>Export</h3>
    <div class="text-tally-export-buttons">
      <button class="text-tally-export-btn" data-format="txt">
        <span class="text-tally-export-icon">📄</span>
        <span class="text-tally-export-label">Text</span>
      </button>
      <button class="text-tally-export-btn" data-format="csv">
        <span class="text-tally-export-icon">📊</span>
        <span class="text-tally-export-label">CSV</span>
      </button>
      <button class="text-tally-export-btn" data-format="json">
        <span class="text-tally-export-icon">{ }</span>
        <span class="text-tally-export-label">JSON</span>
      </button>
      <button class="text-tally-export-btn" data-format="clipboard">
        <span class="text-tally-export-icon">📋</span>
        <span class="text-tally-export-label">Copy</span>
      </button>
    </div>
  `;
  
  popup.appendChild(header);
  popup.appendChild(content);
  content.appendChild(exportSection);
  
  // Add a resize handle
  const resizeHandle = document.createElement('div');
  resizeHandle.className = 'text-tally-resize-handle';
  popup.appendChild(resizeHandle);
  
  // Append to body
  document.body.appendChild(popup);
  
  // Set position based on click coordinates if available
  if (clickX !== undefined && clickY !== undefined) {
    positionPopupAtClick(popup, clickX, clickY);
  } else {
    // Fallback to default position in top-right corner
    positionPopup(popup);
  }
  
  // Make popup draggable
  makeDraggable(popup, header);
  
  // Add event listeners
  setupPopupEventListeners(popup, stats, originalText, sourceUrl);
  
  // Add animation class after a small delay to trigger animation
  setTimeout(() => {
    popup.classList.add('text-tally-popup-visible');
    
    // After animation completes, ensure the popup is properly positioned for dragging
    setTimeout(() => {
      const rect = popup.getBoundingClientRect();
      
      // Force position to be fixed and ensure we have explicit top/left values
      popup.style.position = 'fixed';
      
      if (!popup.style.top || popup.style.top === 'auto') {
        popup.style.top = rect.top + 'px';
      }
      
      if (!popup.style.left || popup.style.left === 'auto') {
        popup.style.left = rect.left + 'px';
      }
      
      // Clear right positioning to avoid conflicts with left
      popup.style.right = 'auto';
      
      // Remove transform to avoid interference with dragging
      popup.style.transform = 'none';
      
      console.log('Popup positioned for dragging:', popup.style.top, popup.style.left);
    }, 300); // Match the CSS transition duration
  }, 10);
}

/**
 * Makes an element draggable
 * @param {HTMLElement} element - The element to make draggable
 * @param {HTMLElement} handle - The drag handle element
 */
function makeDraggable(element, handle) {
  let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
  
  console.log('Making element draggable', element);
  
  // Ensure the element has a valid initial position
  if (!element.style.top || !element.style.left) {
    const rect = element.getBoundingClientRect();
    element.style.top = rect.top + 'px';
    element.style.left = rect.left + 'px';
    console.log('Set initial position:', element.style.top, element.style.left);
  }
  
  // Force position to be fixed
  element.style.position = 'fixed';
  
  if (handle) {
    // If handle is specified, make only the handle trigger dragging
    handle.onmousedown = dragMouseDown;
    handle.style.cursor = 'move';
    console.log('Using handle for drag:', handle);
  } else {
    // Otherwise, make the whole element draggable
    element.onmousedown = dragMouseDown;
    element.style.cursor = 'move';
  }
  
  function dragMouseDown(e) {
    // Only handle left mouse button for dragging
    if (e.button !== 0) return;
    
    e = e || window.event;
    e.preventDefault();
    e.stopPropagation();
    
    console.log('Drag started at:', e.clientX, e.clientY);
    
    // Get the mouse cursor position at startup
    pos3 = e.clientX;
    pos4 = e.clientY;
    
    // Add dragging class
    element.classList.add('draggable');
    
    // Call functions on mouse move and mouse up
    document.onmousemove = elementDrag;
    document.onmouseup = closeDragElement;
  }
  
  function elementDrag(e) {
    e = e || window.event;
    e.preventDefault();
    
    // Calculate the new cursor position
    pos1 = pos3 - e.clientX;
    pos2 = pos4 - e.clientY;
    pos3 = e.clientX;
    pos4 = e.clientY;
    
    // Get current position from styles
    const currentTop = parseInt(element.style.top) || 0;
    const currentLeft = parseInt(element.style.left) || 0;
    
    // Calculate new position
    const newTop = currentTop - pos2;
    const newLeft = currentLeft - pos1;
    
    console.log('Dragging to:', newLeft, newTop);
    
    // Set the element's new position
    element.style.top = newTop + "px";
    element.style.left = newLeft + "px";
    
    // Remove the transform that was initially applied
    element.style.transform = 'none';
    // Ensure right positioning is cleared
    element.style.right = 'auto';
  }
  
  function closeDragElement() {
    console.log('Drag ended, final position:', element.style.left, element.style.top);
    
    // Stop moving when mouse button is released
    document.onmouseup = null;
    document.onmousemove = null;
    
    // Remove dragging class
    element.classList.remove('draggable');
  }
}

/**
 * Sets up event listeners for the popup
 * @param {HTMLElement} popup - The popup element
 * @param {Object} stats - The text statistics
 * @param {string} originalText - The original analyzed text
 * @param {string} sourceUrl - The URL of the source page
 */
function setupPopupEventListeners(popup, stats, originalText, sourceUrl) {
  // Close button
  const closeBtn = popup.querySelector('.text-tally-close-btn');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      closePopup(popup);
    });
  }
  
  // Export buttons
  const exportButtons = popup.querySelectorAll('.text-tally-export-btn');
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
  
  // Close when clicking outside the popup
  document.addEventListener('mousedown', function clickOutsideHandler(e) {
    if (!popup.contains(e.target)) {
      closePopup(popup);
      document.removeEventListener('mousedown', clickOutsideHandler);
    }
  });
  
  // Close when scrolling the page
  window.addEventListener('scroll', function scrollHandler() {
    closePopup(popup);
    window.removeEventListener('scroll', scrollHandler);
  }, { passive: true });
  
  // Prevent closing when clicking inside the popup
  popup.addEventListener('mousedown', (e) => {
    e.stopPropagation();
  });
}

/**
 * Closes the popup with animation
 * @param {HTMLElement} popup - The popup element
 */
function closePopup(popup) {
  popup.classList.remove('text-tally-popup-visible');
  
  setTimeout(() => {
    popup.remove();
  }, 300); // Match the CSS transition duration
}

/**
 * Positions the popup in the default position (top-right corner)
 * @param {HTMLElement} popup - The popup element
 */
function positionPopup(popup) {
  console.log('Positioning popup in default position');
  
  // Initial position in the top right corner
  popup.style.position = 'fixed';
  popup.style.top = '20px';
  popup.style.right = '20px';
  popup.style.left = 'auto'; // Let the browser calculate this based on right
  popup.style.zIndex = '2147483647'; // Highest possible z-index
  
  // After a brief delay, convert right positioning to left for dragging
  setTimeout(() => {
    const rect = popup.getBoundingClientRect();
    popup.style.left = rect.left + 'px';
    popup.style.right = 'auto';
    console.log('Converted right position to left:', popup.style.left);
  }, 50);
}

/**
 * Positions the popup near the click position
 * @param {HTMLElement} popup - The popup element
 * @param {number} clickX - The X coordinate of the click
 * @param {number} clickY - The Y coordinate of the click
 */
function positionPopupAtClick(popup, clickX, clickY) {
  console.log('Positioning popup at click:', clickX, clickY);
  
  // Get viewport dimensions
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  
  // Get popup dimensions
  const popupWidth = 350; // Default width
  const popupHeight = 400; // Estimated height
  
  // Add a small offset from the cursor position for better UX
  const offsetX = 10;
  const offsetY = 10;
  
  // Calculate position to ensure popup stays within viewport
  // Try to position the popup to the right and below the click point first
  let left = clickX + offsetX;
  let top = clickY + offsetY;
  
  // If popup would go off-screen to the right, position it to the left of the click
  if (left + popupWidth > viewportWidth - 20) {
    left = Math.max(20, clickX - popupWidth - offsetX);
  }
  
  // If popup would go off-screen at the bottom, position it above the click
  if (top + popupHeight > viewportHeight - 20) {
    top = Math.max(20, clickY - popupHeight - offsetY);
  }
  
  // If we're still out of bounds (small viewport), center it
  if (left < 20 || left + popupWidth > viewportWidth - 20) {
    left = Math.max(20, (viewportWidth - popupWidth) / 2);
  }
  
  if (top < 20 || top + popupHeight > viewportHeight - 20) {
    top = Math.max(20, (viewportHeight - popupHeight) / 2);
  }
  
  console.log('Calculated position:', left, top);
  
  // Set the position
  popup.style.position = 'fixed';
  popup.style.left = left + 'px';
  popup.style.top = top + 'px';
  popup.style.right = 'auto'; // Clear any right positioning
  popup.style.transform = 'scale(0.95)'; // Keep the initial scale for animation
  popup.style.zIndex = '2147483647'; // Highest possible z-index
  
  // Store initial position as data attributes for dragging reference
  popup.dataset.initialLeft = left;
  popup.dataset.initialTop = top;
}

/**
 * Handles exporting analysis in different formats
 * @param {string} format - The export format (txt, csv, json, clipboard)
 * @param {Object} stats - The text statistics
 * @param {string} originalText - The original analyzed text
 * @param {string} sourceUrl - The URL of the source page
 */
function handleExport(format, stats, originalText, sourceUrl) {
  if (format === 'clipboard') {
    // Copy text format to clipboard
    const textContent = generateExportContent(stats, originalText, sourceUrl, 'txt');
    navigator.clipboard.writeText(textContent)
      .then(() => {
        showExportNotification('Results copied to clipboard!');
      })
      .catch(err => {
        console.error('Failed to copy: ', err);
        showExportNotification('Failed to copy to clipboard', true);
      });
  } else {
    // Generate content based on format
    const content = generateExportContent(stats, originalText, sourceUrl, format);
    const contentType = getContentType(format);
    const filename = `texttally-analysis.${format}`;
    
    // Send to background script for handling the download
    chrome.runtime.sendMessage({
      action: "exportFile",
      data: {
        content: content,
        filename: filename,
        type: contentType
      }
    }, response => {
      if (response && response.success) {
        showExportNotification(`Exporting as ${format.toUpperCase()}...`);
      } else {
        showExportNotification('Export failed', true);
      }
    });
  }
}

/**
 * Gets the content type for the export format
 * @param {string} format - Export format
 * @returns {string} Content type
 */
function getContentType(format) {
  switch (format) {
    case 'txt': return 'text/plain';
    case 'csv': return 'text/csv';
    case 'json': return 'application/json';
    default: return 'text/plain';
  }
}

/**
 * Shows a notification for export actions
 * @param {string} message - The notification message
 * @param {boolean} isError - Whether this is an error notification
 */
function showExportNotification(message, isError = false) {
  // Remove any existing notifications
  const existingNotification = document.querySelector('.text-tally-notification');
  if (existingNotification) {
    existingNotification.remove();
  }
  
  // Create notification element
  const notification = document.createElement('div');
  notification.className = `text-tally-notification${isError ? ' error' : ''}`;
  
  // Add icon based on type
  const icon = isError ? '❌' : '✓';
  
  notification.innerHTML = `
    <span style="margin-right: 8px; font-size: 16px;">${icon}</span>
    <span>${message}</span>
  `;
  
  // Add to body
  document.body.appendChild(notification);
  
  // Show notification
  setTimeout(() => {
    notification.classList.add('visible');
  }, 10);
  
  // Hide after 3 seconds
  setTimeout(() => {
    notification.classList.remove('visible');
    
    // Remove from DOM after animation completes
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 300);
  }, 3000);
} 