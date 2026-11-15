# Technical Specification Document: Misophonia Sound Therapy PWA (Neuro-Acoustic Habituation Platform)

**Document Version:** 1.0.0  
**Target Audience:** Autonomous Coding Agents & Full-Stack Web Engineers  
**Application Type:** Progressive Web Application (PWA) / Responsive Web Platform  
**Target Clinical Goal:** Habituation via Counterconditioning & Systematic Desensitization  

---

## 1. Executive Summary & Clinical Architecture

### 1.1 Clinical Rationale
Misophonia is characterized by heightened autonomic arousal and severe emotional reactivity to specific auditory trigger stimuli (most commonly human oral and nasal sounds, repetitive tapping, chewing, or breathing). 

This platform implements **counterconditioning and systematic desensitization** within an engaging, low-cognitive-stress environment. The core neuro-acoustic mechanism relies on:
1. **Sub-Threshold Exposure:** Presenting target trigger sounds at decibel levels and spectral characteristics strictly below the patient's autonomic threshold of reactivity.
2. **Acoustic Masking & Pairing:** Superimposing target triggers onto pleasant, predictable ambient soundscapes (pink noise, rainfall, binaural drones) and reinforcing them with harmonic gameplay sound feedback.
3. **Cognitive Distraction & Flow:** Immersing the child in non-punitive, timer-free spatial puzzles that recruit visual-spatial working memory, preventing hyper-fixation on the acoustic trigger while associative neural pathways rewire.
4. **Autonomous Control & Psychological Safety:** Providing an instantaneous, zero-latency "Panic Button" to eliminate learned helplessness and anxiety associated with exposure.

### 1.2 System Scope
The application is a client-side, zero-telemetry-by-default, installable Progressive Web Application (PWA) targeting mobile (iOS/Android tablets and phones) and modern desktop browsers (Chrome, Safari, Firefox, Edge).

---

## 2. Technology Stack & Runtime Dependencies

| Layer | Technology | Specification / Rationale |
| :--- | :--- | :--- |
| **Language & Engine** | TypeScript 5.x / ES2023 | Strict type safety, clean interface boundaries. |
| **UI Framework** | Vanilla JS / Lightweight Framework (e.g., Preact / Vite) | Low memory footprint, near-zero startup overhead, precise DOM control. |
| **Styling & Design System** | Modern CSS3 / Tailwind CSS / Vanilla CSS | Responsive touch UI, high contrast accessibility, WCAG AAA compliance. |
| **Audio Engine** | Web Audio API (`AudioContext`) | Node-based hardware-accelerated DSP graph, sub-millisecond scheduling. |
| **Audio Capture** | MediaStream Recording API (`navigator.mediaDevices`) | In-browser 16-bit PCM/WebM/WAV capture from device microphone. |
| **Client Storage** | IndexedDB via `idb-keyval` / Dexie.js | Offline persistent storage for custom audio blobs, logs, and settings. |
| **PWA & Caching** | Service Workers + Cache API | 100% offline-first execution, background audio compatibility. |

---

## 3. Web Audio API Architecture (Triple-Channel Mixer)

The audio pipeline consists of three independent sub-buses converging into a safety-limited Master Output bus.

```
+-----------------------------------------------------------------------------------------+
|                                    AUDIO GRAPH                                          |
+-----------------------------------------------------------------------------------------+

  [ Channel A: Calming Soundscapes ]
  (AudioBufferSourceNode / HTMLAudioElement)
         │
         ▼
  [ StereoPannerNode ] ──► [ ChannelA GainNode ] ─────────┐
                                                          │
  [ Channel B: Interactive Game Audio ]                   │
  (Polyphonic Synth / Web Audio Sound Effects)            │
         │                                                │
         ▼                                                │
  [ StereoPannerNode ] ──► [ ChannelB GainNode ] ─────────┼──► [ Master DynamicsCompressor ]
                                                          │                 │
  [ Channel C: Target Trigger Exposure ]                  │                 ▼
  (Captured / Stored AudioBuffer Loops)                   │         [ Master GainNode ]
         │                                                │                 │
         ▼                                                │                 ▼
  [ High-Cut / Low-Pass BiquadFilterNode ]                │         [ AnalyserNode ]
         │                                                │                 │
         ▼                                                │                 ▼
  [ Hardware Safety Gain Cap (Parent Lock) ]              │     [ AudioContext.destination ]
         │                                                │
         ▼                                                │
  [ ChannelC Volume Slider GainNode ]                     │
         │                                                │
         ▼                                                │
  [ Panic Mute Ramp GainNode ] ───────────────────────────┘
```

### 3.1 Audio Graph Specifications

#### Channel A: Calming Soundscape Bus
* **Source:** Continuous loop playback of stereo audio (pink noise, rain, forest, oceanic drones).
* **Gain Node:** User-accessible 0% to 100% linear gain (`0.0` to `1.0`).
* **Fade Transitions:** Smooth cross-fading (`linearRampToValueAtTime`) over 2.0 seconds between selectable soundscapes.

#### Channel B: Game Audio Bus
* **Source:** Procedural synthesis or pre-rendered short audio buffers for puzzle interactions (tile placement, line connection, level completion).
* **Acoustic Characteristics:** Soft harmonic frequencies (pentatonic scale, 432 Hz / 528 Hz tuning, low transients, zero harsh percussive clacks).
* **Gain Node:** Independent user-controlled gain (`0.0` to `1.0`).

#### Channel C: Target Exposure Bus (Trigger Audio)
* **Source:** User-recorded or library trigger samples (chewing, breathing, sniffing, tapping).
* **BiquadFilterNode:**
  * `type: "lowpass"` (High-Cut Filter).
  * `frequency.value`: Configurable range between 500 Hz and 8000 Hz (default: 1500 Hz to roll off harsh high-frequency acoustic edges).
  * `Q.value`: 0.707 (Butterworth maximally flat response, no resonance peaks).
* **Parent Ceiling GainNode (`parentCeilingGain`):**
  * Hard upper bound managed exclusively by the Parent/Therapist Lock menu.
  * Capped at e.g., `-24 dB` (`0.063`) or `-18 dB` (`0.125`) relative to Channel A.
* **Child Attenuation Slider (`childTriggerGain`):**
  * Modulates gain from `0.0` to `1.0` *relative* to the Parent Ceiling.
  * Formula: $\text{Effective Gain} = \text{Child Gain} \times \text{Parent Ceiling Gain}$.
* **Panic GainNode (`panicGain`):**
  * Dedicated node specifically for instantaneous cutoffs: `gain.cancelScheduledValues(t); gain.setValueAtTime(0.0, t)`.

#### Master Bus
* **DynamicsCompressorNode:**
  * `threshold: -6.0 dB`
  * `knee: 12.0 dB`
  * `ratio: 8.0`
  * `attack: 0.003 s`
  * `release: 0.25 s`
  * Protects against acoustic clipping and sudden volume spikes from uncalibrated audio recordings.
* **Master GainNode:** Overall device output calibration.
* **AnalyserNode:** Fast Fourier Transform (FFT) analysis (`fftSize: 256`) for real-time visual feedback of sound levels.

---

## 4. In-App Recording & Acoustic Conditioning Module

To capture real-world triggers (e.g., a specific sibling's chewing, family member's breathing, or specific clicking sounds), the app provides a secure local recording and processing studio.

```
+─────────────────────────────────────────────────────────────────────────────+
|                     RECORDING & PRE-PROCESSING PIPELINE                     |
+─────────────────────────────────────────────────────────────────────────────+

  [ Mic Input ] ──► [ MediaStream ] ──► [ AudioContext Source / AudioBuffer ]
                                                        │
                                                        ▼
  [ Non-Destructive Trim ] ◄── [ Waveform Display (Canvas AnalyserNode) ]
          │
          ▼
  [ Loudness Normalization ] (Calculate RMS / Peak; Normalize to -18 dBFS Target)
          │
          ▼
  [ Low-Pass Filter Preview ] (Real-time frequency slider: 500Hz - 8kHz)
          │
          ▼
  [ IndexedDB Audio Repository ] (Stored as ArrayBuffer / Blob with metadata)
```

### 4.1 In-App Recording Functional Requirements
1. **Microphone Permissions & Capture:**
   * Invoke `navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } })` to obtain raw, uncompressed environmental audio.
2. **Recording Duration:**
   * Maximum recording window: 30 seconds per sample (optimized for trigger loops).
3. **Visual Waveform Editor:**
   * Interactive `<canvas>` element rendering time-domain audio data.
   * Dual draggable bounding handles for non-destructive trimming of leading/trailing silence or extraneous artifacts.
4. **Acoustic Softening & Pre-Filtering:**
   * Interactive Low-Pass (High-Cut) slider with real-time A/B preview button.
   * Removes frequencies $> 2 \text{ kHz}$ to strip sharp, visceral transients before exposure.
5. **Auto-Normalization:**
   * Scan peak amplitude and RMS energy; normalize audio buffer peak to a maximum of `-14 dBFS` to prevent accidental startle responses.
6. **Local Encryption & Privacy:**
   * All audio blobs are stored locally in the browser's IndexedDB. No audio is ever uploaded to external servers or cloud services.

---

## 5. Puzzle Gameplay Engine

### 5.1 Game Design Philosophy
* **Zero Stress / Zero Threat:** Absolutely no timers, countdown clocks, move limits, point decays, or fail states.
* **Spatial & Kinesthetic Engagement:** Tactile puzzle mechanics requiring spatial manipulation, color harmony, or pattern matching.
* **Low Cognitive Frustration:** Puzzles are self-correcting or exploratory, inducing a calm flow state.

### 5.2 Recommended Game Mechanics: "Constellation Connect" / "Harmonic Tangram"
1. **Core Loop:**
   * The screen presents floating celestial nodes or soft geometric tiles on a calming watercolor or dark-mode canvas.
   * The child drags connections between nodes or rotates soft geometric tiles until visual symmetry / harmonic connection is reached.
2. **Audio-Kinesthetic Integration:**
   * Dragging a piece triggers a gentle microtonal chime on Channel B.
   * Completing a constellation/shape triggers an ambient bloom animation and a soft pentatonic chord.
3. **Session Flow & Exposure Cycling:**
   * Background Channel A plays continuously.
   * Trigger Channel C is introduced at a random interval between 45 seconds and 90 seconds into the session, playing for a brief, configurable exposure window (e.g., 10–30 seconds), then cross-fading back to silence.

---

## 6. Safety Systems, Parent Lock & Panic Button

```
+─────────────────────────────────────────────────────────────────────────────+
|                             SAFETY CONTROL LOGIC                            |
+─────────────────────────────────────────────────────────────────────────────+

   PARENT CONFIGURATION                           CHILD SESSION UI
  ┌─────────────────────────┐                    ┌─────────────────────────┐
  │  PIN-Protected Menu     │                    │  Persistent Red Panic   │
  │  ─────────────────────  │                    │  Button (Sticky Header) │
  │  • Max Trigger Ceiling  │                    └────────────┬────────────┘
  │    (e.g., 0.08 / -22dB) │                                 │
  │  • Max Session Time     │                                 ▼
  │  • Filter Cutoff Lock   │                    [ Zero-Delay Audio Mute ]
  │  • SUDS Log History     │                    gain.setValueAtTime(0, t);
  └───────────┬─────────────┘                    Prompt Breathing Flower UI
              │                                  Log Panic Event to SUDS
              ▼
    [ Hardware Lock Cap ]
```

### 6.1 Parent / Therapist Lock
* **Authentication:** 4-digit numeric PIN, hashed (SHA-256 with salt) and stored in `localStorage` / IndexedDB.
* **Ceiling Cap Enforcement:**
  * Defines the maximum absolute volume slider limit for Channel C (Trigger Audio).
  * Even if the child moves their in-game trigger slider to "100%", the physical gain node will not exceed `parentCeilingGain`.
* **Session Exposure Rules:**
  * Max exposure duration per session (default: 10 minutes).
  * Auto-fadeout when limit is reached with gentle completion prompt.

### 6.2 Persistent One-Tap Panic Button
* **Placement & Affordance:**
  * Large, high-visibility, persistent circular button located in the top-right corner of every active gameplay screen.
  * Distinct styling: Soft coral/rose color with a universal pause/shield icon.
* **Execution Latency:** $< 10 \text{ ms}$.
* **Immediate Audio Action:**
  ```javascript
  function handlePanicTrigger(audioContext, channelCGainNode, channelAGainNode) {
    const now = audioContext.currentTime;
    // Hard instantaneous cut of trigger channel with 5ms de-click ramp
    channelCGainNode.gain.cancelScheduledValues(now);
    channelCGainNode.gain.setValueAtTime(channelCGainNode.gain.value, now);
    channelCGainNode.gain.linearRampToValueAtTime(0.0001, now + 0.005);
    channelCGainNode.gain.setValueAtTime(0.0, now + 0.006);
    
    // Optional gentle boost to soothing background audio
    channelAGainNode.gain.cancelScheduledValues(now);
    channelAGainNode.gain.linearRampToValueAtTime(1.0, now + 0.5);
  }
  ```
* **Post-Panic UI Response:**
  * Transition gameplay to a tranquil "Calm Down" breathing circle (4-second inhale, 4-second hold, 6-second exhale).
  * Record timestamped panic incident to the clinical session log.

---

## 7. Clinical Distress Logging (SUDS System)

The **Subjective Units of Distress Scale (SUDS)** tracks longitudinal habituation and clinical efficacy.

```
+─────────────────────────────────────────────────────────────────────────────+
|                          SUDS LOGGING WORKFLOW                              |
+─────────────────────────────────────────────────────────────────────────────+

  [ Start Session ] ──► [ Pre-Session SUDS Prompt (0 - 10 Visual Slider) ]
                                   │
                                   ▼
                   [ Interactive Gameplay & Exposure ]
                   (Automatic event logging: exposure duration, volume, panics)
                                   │
                                   ▼
  [ End Session ]   ──► [ Post-Session SUDS Prompt (0 - 10 Visual Slider) ]
                                   │
                                   ▼
                   [ Store Session Record in IndexedDB ]
                                   │
                                   ▼
                   [ Parent Portal Graph & CSV Export ]
```

### 7.1 Data Schema & Scale
* **Scale Presentation:** 
  * 0–10 numeric scale coupled with child-friendly visual anchors (0 = Completely Relaxed / Smiling Cloud, 5 = Mildly Annoyed / Neutral Sun, 10 = Severe Distress / Thunderstorm).
* **Metrics Captured Per Session:**
  * `sessionId`: UUIDv4
  * `timestamp`: ISO-8601 string
  * `preSuds`: Number (0–10)
  * `postSuds`: Number (0–10)
  * `deltaSuds`: $\text{postSuds} - \text{preSuds}$
  * `sessionDurationSec`: Integer
  * `triggerSampleId`: String (ID of trigger sound used)
  * `triggerExposureDurationSec`: Integer
  * `averageTriggerGain`: Float (`0.0`–`1.0`)
  * `lowpassFilterFreq`: Integer (Hz)
  * `panicTriggered`: Boolean (and timestamp count)

### 7.2 Clinical Reporting View (Parent Locked)
* Interactive chart (Canvas / SVG) plotting Pre- and Post-SUDS over time.
* Habituation index: Calculated 7-day moving average of $\Delta \text{SUDS}$.
* One-click "Export Clinical Data" button generating a standardized JSON or CSV file for pediatrician or cognitive behavioral therapist (CBT) review.

---

## 8. PWA & Mobile Web Requirements

### 8.1 Offline Architecture & Service Worker
* **Service Worker Strategy:** Cache-first for static assets (HTML, CSS, JS, sound library).
* **Storage Limit Handling:** Estimate quota via `navigator.storage.estimate()`; persist indexedDB storage via `navigator.storage.persist()`.
* **Manifest Configurations:**
  ```json
  {
    "name": "SoundCalm Misophonia Therapy",
    "short_name": "SoundCalm",
    "start_url": "./index.html",
    "display": "standalone",
    "orientation": "portrait-primary",
    "background_color": "#0F172A",
    "theme_color": "#1E293B",
    "icons": [
      {
        "src": "assets/icons/icon-192.png",
        "sizes": "192x192",
        "type": "image/png"
      },
      {
        "src": "assets/icons/icon-512.png",
        "sizes": "512x512",
        "type": "image/png"
      }
    ]
  }
  ```

### 8.2 iOS / Android Web Audio Specific Quirks & Safeguards
1. **Autoplay Policy Unlock:** iOS Safari suspends `AudioContext` until an explicit user gesture (`touchend` or `click`).
   * *Requirement:* Implement a full-screen "Tap to Begin" splash screen that calls `await audioCtx.resume()` before initializing the mixer.
2. **Silent Switch Workaround (iOS):**
   * *Requirement:* Route audio through an invisible `<audio loop playsinline src="assets/audio/silence.mp3">` element linked to `createMediaElementSource` to ensure audio plays even if the physical mute switch is toggled.
3. **Screen Wake Lock API:**
   * Implement `navigator.wakeLock.request('screen')` during active therapy sessions to prevent the display from sleeping and interrupting Web Audio execution.

---

## 9. Data Models & TypeScript Interfaces

```typescript
export interface AudioTrack {
  id: string;
  name: string;
  category: 'calm' | 'game' | 'trigger';
  blob?: Blob;
  url?: string;
  duration: number;
  lowpassCutoffHz?: number;
  normalizedPeakDbfs: number;
}

export interface ParentSettings {
  pinHash: string;
  salt: string;
  maxTriggerCeilingGain: number; // 0.0 to 0.25 (strict cap)
  maxSessionDurationMinutes: number;
  allowedTriggerIds: string[];
  autoFadeoutEnabled: boolean;
  exportFormat: 'json' | 'csv';
}

export interface SessionLog {
  id: string;
  timestamp: string;
  preSuds: number;
  postSuds: number;
  deltaSuds: number;
  sessionDurationSeconds: number;
  triggerSoundId: string;
  triggerExposureSeconds: number;
  effectiveGainRatio: number;
  filterCutoffHz: number;
  panicActivated: boolean;
  panicCount: number;
}
```

---

## 10. Phased Implementation Roadmap for Coding Agent

```
+─────────────────────────────────────────────────────────────────────────────+
|                         AGENT IMPLEMENTATION PHASES                         |
+─────────────────────────────────────────────────────────────────────────────+

  PHASE 1: Audio Engine & Mixer Graph
  ├── Implement AudioContext initializer with user-gesture unlock
  ├── Build Channel A (Soundscape), Channel B (SFX), Channel C (Trigger) buses
  └── Wire up DynamicsCompressorNode, Master Gain, and Safety Limiter

  PHASE 2: In-App Recording & Audio Processing
  ├── Implement getUserMedia audio capture
  ├── Build Canvas waveform display with draggable trim sliders
  └── Implement BiquadFilterNode (lowpass) and RMS normalization routine

  PHASE 3: Spatial Puzzle Gameplay
  ├── Build HTML5 Canvas / SVG interaction loop (no timers, no fail states)
  ├── Hook puzzle completion events to Channel B harmonic sound chimes
  └── Build procedural trigger exposure scheduler (sub-threshold bursts)

  PHASE 4: Safety Architecture & Panic Subsystem
  ├── Implement instant Zero-Delay Panic Button (<10ms mute)
  ├── Build SHA-256 PIN-protected Parent Settings modal
  └── Enforce physical gain ceiling clamps on Channel C

  PHASE 5: SUDS Logging, PWA Offline Shell & Verification
  ├── Build Pre/Post SUDS rating modals with child-friendly visual anchors
  ├── Configure IndexedDB schema for persistent logs and audio storage
  └── Configure Service Worker, Web App Manifest, and iOS wake-lock safeguards
```

---

## 11. Verification & Acceptance Criteria

1. **Audio Latency & Panic Check:** Tapping the Panic Button mutes Channel C within $\le 10 \text{ ms}$ without audible speaker popping or audio engine crashing.
2. **Ceiling Verification:** In Parent Settings, if `maxTriggerCeilingGain` is set to `0.10`, the child-facing volume slider set at 100% outputs an effective gain of strictly `0.10`.
3. **Filter Check:** Trigger audio played through Channel C exhibits steep attenuation above the configured low-pass cutoff frequency (minimum $12 \text{ dB/octave}$ rolloff).
4. **Offline Capability:** Disconnecting network connectivity allows full app functionality, puzzle gameplay, audio recording, and SUDS logging.
5. **Data Integrity:** Completed sessions reliably append to IndexedDB with pre/post SUDS deltas correctly computed and exported.
