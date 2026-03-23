const toggleBtn = document.getElementById("toggleBtn")!

toggleBtn.addEventListener("click", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (tab?.id) {
    chrome.tabs.sendMessage(tab.id, { type: "TOGGLE_SIDEBAR" })
    window.close()
  }
})
