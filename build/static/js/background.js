!function(){"use strict";var e;chrome.runtime.onConnect.addListener((function(n){console.assert("courseHover"===n.name),(e=n).onDisconnect.addListener((function(){e=null}))})),chrome.runtime.onMessage.addListener((function(n){"HOVER"===n.type&&e&&e.postMessage(n.course)}))}();
//# sourceMappingURL=background.js.map