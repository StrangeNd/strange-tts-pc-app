// Offscreen script for Strange TTS Solution Pro
// Purpose: Keep the service worker alive 24/7 by sending periodic messages and playing silent audio

console.log('[Strange TTS Offscreen] Alive and kicking with Audio Persistence...');

// === PERSISTENCE: SILENT AUDIO LOOP ===
let audioCtx = null;
function startSilentAudio() {
  try {
    if (audioCtx) return;
    // Standard AudioContext (or webkit for Safari/Chrome older)
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    
    // Create a 1-second silent buffer
    const buffer = audioCtx.createBuffer(1, audioCtx.sampleRate, audioCtx.sampleRate);
    const source = audioCtx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    
    // Connect to destination (speaker) but it's silent
    source.connect(audioCtx.destination);
    source.start();
    console.log('[Strange TTS Offscreen] Silent audio loop started.');
  } catch (e) {
    // console.warn('[Strange TTS Offscreen] Could not start audio loop:', e);
  }
}

// Periodically ping the service worker
function keepAlive() {
  chrome.runtime.sendMessage({ action: 'keep_alive_ping' });
  // Ensure audio is running (often requires a "user gesture" or being called from a message)
  startSilentAudio();
}

// Every 25 seconds (Modern Chrome SW sleeps after ~30s)
setInterval(keepAlive, 25000);

// Also set up listeners
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'offscreen_check') {
    console.log('[Strange TTS Offscreen] Heartbeat check received');
    startSilentAudio(); // Try to start audio on any interaction
  }
  return true;
});

// Try to start immediately (might fail without gesture, but heartbeat will retry)
startSilentAudio();
