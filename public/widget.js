/**
 * Bug Reporter Widget - Embeddable
 * Usage: <script src="https://your-app.vercel.app/widget.js"></script>
 *        <script>BugReporter.init({ projectId: 'vigitask' })</script>
 */

(function() {
  'use strict';

  // Configuration
  const API_BASE = window.BUG_REPORTER_API || (document.currentScript?.src.replace('/widget.js', '') || '');

  // State
  let sessionId = null;
  let projectId = 'default';
  let projectName = 'Support';
  let history = [];
  let images = [];
  let isOpen = false;
  let isLoading = false;

  // Styles
  const styles = `
    #bug-reporter-widget {
      --br-primary: #6366f1;
      --br-primary-hover: #4f46e5;
      --br-bg: #ffffff;
      --br-text: #1f2937;
      --br-text-light: #6b7280;
      --br-border: #e5e7eb;
      --br-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      position: fixed;
      z-index: 999999;
    }

    #br-button {
      position: fixed;
      bottom: 20px;
      right: 20px;
      width: 60px;
      height: 60px;
      border-radius: 50%;
      background: var(--br-primary);
      color: white;
      border: none;
      cursor: pointer;
      box-shadow: var(--br-shadow);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 24px;
      transition: all 0.2s ease;
      z-index: 999999;
    }

    #br-button:hover {
      background: var(--br-primary-hover);
      transform: scale(1.05);
    }

    #br-panel {
      position: fixed;
      bottom: 90px;
      right: 20px;
      width: 380px;
      max-width: calc(100vw - 40px);
      height: 500px;
      max-height: calc(100vh - 120px);
      background: var(--br-bg);
      border-radius: 16px;
      box-shadow: var(--br-shadow);
      display: none;
      flex-direction: column;
      overflow: hidden;
      z-index: 999999;
    }

    #br-panel.open { display: flex; }

    #br-header {
      padding: 16px;
      background: var(--br-primary);
      color: white;
    }

    #br-header h3 {
      margin: 0;
      font-size: 16px;
      font-weight: 600;
    }

    #br-header p {
      margin: 4px 0 0;
      font-size: 12px;
      opacity: 0.9;
    }

    #br-messages {
      flex: 1;
      overflow-y: auto;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .br-message {
      max-width: 85%;
      padding: 10px 14px;
      border-radius: 12px;
      font-size: 14px;
      line-height: 1.4;
    }

    .br-message.user {
      align-self: flex-end;
      background: var(--br-primary);
      color: white;
      border-bottom-right-radius: 4px;
    }

    .br-message.assistant {
      align-self: flex-start;
      background: #f3f4f6;
      color: var(--br-text);
      border-bottom-left-radius: 4px;
    }

    .br-message.system {
      align-self: center;
      background: #ecfdf5;
      color: #059669;
      font-size: 13px;
      text-align: center;
    }

    #br-images-preview {
      display: flex;
      gap: 8px;
      padding: 8px 16px;
      overflow-x: auto;
      border-top: 1px solid var(--br-border);
    }

    #br-images-preview:empty { display: none; }

    .br-preview-img {
      position: relative;
      width: 60px;
      height: 60px;
      border-radius: 8px;
      overflow: hidden;
      flex-shrink: 0;
    }

    .br-preview-img img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .br-preview-img button {
      position: absolute;
      top: 2px;
      right: 2px;
      width: 18px;
      height: 18px;
      border-radius: 50%;
      background: rgba(0,0,0,0.6);
      color: white;
      border: none;
      cursor: pointer;
      font-size: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    #br-input-area {
      display: flex;
      gap: 8px;
      padding: 12px 16px;
      border-top: 1px solid var(--br-border);
      align-items: flex-end;
    }

    #br-input-area textarea {
      flex: 1;
      border: 1px solid var(--br-border);
      border-radius: 8px;
      padding: 10px 12px;
      font-size: 14px;
      resize: none;
      max-height: 100px;
      font-family: inherit;
    }

    #br-input-area textarea:focus {
      outline: none;
      border-color: var(--br-primary);
    }

    #br-input-area button {
      width: 40px;
      height: 40px;
      border-radius: 8px;
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s;
    }

    #br-attach {
      background: #f3f4f6;
      color: var(--br-text-light);
    }

    #br-attach:hover { background: #e5e7eb; }

    #br-send {
      background: var(--br-primary);
      color: white;
    }

    #br-send:hover { background: var(--br-primary-hover); }
    #br-send:disabled { opacity: 0.5; cursor: not-allowed; }

    .br-typing {
      display: flex;
      gap: 4px;
      padding: 12px;
    }

    .br-typing span {
      width: 8px;
      height: 8px;
      background: var(--br-text-light);
      border-radius: 50%;
      animation: br-bounce 1.4s ease-in-out infinite;
    }

    .br-typing span:nth-child(2) { animation-delay: 0.2s; }
    .br-typing span:nth-child(3) { animation-delay: 0.4s; }

    @keyframes br-bounce {
      0%, 80%, 100% { transform: scale(0); }
      40% { transform: scale(1); }
    }
  `;

  // Create widget
  function createWidget() {
    // Add styles
    const styleEl = document.createElement('style');
    styleEl.textContent = styles;
    document.head.appendChild(styleEl);

    // Widget container
    const widget = document.createElement('div');
    widget.id = 'bug-reporter-widget';
    widget.innerHTML = `
      <button id="br-button" title="Signaler un bug">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
      </button>
      <div id="br-panel">
        <div id="br-header">
          <h3>💬 Signaler un problème</h3>
          <p>Décris le bug, on s'en occupe!</p>
        </div>
        <div id="br-messages"></div>
        <div id="br-images-preview"></div>
        <div id="br-input-area">
          <input type="file" id="br-file" accept="image/*" multiple hidden>
          <button id="br-attach" title="Joindre une image">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
              <circle cx="8.5" cy="8.5" r="1.5"/>
              <polyline points="21 15 16 10 5 21"/>
            </svg>
          </button>
          <textarea id="br-input" placeholder="Décris ton problème..." rows="1"></textarea>
          <button id="br-send" title="Envoyer">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="22" y1="2" x2="11" y2="13"/>
              <polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(widget);

    // Event listeners
    document.getElementById('br-button').addEventListener('click', togglePanel);
    document.getElementById('br-send').addEventListener('click', sendMessage);
    document.getElementById('br-attach').addEventListener('click', () => document.getElementById('br-file').click());
    document.getElementById('br-file').addEventListener('change', handleFiles);

    const input = document.getElementById('br-input');
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });

    // Auto-resize textarea
    input.addEventListener('input', () => {
      input.style.height = 'auto';
      input.style.height = Math.min(input.scrollHeight, 100) + 'px';
    });

    // Paste handler
    document.addEventListener('paste', handlePaste);
  }

  async function togglePanel() {
    const panel = document.getElementById('br-panel');
    isOpen = !isOpen;
    panel.classList.toggle('open', isOpen);

    if (isOpen && !sessionId) {
      await startSession();
    }
  }

  async function startSession() {
    try {
      const res = await fetch(`${API_BASE}/api/chat/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId })
      });
      const data = await res.json();
      sessionId = data.sessionId;
      projectName = data.projectName || projectName;
      history = [];
      addMessage(data.message, 'assistant');

      // Mettre à jour le header avec le nom du projet
      const header = document.querySelector('#br-header h3');
      if (header) {
        header.textContent = `💬 Support ${projectName}`;
      }
    } catch (error) {
      addMessage('Erreur de connexion. Réessaie plus tard.', 'system');
    }
  }

  async function sendMessage() {
    const input = document.getElementById('br-input');
    const message = input.value.trim();

    if (!message && images.length === 0) return;
    if (isLoading) return;

    // Display user message
    if (message) {
      addMessage(message, 'user');
    }
    if (images.length > 0) {
      addMessage(`📷 ${images.length} image(s) jointe(s)`, 'user');
    }

    input.value = '';
    input.style.height = 'auto';
    clearImagePreviews();

    // Show typing
    isLoading = true;
    document.getElementById('br-send').disabled = true;
    const typingId = addTyping();

    try {
      const res = await fetch(`${API_BASE}/api/chat/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          projectId,
          message,
          images: images.map(img => ({ data: img.data })),
          history
        })
      });

      const data = await res.json();

      removeTyping(typingId);

      if (data.error) {
        addMessage(`Erreur: ${data.error}`, 'system');
      } else {
        addMessage(data.message, data.type === 'complete' ? 'system' : 'assistant');

        if (data.history) {
          history = data.history;
        }

        if (data.type === 'complete') {
          // Reset for new conversation
          setTimeout(() => {
            sessionId = null;
            history = [];
          }, 3000);
        }
      }
    } catch (error) {
      removeTyping(typingId);
      addMessage('Erreur de connexion. Réessaie.', 'system');
    } finally {
      isLoading = false;
      document.getElementById('br-send').disabled = false;
      images = [];
    }
  }

  function addMessage(text, type) {
    const container = document.getElementById('br-messages');
    const div = document.createElement('div');
    div.className = `br-message ${type}`;
    div.innerHTML = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>');
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
  }

  function addTyping() {
    const container = document.getElementById('br-messages');
    const div = document.createElement('div');
    div.className = 'br-message assistant br-typing';
    div.id = 'typing-' + Date.now();
    div.innerHTML = '<span></span><span></span><span></span>';
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
    return div.id;
  }

  function removeTyping(id) {
    const el = document.getElementById(id);
    if (el) el.remove();
  }

  function handleFiles(e) {
    const files = Array.from(e.target.files);
    files.forEach(file => {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (ev) => {
          images.push({ data: ev.target.result, name: file.name });
          addImagePreview(ev.target.result, images.length - 1);
        };
        reader.readAsDataURL(file);
      }
    });
    e.target.value = '';
  }

  function handlePaste(e) {
    if (!isOpen) return;
    const items = Array.from(e.clipboardData?.items || []);
    items.forEach(item => {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        const reader = new FileReader();
        reader.onload = (ev) => {
          images.push({ data: ev.target.result, name: 'clipboard.png' });
          addImagePreview(ev.target.result, images.length - 1);
        };
        reader.readAsDataURL(file);
      }
    });
  }

  function addImagePreview(dataUrl, index) {
    const container = document.getElementById('br-images-preview');
    const div = document.createElement('div');
    div.className = 'br-preview-img';
    div.innerHTML = `
      <img src="${dataUrl}" alt="Preview">
      <button onclick="BugReporter.removeImage(${index})">×</button>
    `;
    container.appendChild(div);
  }

  function clearImagePreviews() {
    document.getElementById('br-images-preview').innerHTML = '';
  }

  function removeImage(index) {
    images.splice(index, 1);
    // Rebuild previews
    clearImagePreviews();
    images.forEach((img, i) => addImagePreview(img.data, i));
  }

  // Public API
  window.BugReporter = {
    init: function(options = {}) {
      // Configurer le projet
      if (options.projectId) {
        projectId = options.projectId;
      }
      if (options.projectName) {
        projectName = options.projectName;
      }

      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', createWidget);
      } else {
        createWidget();
      }
    },
    open: function() {
      if (!isOpen) togglePanel();
    },
    close: function() {
      if (isOpen) togglePanel();
    },
    removeImage: removeImage
  };

  // Auto-init seulement si pas de data-project spécifié
  // Sinon, l'utilisateur doit appeler BugReporter.init({ projectId: 'xxx' })
  const script = document.currentScript;
  const autoProjectId = script?.getAttribute('data-project');

  if (autoProjectId) {
    projectId = autoProjectId;
    BugReporter.init({ projectId: autoProjectId });
  }
})();
