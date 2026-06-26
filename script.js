// ==========================================
// 1. STATE & CONSTANTS
// ==========================================
const BASE_STATS = { str: 90, agi: 85, vit: 75, int: 80, sen: 95 };
let stats = { ...BASE_STATS };
let unusedPoints = 5;
let combatPower = 9420;
let ariseModeActive = false;
let soundEnabled = true;
let audioCtx = null;
let inventoryTargetAction = null;
let inventoryTargetUrl = null;

// ==========================================
// 2. SYNTH SOUND ENGINE (WEB AUDIO API)
// ==========================================
function initAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
}

function playSound(type) {
  if (!soundEnabled) return;
  initAudio();
  if (!audioCtx) return;

  const now = audioCtx.currentTime;

  if (type === 'click') {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, now);
    osc.frequency.exponentialRampToValueAtTime(100, now + 0.1);
    gain.gain.setValueAtTime(0.04, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(now + 0.1);
  } 
  
  else if (type === 'levelup') {
    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6 chimes
    notes.forEach((freq, idx) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + idx * 0.08);
      gain.gain.setValueAtTime(0.05, now + idx * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.18);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(now + idx * 0.08);
      osc.stop(now + idx * 0.08 + 0.18);
    });
  } 
  
  else if (type === 'arise') {
    // Low deep bass swell + high ring
    const oscBase = audioCtx.createOscillator();
    const oscDetune = audioCtx.createOscillator();
    const filter = audioCtx.createBiquadFilter();
    const gain = audioCtx.createGain();

    oscBase.type = 'sawtooth';
    oscBase.frequency.setValueAtTime(55, now); // A1
    oscBase.frequency.linearRampToValueAtTime(25, now + 2.0);

    oscDetune.type = 'sawtooth';
    oscDetune.frequency.setValueAtTime(55.5, now);
    oscDetune.frequency.linearRampToValueAtTime(25.5, now + 2.0);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(250, now);
    filter.frequency.exponentialRampToValueAtTime(30, now + 2.0);

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 2.0);

    oscBase.connect(filter);
    oscDetune.connect(filter);
    filter.connect(gain);
    gain.connect(audioCtx.destination);

    oscBase.start();
    oscDetune.start();
    oscBase.stop(now + 2.0);
    oscDetune.stop(now + 2.0);

    // High frequency system sound overlay
    const oscChime = audioCtx.createOscillator();
    const gainChime = audioCtx.createGain();
    oscChime.type = 'sine';
    oscChime.frequency.setValueAtTime(1200, now);
    oscChime.frequency.exponentialRampToValueAtTime(180, now + 1.2);
    gainChime.gain.setValueAtTime(0.06, now);
    gainChime.gain.exponentialRampToValueAtTime(0.001, now + 1.2);
    oscChime.connect(gainChime);
    gainChime.connect(audioCtx.destination);
    oscChime.start();
    oscChime.stop(now + 1.2);
  }
}

// ==========================================
// 3. SYSTEM CLOCK & CLOCK RUNNER
// ==========================================
function updateClock() {
  const now = new Date();
  const hrs = String(now.getHours()).padStart(2, '0');
  const mins = String(now.getMinutes()).padStart(2, '0');
  const secs = String(now.getSeconds()).padStart(2, '0');
  document.getElementById('systemClock').innerText = `${hrs}:${mins}:${secs}`;
}
setInterval(updateClock, 1000);
updateClock();

// ==========================================
// 4. FLOATING NOTIFICATION SYSTEM
// ==========================================
function triggerSystemNotification(msg, type = 'info') {
  const container = document.getElementById('notificationContainer');
  const notification = document.createElement('div');
  
  let borderClass = 'border-cyan-500/60 bg-slate-950/90 text-cyan-300 shadow-[0_0_10px_rgba(0,240,255,0.15)]';
  if (ariseModeActive) {
    borderClass = 'border-purple-500/60 bg-slate-950/90 text-purple-300 shadow-[0_0_10px_rgba(168,85,247,0.15)]';
  }
  if (type === 'warning') {
    borderClass = 'border-amber-500/60 bg-slate-950/90 text-amber-400';
  }

  notification.className = `p-3 mb-2 border ${borderClass} rounded text-[11px] font-mono-sys tracking-wider flex items-center justify-between pointer-events-auto transform translate-x-20 opacity-0 transition-all duration-300 w-72`;
  notification.innerHTML = `
    <span>[SYSTEM] ${msg}</span>
    <button class="ml-4 text-xs text-gray-500 hover:text-white" onclick="this.parentElement.remove()">×</button>
  `;

  container.appendChild(notification);
  setTimeout(() => {
    notification.classList.remove('translate-x-20', 'opacity-0');
  }, 10);

  setTimeout(() => {
    notification.classList.add('opacity-0', '-translate-y-2');
    setTimeout(() => notification.remove(), 300);
  }, 4000);
}

// ==========================================
// 5. RADAR PENTAGON GRAPH MATHEMATICS
// ==========================================
function updateRadarPolygon() {
  const cx = 150;
  const cy = 150;
  const R = 110;
  const statKeys = ['str', 'agi', 'vit', 'int', 'sen'];
  let points = [];

  statKeys.forEach((key, index) => {
    const val = stats[key];
    // Scale from 0 to 100
    const scale = val / 100;
    const theta = -Math.PI / 2 + (index * 2 * Math.PI / 5);
    const x = cx + Math.cos(theta) * scale * R;
    const y = cy + Math.sin(theta) * scale * R;
    points.push(`${x},${y}`);

    // Update corresponding vertex circle
    const dotId = 'dot' + key.charAt(0).toUpperCase() + key.slice(1);
    const dot = document.getElementById(dotId);
    if (dot) {
      dot.setAttribute('cx', x);
      dot.setAttribute('cy', y);
    }
  });

  document.getElementById('statPolygon').setAttribute('points', points.join(' '));
}

// ==========================================
// 6. STAT POINT ALLOCATION ENGINE
// ==========================================
function initStatAllocation() {
  const statRows = document.querySelectorAll('#statsContainer > div');
  statRows.forEach(row => {
    const statKey = row.getAttribute('data-stat');
    const addBtn = row.querySelector('.add-stat-btn');
    
    addBtn.addEventListener('click', (e) => {
      if (unusedPoints > 0) {
        // Deduct points
        unusedPoints--;
        stats[statKey]++;
        combatPower += 48; // Increment rating

        // Audio level up
        playSound('click');

        // Floating numbers effect
        spawnFloatingText(`+1`, e.clientX, e.clientY);

        // Update View
        updateStatsView();
        updateRadarPolygon();

        if (unusedPoints === 0) {
          triggerSystemNotification('STAT POINT ALLOCATION SYNC COMPLETE.', 'info');
        }
      } else {
        triggerSystemNotification('INSUFFICIENT UNUSED STAT POINTS.', 'warning');
      }
    });
  });

  document.getElementById('resetStatsBtn').addEventListener('click', () => {
    playSound('click');
    stats = { ...BASE_STATS };
    unusedPoints = 5;
    combatPower = 9420;
    updateStatsView();
    updateRadarPolygon();
    triggerSystemNotification('STATS RESET TO DEFAULT VALUES.', 'info');
  });
}

function updateStatsView() {
  document.getElementById('unusedPoints').innerText = unusedPoints;
  document.getElementById('combatPowerIndex').innerText = combatPower.toLocaleString();
  
  // Update percentages and labels
  const statKeys = ['str', 'agi', 'vit', 'int', 'sen'];
  statKeys.forEach(key => {
    const row = document.querySelector(`[data-stat="${key}"]`);
    if (row) {
      row.querySelector('.stat-val').innerText = stats[key];
      row.querySelector('.stat-bar').style.width = `${stats[key]}%`;
      
      // Toggle add button display
      const btn = row.querySelector('.add-stat-btn');
      if (unusedPoints > 0) {
        btn.classList.remove('opacity-30', 'cursor-not-allowed');
      } else {
        btn.classList.add('opacity-30', 'cursor-not-allowed');
      }
    }
  });
}

function spawnFloatingText(text, x, y) {
  const el = document.createElement('div');
  el.className = 'float-point';
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
  el.innerText = text;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 800);
}

// ==========================================
// 7. INTERACTIVE TABS ROUTING
// ==========================================
function initTabs() {
  const tabs = document.querySelectorAll('.sys-tab-btn');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const target = tab.getAttribute('data-tab');
      playSound('click');
      
      // Remove active classes
      tabs.forEach(btn => btn.classList.remove('active'));
      document.querySelectorAll('.tab-pane').forEach(pane => pane.classList.add('hidden'));

      // Set active
      tab.classList.add('active');
      document.getElementById(`tab-${target}`).classList.remove('hidden');
    });
  });
}

// ==========================================
// 8. INSPECTOR PANEL LOGIC (SKILLS & INVENTORY)
// ==========================================
function inspectSkill(name, desc, cooldown, cost) {
  playSound('click');
  const box = document.getElementById('skillDetailsBox');
  box.classList.remove('hidden');
  document.getElementById('detailSkillName').innerText = name;
  document.getElementById('detailSkillDesc').innerText = desc;
  document.getElementById('detailSkillCooldown').innerText = cooldown;
  document.getElementById('detailSkillCost').innerText = `MP: ${cost}`;
  
  // Scroll slightly to view
  box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function selectInventoryItem(name, rarity, desc, actionType, url = null) {
  playSound('click');
  const inspector = document.getElementById('itemInspector');
  inspector.classList.remove('hidden');
  document.getElementById('inspectItemName').innerText = name;
  document.getElementById('inspectItemRarity').innerText = rarity;
  document.getElementById('inspectItemDesc').innerText = desc;

  // Color tag based on rarity
  const rarityEl = document.getElementById('inspectItemRarity');
  rarityEl.className = 'text-xs font-bold font-mono-sys tracking-wider ';
  if (rarity.includes('LEGENDARY')) {
    rarityEl.className += 'text-purple-400';
  } else if (rarity.includes('EPIC')) {
    rarityEl.className += 'text-yellow-500';
  } else if (rarity.includes('RARE')) {
    rarityEl.className += 'text-cyan-400';
  } else {
    rarityEl.className += 'text-gray-400';
  }

  // Cache action
  inventoryTargetAction = actionType;
  inventoryTargetUrl = url;
  
  // Scroll slightly
  inspector.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function executeInventoryAction() {
  if (!inventoryTargetAction) return;
  playSound('click');

  if (inventoryTargetAction === 'use-email') {
    triggerSystemNotification('OPENING COMMUNICATOR SCROLL...', 'info');
    window.location.href = 'mailto:rajat.sharma.swe@gmail.com';
  } else if (inventoryTargetAction === 'visit-url' && inventoryTargetUrl) {
    triggerSystemNotification('REDIRECTING GATE TO PORTAL...', 'info');
    window.open(inventoryTargetUrl, '_blank');
  } else if (inventoryTargetAction === 'display-toast') {
    triggerSystemNotification('GRADUATION CERTIFICATE SYNCED: MCA DEGREE CONFIRMED.', 'info');
  } else if (inventoryTargetAction === 'teleport-contact') {
    triggerSystemNotification('TELEPORTING TO DIMENSIONAL CONTACT GATE...', 'info');
    document.getElementById('contact').scrollIntoView({ behavior: 'smooth' });
  }
}

// ==========================================
// 9. ARISE MONARCH SYSTEM CONVERSION
// ==========================================
function toggleAriseMode() {
  ariseModeActive = !ariseModeActive;
  
  // Play epic low hum synthesizer sound
  playSound('arise');

  // Full-screen overlay trigger
  const ariseOverlay = document.getElementById('ariseOverlay');
  ariseOverlay.classList.remove('opacity-0');
  ariseOverlay.classList.add('opacity-100');

  setTimeout(() => {
    ariseOverlay.classList.remove('opacity-100');
    ariseOverlay.classList.add('opacity-0');
  }, 2200);

  // Body class toggle
  if (ariseModeActive) {
    document.body.classList.add('arise-mode');
    document.getElementById('headerLevel').innerText = 'LV. MAX';
    document.getElementById('headerLevel').className = 'text-xs px-2 py-0.5 border border-purple-500/50 text-purple-400 rounded bg-purple-500/10 font-tech font-bold uppercase';
    document.getElementById('headerJob').innerText = 'Class: Shadow Monarch';
    document.getElementById('headerJob').className = 'text-xs text-purple-400 tracking-wider font-tech uppercase';
    
    document.getElementById('statTitle').innerText = 'MONARCH OF SHADOWS';
    document.getElementById('statTitle').className = 'text-purple-400 font-bold ml-2';
    document.getElementById('statClass').innerText = 'SHADOW MONARCH (AI CORE)';
    
    document.getElementById('titleName1').innerText = 'Monarch of Shadows (Active)';
    document.getElementById('headerAriseBtn').innerText = 'RESTORE';
    document.getElementById('headerAriseBtn').className = 'px-4 py-2 border border-cyan-500/50 hover:border-cyan-400 text-cyan-400 hover:text-white rounded bg-cyan-950/20 font-bold tracking-wider hover:scale-105 active:scale-95 transition-all';
    
    triggerSystemNotification('SHADOW MONARCH AUTHORITY ACTIVE. SHADOW ARMY INJECTED.', 'info');
  } else {
    document.body.classList.remove('arise-mode');
    document.getElementById('headerLevel').innerText = 'LV. 99';
    document.getElementById('headerLevel').className = 'text-xs px-2 py-0.5 border border-yellow-500/50 text-yellow-400 rounded bg-yellow-500/10 font-tech font-bold uppercase';
    document.getElementById('headerJob').innerText = 'Class: S-Rank Software Engineer';
    document.getElementById('headerJob').className = 'text-xs text-cyan-400 tracking-wider font-tech uppercase';
    
    document.getElementById('statTitle').innerText = 'MONARCH OF DEVELOPERS';
    document.getElementById('statTitle').className = 'text-cyan-400 font-bold ml-2';
    document.getElementById('statClass').innerText = 'S-RANK SOFTWARE ENGINEER';
    
    document.getElementById('titleName1').innerText = 'Monarch of Shadows';
    document.getElementById('headerAriseBtn').innerText = 'ARISE';
    document.getElementById('headerAriseBtn').className = 'px-4 py-2 border border-purple-500/50 hover:border-purple-400 text-purple-400 hover:text-white rounded bg-purple-950/20 font-bold tracking-wider hover:scale-105 active:scale-95 transition-all shadow-[0_0_10px_rgba(168,85,247,0.1)]';
    
    triggerSystemNotification('RESTORED STANDARD OPERATION PROTOCOLS.', 'info');
  }

  // Redraw pentagon graph and trigger canvas shift
  updateRadarPolygon();
}

// ==========================================
// 10. BACKGROUND CANVAS & AURA PARTICLES
// ==========================================
const canvas = document.getElementById('particleCanvas');
const ctx = canvas.getContext('2d');
let particles = [];
const particleCount = 45;

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}

class Particle {
  constructor() {
    this.reset();
  }
  reset() {
    this.x = Math.random() * canvas.width;
    this.y = canvas.height + Math.random() * 80;
    this.size = Math.random() * 2 + 1;
    this.speedY = Math.random() * 0.8 + 0.3;
    this.speedX = (Math.random() - 0.5) * 0.4;
    this.alpha = Math.random() * 0.4 + 0.15;
    this.wobble = Math.random() * Math.PI * 2;
    this.wobbleSpeed = Math.random() * 0.02 + 0.005;
  }
  update() {
    this.y -= this.speedY * (ariseModeActive ? 2.2 : 1.0);
    this.wobble += this.wobbleSpeed;
    this.x += this.speedX + Math.sin(this.wobble) * 0.2;
    
    if (this.y < -10 || this.x < -10 || this.x > canvas.width + 10) {
      this.reset();
    }
  }
  draw() {
    ctx.beginPath();
    ctx.globalAlpha = this.alpha;
    if (ariseModeActive) {
      ctx.arc(this.x, this.y, this.size * 3.5, 0, Math.PI * 2);
      ctx.fillStyle = '#a855f7';
    } else {
      ctx.rect(this.x, this.y, this.size, this.size);
      ctx.fillStyle = '#00f0ff';
    }
    ctx.fill();
    ctx.globalAlpha = 1.0;
  }
}

// Small Avatar Aura Canvas
const auraCanvas = document.getElementById('auraCanvas');
const auraCtx = auraCanvas.getContext('2d');
let auraParticles = [];

function resizeAuraCanvas() {
  if (auraCanvas) {
    auraCanvas.width = auraCanvas.parentElement.clientWidth;
    auraCanvas.height = auraCanvas.parentElement.clientHeight;
  }
}

class AuraParticle {
  constructor() {
    this.reset();
  }
  reset() {
    this.x = auraCanvas.width / 2 + (Math.random() - 0.5) * 40;
    this.y = auraCanvas.height - 20;
    this.size = Math.random() * 2 + 1;
    this.speedY = Math.random() * 1.2 + 0.4;
    this.speedX = (Math.random() - 0.5) * 0.6;
    this.alpha = Math.random() * 0.6 + 0.2;
    this.life = Math.random() * 60 + 40;
  }
  update() {
    this.y -= this.speedY;
    this.x += this.speedX;
    this.life--;
    if (this.life <= 0 || this.y < 0) {
      this.reset();
    }
  }
  draw() {
    auraCtx.beginPath();
    auraCtx.globalAlpha = this.alpha * (this.life / 100);
    auraCtx.arc(this.x, this.y, this.size * (ariseModeActive ? 3.0 : 1.5), 0, Math.PI * 2);
    auraCtx.fillStyle = ariseModeActive ? '#c084fc' : '#00f0ff';
    auraCtx.fill();
    auraCtx.globalAlpha = 1.0;
  }
}

function drawMatrix() {
  ctx.fillStyle = ariseModeActive ? '#030008' : '#050814';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  particles.forEach(p => {
    p.update();
    p.draw();
  });

  if (auraCanvas && auraCanvas.width > 0) {
    auraCtx.clearRect(0, 0, auraCanvas.width, auraCanvas.height);
    auraParticles.forEach(ap => {
      ap.update();
      ap.draw();
    });
  }

  requestAnimationFrame(drawMatrix);
}

// ==========================================
// 11. HOTKEYS / QUICK ACTIONS
// ==========================================
window.addEventListener('keydown', (e) => {
  if (document.getElementById('welcomeModal')) return; 
  
  if (e.key === '1') {
    playSound('click');
    triggerSystemNotification('HOTKEY [1]: Mail Link Triggered', 'info');
    window.location.href = 'mailto:rajat.sharma.swe@gmail.com';
  } else if (e.key === '2') {
    playSound('click');
    triggerSystemNotification('HOTKEY [2]: LinkedIn Link Triggered', 'info');
    window.open('https://linkedin.com/in/rajat-sharma-swe', '_blank');
  } else if (e.key === '3') {
    playSound('click');
    triggerSystemNotification('HOTKEY [3]: Teleported to Contact Gate', 'info');
    document.getElementById('contact').scrollIntoView({ behavior: 'smooth' });
  }
});

// ==========================================
// 12. INITIALIZATION / EVENTS
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
  // Clock & Canvas Setup
  updateClock();
  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();

  for (let i = 0; i < particleCount; i++) {
    particles.push(new Particle());
  }

  window.addEventListener('resize', resizeAuraCanvas);
  setTimeout(resizeAuraCanvas, 100);

  for (let i = 0; i < 20; i++) {
    auraParticles.push(new AuraParticle());
  }

  requestAnimationFrame(drawMatrix);

  // Arise binding
  const ariseBtn = document.getElementById('headerAriseBtn');
  if (ariseBtn) {
    ariseBtn.addEventListener('click', toggleAriseMode);
  }

  // Welcome modal binding
  const modal = document.getElementById('welcomeModal');
  const acceptBtn = document.getElementById('acceptBtn');
  const declineBtn = document.getElementById('declineBtn');
  const fatigueBar = document.getElementById('fatigueBar');
  const fatigueValue = document.getElementById('fatigueValue');

  if (acceptBtn) {
    acceptBtn.addEventListener('click', () => {
      initAudio();
      playSound('levelup');
      modal.classList.add('opacity-0');
      setTimeout(() => {
        modal.remove();
        let fVal = 0;
        const fInterval = setInterval(() => {
          if (fVal < 12) {
            fVal++;
            if (fatigueBar) fatigueBar.style.width = `${fVal}%`;
            if (fatigueValue) fatigueValue.innerText = `${fVal}/100`;
          } else {
            clearInterval(fInterval);
          }
        }, 600);
      }, 300);

      triggerSystemNotification('DEVELOPER ARCHIVE ACCESSED SUCCESSFULLY.', 'info');
    });
  }

  if (declineBtn) {
    declineBtn.addEventListener('click', () => {
      initAudio();
      playSound('click');
      
      const dialog = modal.querySelector('h2');
      dialog.innerText = '[ WARNING: ACCESS MANDATORY ]';
      dialog.className = 'text-3xl font-bold font-mono-sys text-red-500 mb-6 tracking-widest uppercase';
      
      const info = modal.querySelector('p.text-lg');
      info.innerHTML = '[System Warning: You cannot decline the invitation of the Shadow Monarch. System synchronization will commence immediately.]';
      info.className = 'text-lg text-red-400 font-bold';

      declineBtn.remove();
      
      setTimeout(() => {
        playSound('levelup');
        modal.classList.add('opacity-0');
        setTimeout(() => {
          modal.remove();
          triggerSystemNotification('SYSTEM FORCED OVERRIDE. SYNC COMPLETE.', 'info');
        }, 300);
      }, 2500);
    });
  }

  // Audio Toggle
  const audioBtn = document.getElementById('audioToggleBtn');
  const audioIcon = document.getElementById('audioIcon');
  if (audioBtn) {
    audioBtn.addEventListener('click', () => {
      soundEnabled = !soundEnabled;
      if (soundEnabled) {
        audioIcon.innerHTML = `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />`;
        playSound('click');
        triggerSystemNotification('SYSTEM SPEECH SYNTHETICS AUDIO ENABLED.', 'info');
      } else {
        audioIcon.innerHTML = `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15zM17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />`;
        triggerSystemNotification('SYSTEM SPEECH SYNTHETICS AUDIO DISABLED.', 'info');
      }
    });
  }

  // Use Item button listener
  const useItemBtn = document.getElementById('useItemBtn');
  if (useItemBtn) {
    useItemBtn.addEventListener('click', executeInventoryAction);
  }

  // Initialize tabs, stats, and radar graph
  initTabs();
  initStatAllocation();
  updateStatsView();
  updateRadarPolygon();
});
