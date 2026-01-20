function save() {
  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value;
  const terminalAutoLogin = document.getElementById('terminalAutoLogin').checked;
  // Preserva dados adicionais previamente salvos (URLs, IPs, etc)
  chrome.storage.sync.get(['loginFiller'], data => {
    const prev = data.loginFiller || {};
    const payload = { 
      username, 
      password,
      terminalAutoLogin,
      urls: prev.urls || [],
      ipCasa: prev.ipCasa || '',
      ipAdap: prev.ipAdap || ''
    };
    chrome.storage.sync.set({ loginFiller: payload }, () => {
      const st = document.getElementById('status');
      st.textContent = 'Salvo';
      setTimeout(()=> st.textContent='', 2000);
    });
  });
}

function load() {
  chrome.storage.sync.get(['loginFiller'], data => {
    if (data.loginFiller) {
      document.getElementById('username').value = data.loginFiller.username || '';
      document.getElementById('password').value = data.loginFiller.password || '';
      document.getElementById('terminalAutoLogin').checked = data.loginFiller.terminalAutoLogin || false;
    }
  });
}

document.getElementById('save').addEventListener('click', save);
load();
