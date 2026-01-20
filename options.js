function save() {
  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value;
  chrome.storage.sync.set({ loginFiller: { username, password } }, () => {
    setStatus('Dados salvos');
  });
}
function load() {
  chrome.storage.sync.get(['loginFiller'], data => {
    if (data.loginFiller) {
      document.getElementById('username').value = data.loginFiller.username || '';
      document.getElementById('password').value = data.loginFiller.password || '';
    }
  });
}
function clearAll() {
  if (!confirm('Apagar usuário, senha e URLs?')) return;
  chrome.storage.sync.remove(['loginFiller'], () => setStatus('Dados apagados'));
}
function setStatus(msg) {
  const el = document.getElementById('status');
  el.textContent = msg;
  setTimeout(()=> el.textContent='', 2500);
}

document.getElementById('save').addEventListener('click', save);

document.getElementById('clear').addEventListener('click', clearAll);

load();
