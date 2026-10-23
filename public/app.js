document.documentElement.classList.add('js');
addEventListener('DOMContentLoaded', () => {
  const h = document.querySelector('header'), f = () => h.classList.toggle('solid', scrollY > 8);
  f(); addEventListener('scroll', f, { passive: true });
  const m = document.querySelector('details.mob');
  if (m) {
    addEventListener('keydown', (e) => { if (e.key === 'Escape' && m.open) { m.open = false; m.querySelector('summary').focus(); } });
    m.addEventListener('click', (e) => { if (e.target.closest('a')) m.open = false; });
  }
  const els = document.querySelectorAll('.rv');
  if (!('IntersectionObserver' in window) || matchMedia('(prefers-reduced-motion: reduce)').matches) return els.forEach((e) => e.classList.add('in'));
  const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: 0.12 });
  els.forEach((e) => io.observe(e));

  // Background canvas animation
  function createBackgroundCanvas() {
    // Respect prefers-reduced-motion
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    // Create canvas
    const canvas = document.createElement('canvas');
    canvas.id = 'bg-canvas';
    canvas.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;z-index:-1;pointer-events:none;';
    document.body.insertBefore(canvas, document.body.firstChild);

    // Get context
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Initialize node state
    const isMobile = window.innerWidth < 768;
    const nodeCount = isMobile ? 30 : 60;
    const nodes = Array.from({ length: nodeCount }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.3,
      isGold: Math.random() < 0.125
    }));

    // Initialize parallax state
    let mouseX = 0, mouseY = 0;
    const parallaxStrength = 20;
    addEventListener('mousemove', (e) => {
      mouseX = (e.clientX / window.innerWidth - 0.5) * parallaxStrength;
      mouseY = (e.clientY / window.innerHeight - 0.5) * parallaxStrength;
    }, { passive: true });

    // Resize handler
    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    addEventListener('resize', resize, { passive: true });

    // Animation loop
    function animate() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.save();
      ctx.translate(mouseX, mouseY);

      // Update node positions
      for (const node of nodes) {
        node.x += node.vx;
        node.y += node.vy;
        if (node.x < 0 || node.x > canvas.width) node.vx *= -1;
        if (node.y < 0 || node.y > canvas.height) node.vy *= -1;
        node.x = Math.max(0, Math.min(canvas.width, node.x));
        node.y = Math.max(0, Math.min(canvas.height, node.y));
      }

      // Draw lines between nearby nodes
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x;
          const dy = nodes[i].y - nodes[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 120) {
            ctx.strokeStyle = 'rgba(212,175,98,0.12)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(nodes[i].x, nodes[i].y);
            ctx.lineTo(nodes[j].x, nodes[j].y);
            ctx.stroke();
          }
        }
      }

      // Draw nodes
      for (const node of nodes) {
        ctx.fillStyle = node.isGold ? 'rgba(212,175,98,0.6)' : 'rgba(200,205,212,0.4)';
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.isGold ? 3 : 2, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
      requestAnimationFrame(animate);
    }

    requestAnimationFrame(animate);
  }

  createBackgroundCanvas();

  // Sound effect and toggle
  const SOUND_KEY = 'eng_sound';
  let soundEnabled = localStorage.getItem(SOUND_KEY) === 'true';

  // Create sound toggle button
  const soundToggle = document.createElement('button');
  soundToggle.id = 'sound-toggle';
  soundToggle.setAttribute('aria-label', 'Toggle sound effects');
  soundToggle.textContent = soundEnabled ? '♪ ON' : '♫ OFF';
  soundToggle.style.cssText = 'position:fixed;bottom:100px;right:24px;width:52px;height:52px;border-radius:50%;background:var(--surf);border:1px solid var(--line);color:var(--silver);cursor:pointer;font-size:20px;z-index:98;transition:transform 0.2s ease;';
  document.body.appendChild(soundToggle);

  // RTL adjustment
  if (document.documentElement.dir === 'rtl') {
    soundToggle.style.left = '24px';
    soundToggle.style.right = 'auto';
  }

  // Sound toggle click handler
  soundToggle.addEventListener('click', () => {
    soundEnabled = !soundEnabled;
    localStorage.setItem(SOUND_KEY, soundEnabled);
    soundToggle.textContent = soundEnabled ? '♪ ON' : '♫ OFF';
  });

  // Logo sound effect
  function playConfirmationTone() {
    try {
      const ac = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.connect(gain);
      gain.connect(ac.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ac.currentTime);
      osc.frequency.exponentialRampToValueAtTime(440, ac.currentTime + 0.15);
      gain.gain.setValueAtTime(0.08, ac.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ac.currentTime + 0.15);
      osc.start(ac.currentTime);
      osc.stop(ac.currentTime + 0.15);
    } catch (err) {
      console.warn('Audio not supported:', err);
    }
  }

  // Listen for clicks on .brand link
  document.addEventListener('click', (e) => {
    const brand = e.target.closest('.brand');
    if (!brand || !soundEnabled) return;
    playConfirmationTone();
  });

  // AI Assistant Panel
  function createAIAssistant() {
    // Create launcher button
    const launcher = document.createElement('button');
    launcher.id = 'ai-launcher';
    launcher.setAttribute('aria-label', 'Open AI assistant');
    launcher.innerHTML = '<svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2l3 7h7l-6 5 3 7-7-5-7 5 3-7-6-5h7z"/></svg><span style="position:absolute;bottom:8px;font-size:9px;font-weight:600;letter-spacing:0.5px;">AI</span>';
    document.body.appendChild(launcher);

    // Create panel
    const panel = document.createElement('div');
    panel.id = 'ai-panel';
    panel.innerHTML = '<div class="ai-header"><div><strong>ENGINEER INTELLIGENCE</strong><span style="font-size:11px;color:var(--gold);margin-left:8px;">DEMO</span></div><button id="ai-close" aria-label="Close panel" style="background:none;border:none;color:var(--silver);font-size:20px;cursor:pointer;">&times;</button></div><div class="ai-messages" id="ai-messages"></div><div class="ai-prompts" id="ai-prompts"></div><div class="ai-input-row"><textarea id="ai-input" placeholder="Type a message..." rows="1"></textarea><button id="ai-send" class="btn">Send</button></div>';
    document.body.appendChild(panel);

    // RTL adjustments
    if (document.documentElement.dir === 'rtl') {
      launcher.style.left = '24px';
      launcher.style.right = 'auto';
      panel.style.left = '24px';
      panel.style.right = 'auto';
    }

    // Add suggested prompts
    const prompts = ['What services do you offer?', 'Tell me about your projects', 'How do I start a project?', 'What technologies do you use?'];
    const promptsContainer = document.getElementById('ai-prompts');
    for (const prompt of prompts) {
      const chip = document.createElement('button');
      chip.className = 'ai-prompt-chip';
      chip.textContent = prompt;
      chip.addEventListener('click', () => sendMessage(prompt));
      promptsContainer.appendChild(chip);
    }

    // Message history state
    const messages = [];
    const messagesContainer = document.getElementById('ai-messages');

    // Add message to UI
    function addMessage(text, role) {
      const msg = document.createElement('div');
      msg.className = 'ai-message ' + role;
      msg.textContent = text;
      messagesContainer.appendChild(msg);
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
      messages.push({ role, text });
    }

    // Send message function
    async function sendMessage(text) {
      const input = document.getElementById('ai-input');
      const msg = text || input.value.trim();
      if (!msg) return;
      
      addMessage(msg, 'user');
      input.value = '';
      
      const sendBtn = document.getElementById('ai-send');
      sendBtn.disabled = true;
      sendBtn.textContent = 'Sending...';
      
      try {
        const res = await fetch('/api/assistant', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: msg })
        });
        
        if (!res.ok) throw new Error('Request failed');
        
        const data = await res.json();
        addMessage(data.reply, 'assistant');
      } catch (err) {
        addMessage('Sorry, I could not process your request. Please try again.', 'assistant');
      } finally {
        sendBtn.disabled = false;
        sendBtn.textContent = 'Send';
      }
    }

    // Wire up event listeners
    document.getElementById('ai-send').addEventListener('click', () => sendMessage());
    
    document.getElementById('ai-input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });

    let greeted = false;
    launcher.addEventListener('click', () => {
      panel.classList.toggle('open');
      if (panel.classList.contains('open')) {
        document.getElementById('ai-input').focus();
        if (!greeted) {
          addMessage('Hello! I\'m the ENGINEER INTELLIGENCE assistant (demonstration mode). I can answer questions about our services, projects, methodology, and more. What would you like to know?', 'assistant');
          greeted = true;
        }
      }
    });

    document.getElementById('ai-close').addEventListener('click', () => {
      panel.classList.remove('open');
    });
  }

  createAIAssistant();
});

let dirty = false;
document.addEventListener('input', (e) => { if (e.target.closest('form[data-dirty]')) dirty = true; });
document.addEventListener('submit', (e) => { const c = e.target.dataset.confirm; if (c && !confirm(c)) e.preventDefault(); else dirty = false; });
addEventListener('beforeunload', (e) => { if (dirty) { e.preventDefault(); e.returnValue = ''; } });

document.addEventListener('click', async (e) => { const b = e.target.closest('[data-copy]'); if (!b) return; try { await navigator.clipboard.writeText(b.dataset.copy); const old = b.textContent; b.textContent = 'Copied'; setTimeout(() => { b.textContent = old; }, 1400); } catch { prompt('Copy this image URL:', b.dataset.copy); } });

document.addEventListener('submit', (e) => {
  const form = e.target;
  if (form.id !== 'media-upload') return;
  const input = document.getElementById('image'), status = document.getElementById('image_status'), file = input?.files?.[0];
  if (!file) { e.preventDefault(); status.textContent = 'Choose an image first.'; return; }
  if (file.size > 2097152) { e.preventDefault(); status.textContent = 'Maximum file size is 2 MB.'; return; }
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) { e.preventDefault(); status.textContent = 'Only PNG, JPEG, or WebP images are allowed.'; return; }
  e.preventDefault(); status.textContent = 'Preparing image…';
  const reader = new FileReader();
  reader.onload = () => { document.getElementById('image_data').value = String(reader.result).split(',')[1]; document.getElementById('image_type').value = file.type; form.submit(); };
  reader.onerror = () => { status.textContent = 'Could not read this file. Try another image.'; };
  reader.readAsDataURL(file);
});
