// Login Filler - Preenchimento automático de credenciais
(async function() {
    const { loginFiller } = await chrome.storage.sync.get(['loginFiller']);
    
    if (!loginFiller || !loginFiller.username || !loginFiller.password) {
      return;
    }

    const terminalAutoLoginEnabled = loginFiller.terminalAutoLogin === true;
  
    // ============= LÓGICA XTERM.JS =============
    
    function isXtermPresent() {
        return document.querySelector('.xterm-helper-textarea') !== null;
    }

    function processXtermInContext(context, contextName = 'page') {
        let passSent = false;

        const isXtermPresentInContext = () => {
            return context.querySelector('.xterm-helper-textarea') !== null;
        };

        const getTerminalContentInContext = () => {
            const rows = context.querySelectorAll('.xterm-rows > div');
            if (!rows.length) return "";
            return Array.from(rows).map(row => row.textContent).join('\n');
        };

        const sendToTerminalInContext = (text) => {
            const textarea = context.querySelector('.xterm-helper-textarea');
            if (!textarea) return;

            textarea.focus();

            const dataTransfer = new DataTransfer();
            dataTransfer.setData('text/plain', text);
            
            const pasteEvent = new ClipboardEvent('paste', {
                bubbles: true,
                cancelable: true,
                clipboardData: dataTransfer
            });

            textarea.dispatchEvent(pasteEvent);
        };

        const terminalInterval = setInterval(() => {
            if (!isXtermPresentInContext()) {
                clearInterval(terminalInterval);
                return;
            }

            const content = getTerminalContentInContext().toLowerCase();

            if (!passSent && (content.includes('password:') || content.includes('senha:'))) {
                setTimeout(() => {
                    sendToTerminalInContext(loginFiller.password + '\r');
                    passSent = true;
                    clearInterval(terminalInterval);
                }, 500);
            }

        }, 1000);
    }

    async function processXterm() {
        processXtermInContext(document, 'page');
    }

    function monitorIframes() {
        if (!terminalAutoLoginEnabled) {
            return;
        }

        const iframeObserver = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'childList') {
                    mutation.addedNodes.forEach((node) => {
                        if (node.nodeType === Node.ELEMENT_NODE && node.tagName === 'IFRAME') {
                            checkIframeForXterm(node);
                        }
                    });
                }
            });
        });

        iframeObserver.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    function checkIframeForXterm(iframe) {
        const checkXtermInIframe = () => {
            try {
                const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
                
                if (!iframeDoc) {
                    setTimeout(checkXtermInIframe, 500);
                    return;
                }

                const xtermTextarea = iframeDoc.querySelector('.xterm-helper-textarea');
                
                if (xtermTextarea) {
                    processXtermInContext(iframeDoc, `iframe[${iframe.id || iframe.src}]`);
                } else {
                    setTimeout(checkXtermInIframe, 500);
                }
            } catch (e) {
                // Silenciosamente falha em cross-origin
            }
        };

        checkXtermInIframe();
    }

    // ============= LÓGICA FORM TRADICIONAL =============
  
    function findLoginTriggerButton() {
      return Array.from(document.querySelectorAll("button.loginButton")).find(el => el.textContent.trim() === "Acessar");
    }
  
    async function waitForButton(maxWaitMs = 2000) {
      const startTime = Date.now();
  
      let btn = findLoginTriggerButton();
      if (btn) {
        return btn;
      }
      
      return new Promise((resolve) => {
        const pollInterval = setInterval(() => {
          btn = findLoginTriggerButton();
          if (btn) {
            clearInterval(pollInterval);
            observer.disconnect();
            resolve(btn);
            return;
          }
          
          if (Date.now() - startTime > maxWaitMs) {
            clearInterval(pollInterval);
            observer.disconnect();
            resolve(null);
          }
        }, 500);
        
        const observer = new MutationObserver(() => {
          btn = findLoginTriggerButton();
          if (btn) {
            clearInterval(pollInterval);
            observer.disconnect();
            resolve(btn);
          }
        });
        
        const target = document.getElementById('root') || document.body;
        observer.observe(target, { 
          childList: true, 
          subtree: true 
        });
      });
    }
  
    function pickUsernameField() {
      return document.querySelector('input[placeholder="Usuário"]');
    }
  
    function pickPasswordField() {
      return document.querySelector('input[placeholder="Senha"]');
    }
  
    function dispatchAll(el, value) {
      try {
        el.focus();
        el.value = value;
        
        setTimeout(() => {
          try {
            el.dispatchEvent(new Event('change', { bubbles: true }));
            el.dispatchEvent(new Event('input', { bubbles: true }));
          } catch(e) {}
        }, 100);
      } catch(e) {}
    }
  
    function fillFields(force = false) {
      const u = pickUsernameField();
      const p = pickPasswordField();
      
      if (!u || !p) {
        return false;
      }
  
      if (force || !u.value) { 
        dispatchAll(u, loginFiller.username);
      }
      if (force || !p.value) { 
        setTimeout(() => dispatchAll(p, loginFiller.password), 200);
      }
      
      return true;
    }
  
    function attemptLogin(btn, tries = 0) {
      if (!btn) return;
      if (btn.disabled && tries < 15) { setTimeout(() => attemptLogin(btn, tries+1), 100); return; }
      const form = btn.closest('form');
      ['pointerover','pointerenter','mouseover','mouseenter','pointerdown','mousedown','focus','pointerup','mouseup','click']
        .forEach(type => {
          try { btn.dispatchEvent(new MouseEvent(type, { bubbles:true, cancelable:true, view:window })); } catch(e){}
        });
      if (form) {
        try { typeof form.requestSubmit === 'function' ? form.requestSubmit(btn) : form.submit(); } catch(e){}
      }
    }
  
    function ensureHelperButton(originalButton) {
      if (!originalButton || originalButton.dataset.loginFillerAdded) return;
      
      const helper = document.createElement('button');
      helper.type = 'button';
      helper.textContent = 'Preencher & Acessar';
      helper.className = originalButton.className;
      helper.style.marginTop = '8px';
      helper.style.cursor = 'pointer';
      helper.style.height = '35px';
      helper.classList.remove('disabled');
      
      helper.addEventListener('click', () => {
        const ok = fillFields(true);
        if (ok) setTimeout(() => attemptLogin(originalButton), 80);
      });
      
      originalButton.insertAdjacentElement('afterend', helper);
      originalButton.dataset.loginFillerAdded = '1';
    }
  
    async function process() {
        if (terminalAutoLoginEnabled && isXtermPresent()) {
            processXterm();
            return;
        }

        if (terminalAutoLoginEnabled) {
            const iframes = document.querySelectorAll('iframe');
            if (iframes.length > 0) {
                iframes.forEach(iframe => checkIframeForXterm(iframe));
            }
        }
      
        const btn = await waitForButton(2000);
        if (btn) {
            fillFields(false);
            ensureHelperButton(btn);
        }
    }

    monitorIframes();
    process();
    setTimeout(process, 1500); 
  
    const globalObserver = new MutationObserver((mutations) => {
      let shouldReprocess = false;
      
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
            const addedXterm = Array.from(mutation.addedNodes).some(node => 
                node.classList && node.classList.contains('xterm-helper-textarea')
            );
            if (addedXterm) shouldReprocess = true;

            mutation.addedNodes.forEach((node) => {
                if (node.nodeType === Node.ELEMENT_NODE && node.querySelectorAll('*').length > 5) {
                shouldReprocess = true;
                }
            });
        }
      });
      
      if (shouldReprocess) {
        setTimeout(() => process(), 1000);
      }
    });
  
    const observeTarget = document.getElementById('root') || document.body;
    globalObserver.observe(observeTarget, {
      childList: true,
      subtree: true
    });
  
    window.addEventListener('popstate', () => {
      setTimeout(() => process(), 500);
    });
  
    let currentUrl = location.href;
    setInterval(() => {
      if (location.href !== currentUrl) {
        currentUrl = location.href;
        setTimeout(() => process(), 500);
      }
    }, 1000);
  
  })();