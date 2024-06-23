// import { runtime, storage } from 'webextension-polyfill'
// import { getCurrentTab } from '../helpers/tabs'
let portFromContentScript: chrome.runtime.Port | null

chrome.runtime.onConnect.addListener((port) => {
  console.assert(port.name === "courseHover")
  portFromContentScript = port
  portFromContentScript.onDisconnect.addListener(() => {
    portFromContentScript = null
  })
})

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "HOVER" && portFromContentScript) {
    portFromContentScript.postMessage(message.course)
  }
})

// When user clicks on extension button
chrome.action.onClicked.addListener((tab) => {
  if (tab.id !== undefined) {
    chrome.tabs.sendMessage(tab.id, { toggleContainer: true })
  } else {
    console.error("Tab ID is undefined.")
  }
})

chrome.runtime.onInstalled.addListener(() => {
  ;(async () => {
    // Get existing cookies
    const cookiePromise = new Promise<string | undefined>((resolve) => {
      chrome.cookies.getAll({ url: "https://*.myworkday.com/*" }, (cookies) => {
        if (!cookies) {
          resolve(undefined)
          return
        }

        let cookieHeader = ""
        for (const cookie of cookies) {
          cookieHeader += `${cookie.name}=${cookie.value}; `
        }
        resolve(cookieHeader.trim())
      })
    })

    try {
      // Wait for the cookie promise to resolve
      const cookieHeader = await cookiePromise

      if (!cookieHeader) {
        // Handle case where no cookies were retrieved (optional)
        return
      }

      // Update dynamic rules with the retrieved cookie header
      chrome.declarativeNetRequest.updateDynamicRules({
        addRules: [
          {
            id: 1,
            priority: 1,
            action: {
              type: chrome.declarativeNetRequest.RuleActionType.MODIFY_HEADERS,
              requestHeaders: [
                {
                  header: "Cookie",
                  operation: chrome.declarativeNetRequest.HeaderOperation.SET,
                  value: cookieHeader,
                },
              ],
            },
            condition: {
              urlFilter: "https://*.myworkday.com/*",
              resourceTypes: [
                chrome.declarativeNetRequest.ResourceType.MAIN_FRAME,
                chrome.declarativeNetRequest.ResourceType.SUB_FRAME,
                chrome.declarativeNetRequest.ResourceType.XMLHTTPREQUEST,
              ],
            },
          },
        ],
      })
    } catch (error) {
      console.error("Error retrieving cookies:", error)
    }
  })()
})

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "captureContextId") {
    const details = request.details

    const urlParts = details.url.split("/")

    const contextId = urlParts[5].substring(1)

    chrome.storage.local.set({ contextId: contextId })
    sendResponse({})
  }
})

chrome.webRequest.onBeforeRequest.addListener(
  (details) => {
    const urlParts = details.url.split("/")
    const contextIdString = urlParts[5].substring(1)

    const contextId = parseInt(contextIdString, 10)

    if (isNaN(contextId) || contextId < 0 || contextId > 99) {
      return
    }

    chrome.storage.local.get("contextId", (data) => {
      const existingContextId = data.contextId

      if (existingContextId !== contextId) {
        chrome.storage.local.set({ contextId: contextId })
      }
    })
  },
  { urls: ["<all_urls>"] }
)
export {}
