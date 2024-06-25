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

const updateContextId = (endpoint: string, increment: number) => {
  chrome.webRequest.onBeforeSendHeaders.addListener(
    (details) => {
      if (details.url.includes(endpoint) && details.requestHeaders) {
        const hasExistingFlag = details.requestHeaders.some(
          (header) =>
            header.name.toLowerCase() === "flag" && header.value === "1"
        )

        if (hasExistingFlag) {
          return
        }

        const newClientRequestId = crypto.randomUUID().replace("-", "")
        const newUrl = `${endpoint}${newClientRequestId}`
        console.log("Forwarding request to:", newUrl)
        const headers = new Headers()
        headers.append("flag", "1")

        fetch(newUrl, {
          method: "GET",
          headers: headers,
        })
          .then((response) => response.json())
          .then((data) => {
            try {
              const rawContextId = data["pageContextId"]
              const contextIdNum =
                parseInt(rawContextId.substring(1)) + increment //increment to account for flow controller after

              chrome.storage.local.set({ contextId: contextIdNum })
            } catch (error) {
              console.error("Error parsing context id:", error)
              return null
            }
          })
          .catch((error) => console.error("Error forwarding request:", error))
      }
    },
    { urls: ["<all_urls>"] },
    ["requestHeaders", "extraHeaders"]
  )
}

// "find course sections" button
updateContextId(
  "https://wd10.myworkday.com/ubc/task/1422$5132.htmld?clientRequestID=",
  1
)

// "view my saved schedules" button
updateContextId(
  "https://wd10.myworkday.com/ubc/task/2997$9892.htmld?clientRequestID=",
  1
)

// "view my courses" button
updateContextId(
  "https://wd10.myworkday.com/ubc/task/2998$28771.htmld?clientRequestID=",
  0
)

// "registration and courses" button
updateContextId(
  "https://wd10.myworkday.com/ubc/inst/12709$165/rel-task/12709$165.htmld?clientRequestID=",
  0
)

// "academics" button
updateContextId(
  "https://wd10.myworkday.com/ubc/inst/12709$56/rel-task/12709$56.htmld?clientRequestID=",
  0
)
export {}
