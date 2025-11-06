/**
 * DevTools panel creation
 * This runs when DevTools opens and creates the PAN panel
 */

// Create the PAN Inspector panel
chrome.devtools.panels.create(
  'PAN',
  'icons/icon-16.png',
  'panel.html',
  function(panel) {
    console.log('PAN Inspector panel created');
  }
);
