// TextTally Background Script

// Create context menu item when the extension is installed
chrome.runtime.onInstalled.addListener(() => {
  console.log('TextTally extension installed, creating context menu item');
  
  try {
    chrome.contextMenus.create({
      id: "textTallyAnalyze",
      title: "Analyze with TextTally",
      contexts: ["selection"]
    });
    
    console.log("TextTally extension installed successfully");
  } catch (error) {
    console.error("Error creating context menu:", error);
  }
});

// Listen for context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
  console.log('Context menu clicked:', info.menuItemId);
  
  if (info.menuItemId === "textTallyAnalyze" && info.selectionText) {
    console.log('Selected text:', info.selectionText.substring(0, 50) + '...');
    
    // Check if we can access the tab
    if (tab && tab.id >= 0) {
      console.log('Processing in tab:', tab.id, tab.url);
      
      // Try to send the selected text to the content script for analysis
      try {
        // Get the click coordinates
        console.log('Getting click coordinates...');
        chrome.tabs.executeScript(tab.id, {
          code: `
            (function() {
              console.log('Executing coordinate script, last right click:', window.lastRightClickX, window.lastRightClickY);
              return {
                clickX: window.lastRightClickX || window.innerWidth / 2,
                clickY: window.lastRightClickY || window.innerHeight / 2
              };
            })();
          `
        }, (results) => {
          console.log('Click coordinate results:', results);
          const clickCoords = results && results[0] ? results[0] : { clickX: 0, clickY: 0 };
          console.log('Using coordinates:', clickCoords);
          
          console.log('Sending message to content script...');
          chrome.tabs.sendMessage(
            tab.id, 
            {
              action: "analyzeText",
              text: info.selectionText,
              clickX: clickCoords.clickX,
              clickY: clickCoords.clickY
            },
            (response) => {
              // Handle potential error with the content script
              if (chrome.runtime.lastError) {
                console.error("Error sending message to content script:", chrome.runtime.lastError);
                injectContentScriptAndRetry(tab, info.selectionText, clickCoords);
              } else if (response && response.success) {
                console.log("Analysis request received by content script");
              } else {
                console.error("Content script returned error:", response);
              }
            }
          );
        });
      } catch (error) {
        console.error("Error in context menu handler:", error);
        injectContentScriptAndRetry(tab, info.selectionText, { clickX: 0, clickY: 0 });
      }
    } else {
      console.error('Invalid tab:', tab);
    }
  }
});

/**
 * Injects the content script and retries the analysis
 * @param {Object} tab - The tab object
 * @param {string} selectedText - The selected text to analyze
 * @param {Object} clickCoords - The click coordinates
 */
function injectContentScriptAndRetry(tab, selectedText, clickCoords) {
  console.log("Injecting content script and retrying...", tab.id);
  
  // Inject CSS first
  chrome.scripting.insertCSS({
    target: { tabId: tab.id },
    files: ["styles/content.css"]
  }).then(() => {
    console.log("CSS injected successfully");
    
    // Then inject the content script
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["src/content.js"]
    }).then(() => {
      console.log("Content script injected successfully");
      
      // Wait a moment for the script to initialize
      setTimeout(() => {
        // Retry sending the message
        chrome.tabs.sendMessage(
          tab.id,
          {
            action: "analyzeText",
            text: selectedText,
            clickX: clickCoords.clickX,
            clickY: clickCoords.clickY
          },
          (response) => {
            if (chrome.runtime.lastError) {
              console.error("Still failed after injection:", chrome.runtime.lastError);
              // Show an error notification using the extension popup
              chrome.action.setPopup({ 
                popup: "src/error.html",
                tabId: tab.id 
              });
            } else if (response && response.success) {
              console.log("Retry successful!");
            } else {
              console.error("Retry failed with response:", response);
            }
          }
        );
      }, 500);
    }).catch(err => {
      console.error("Failed to inject content script:", err);
      alert("TextTally: Unable to analyze text on this page due to security restrictions.");
    });
  }).catch(err => {
    console.error("Failed to inject CSS:", err);
  });
}

// Listen for messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getStats") {
    // Store the stats in local storage for the popup
    chrome.storage.local.set({ textStats: request.stats }, () => {
      sendResponse({ success: true });
    });
    return true; // Required for async sendResponse
  }
  
  return false;
});