Bing Translate Action Extension
==============

Bing Translate iOS Action Extension, works in iOS, IE, Chrome, Safari, and
Firefox. Currently just supplying the core code which is the JavaScript
portion. The JavaScript portion has two main interop points to iOS Actions,
<code>run</code> and <code>finalize</code> which are object members within 
<code>ExtensionContext</code>.

Sandbox Contexts
---------------

The way this script works is that it communicates to both Sandboxes, browser
and extension. Since we are using Bing Translation Services, we need to inject
the Bing Translator API into the page. By doing so, the extension context
cannot communicate to the Bing Translator API since it lives on the browser
context. We need to communicate to the Translator API because once we detect
the language on the page the Cocoa UI will need to show the detected language.
The only way of communication is by using the DOM since the DOM is shared
between both contexts.

What we do is the following:

- Use a shared textarea where it becomes injected into the DOM.
- Listen to the BrowserContextEvent in the Extension Context
- Write the script in the document and let that listen to
  ExtensionContextEvent to receive events from the Extension Sandbox.
- Inject that script into the page using script tag elements.
- Each context will fire (dispatch) an event to the appropriate sandbox.

By doing the following, we make sure we are passing events back and fourth
between the extension context and browser context just so that we can
communicate between the Sandboxes.

How to run
---------------

Since this is just vanialla JavaScript. It will work on any browser. Just copy
the contents to the console/inspector. Once you are done copying, you can run
it by:


    ExtensionPreprocessingJS.run({completionFunction: function(lang) {console.log(lang)}});
    ExtensionPreprocessingJS.finalize({from: 'ja', to: 'en'});

