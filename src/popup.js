// TextTally Popup Script

document.addEventListener('DOMContentLoaded', function() {
  console.log('TextTally popup loaded');
  
  // Check if we have stats stored from text analysis
  chrome.storage.local.get(['textStats'], function(result) {
    if (result.textStats) {
      console.log('Found stored text stats:', result.textStats);
      // Could show stats in the popup if desired
    } else {
      console.log('No text stats found in storage');
      // This is the initial popup state where we show instructions
    }
  });
  
  // Add any popup interactivity here
  // For the basic implementation, this popup just shows instructions
  // Future versions could include settings or history
});