//
// Bing Translation for iOS Extension Actions.
// 
// Mohamed Mansour mmansour@microsoft.com) May 7th, 2014
//
// ============================================================================
// EXTENSION CONTEXT
//
// The way this script works is that it communicates to both Sandboxes, browser and
// extension. Since we are using Bing Translation Services, we need to inject
// the Bing Translator API into the page. By doing so, the extension context
// cannot communicate to the Bing Translator API since it lives on the browser
// context. We need to communicate to the Translator API because once we detect the
// language on the page the Cocoa UI will need to show the detected language. The only
// way of communication is by using the DOM since the DOM is shared between both contexts.
//
// What we do is the following:
// 
// 1) Use a shared textarea where it becomes injected into the DOM.
// 2) Listen to the BrowserContextEvent in the Extension Context
// 3) Write the script in the document and let that listen to ExtensionContextEvent to
//    receive events from the Extension Sandbox.
// 4) Inject that script into the page using <script> elements.
// 5) Each context will fire (dispatch) an event to the appropriate sandbox.
//
// By doing the following, we make sure we are passing events back and fourth
// between the extension context and browser context just so that we can communicate
// between the Sandboxes.
//
//
// HOW TO RUN IN THE BROWSER
// 
// Since this is just vanialla JavaScript. It will work on any browser. Just copy the
// contents to the console/inspector. Once you are done copying, you can run it by:
//
//  ExtensionPreprocessingJS.run({completionFunction: function(lang) {console.log(lang)}});
//  ExtensionPreprocessingJS.finalize({from: 'ja', to: 'en'});
//
// ============================================================================
(function(w) {
    /**
    * Lives in the Extension Action Context Isolated from the browser context.
    */
    var ExtensionContext = (function() {
        var runArguments = null;
        var detectedLanguage = null;
        var debuglog = null;
        var transferDom = null;

        /**
        * Initialize Extension Context
        */
        function init() {
            // Initialize the extension communications shared DOM states.
            embedTransferDom();
            embedLoggerDom();
            embedBrandingRemoval();

            // Listen for messages from the browser context.
            w.addEventListener('BrowserContextEvent', onBingTransferEventReceived);

            // Inject the Microsoft script.
            log('Injecting ...');
            loadScript('http://www.microsofttranslator.com/ajax/v3/widgetV3.ashx?settings=manual', function() {
                log('Injected Script!');
                injectScript(InjectBrowserContext);
            });
        }

        /**
        * Create shared DOM to transfer between two worlds
        */
        function embedTransferDom() {
            transferDom = document.createElement('textarea');
            transferDom.id = 'transferdata';
            document.body.appendChild(transferDom);
        }

        /**
        * Create shared logger.
        */
        function embedLoggerDom() {
            debuglog = document.createElement('textarea');
            debuglog.style.position = 'fixed';
            debuglog.style.top = 0;
            debuglog.style.left = 0;
            debuglog.style.backgroundColor = 'orange';
            debuglog.style.width = '300px';
            debuglog.style.height = '150px';
            debuglog.style.fontSize = '10px';
            debuglog.id = 'binglog';
            debuglog.style.zIndex = 9000;
            // debuglog.style.display = 'none';
            document.body.appendChild(debuglog);
        }

        /**
        * Inject a locally created script into the Browser Context.
        */
        function injectScript(fn) {
            var script = document.createElement('script');
            script.appendChild(document.createTextNode('(' + fn + ')();'));
            document.body.appendChild(script);
        }

        /**
        * Load an external resource to the DOM to evaluate more scripts.
        */
        function loadScript(scriptName, onload) {
            var script = document.createElement('script');
            script.setAttribute('type', 'text/javascript');
            script.setAttribute('src', scriptName);
            if (onload) {
                script.addEventListener('load', onload, false);
            }
            document.body.appendChild(script);
        }

        /**
        * Log Panel for debug purposes
        */
        function log(msg) {
            debuglog.value += '\nEXTENSION CONTEXT: ' + msg;
            debuglog.scrollTop = debuglog.scrollHeight;
        }

        /**
        * Receive the transfer data.
        */
        function data() {
            return transferDom.value;
        }

        /**
        * Fires an event to the Browser context for cross context messaging.
        */
        function dispatch(msg) {
            log('Dispatching : ' + msg);
            var transferEvent = document.createEvent('Event');
            transferEvent.initEvent('ExtensionContextEvent', true, true);
            transferDom.value = msg;
            window.dispatchEvent(transferEvent);
        }

        /**
        * Custom Event Receive Handler from the Browser Context.
        */
        function onBingTransferEventReceived() {
            var protocol = data().split(' ');
            log('Data Received: ' + protocol);
            if (protocol[0] === 'DETECT') {
                onDetect(protocol[1]);
            }
        }

        /**
        * Bing Translator Detect Callback
        */
        function onDetect(currentLang) {
            log('Language Detected: ' + currentLang);
            detectedLanguage = currentLang;
            if (runArguments) {
                runArguments.completionFunction({
                    "currentLang": detectedLanguage
                });
            }
        }

        /**
        * iOS Extension API Endpoint that starts running 
        * when you issue a tab on the action icon.
        */
        function run(actionArgs) {
            log('iOS Action API - Running');
            // This is to ensure we save the iOS Action Callback so 
            // we complete its return safely since we are waiting for
            // detection from the script which gets loaded earlier.
            runArguments = actionArgs;
            if (detectedLanguage) {
                actionArgs.completionFunction({
                    "currentLang": detectedLanguage
                });
                runArguments = null;
            }
        }

        /**
        * iOS Extension API Endpoint that finalizes when
        * completing the action sheer.
        */
        function finalize(actionArgs) {
            log('iOS Action API - Finalizing');
            var fromLang = actionArgs['from'];
            var toLang = actionArgs['to'];;
            dispatch('TRANSLATE ' + fromLang + ' ' + toLang);
        }

        /**
        * Bing adds branding to the page when the translator has begun.
        * This will use Mutation Observers to listen on the newly added
        * DOM and remove it from display.
        *
        * NOTE: Display None will not work since Translate API we are using
        * automatically brings it back to "block".
        */
        function embedBrandingRemoval() {
            var observer = new MutationObserver(function onMutationObserver(mutations) {
                mutations.forEach(function(mutationNode) {
                    if (mutationNode.addedNodes) {
                        for (var n = 0; n < mutationNode.addedNodes.length; n++) {
                            var node = mutationNode.addedNodes[n];
                            if (node.id === 'WidgetFloaterPanels') {
                                node.style.visibility = 'hidden';
                            }
                        }
                    }
                });
            });

            // Just observe on the root of the body, that is where the widget
            // will be rendered when it is discovered.
            observer.observe(document.body, { childList: true, subtree: false });
        }

        return {
            init: init,
            run: run,
            finalize: finalize
        };
    })();

    // ============================================================================
    // BROWSER CONTEXT
    // ============================================================================
    function InjectBrowserContext() {
        /**
        * Core responsibility is to communicate to the Bing Translator Service. 
        */
        var BrowserContext = (function() {
            var logPanel = document.getElementById('binglog');
            var transferDOM = document.getElementById('transferdata');

            /**
            * Initializes the listeners and starts detecting lang.
            */
            function init() {
                log('Init');

                // Listen to the custom event so we can communicate from the
                // browser context and extension context.
                window.addEventListener('ExtensionContextEvent', onExtensionContextEvent);

                // Send a message to the extension context the detection lang.
                detect(function(currentLanguage) {
                    dispatch("DETECT " + currentLanguage);
                });
            }

            /**
            * Receive the transfer data.
            */
            function data() {
                return transferDOM.value;
            }

            /**
            * Fires an event to the Extension context for cross context messaging.
            */
            function dispatch(msg) {
                log('Dispatching : ' + msg);
                var transferEvent = document.createEvent('Event');
                transferEvent.initEvent('BrowserContextEvent', true, true);
                transferDOM.value = msg;
                window.dispatchEvent(transferEvent);
            }

            /**
            * Custom BingTransferEvent listener to listen for requests coming from
            * the Extension Context.
            */
            function onExtensionContextEvent() {
                log('Data Received: ' + data());
                var protocol = data().split(' ');
                var msg = protocol[0];
                if (msg === 'TRANSLATE' && protocol.length === 3) {
                    var fromLang = protocol[1];
                    var toLang = protocol[2];

                    translate(fromLang, toLang,
                    {
                        onProgress: function(val) {
                            log('Progress: ' + val);
                        },
                        onError: function(e) {
                            log('Error: ' + e);
                        },
                        onComplete: function() {
                            log('Completed!');
                        }
                    });
                }
            }

            /**
            * Log Panel for debug purposes
            */
            function log(msg) {
                logPanel.value += '\nBROWSER CONTEXT: ' + msg;
                logPanel.scrollTop = logPanel.scrollHeight;
            }

            /**
            * Translate the current page to the desired languages.
            */
            function translate(from, to, callbackObj) {
                if (!from || from === 'undefined' || from === 'null') {
                    from = null;
                }

                if (!to || to === 'undefined' || from === 'null') {
                    to = navigate.language.split('-')[0].toLowerCase();
                }

                log('Bing Translating ... ' + from + '->' + to);

                Microsoft.Translator.Widget.Translate(from, to, callbackObj.onProgress, callbackObj.onError, callbackObj.onComplete);
            }

            /**
            * Detect what the current language on the page really is.
            */
            function detect(onLanguageDetected) {
                log('Bing Detecting Language ...');
                var bodyText = document.body.innerText;
                var applicationId = window._mstConfig.appId;
                Microsoft.Translator.Detect(applicationId, bodyText.substring(0, Math.min(500, bodyText.length)), onLanguageDetected);
            }

            return {
                init: init
            };
        })();

        BrowserContext.init();
    }

    // ============================================================================
    // iOS Action API Endpoint - Core Standard
    // ============================================================================
    w.ExtensionPreprocessingJS = (function () {
        ExtensionContext.init();
        return {
            run: ExtensionContext.run,
            finalize: ExtensionContext.finalize
        };
    })();
})(window);