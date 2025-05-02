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
                
                // If content script didn't respond, inject it and try again
                console.log('Content script did not respond, injecting and retrying...');
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
  console.log("Injecting CSS...");
  chrome.scripting.insertCSS({
    target: { tabId: tab.id },
    files: ["styles/content.css"]
  }).then(() => {
    console.log("CSS injected successfully");
    
    // Then inject the content script
    console.log("Injecting content script...");
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["src/content.js"]
    }).then(() => {
      console.log("Content script injected successfully");
      
      // Wait a moment for the script to initialize
      console.log("Waiting for script initialization...");
      setTimeout(() => {
        // Retry sending the message
        console.log("Retrying message send...");
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
              
              // Try one more approach - inject directly
              console.log("Trying direct script injection...");
              chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: (text, coords) => {
                  console.log("Executing direct analysis in page context");
                  // This function runs in the page context
                  if (typeof analyzeText !== 'function') {
                    console.error("analyzeText function not found in page context");
                    alert("TextTally: Unable to analyze text on this page due to security restrictions.");
                    return;
                  }
                  
                  const stats = analyzeText(text);
                  showResultsPopup(stats, text, window.location.href, coords.clickX, coords.clickY);
                },
                args: [selectedText, clickCoords]
              }).catch(err => {
                console.error("Direct injection failed:", err);
                alert("TextTally: Unable to analyze text on this page. Please try a different page.");
              });
            } else if (response && response.success) {
              console.log("Retry successful!");
            } else {
              console.error("Retry failed with response:", response);
            }
          }
        );
      }, 500); // Increased timeout for better reliability
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
  
  // Handle export requests from content script
  if (request.action === "exportFile") {
    const { content, filename, type } = request.data;
    
    // Extract source URL from content if available
    let sourceUrl = "";
    if (type === "text/plain") {
      const sourceMatch = content.match(/Source: (.*?)(\r?\n|\r)/);
      if (sourceMatch && sourceMatch[1]) {
        sourceUrl = sourceMatch[1];
      }
    } else if (type === "text/csv") {
      const sourceMatch = content.match(/Metadata,Source,"(.*?)"/);
      if (sourceMatch && sourceMatch[1]) {
        sourceUrl = sourceMatch[1];
      }
    } else if (type === "application/json") {
      try {
        const jsonData = JSON.parse(content);
        if (jsonData.metadata && jsonData.metadata.source) {
          sourceUrl = jsonData.metadata.source;
        }
      } catch (e) {
        console.error("Error parsing JSON:", e);
      }
    }
    
    // Create a data URL for the content
    const dataUrl = `data:${type};charset=utf-8,${encodeURIComponent(content)}`;
    
    // Create a tab with the data URL
    chrome.tabs.create({
      url: dataUrl,
      active: true
    }, (tab) => {
      // Execute script to trigger download in the new tab
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: (filename, sourceUrl) => {
          // Create a download link and click it
          const a = document.createElement('a');
          a.download = filename;
          a.href = window.location.href;
          a.click();
          
          // Show a message
          document.body.innerHTML = `
            <html>
            <head>
              <title>TextTally Export</title>
              <style>
                body {
                  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                  display: flex;
                  flex-direction: column;
                  align-items: center;
                  justify-content: center;
                  height: 100vh;
                  margin: 0;
                  background-color: #f8f9fa;
                  color: #333;
                }
                .container {
                  text-align: center;
                  padding: 2rem;
                  background-color: white;
                  border-radius: 12px;
                  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
                  max-width: 500px;
                }
                h1 {
                  color: #00CEC9;
                  margin-top: 0;
                }
                p {
                  line-height: 1.6;
                }
                .source {
                  font-size: 0.9rem;
                  color: #666;
                  margin-top: 1rem;
                  word-break: break-all;
                }
                .icon {
                  font-size: 48px;
                  margin-bottom: 1rem;
                }
                .close-btn {
                  margin-top: 1.5rem;
                  padding: 0.5rem 1.5rem;
                  background-color: #00CEC9;
                  color: white;
                  border: none;
                  border-radius: 4px;
                  cursor: pointer;
                  font-size: 1rem;
                  transition: background-color 0.2s;
                }
                .close-btn:hover {
                  background-color: #00A8A3;
                }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="icon">✅</div>
                <h1>Download Complete</h1>
                <p>Your TextTally analysis has been exported successfully.</p>
                <p>The file <strong>${filename}</strong> should have started downloading automatically.</p>
                ${sourceUrl ? `<p class="source">Source: ${sourceUrl}</p>` : ''}
                <button class="close-btn" onclick="window.close()">Close This Tab</button>
              </div>
            </body>
            </html>
          `;
        },
        args: [filename, sourceUrl]
      });
    });
    
    sendResponse({ success: true });
    return true;
  }
}); 