// Preenche usuário/senha automaticamente em páginas configuradas e Terminais Xterm.js
(async function() {
    const DEBUG = true; // Mude para true para debug
  
    console.log('[LoginFiller] Script iniciado - verificando storage');
    
    const { loginFiller } = await chrome.storage.sync.get(['loginFiller']);
    console.log('[LoginFiller] Storage recuperado:', { username: loginFiller?.username, terminalAutoLogin: loginFiller?.terminalAutoLogin });
    
    if (!loginFiller || !loginFiller.username || !loginFiller.password) {
      console.log('[LoginFiller] Credenciais não configuradas, abortando');
      return;
    }

    // Verifica se auto-login de terminal está habilitado
    const terminalAutoLoginEnabled = loginFiller.terminalAutoLogin === true;
  
    // ============= LÓGICA XTERM.JS (NOVA) =============
    
    function isXtermPresent() {
        return document.querySelector('.xterm-helper-textarea') !== null;
    }

    // Função para enviar dados ao terminal via evento de 'paste'
    // Isso evita o encavalamento de caracteres que ocorre na digitação simulada
    function sendToTerminal(text) {
        const textarea = document.querySelector('.xterm-helper-textarea');
        if (!textarea) return;

        DEBUG && console.log(`[Xterm] Enviando comando: "${text.trim()}"`);

        // Foca no textarea do xterm
        textarea.focus();

        // Cria um evento de clipboard 'paste'. 
        // O xterm.js escuta isso e envia o bloco de texto para o PTY corretamente.
        const dataTransfer = new DataTransfer();
        dataTransfer.setData('text/plain', text);
        
        const pasteEvent = new ClipboardEvent('paste', {
            bubbles: true,
            cancelable: true,
            clipboardData: dataTransfer
        });

        textarea.dispatchEvent(pasteEvent);
    }

    // Lê o conteúdo visual do terminal para saber em que etapa estamos
    function getTerminalContent() {
        // O xterm renderiza linhas dentro de .xterm-rows
        const rows = document.querySelectorAll('.xterm-rows > div');
        if (!rows.length) return "";
        return Array.from(rows).map(row => row.textContent).join('\n');
    }

    // Função genérica para processar Xterm em qualquer contexto (página ou iframe)
    function processXtermInContext(context, contextName = 'page') {
        DEBUG && console.log(`[Xterm] Iniciando monitoramento do terminal (${contextName})...`);
        
        // Flag para evitar envio duplicado de senha
        let passSent = false;

        // Funções adaptadas para o contexto (document ou iframeDoc)
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

            DEBUG && console.log(`[Xterm] Enviando senha (${contextName}): "${text.trim()}"`);

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
            // Se o terminal sumir, paramos
            if (!isXtermPresentInContext()) {
                clearInterval(terminalInterval);
                DEBUG && console.log(`[Xterm] Terminal não encontrado (${contextName}), parando monitoramento.`);
                return;
            }

            const content = getTerminalContentInContext().toLowerCase();

            // Detecta apenas pedido de Senha (usuário já digitou manualmente)
            if (!passSent && (content.includes('password:') || content.includes('senha:'))) {
                DEBUG && console.log(`[Xterm] Prompt de senha detectado (${contextName}). Enviando senha automaticamente...`);
                
                setTimeout(() => {
                    sendToTerminalInContext(loginFiller.password + '\r');
                    passSent = true;
                    
                    DEBUG && console.log(`[Xterm] Senha enviada (${contextName}). Parando monitoramento.`);
                    clearInterval(terminalInterval);
                }, 500);
            }

        }, 1000); // Verifica a tela a cada 1 segundo
    }

    async function processXterm() {
        processXtermInContext(document, 'page');
    }

    // Monitora iframes que surgem dinamicamente e processa xterm dentro deles
    function monitorIframes() {
        DEBUG && console.log('[Iframe] Iniciando monitoramento de iframes...');

        const iframeObserver = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'childList') {
                    mutation.addedNodes.forEach((node) => {
                        if (node.nodeType === Node.ELEMENT_NODE && node.tagName === 'IFRAME') {
                            DEBUG && console.log('[Iframe] Novo iframe detectado:', node.id, node.src);
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

    // Verifica se um iframe contém xterm e processa
    function checkIframeForXterm(iframe) {
        // Aguarda o iframe estar carregado
        const checkXtermInIframe = () => {
            try {
                const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
                
                if (!iframeDoc) {
                    DEBUG && console.log('[Iframe] Não foi possível acessar iframeDoc (cross-origin ou não carregado)');
                    // Tenta novamente em 500ms
                    setTimeout(checkXtermInIframe, 500);
                    return;
                }

                const xtermTextarea = iframeDoc.querySelector('.xterm-helper-textarea');
                
                if (xtermTextarea) {
                    DEBUG && console.log('[Iframe] Xterm detectado dentro do iframe!');
                    // Processa xterm dentro deste iframe
                    processXtermInContext(iframeDoc, `iframe[${iframe.id || iframe.src}]`);
                } else {
                    DEBUG && console.log('[Iframe] Xterm não encontrado ainda, aguardando...');
                    // Tenta novamente em 500ms
                    setTimeout(checkXtermInIframe, 500);
                }
            } catch (e) {
                DEBUG && console.log('[Iframe] Erro ao acessar iframe:', e.message);
            }
        };

        checkXtermInIframe();
    }

    // ============= LÓGICA FORM TRADICIONAL (ORIGINAL) =============
  
    // Procura o botão de login
    function findLoginTriggerButton() {
      return Array.from(document.querySelectorAll("button.loginButton")).find(el => el.textContent.trim() === "Acessar");
    }
  
    // Aguarda o botão aparecer com polling + observer
    async function waitForButton(maxWaitMs = 2000) {
      const startTime = Date.now();
  
      let btn;
      
      // Primeira tentativa imediata
      btn = findLoginTriggerButton();
      if (btn) {
        DEBUG && console.log('Botão encontrado imediatamente');
        return btn;
      }
      
      DEBUG && console.log('Botão não encontrado, aguardando...');
      
      return new Promise((resolve) => {
        // Polling a cada 500ms
        const pollInterval = setInterval(() => {
          btn = findLoginTriggerButton();
          if (btn) {
            DEBUG && console.log('Botão encontrado via polling');
            clearInterval(pollInterval);
            observer.disconnect();
            resolve(btn);
            return;
          }
          
          // Timeout
          if (Date.now() - startTime > maxWaitMs) {
            DEBUG && console.log('Timeout aguardando botão');
            clearInterval(pollInterval);
            observer.disconnect();
            resolve(null);
          }
        }, 500);
        
        // Observer para mudanças no DOM
        const observer = new MutationObserver(() => {
          btn = findLoginTriggerButton();
          if (btn) {
            DEBUG && console.log('Botão encontrado via MutationObserver');
            clearInterval(pollInterval);
            observer.disconnect();
            resolve(btn);
          }
        });
        
        // Observa mudanças no root ou body
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
          } catch(e) {
            DEBUG && console.log('Erro ao disparar eventos:', e);
          }
        }, 100);
      } catch(e) {
        DEBUG && console.log('Erro ao preencher:', e);
      }
    }
  
    function fillFields(force = false) {
      DEBUG && console.log('Preenchendo campos...');
      
      const u = pickUsernameField();
      const p = pickPasswordField();
      
      if (!u || !p) {
        DEBUG && console.log('Campos de login não encontrados');
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
      DEBUG && console.log('Botão auxiliar inserido');
    }
  
    async function process() {
        // Verifica se terminal auto-login está habilitado
        if (!terminalAutoLoginEnabled) {
            DEBUG && console.log('[LoginFiller] Terminal auto-login desabilitado na configuração');
        } else {
            // Verifica se é Xterm na página raiz
            if (isXtermPresent()) {
                console.log('[LoginFiller] Xterm detectado na página raiz.');
                processXterm();
                return;
            }

            // Verifica iframes que possam conter xterm
            const iframes = document.querySelectorAll('iframe');
            if (iframes.length > 0) {
                DEBUG && console.log(`[LoginFiller] ${iframes.length} iframe(s) encontrado(s), verificando por xterm...`);
                iframes.forEach(iframe => checkIframeForXterm(iframe));
            }
        }

        DEBUG && console.log('Procurando botão de login tradicional...');
      
        const btn = await waitForButton(2000);
        if (btn) {
            fillFields(false);
            ensureHelperButton(btn);
        }
    }

    // Monitora iframes que surgem dinamicamente e processa xterm dentro deles
    function monitorIframes() {
        // Só inicia monitoramento se terminal auto-login estiver habilitado
        if (!terminalAutoLoginEnabled) {
            DEBUG && console.log('[Iframe] Terminal auto-login desabilitado, pulando monitoramento de iframes');
            return;
        }

        DEBUG && console.log('[Iframe] Iniciando monitoramento de iframes...');

        const iframeObserver = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'childList') {
                    mutation.addedNodes.forEach((node) => {
                        if (node.nodeType === Node.ELEMENT_NODE && node.tagName === 'IFRAME') {
                            DEBUG && console.log('[Iframe] Novo iframe detectado:', node.id, node.src);
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

    // Verifica se um iframe contém xterm e processa
    function checkIframeForXterm(iframe) {
        // Aguarda o iframe estar carregado
        const checkXtermInIframe = () => {
            try {
                const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
                
                if (!iframeDoc) {
                    DEBUG && console.log('[Iframe] Não foi possível acessar iframeDoc (cross-origin ou não carregado)');
                    // Tenta novamente em 500ms
                    setTimeout(checkXtermInIframe, 500);
                    return;
                }

                const xtermTextarea = iframeDoc.querySelector('.xterm-helper-textarea');
                
                if (xtermTextarea) {
                    DEBUG && console.log('[Iframe] Xterm detectado dentro do iframe!');
                    // Processa xterm dentro deste iframe
                    processXtermInContext(iframeDoc, `iframe[${iframe.id || iframe.src}]`);
                } else {
                    DEBUG && console.log('[Iframe] Xterm não encontrado ainda, aguardando...');
                    // Tenta novamente em 500ms
                    setTimeout(checkXtermInIframe, 500);
                }
            } catch (e) {
                DEBUG && console.log('[Iframe] Erro ao acessar iframe:', e.message);
            }
        };

        checkXtermInIframe();
    }
  
    // Executa o process inicialmente
    console.log('[LoginFiller] Iniciando detecção de ambiente...');
    
    // Inicia monitoramento de iframes dinâmicos
    monitorIframes();
    
    // Tenta rodar imediatamente (caso o xterm já esteja lá)
    process();
    // Tenta novamente em breve caso o xterm carregue assincronamente
    setTimeout(process, 1500); 
  
    // Observer para reexecutar process quando o DOM for alterado significativamente
    const globalObserver = new MutationObserver((mutations) => {
      let shouldReprocess = false;
      
      mutations.forEach((mutation) => {
        // Verifica se houve adição de novos nós
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
            // Se detectou o helper do xterm sendo inserido
            const addedXterm = Array.from(mutation.addedNodes).some(node => 
                node.classList && node.classList.contains('xterm-helper-textarea')
            );
            if (addedXterm) shouldReprocess = true;

            mutation.addedNodes.forEach((node) => {
                // Se foi adicionado um elemento grande
                if (node.nodeType === Node.ELEMENT_NODE && node.querySelectorAll('*').length > 5) {
                shouldReprocess = true;
                }
            });
        }
      });
      
      if (shouldReprocess) {
        DEBUG && console.log('DOM alterado, reexecutando verificação...');
        setTimeout(() => process(), 1000);
      }
    });
  
    // Observa mudanças no root ou body
    const observeTarget = document.getElementById('root') || document.body;
    globalObserver.observe(observeTarget, {
      childList: true,
      subtree: true
    });
  
    // Escuta eventos de navegação SPA
    window.addEventListener('popstate', () => {
      DEBUG && console.log('Navegação detectada');
      setTimeout(() => process(), 500);
    });
  
    // Detecta mudanças de URL em SPAs com history.pushState
    let currentUrl = location.href;
    setInterval(() => {
      if (location.href !== currentUrl) {
        currentUrl = location.href;
        DEBUG && console.log('URL alterada');
        setTimeout(() => process(), 500);
      }
    }, 1000);
  
  })();