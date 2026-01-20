// Preenche usuário/senha automaticamente em páginas configuradas
(async function() {
  const DEBUG = true; // Mude para true para debug

  console.log('[LoginFiller] Script iniciado - verificando storage');
  
  const { loginFiller } = await chrome.storage.sync.get(['loginFiller']);
  console.log('[LoginFiller] Storage recuperado:', { username: loginFiller?.username });
  
  if (!loginFiller || !loginFiller.username || !loginFiller.password) {
    console.log('[LoginFiller] Credenciais não configuradas, abortando');
    return;
  }

  console.log('[LoginFiller] Extensão ativada - suportando apenas FORM TRADICIONAL', { username: loginFiller.username });

  // ============= LOGIN FORM TRADICIONAL =============

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
    DEBUG && console.log('Procurando botão de login...');
    
    const btn = await waitForButton(2000);
    if (btn) {
      fillFields(false);
      ensureHelperButton(btn);
    }
  }

  // Executa o process inicialmente
  console.log('[LoginFiller] Iniciando busca por botão de login tradicional...');
  process();

  // Observer para reexecutar process quando o DOM for alterado significativamente
  const globalObserver = new MutationObserver((mutations) => {
    let shouldReprocess = false;
    
    mutations.forEach((mutation) => {
      // Verifica se houve adição de novos nós
      if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
        mutation.addedNodes.forEach((node) => {
          // Se foi adicionado um elemento (não texto) e tem mais de 5 elementos filhos
          if (node.nodeType === Node.ELEMENT_NODE && node.querySelectorAll('*').length > 5) {
            shouldReprocess = true;
          }
        });
      }
    });
    
    if (shouldReprocess) {
      DEBUG && console.log('DOM alterado, reexecutando...');
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
