// Register the side panel
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error(error));

chrome.action.onClicked.addListener((tab) => {
  // Toggle the side panel when the extension icon is clicked
  chrome.sidePanel.open({ tabId: tab.id });
}); 