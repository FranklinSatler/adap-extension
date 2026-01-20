# Login Filler Extension

Extensão Chrome Manifest V3 simples que armazena um único usuário/senha e preenche automaticamente em campos de login com suporte a SPAs.

## Estrutura
- manifest.json
- popup.html / popup.js - Interface rápida para editar credenciais
- options.html / options.js - Página de configurações
- content.js - Script de preenchimento automático
- icons/ - Ícones da extensão

## Como usar em modo desenvolvedor
1. Abra `chrome://extensions`
2. Ative **Modo do desenvolvedor**
3. Clique em **Carregar sem compactação** (Load unpacked)
4. Selecione a pasta desta extensão
5. Clique no ícone da extensão para configurar credenciais

## Funcionalidades
- Preenchimento automático de usuário/senha em campos padrão
- Botão auxiliar "Preencher & Acessar" para preenchimento manual
- Detecta automaticamente alterações de página em SPAs
- Suporte para múltiplos tipos de navegação (popstate, history.pushState)

## Campos detectados
- Usuário: `input[placeholder="Usuário"]`
- Senha: `input[placeholder="Senha"]`

## Segurança
- Credenciais armazenadas em `chrome.storage.sync` (sincroniza com conta Google)
- Para maior segurança, considere usar `chrome.storage.local` + criptografia

## Melhorias futuras
- Criptografia local de senha
- Detecção mais robusta de campos de login
- Suporte a múltiplos logins
- Whitelist/blacklist de domínios
