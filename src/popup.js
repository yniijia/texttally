// TextTally Popup Script

document.addEventListener('DOMContentLoaded', function() {
  // Check if there are any stored stats to display
  chrome.storage.local.get(['textStats'], function(result) {
    if (result.textStats) {
      // If there are stats, we could display them here
      // For now, we're just showing the instructions
    }
  });
  
  // Add animation to the features list
  const features = document.querySelectorAll('.features li');
  features.forEach((feature, index) => {
    feature.style.opacity = '0';
    feature.style.transform = 'translateY(10px)';
    feature.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
    
    setTimeout(() => {
      feature.style.opacity = '1';
      feature.style.transform = 'translateY(0)';
    }, 100 + (index * 100));
  });
}); 