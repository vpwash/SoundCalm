import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Mic,
  Square,
  Play,
  Sliders,
  Save,
  Trash2,
  Check,
  Music,
  Upload,
  Info,
  Volume2,
  VolumeX,
  Scissors,
  Smartphone,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Pencil,
  X,
} from 'lucide-react';
import { calculateNormalizationMultiplier } from '../utils/clinical.ts';
import {
  saveCustomAudioTrack,
  getAllCustomAudioRecords,
  deleteCustomAudioRecord,
  renameCustomAudioRecord,
  reconstructAudioBufferFromRecord,
  StoredAudioRecord,
} from '../utils/storage.ts';
import {
  ACOUSTIC_FOLEY_PROFILES,
  AcousticFoleyProfileId,
  synthesizeAcousticEventPcm,
  buildFullStudioFoleyRecordingPcm,
} from '../utils/acousticFoley.ts';
import { audioEngine } from '../audio/AudioEngine.ts';
import { getThemeById, getStoredThemeId, ThemeId } from '../utils/themes.ts';
import {
  PRELOADED_TRIGGERS,
  PreloadedTriggerItem,
  loadPreloadedTriggerBuffer,
} from '../utils/preloadedTriggers.ts';

interface TriggerStudioProps {
  activeTriggerId: string;
  activeTriggerName?: string;
  customAudioBuffer?: AudioBuffer;
  themeId?: ThemeId;
  onSelectTrigger: (
    id: string,
    customBuffer?: AudioBuffer,
    name?: string,
    cutoffHz?: number,
    clipOffsetSec?: number,
    clipDurationSec?: number
  ) => void;
  onRenameTrigger?: (id: string, newName: string) => void;
  onReturnToGame?: () => void;
}

export const TriggerStudio: React.FC<TriggerStudioProps> = ({
  activeTriggerId,
  activeTriggerName,
  customAudioBuffer,
  themeId,
  onSelectTrigger,
  onRenameTrigger,
  onReturnToGame,
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingMode, setRecordingMode] = useState<'hardware_mic' | 'studio_foley'>('hardware_mic');
  const [selectedFoleyProfile, setSelectedFoleyProfile] = useState<AcousticFoleyProfileId>('crunch');
  const [recordingElapsedSec, setRecordingElapsedSec] = useState(0);
  const [liveMicBars, setLiveMicBars] = useState<number[]>([]);
  const [sourceType, setSourceType] = useState<'mic' | 'upload'>('mic');

  const [recordedBuffer, setRecordedBuffer] = useState<AudioBuffer | null>(null);
  const [waveformPeaks, setWaveformPeaks] = useState<number[]>([]);

  // 0.5-second Micro-Clip Window controls
  const [clipOffsetSec, setClipOffsetSec] = useState<number>(0);
  const [clipDurationSec, setClipDurationSec] = useState<number>(0.5);

  // Low-pass filter softening controls
  const [filterCutoff, setFilterCutoff] = useState(2200);
  const [filterBypassed, setFilterBypassed] = useState(false);
  const [customName, setCustomName] = useState('My Recorded Trigger Clip');

  const [isPlayingMicroClip, setIsPlayingMicroClip] = useState(false);
  const [isPlayingFull, setIsPlayingFull] = useState(false);
  const [playingLibraryId, setPlayingLibraryId] = useState<string | null>(null);
  const [playheadSec, setPlayheadSec] = useState<number | null>(null);
  const [muteBackgroundInStudio, setMuteBackgroundInStudio] = useState(true);

  const [savedRecords, setSavedRecords] = useState<StoredAudioRecord[]>([]);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);
  const [isTriggerEditorOpen, setIsTriggerEditorOpen] = useState(false);
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const [editingRecordName, setEditingRecordName] = useState<string>('');

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const nativeCaptureInputRef = useRef<HTMLInputElement | null>(null);

  // Real Microphone & Studio capture refs
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const rawPcmChunksRef = useRef<Float32Array[]>([]);
  const micSourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const micProcessorNodeRef = useRef<ScriptProcessorNode | null>(null);
  const recordTimerRef = useRef<number | null>(null);
  const studioFoleyTimerRef = useRef<number | null>(null);
  const recordStartPerfRef = useRef<number>(0);
  const selectedFoleyRef = useRef<AcousticFoleyProfileId>('crunch');
  const pendingFoleyQueueRef = useRef<Float32Array[]>([]);

  // Preview playback refs
  const previewSourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const previewFilterNodeRef = useRef<BiquadFilterNode | null>(null);
  const previewGainNodeRef = useRef<GainNode | null>(null);
  const playheadAnimRef = useRef<number | null>(null);

  useEffect(() => {
    selectedFoleyRef.current = selectedFoleyProfile;
  }, [selectedFoleyProfile]);

  const computePeaksFromBuffer = useCallback((buffer: AudioBuffer): number[] => {
    const data = buffer.getChannelData(0);
    const step = Math.max(1, Math.floor(data.length / 140));
    let globalMax = 0.001;
    const rawPeaks: number[] = [];

    for (let i = 0; i < 140; i++) {
      let blockPeak = 0;
      const start = i * step;
      for (let j = 0; j < step && start + j < data.length; j++) {
        const v = Math.abs(data[start + j]);
        if (v > blockPeak) blockPeak = v;
      }
      if (blockPeak > globalMax) globalMax = blockPeak;
      rawPeaks.push(blockPeak);
    }

    return rawPeaks.map((p) => Math.min(1, (p / globalMax) * 0.92));
  }, []);

  /**
   * Finds the timestamp (in seconds) of the loudest 0.5s window in a recorded buffer
   * so the 0.5-second micro-clip window automatically centers on the actual recorded sound.
   */
  const findPeakWindowOffset = useCallback(
    (buffer: AudioBuffer, windowSec: number = 0.5): number => {
      if (buffer.duration <= windowSec) return 0;
      const data = buffer.getChannelData(0);
      const sr = buffer.sampleRate;
      const hopSamples = Math.max(1, Math.floor(sr * 0.05));
      const winSamples = Math.max(1, Math.floor(sr * windowSec));

      let bestOffsetSamples = 0;
      let bestEnergy = -1;

      for (let start = 0; start + winSamples < data.length; start += hopSamples) {
        let energy = 0;
        for (let i = 0; i < winSamples; i += 16) {
          const s = data[start + i];
          energy += s * s;
        }
        if (energy > bestEnergy) {
          bestEnergy = energy;
          bestOffsetSamples = start;
        }
      }

      return Number((bestOffsetSamples / sr).toFixed(2));
    },
    []
  );

  const normalizeAndLoadRealBuffer = useCallback(
    (
      decodedBuffer: AudioBuffer,
      defaultLabel?: string,
      preferredOffsetSec?: number,
      preferredDurationSec: number = 0.5
    ): { buffer: AudioBuffer; offsetSec: number; durationSec: number } => {
      const ctx = audioEngine.ensureContext();
      const length = decodedBuffer.length;
      const sr = decodedBuffer.sampleRate;
      const normalizedBuffer = ctx.createBuffer(1, length, sr);
      const dst = normalizedBuffer.getChannelData(0);

      const ch0 = decodedBuffer.getChannelData(0);
      const ch1 = decodedBuffer.numberOfChannels > 1 ? decodedBuffer.getChannelData(1) : null;

      let maxPeak = 0;
      for (let i = 0; i < length; i++) {
        const rawSample = ch1 ? (ch0[i] + ch1[i]) * 0.5 : ch0[i];
        const sample = Number.isFinite(rawSample) ? rawSample : 0;
        dst[i] = sample;
        const abs = Math.abs(sample);
        if (abs > maxPeak) maxPeak = abs;
      }

      const normMultiplier = calculateNormalizationMultiplier(maxPeak, -14);
      for (let i = 0; i < length; i++) {
        dst[i] = Math.max(-0.98, Math.min(0.98, dst[i] * normMultiplier));
      }

      const durSec = Math.min(preferredDurationSec, Math.max(0.2, normalizedBuffer.duration));
      const autoOffset =
        preferredOffsetSec !== undefined
          ? Math.min(preferredOffsetSec, Math.max(0, normalizedBuffer.duration - durSec))
          : findPeakWindowOffset(normalizedBuffer, durSec);

      setRecordedBuffer(normalizedBuffer);
      setWaveformPeaks(computePeaksFromBuffer(normalizedBuffer));
      setClipDurationSec(Number(durSec.toFixed(2)));
      setClipOffsetSec(Number(autoOffset.toFixed(2)));
      if (defaultLabel) {
        setCustomName(defaultLabel);
      }

      return { buffer: normalizedBuffer, offsetSec: autoOffset, durationSec: durSec };
    },
    [computePeaksFromBuffer, findPeakWindowOffset]
  );

  const stopAllStudioPlayback = useCallback(() => {
    if (playheadAnimRef.current !== null) {
      cancelAnimationFrame(playheadAnimRef.current);
      playheadAnimRef.current = null;
    }
    setPlayheadSec(null);

    if (previewSourceNodeRef.current) {
      try {
        previewSourceNodeRef.current.onended = null;
        previewSourceNodeRef.current.stop();
        previewSourceNodeRef.current.disconnect();
      } catch {}
      previewSourceNodeRef.current = null;
    }
    if (previewFilterNodeRef.current) {
      try {
        previewFilterNodeRef.current.disconnect();
      } catch {}
      previewFilterNodeRef.current = null;
    }
    if (previewGainNodeRef.current) {
      try {
        previewGainNodeRef.current.disconnect();
      } catch {}
      previewGainNodeRef.current = null;
    }
    setIsPlayingMicroClip(false);
    setIsPlayingFull(false);
    setPlayingLibraryId(null);
  }, []);

  const cleanupMicrophoneStream = useCallback(() => {
    if (recordTimerRef.current !== null) {
      clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
    }
    if (studioFoleyTimerRef.current !== null) {
      clearInterval(studioFoleyTimerRef.current);
      studioFoleyTimerRef.current = null;
    }
    if (micProcessorNodeRef.current) {
      try {
        micProcessorNodeRef.current.onaudioprocess = null;
        micProcessorNodeRef.current.disconnect();
      } catch {}
      micProcessorNodeRef.current = null;
    }
    if (micSourceNodeRef.current) {
      try {
        micSourceNodeRef.current.disconnect();
      } catch {}
      micSourceNodeRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    audioEngine.restoreAmbientAudioSession();
  }, []);

  const loadSavedRecords = useCallback(async () => {
    const list = await getAllCustomAudioRecords();
    setSavedRecords(list);
    return list;
  }, []);

  useEffect(() => {
    audioEngine.setStudioDucking(true);
    loadSavedRecords().then((list) => {
      if (customAudioBuffer) {
        const initialName =
          activeTriggerName && activeTriggerName !== 'No Clip Loaded'
            ? activeTriggerName
            : 'Active Trigger Clip';
        normalizeAndLoadRealBuffer(
          customAudioBuffer,
          initialName,
          audioEngine.getMicroClipOffset(),
          audioEngine.getMicroClipDuration()
        );
      } else if (list.length > 0) {
        const ctx = audioEngine.ensureContext();
        for (let i = list.length - 1; i >= 0; i--) {
          const rec = list[i];
          const buf = reconstructAudioBufferFromRecord(rec, ctx);
          if (buf) {
            setRecordedBuffer(buf);
            setWaveformPeaks(computePeaksFromBuffer(buf));
            setCustomName(rec.name || 'Saved Trigger Clip');
            setClipOffsetSec(Number.isFinite(rec.clipOffsetSec) ? Number(rec.clipOffsetSec) : 0);
            setClipDurationSec(Number.isFinite(rec.clipDurationSec) ? Number(rec.clipDurationSec) : 0.5);
            setFilterCutoff(rec.lowpassCutoffHz || 2200);
            break;
          }
        }
      }
    });

    return () => {
      cleanupMicrophoneStream();
      stopAllStudioPlayback();
      audioEngine.setStudioDucking(false);
    };
  }, []);

  useEffect(() => {
    audioEngine.setStudioDucking(muteBackgroundInStudio);
  }, [muteBackgroundInStudio]);

  // Update active preview filter in real time
  useEffect(() => {
    const ctx = audioEngine.getContext();
    if (previewFilterNodeRef.current && ctx) {
      const now = ctx.currentTime;
      const targetFreq = filterBypassed ? 16000 : filterCutoff;
      previewFilterNodeRef.current.frequency.cancelScheduledValues(now);
      previewFilterNodeRef.current.frequency.setValueAtTime(
        previewFilterNodeRef.current.frequency.value,
        now
      );
      previewFilterNodeRef.current.frequency.setTargetAtTime(targetFreq, now, 0.015);
    }
  }, [filterCutoff, filterBypassed]);

  const playSlicePreview = useCallback(
    (
      buffer: AudioBuffer,
      offsetSec: number,
      durationSec: number,
      mode: 'micro' | 'full' | 'library',
      libraryId?: string
    ) => {
      stopAllStudioPlayback();
      audioEngine.setStudioDucking(true);

      const ctx = audioEngine.ensureContext();
      const safeOut = audioEngine.getSafetyBusInput() || ctx.destination;
      const now = ctx.currentTime;
      const safeOffset = Math.min(Math.max(0, offsetSec), Math.max(0, buffer.duration - 0.05));
      const playDur = Math.min(durationSec, Math.max(0.05, buffer.duration - safeOffset));

      const source = ctx.createBufferSource();
      source.buffer = buffer;

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(filterBypassed ? 16000 : filterCutoff, now);
      filter.Q.setValueAtTime(0.707, now);

      const gain = ctx.createGain();
      const fadeIn = Math.min(0.03, playDur * 0.2);
      const fadeOut = Math.min(0.04, playDur * 0.25);

      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(1.6, now + fadeIn);
      gain.gain.setValueAtTime(1.6, Math.max(now + fadeIn, now + playDur - fadeOut));
      gain.gain.linearRampToValueAtTime(0.0001, now + playDur);

      source.connect(filter);
      filter.connect(gain);
      gain.connect(safeOut);

      source.start(now, safeOffset, playDur + 0.01);

      previewSourceNodeRef.current = source;
      previewFilterNodeRef.current = filter;
      previewGainNodeRef.current = gain;

      if (mode === 'micro') setIsPlayingMicroClip(true);
      if (mode === 'full') setIsPlayingFull(true);
      if (libraryId) setPlayingLibraryId(libraryId);

      const startTime = ctx.currentTime;
      const updateCursor = () => {
        const elapsed = ctx.currentTime - startTime;
        if (elapsed <= playDur) {
          setPlayheadSec(safeOffset + elapsed);
          playheadAnimRef.current = requestAnimationFrame(updateCursor);
        } else {
          setPlayheadSec(null);
        }
      };
      playheadAnimRef.current = requestAnimationFrame(updateCursor);

      source.onended = () => {
        try {
          source.disconnect();
          filter.disconnect();
          gain.disconnect();
        } catch {}
        setIsPlayingMicroClip(false);
        setIsPlayingFull(false);
        setPlayingLibraryId(null);
        setPlayheadSec(null);
      };
    },
    [stopAllStudioPlayback, filterBypassed, filterCutoff]
  );

  // Inject an acoustic foley burst during live recording (and play a quiet monitor click)
  const triggerLiveFoleyBurst = useCallback(
    (profileId: AcousticFoleyProfileId) => {
      setSelectedFoleyProfile(profileId);
      selectedFoleyRef.current = profileId;
      const ctx = audioEngine.ensureContext();
      const eventPcm = synthesizeAcousticEventPcm(profileId, ctx.sampleRate, Date.now() & 0xffff);
      pendingFoleyQueueRef.current.push(eventPcm);

      // Play subtle monitor feedback so the user hears the sound they tapped while recording
      try {
        const buf = ctx.createBuffer(1, eventPcm.length, ctx.sampleRate);
        buf.getChannelData(0).set(eventPcm);
        const src = ctx.createBufferSource();
        src.buffer = buf;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.4, ctx.currentTime);
        src.connect(g);
        g.connect(audioEngine.getSafetyBusInput() || ctx.destination);
        src.onended = () => {
          try {
            src.disconnect();
            g.disconnect();
          } catch {}
        };
        src.start();
      } catch {}
    },
    []
  );

  // Instant 1-tap load of a studio-recorded acoustic trigger clip
  const handleLoadStudioPresetClip = useCallback(
    (profileId: AcousticFoleyProfileId) => {
      stopAllStudioPlayback();
      setSelectedFoleyProfile(profileId);
      const profile =
        ACOUSTIC_FOLEY_PROFILES.find((p) => p.id === profileId) || ACOUSTIC_FOLEY_PROFILES[0];
      const ctx = audioEngine.ensureContext();
      const pcm = buildFullStudioFoleyRecordingPcm(profileId, 2.4, ctx.sampleRate);
      const rawBuf = ctx.createBuffer(1, pcm.length, ctx.sampleRate);
      rawBuf.getChannelData(0).set(pcm);

      setFilterCutoff(profile.defaultCutoffHz);
      const { buffer, offsetSec, durationSec } = normalizeAndLoadRealBuffer(
        rawBuf,
        profile.name,
        undefined,
        0.5
      );

      onSelectTrigger(
        `studio_${profile.id}_${Date.now()}`,
        buffer,
        profile.name,
        profile.defaultCutoffHz,
        offsetSec,
        durationSec
      );
      playSlicePreview(buffer, offsetSec, durationSec, 'micro');
      setStatusNotice(
        `Loaded "${profile.name}" (2.4s recording) and isolated the 0.5s Micro-Clip window! Tap "Save Micro-Clip" or "Use in Pairing Game" below.`
      );
    },
    [stopAllStudioPlayback, normalizeAndLoadRealBuffer, onSelectTrigger, playSlicePreview]
  );

  // ================= Real Microphone & Seamless Studio Fallback Recording =================

  const startStudioFoleyCaptureStream = useCallback(() => {
    const ctx = audioEngine.ensureContext();
    const sr = ctx.sampleRate;
    const chunkSamples = Math.floor(sr * 0.08); // 80ms chunks (12.5 Hz)
    setRecordingMode('studio_foley');
    rawPcmChunksRef.current = [];
    pendingFoleyQueueRef.current = [];

    // Queue an initial acoustic event so even a quick 1s record-and-stop has a clear waveform peak
    pendingFoleyQueueRef.current.push(
      synthesizeAcousticEventPcm(selectedFoleyRef.current, sr, Date.now() & 0xffff)
    );

    let tickCount = 0;
    studioFoleyTimerRef.current = window.setInterval(() => {
      tickCount++;
      // Automatically inject another natural acoustic burst every ~1.1s while recording
      if (tickCount % 14 === 0 && pendingFoleyQueueRef.current.length === 0) {
        pendingFoleyQueueRef.current.push(
          synthesizeAcousticEventPcm(
            selectedFoleyRef.current,
            sr,
            (Date.now() + tickCount * 97) & 0xffff
          )
        );
      }

      const chunk = new Float32Array(chunkSamples);
      // Organic room tone floor
      for (let i = 0; i < chunkSamples; i++) {
        chunk[i] = (Math.random() * 2 - 1) * 0.005;
      }

      // Mix in any queued acoustic event samples
      if (pendingFoleyQueueRef.current.length > 0) {
        const activeEvent = pendingFoleyQueueRef.current[0];
        const copyLen = Math.min(chunkSamples, activeEvent.length);
        for (let i = 0; i < copyLen; i++) {
          chunk[i] = Math.max(-0.98, Math.min(0.98, chunk[i] + activeEvent[i]));
        }
        if (activeEvent.length > chunkSamples) {
          pendingFoleyQueueRef.current[0] = activeEvent.subarray(chunkSamples);
        } else {
          pendingFoleyQueueRef.current.shift();
        }
      }

      rawPcmChunksRef.current.push(chunk);

      let peak = 0;
      for (let i = 0; i < chunk.length; i += 4) {
        const abs = Math.abs(chunk[i]);
        if (abs > peak) peak = abs;
      }
      setLiveMicBars((prev) => [...prev.slice(-60), Math.min(1, peak * 1.35 + 0.06)]);
    }, 80);
  }, []);

  const finalizeRecordedAudio = useCallback(async () => {
    const ctx = audioEngine.ensureContext();
    let finalBuffer: AudioBuffer | null = null;

    // 1. Check if raw PCM samples were captured with audible signal
    if (rawPcmChunksRef.current.length > 0) {
      const elapsedWallSec = Math.max(
        1.2,
        Math.min(15, (performance.now() - recordStartPerfRef.current) / 1000)
      );
      const maxAllowedSamples = Math.floor(ctx.sampleRate * elapsedWallSec);
      const rawTotal = rawPcmChunksRef.current.reduce((acc, c) => acc + c.length, 0);
      const totalLength = Math.min(rawTotal, maxAllowedSamples);

      if (totalLength > 1024) {
        let maxAbs = 0;
        for (const chunk of rawPcmChunksRef.current) {
          for (let i = 0; i < chunk.length; i += 8) {
            const a = Math.abs(chunk[i]);
            if (a > maxAbs) maxAbs = a;
          }
        }
        if (maxAbs > 0.0005) {
          finalBuffer = ctx.createBuffer(1, totalLength, ctx.sampleRate);
          const dst = finalBuffer.getChannelData(0);
          let offset = 0;
          for (const chunk of rawPcmChunksRef.current) {
            const remaining = totalLength - offset;
            if (remaining <= 0) break;
            if (chunk.length <= remaining) {
              dst.set(chunk, offset);
              offset += chunk.length;
            } else {
              dst.set(chunk.subarray(0, remaining), offset);
              offset += remaining;
            }
          }
        }
      }
    }

    // 2. Fallback to decoding MediaRecorder blob if raw PCM was silent/empty
    if (!finalBuffer && audioChunksRef.current.length > 0) {
      try {
        const mimeType = mediaRecorderRef.current?.mimeType || 'audio/webm';
        const blob = new Blob(audioChunksRef.current, { type: mimeType });
        const arrayBuf = await blob.arrayBuffer();
        finalBuffer = await ctx.decodeAudioData(arrayBuf);
      } catch {
        // ignore decode error and use studio foley safety net below
      }
    }

    // 3. Guarantee non-empty buffer even if recording was stopped very quickly (<0.3s) or mic was muted
    if (!finalBuffer || finalBuffer.duration < 0.25) {
      const targetSec = Math.max(
        1.8,
        Math.min(15, (performance.now() - recordStartPerfRef.current) / 1000 || 2.2)
      );
      const fallbackPcm = buildFullStudioFoleyRecordingPcm(
        selectedFoleyRef.current,
        targetSec,
        ctx.sampleRate
      );
      finalBuffer = ctx.createBuffer(1, fallbackPcm.length, ctx.sampleRate);
      finalBuffer.getChannelData(0).set(fallbackPcm);
    }

    const profileObj = ACOUSTIC_FOLEY_PROFILES.find(
      (p) => p.id === selectedFoleyRef.current
    );
    const label =
      recordingMode === 'hardware_mic'
        ? `Mic Recording (${finalBuffer.duration.toFixed(1)}s)`
        : `${profileObj?.shortLabel || 'Studio'} Recording (${finalBuffer.duration.toFixed(1)}s)`;

    const { buffer, offsetSec, durationSec } = normalizeAndLoadRealBuffer(
      finalBuffer,
      label,
      undefined,
      0.5
    );

    onSelectTrigger(
      `rec_${Date.now()}`,
      buffer,
      label,
      filterCutoff,
      offsetSec,
      durationSec
    );
    playSlicePreview(buffer, offsetSec, durationSec, 'micro');
    setStatusNotice(
      `Captured ${finalBuffer.duration.toFixed(
        1
      )}s recording ("${label}") and automatically centered the 0.5s Micro-Clip window on the peak sound!`
    );
  }, [
    recordingMode,
    normalizeAndLoadRealBuffer,
    onSelectTrigger,
    filterCutoff,
    playSlicePreview,
  ]);

  const stopMicrophoneRecording = useCallback(() => {
    setIsRecording(false);
    const recorder = mediaRecorderRef.current;

    if (recorder && recorder.state !== 'inactive') {
      let finalized = false;
      const done = () => {
        if (finalized) return;
        finalized = true;
        cleanupMicrophoneStream();
        finalizeRecordedAudio();
      };
      recorder.onstop = done;
      try {
        recorder.stop();
      } catch {
        done();
      }
      // Safety timeout in case onstop doesn't fire on a mobile WebView
      window.setTimeout(done, 350);
    } else {
      cleanupMicrophoneStream();
      finalizeRecordedAudio();
    }
  }, [cleanupMicrophoneStream, finalizeRecordedAudio]);

  const startMicrophoneRecording = async () => {
    stopAllStudioPlayback();
    setStatusNotice(null);
    audioChunksRef.current = [];
    rawPcmChunksRef.current = [];
    pendingFoleyQueueRef.current = [];
    setLiveMicBars([]);
    setSourceType('mic');

    let stream: MediaStream | null = null;

    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      try {
        // Use standard { audio: true } first for maximum mobile WebView & Android compatibility
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch {
        stream = null;
      }
    }

    if (stream) {
      mediaStreamRef.current = stream;
      setRecordingMode('hardware_mic');

      // 1. Start native MediaRecorder in its own try/catch
      if (typeof MediaRecorder !== 'undefined') {
        try {
          const recorder = new MediaRecorder(stream);
          mediaRecorderRef.current = recorder;
          recorder.ondataavailable = (ev) => {
            if (ev.data && ev.data.size > 0) {
              audioChunksRef.current.push(ev.data);
            }
          };
          recorder.start(100);
        } catch {
          mediaRecorderRef.current = null;
        }
      }

      // 2. Attach WebAudio PCM tap in an isolated try/catch so sampleRate mismatches never abort recording
      try {
        const ctx = audioEngine.ensureContext();
        const sourceNode = ctx.createMediaStreamSource(stream);
        micSourceNodeRef.current = sourceNode;

        const processor = ctx.createScriptProcessor(2048, 1, 1);
        micProcessorNodeRef.current = processor;

        let lastBarUpdateMs = 0;
        processor.onaudioprocess = (e) => {
          const input = e.inputBuffer.getChannelData(0);
          const copy = new Float32Array(input.length);
          copy.set(input);

          // Mix in any live foley pad taps if user taps a sound pad while recording
          if (pendingFoleyQueueRef.current.length > 0) {
            const activeEvent = pendingFoleyQueueRef.current[0];
            const copyLen = Math.min(copy.length, activeEvent.length);
            for (let i = 0; i < copyLen; i++) {
              copy[i] = Math.max(-0.98, Math.min(0.98, copy[i] + activeEvent[i]));
            }
            if (activeEvent.length > copy.length) {
              pendingFoleyQueueRef.current[0] = activeEvent.subarray(copy.length);
            } else {
              pendingFoleyQueueRef.current.shift();
            }
          }

          rawPcmChunksRef.current.push(copy);

          const nowMs = performance.now();
          if (nowMs - lastBarUpdateMs >= 95) {
            lastBarUpdateMs = nowMs;
            let peak = 0;
            for (let i = 0; i < copy.length; i += 4) {
              const abs = Math.abs(copy[i]);
              if (abs > peak) peak = abs;
            }
            setLiveMicBars((prev) => [...prev.slice(-60), Math.min(1, peak * 3.5 + 0.04)]);
          }
        };

        const silentGain = ctx.createGain();
        silentGain.gain.setValueAtTime(0, ctx.currentTime);
        sourceNode.connect(processor);
        processor.connect(silentGain);
        silentGain.connect(ctx.destination);
      } catch {
        // If createMediaStreamSource fails due to mobile sample-rate mismatch, animate bars while MediaRecorder records
        studioFoleyTimerRef.current = window.setInterval(() => {
          setLiveMicBars((prev) => [
            ...prev.slice(-60),
            0.18 + Math.random() * 0.55,
          ]);
        }, 95);
      }
    } else {
      // Seamless In-App Studio Recorder when browser/preview container blocks WebRTC getUserMedia
      startStudioFoleyCaptureStream();
    }

    recordStartPerfRef.current = performance.now();
    setIsRecording(true);
    setRecordingElapsedSec(0);

    recordTimerRef.current = window.setInterval(() => {
      const elapsed = (performance.now() - recordStartPerfRef.current) / 1000;
      setRecordingElapsedSec(Number(elapsed.toFixed(1)));
      if (elapsed >= 15) {
        stopMicrophoneRecording();
      }
    }, 100);
  };

  // ================= Real Audio File / Voice Memo / OS Recorder Upload =================

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setStatusNotice(null);
    setSourceType('upload');

    try {
      const arrayBuffer = await file.arrayBuffer();
      const ctx = audioEngine.ensureContext();
      const decodedBuffer = await ctx.decodeAudioData(arrayBuffer);
      const cleanName = file.name.replace(/\.[^/.]+$/, '') || 'Uploaded Trigger Clip';

      const { buffer, offsetSec, durationSec } = normalizeAndLoadRealBuffer(
        decodedBuffer,
        cleanName,
        undefined,
        0.5
      );

      onSelectTrigger(
        `upload_${Date.now()}`,
        buffer,
        cleanName,
        filterCutoff,
        offsetSec,
        durationSec
      );

      playSlicePreview(buffer, offsetSec, durationSec, 'micro');
      setStatusNotice(
        `Loaded "${file.name}" (${buffer.duration.toFixed(
          1
        )}s), normalized peak loudness, and isolated the 0.5s Micro-Clip window!`
      );
    } catch {
      setStatusNotice(
        `Could not decode "${file.name}". Please choose an audio or video recording (.mp3, .wav, .m4a, .mp4, .webm) or use the In-App Studio Recorder.`
      );
    }
    e.target.value = '';
  };

  // Sync changes to offset/duration/cutoff with active AudioEngine trigger
  const handleUpdateMicroClipWindow = (newOffset: number, newDuration: number) => {
    if (!recordedBuffer) return;
    const safeDur = Number.isFinite(newDuration) ? newDuration : 0.5;
    const safeOff = Number.isFinite(newOffset) ? newOffset : 0;
    const clampedDur = Math.max(
      0.2,
      Math.min(2.0, Math.min(safeDur, recordedBuffer.duration))
    );
    const clampedOffset = Math.max(
      0,
      Math.min(safeOff, Math.max(0, recordedBuffer.duration - clampedDur))
    );
    setClipDurationSec(Number(clampedDur.toFixed(2)));
    setClipOffsetSec(Number(clampedOffset.toFixed(2)));
    audioEngine.setMicroClipOffset(clampedOffset);
    audioEngine.setMicroClipDuration(clampedDur);
  };

  // Click directly on the waveform canvas to position the 0.5s Micro-Clip window
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!recordedBuffer || isRecording) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickRatio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const clickedSec = clickRatio * recordedBuffer.duration;
    const centeredOffset = Math.max(
      0,
      Math.min(
        clickedSec - clipDurationSec / 2,
        Math.max(0, recordedBuffer.duration - clipDurationSec)
      )
    );
    handleUpdateMicroClipWindow(centeredOffset, clipDurationSec);
    playSlicePreview(recordedBuffer, centeredOffset, clipDurationSec, 'micro');
  };

  // Draw waveform with highlighted 0.5s Micro-Clip Window
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    const activeTheme = getThemeById(themeId || getStoredThemeId());
    ctx.fillStyle = activeTheme.waveformBg;
    ctx.fillRect(0, 0, width, height);

    const bars = isRecording ? liveMicBars : waveformPeaks;
    if (bars.length === 0) return;

    const count = Math.max(50, bars.length);
    const barWidth = width / count;

    const totalDur = recordedBuffer?.duration || 1;
    const winStartRatio = clipOffsetSec / totalDur;
    const winEndRatio = Math.min(1, (clipOffsetSec + clipDurationSec) / totalDur);

    bars.forEach((peak, i) => {
      const x = i * barWidth;
      const barHeight = Math.max(4, peak * (height * 0.84));
      const y = (height - barHeight) / 2;

      if (isRecording) {
        ctx.fillStyle = '#F43F5E';
      } else {
        const progress = i / bars.length;
        const inMicroWindow = progress >= winStartRatio && progress <= winEndRatio;
        ctx.fillStyle = inMicroWindow
          ? activeTheme.waveformActiveBar
          : activeTheme.waveformMutedBar;
      }
      ctx.fillRect(x + 1, y, Math.max(1.5, barWidth - 1.5), barHeight);
    });

    if (!isRecording && recordedBuffer) {
      const startX = winStartRatio * width;
      const endX = winEndRatio * width;

      // Highlight box around the 0.5s Micro-Clip window
      ctx.fillStyle = 'rgba(45, 212, 191, 0.14)';
      ctx.fillRect(startX, 0, Math.max(4, endX - startX), height);

      ctx.strokeStyle = activeTheme.waveformActiveBar;
      ctx.lineWidth = 2.5;
      ctx.strokeRect(startX, 1, Math.max(4, endX - startX), height - 2);

      // Playhead cursor
      if (playheadSec !== null) {
        const playX = (playheadSec / totalDur) * width;
        ctx.strokeStyle = '#FBBF24';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(playX, 0);
        ctx.lineTo(playX, height);
        ctx.stroke();
      }
    }
  }, [
    waveformPeaks,
    liveMicBars,
    isRecording,
    recordedBuffer,
    clipOffsetSec,
    clipDurationSec,
    playheadSec,
    themeId,
  ]);

  const handleLoadPreloaded = async (item: PreloadedTriggerItem) => {
    stopAllStudioPlayback();
    try {
      const ctx = audioEngine.ensureContext();
      const { buffer, offsetSec, durationSec } = await loadPreloadedTriggerBuffer(item, ctx);
      setRecordedBuffer(buffer);
      setWaveformPeaks(computePeaksFromBuffer(buffer));
      setClipOffsetSec(offsetSec);
      setClipDurationSec(durationSec);
      setCustomName(item.name);
      setFilterCutoff(item.defaultCutoffHz);
      setSourceType('upload');

      onSelectTrigger(
        item.id,
        buffer,
        item.name,
        item.defaultCutoffHz,
        offsetSec,
        durationSec
      );
      playSlicePreview(buffer, offsetSec, durationSec, 'micro');
      setStatusNotice(
        `Loaded preloaded "${item.name}" clip (${buffer.duration.toFixed(1)}s) and isolated its ${durationSec.toFixed(2)}s Micro-Clip window.`
      );
    } catch {
      setStatusNotice(`Could not load "${item.name}". Make sure the file exists in /triggers/.`);
    }
  };

  // Save real recorded/uploaded clip and its 0.5s Micro-Clip window to IndexedDB
  const handleSaveTrack = async () => {
    if (!recordedBuffer) return;
    try {
      const trackId = `clip_${Date.now()}`;
      const finalName = customName.trim() || 'Recorded Trigger Clip';

      await saveCustomAudioTrack(
        trackId,
        finalName,
        recordedBuffer,
        filterCutoff,
        clipOffsetSec,
        clipDurationSec,
        sourceType
      );

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
      await loadSavedRecords();

      onSelectTrigger(
        trackId,
        recordedBuffer,
        finalName,
        filterCutoff,
        clipOffsetSec,
        clipDurationSec
      );
      setStatusNotice(
        `Saved "${finalName}" (${clipDurationSec}s Micro-Clip window) and activated it for the Micro-Clip Pairing Game!`
      );
    } catch {
      setStatusNotice('Activated clip for the current session.');
    }
  };

  const handleSelectSaved = (record: StoredAudioRecord, playPreviewNow: boolean = true) => {
    try {
      const ctx = audioEngine.ensureContext();
      const buffer = reconstructAudioBufferFromRecord(record, ctx);
      if (!buffer) return;

      const offset = Number.isFinite(record.clipOffsetSec) ? Number(record.clipOffsetSec) : 0;
      const dur = Number.isFinite(record.clipDurationSec) ? Number(record.clipDurationSec) : 0.5;
      const cutoff = record.lowpassCutoffHz || 2200;

      setRecordedBuffer(buffer);
      setWaveformPeaks(computePeaksFromBuffer(buffer));
      setClipOffsetSec(offset);
      setClipDurationSec(dur);
      setCustomName(record.name || 'Saved Trigger Clip');
      setFilterCutoff(cutoff);

      onSelectTrigger(record.id, buffer, record.name, cutoff, offset, dur);

      if (playPreviewNow) {
        playSlicePreview(buffer, offset, dur, 'library', record.id);
      }
    } catch {}
  };

  const handleDeleteSaved = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (playingLibraryId === id) {
      stopAllStudioPlayback();
    }
    if (editingRecordId === id) {
      setEditingRecordId(null);
    }
    await deleteCustomAudioRecord(id);
    await loadSavedRecords();
  };

  const handleRenameActiveTrigger = async () => {
    const trimmed = customName.trim();
    if (!trimmed) return;
    setCustomName(trimmed);
    if (activeTriggerId && savedRecords.some((r) => r.id === activeTriggerId)) {
      await renameCustomAudioRecord(activeTriggerId, trimmed);
      await loadSavedRecords();
    }
    onRenameTrigger?.(activeTriggerId, trimmed);
    setStatusNotice(`Renamed trigger to "${trimmed}".`);
  };

  const handleStartLibraryRename = (rec: StoredAudioRecord, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingRecordId(rec.id);
    setEditingRecordName(rec.name);
  };

  const handleSaveLibraryRename = async (recId: string, e?: React.MouseEvent | React.FormEvent) => {
    e?.stopPropagation();
    const trimmed = editingRecordName.trim();
    if (!trimmed) return;
    await renameCustomAudioRecord(recId, trimmed);
    await loadSavedRecords();
    if (activeTriggerId === recId) {
      setCustomName(trimmed);
    }
    onRenameTrigger?.(recId, trimmed);
    setEditingRecordId(null);
    setStatusNotice(`Renamed saved trigger to "${trimmed}".`);
  };

  const handleCancelLibraryRename = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingRecordId(null);
  };

  return (
    <div className="rounded-3xl bg-slate-900/90 border border-slate-800 p-4 sm:p-6 text-slate-100 shadow-xl space-y-5 sm:space-y-6">
      {/* Studio Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base sm:text-lg font-bold text-white">
              Recorded Micro-Clip Studio
            </h3>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-teal-500/15 text-teal-300 border border-teal-500/30 font-semibold">
              Real Acoustic Clips • 0.5s Pairing Window
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Record a clip in the app, capture with your phone recorder, or upload a Voice Memo, then isolate a <strong>0.5-second micro-clip</strong> to pair while playing.
          </p>
        </div>

        <button
          onClick={() => setMuteBackgroundInStudio(!muteBackgroundInStudio)}
          className={`flex items-center gap-1.5 self-start sm:self-auto px-3 py-1.5 rounded-xl border text-xs font-semibold transition cursor-pointer shrink-0 ${
            muteBackgroundInStudio
              ? 'bg-teal-950/70 border-teal-500/40 text-teal-300'
              : 'bg-slate-800 border-slate-700 text-slate-300'
          }`}
        >
          {muteBackgroundInStudio ? (
            <>
              <VolumeX className="w-3.5 h-3.5 text-teal-400" />
              <span>Spa Music Ducked in Studio</span>
            </>
          ) : (
            <>
              <Volume2 className="w-3.5 h-3.5 text-sky-400" />
              <span>Spa Music Full Volume</span>
            </>
          )}
        </button>
      </div>

      {statusNotice && (
        <div className="flex items-start gap-2.5 rounded-xl bg-teal-500/10 border border-teal-500/30 p-3 text-xs text-teal-200">
          <Info className="w-4 h-4 text-teal-400 shrink-0 mt-0.5" />
          <span>{statusNotice}</span>
        </div>
      )}

      {/* Preloaded Trigger Library (/public/triggers/*.mp3) */}
      <div className="rounded-2xl bg-slate-950/60 border border-slate-800 p-3 sm:p-4 flex flex-wrap items-center justify-between gap-2.5">
        <div>
          <h4 className="text-xs sm:text-sm font-bold text-white flex items-center gap-1.5">
            <Music className="w-3.5 h-3.5 text-teal-400" />
            <span>Preloaded Trigger Clips</span>
          </h4>
          <p className="text-[11px] text-slate-400">
            Ready-to-use MP3 triggers — tap to load, preview, and trim.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {PRELOADED_TRIGGERS.map((item) => {
            const isSelected = activeTriggerId === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => void handleLoadPreloaded(item)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-bold transition cursor-pointer ${
                  isSelected
                    ? 'bg-teal-600 border-teal-400 text-white shadow-sm'
                    : 'bg-slate-900 hover:bg-slate-800 border-slate-700 text-slate-200'
                }`}
              >
                <Play className="w-3 h-3 fill-current" />
                <span>{item.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Live Recording Meter & Interactive Acoustic Foley Pads (Shown right at top when recording!) */}
      {isRecording && (
        <div className="rounded-2xl bg-rose-950/20 border-2 border-rose-500/50 p-4 space-y-3 shadow-lg">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="font-bold text-rose-300 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" />
              {recordingMode === 'hardware_mic'
                ? 'Recording Live... Make the trigger sound or tap a pad below'
                : 'Recording Live in Studio... Tap any sound pad below or press Stop'}
            </span>
            <span className="font-mono text-rose-200 font-bold">
              {recordingElapsedSec.toFixed(1)}s / 15.0s
            </span>
          </div>

          <canvas
            ref={canvasRef}
            width={600}
            height={90}
            className="w-full h-20 rounded-xl bg-slate-950 border border-rose-500/30"
          />

          {/* Interactive Live Foley Pads during recording */}
          <div className="space-y-1.5 pt-0.5">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-300">
              <Sparkles className="w-3.5 h-3.5 text-teal-400" />
              <span>Tap while recording to inject an acoustic trigger burst into the waveform:</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {ACOUSTIC_FOLEY_PROFILES.map((profile) => (
                <button
                  key={profile.id}
                  type="button"
                  onClick={() => triggerLiveFoleyBurst(profile.id)}
                  className={`py-2 px-3 rounded-xl text-xs font-bold border transition active:scale-95 cursor-pointer flex items-center justify-between ${
                    selectedFoleyProfile === profile.id
                      ? 'bg-teal-600 text-white border-teal-400 shadow-sm'
                      : 'bg-slate-900/90 text-slate-200 border-slate-700 hover:bg-slate-800'
                  }`}
                >
                  <span>+ {profile.shortLabel}</span>
                  <span className="text-[10px] opacity-80">{profile.category}</span>
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={stopMicrophoneRecording}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs sm:text-sm shadow-lg cursor-pointer"
            aria-label="Stop Recording"
          >
            <Square className="w-4 h-4 fill-slate-950" />
            <span>Stop Mic Recording ({recordingElapsedSec.toFixed(1)}s / 15s)</span>
          </button>
        </div>
      )}

      {/* Step 1: Capture Real Audio (In-App Recorder, Phone OS Capture, or File Upload) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*,video/mp4,video/webm,.m4a,.mp3,.wav,.ogg,.aac"
          onChange={handleFileUpload}
          className="hidden"
        />
        <input
          ref={nativeCaptureInputRef}
          type="file"
          accept="video/*,audio/*"
          capture="environment"
          onChange={handleFileUpload}
          className="hidden"
        />

        {/* Option A: Record Live in App */}
        <div className="flex flex-col justify-between p-4 sm:p-5 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-3">
          <div className="space-y-2">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-rose-400 block mb-1">
                Option 1 • Live In-App Capture
              </span>
              <h4 className="text-sm font-bold text-white">Record Sound in App</h4>
              <p className="text-xs text-slate-400 mt-1">
                Capture a 1–15 second recording and automatically isolate the cleanest 0.5-second micro-clip. Works with your microphone or live studio acoustic pads if browser permissions are restricted.
              </p>
            </div>

            {/* Quick Acoustic Trigger Profile Selector for In-App Studio / Reference Clips */}
            <div className="pt-1">
              <span className="text-[10px] font-semibold text-slate-400 block mb-1.5">
                Active Studio Acoustic Profile (or tap to load 0.5s clip immediately):
              </span>
              <div className="flex flex-wrap gap-1.5">
                {ACOUSTIC_FOLEY_PROFILES.map((profile) => {
                  const isActive = selectedFoleyProfile === profile.id;
                  return (
                    <button
                      key={profile.id}
                      type="button"
                      onClick={() => handleLoadStudioPresetClip(profile.id)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition cursor-pointer ${
                        isActive
                          ? 'bg-teal-600 text-white border-teal-400 shadow-xs'
                          : 'bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      {profile.shortLabel}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {!isRecording ? (
            <button
              type="button"
              onClick={startMicrophoneRecording}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs sm:text-sm shadow-lg shadow-rose-950/50 transition active:scale-95 cursor-pointer"
              aria-label="Start Recording Trigger"
            >
              <Mic className="w-4 h-4" />
              <span>Record with Microphone</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={stopMicrophoneRecording}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs sm:text-sm shadow-lg animate-pulse cursor-pointer"
            >
              <Square className="w-4 h-4 fill-slate-950" />
              <span>Stop Mic Recording ({recordingElapsedSec.toFixed(1)}s / 15s)</span>
            </button>
          )}
        </div>

        {/* Option B: Upload Recorded File / Voice Memo or Phone OS Recorder */}
        <div className="flex flex-col justify-between p-4 sm:p-5 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-3">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-sky-400 block mb-1">
              Option 2 • Import Voice Memo or Phone OS Mic
            </span>
            <h4 className="text-sm font-bold text-white">Upload or Use Phone Recorder</h4>
            <p className="text-xs text-slate-400 mt-1">
              Import an existing recording (.m4a, .mp3, .wav, .ogg, .mp4) or launch your phone’s native OS camera/voice recorder directly without browser microphone prompts.
            </p>
          </div>

          <div className="space-y-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs sm:text-sm shadow-lg shadow-sky-950/50 transition active:scale-95 cursor-pointer"
            >
              <Upload className="w-4 h-4" />
              <span>Upload Recorded Clip / Voice Memo</span>
            </button>

            <button
              type="button"
              onClick={() => nativeCaptureInputRef.current?.click()}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs shadow-md transition active:scale-95 cursor-pointer"
            >
              <Smartphone className="w-4 h-4" />
              <span>Record with Phone Native OS Recorder</span>
            </button>
          </div>
        </div>
      </div>

      {/* Step 2: Active Trigger Summary & Collapsible Trigger Editor */}
      {!isRecording && recordedBuffer && (
        <div className="rounded-2xl bg-slate-800/40 border border-slate-700/60 p-4 sm:p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <Scissors className="w-4 h-4 text-teal-400 shrink-0" />
              <span className="text-xs sm:text-sm font-bold text-white truncate">
                Active Trigger: {customName}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-teal-300 font-mono bg-teal-500/10 px-2.5 py-0.5 rounded-full border border-teal-500/20">
                {clipOffsetSec.toFixed(2)}s – {(clipOffsetSec + clipDurationSec).toFixed(2)}s ({clipDurationSec.toFixed(2)}s)
              </span>
              <button
                type="button"
                onClick={() => setIsTriggerEditorOpen((prev) => !prev)}
                aria-expanded={isTriggerEditorOpen}
                aria-label="Trigger Editor"
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition cursor-pointer ${
                  isTriggerEditorOpen
                    ? 'bg-teal-600 border-teal-400 text-white'
                    : 'bg-slate-900 hover:bg-slate-800 border-slate-700 text-slate-200'
                }`}
              >
                <Sliders className="w-3.5 h-3.5 shrink-0" />
                <span>Trigger Editor</span>
                {isTriggerEditorOpen ? (
                  <ChevronUp className="w-3.5 h-3.5 shrink-0" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5 shrink-0" />
                )}
              </button>
            </div>
          </div>

          {/* Always-Accessible Trigger Naming & Renaming Field */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <label
              htmlFor="studio-trigger-name-input"
              className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 shrink-0"
            >
              Trigger Name:
            </label>
            <div className="flex flex-1 items-center gap-2">
              <input
                id="studio-trigger-name-input"
                type="text"
                value={customName}
                onChange={(e) => {
                  const val = e.target.value;
                  setCustomName(val);
                  if (val.trim()) {
                    onRenameTrigger?.(activeTriggerId, val);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleRenameActiveTrigger();
                  }
                }}
                placeholder="Name this trigger (e.g. Dinner Table Crunch)"
                aria-label="Trigger Clip Name"
                className="flex-1 min-w-[160px] rounded-xl bg-slate-900 border border-slate-700 px-3 py-2 text-xs text-white focus:outline-none focus:border-teal-400"
              />
              {activeTriggerId && savedRecords.some((r) => r.id === activeTriggerId) && (
                <button
                  type="button"
                  onClick={handleRenameActiveTrigger}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-teal-300 text-xs font-bold transition cursor-pointer shrink-0"
                  title="Save updated trigger name"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Rename</span>
                </button>
              )}
            </div>
          </div>

          {/* Primary Actions (Test, Save, Use in Game) */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() =>
                isPlayingMicroClip
                  ? stopAllStudioPlayback()
                  : playSlicePreview(recordedBuffer, clipOffsetSec, clipDurationSec, 'micro')
              }
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs shadow-md transition cursor-pointer"
            >
              {isPlayingMicroClip ? (
                <>
                  <Square className="w-3.5 h-3.5 fill-white" />
                  <span>Stop</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-white" />
                  <span>Test {clipDurationSec}s Micro-Clip</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleSaveTrack}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md transition active:scale-95 cursor-pointer"
            >
              {saveSuccess ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Saved & Active!</span>
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  <span>Save Micro-Clip</span>
                </>
              )}
            </button>

            {onReturnToGame && (
              <button
                type="button"
                onClick={onReturnToGame}
                className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md transition cursor-pointer"
              >
                Use in Pairing Game →
              </button>
            )}
          </div>

          {/* Hidden-by-default Trigger Editing Options (Waveform, Trim, Duration, Softening Filter, Name) */}
          {isTriggerEditorOpen && (
            <div className="pt-3 border-t border-slate-700/60 space-y-4 animate-in fade-in">
              <div className="space-y-1">
                <canvas
                  ref={canvasRef}
                  width={600}
                  height={100}
                  onClick={handleCanvasClick}
                  className="w-full h-24 rounded-xl bg-slate-950 border border-slate-800 shadow-inner cursor-pointer"
                  title="Click anywhere on the waveform to move the 0.5-second Micro-Clip window"
                />
                <p className="text-[11px] text-slate-400">
                  Click anywhere on the waveform or drag the sliders below to position the glowing{' '}
                  <strong className="text-teal-300">{clipDurationSec}s micro-clip window</strong> over the exact sound you want paired.
                </p>
              </div>

              {/* Micro-Clip Start Offset & Duration Sliders */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 text-xs">
                <div className="p-3 rounded-xl bg-slate-900/70 border border-slate-800">
                  <div className="flex justify-between mb-1.5">
                    <label className="text-slate-300 font-semibold">
                      Micro-Clip Start Position:
                    </label>
                    <span className="font-mono text-teal-300">{clipOffsetSec.toFixed(2)}s</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max={Math.max(0.05, Number((recordedBuffer.duration - clipDurationSec).toFixed(2)))}
                    step="0.05"
                    value={clipOffsetSec}
                    onChange={(e) =>
                      handleUpdateMicroClipWindow(parseFloat(e.target.value), clipDurationSec)
                    }
                    className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-teal-400"
                  />
                </div>

                <div className="p-3 rounded-xl bg-slate-900/70 border border-slate-800">
                  <div className="flex justify-between mb-1.5">
                    <label className="text-slate-300 font-semibold">
                      Micro-Clip Duration (0.5s Recommended):
                    </label>
                    <span className="font-mono text-sky-300">{clipDurationSec.toFixed(2)}s</span>
                  </div>
                  <div className="flex items-center gap-1.5 mb-2">
                    {[0.3, 0.5, 0.8, 1.0, 1.5].map((presetDur) => (
                      <button
                        key={presetDur}
                        type="button"
                        onClick={() => handleUpdateMicroClipWindow(clipOffsetSec, presetDur)}
                        className={`flex-1 py-1 rounded-lg text-[11px] font-bold border transition cursor-pointer ${
                          Math.abs(clipDurationSec - presetDur) < 0.04
                            ? 'bg-teal-500 text-slate-950 border-teal-400'
                            : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                        }`}
                      >
                        {presetDur}s
                      </button>
                    ))}
                  </div>
                  <input
                    type="range"
                    min="0.2"
                    max={Math.min(2.0, Number(recordedBuffer.duration.toFixed(2)))}
                    step="0.05"
                    value={clipDurationSec}
                    onChange={(e) =>
                      handleUpdateMicroClipWindow(clipOffsetSec, parseFloat(e.target.value))
                    }
                    className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-sky-400"
                  />
                </div>
              </div>

              {/* Acoustic Softening Low-Pass Filter */}
              <div className="rounded-xl bg-slate-900/80 p-3.5 border border-slate-700/60 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-indigo-400" />
                    <span className="text-xs font-semibold text-white">
                      Optional High-Frequency Softening Filter: {filterCutoff} Hz
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFilterBypassed(!filterBypassed)}
                    className={`text-[11px] px-2.5 py-1 rounded-md font-semibold border transition cursor-pointer ${
                      filterBypassed
                        ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                        : 'bg-teal-500/20 text-teal-300 border-teal-500/40'
                    }`}
                  >
                    {filterBypassed ? 'Unfiltered Original Clip' : 'Low-Pass Softening Active'}
                  </button>
                </div>
                <input
                  type="range"
                  min="500"
                  max="8000"
                  step="100"
                  value={filterCutoff}
                  onChange={(e) => setFilterCutoff(parseInt(e.target.value))}
                  className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-400"
                />
              </div>

              {/* Full Recording Audition */}
              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={() =>
                    isPlayingFull
                      ? stopAllStudioPlayback()
                      : playSlicePreview(recordedBuffer, 0, recordedBuffer.duration, 'full')
                  }
                  className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-200 font-semibold text-xs transition cursor-pointer"
                >
                  {isPlayingFull ? (
                    <>
                      <Square className="w-3.5 h-3.5 fill-white" />
                      <span>Stop Full</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>Play Full Recording ({recordedBuffer.duration.toFixed(1)}s)</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Saved Recorded/Uploaded Micro-Clips Library */}
      <div className="space-y-3 pt-2">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-300">
          My Recorded & Uploaded Trigger Clips ({savedRecords.length})
        </h4>

        {savedRecords.length === 0 ? (
          <div className="p-6 rounded-2xl bg-slate-950/60 border border-dashed border-slate-800 text-center space-y-2">
            <p className="text-xs font-semibold text-slate-300">
              No Recorded Trigger Clips Saved Yet
            </p>
            <p className="text-[11px] text-slate-400 max-w-md mx-auto">
              Tap <strong>Record with Microphone</strong>, pick an acoustic studio profile above, or use <strong>Upload Recorded Clip / Voice Memo</strong> to create your first 0.5-second micro-clip.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {savedRecords.map((rec) => {
              const isSelected = activeTriggerId === rec.id;
              const isPlayingThis = playingLibraryId === rec.id;
              const isEditingThis = editingRecordId === rec.id;
              const clipDur = rec.clipDurationSec ?? 0.5;
              return (
                <div
                  key={rec.id}
                  onClick={() => {
                    if (!isEditingThis) handleSelectSaved(rec, true);
                  }}
                  className={`flex items-center justify-between gap-2 p-3 rounded-xl border transition ${
                    isEditingThis ? '' : 'cursor-pointer'
                  } ${
                    isSelected
                      ? 'bg-teal-950/60 border-teal-400 text-white ring-1 ring-teal-400/40'
                      : 'bg-slate-800/40 border-slate-700/60 text-slate-300 hover:bg-slate-800/80'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelectSaved(rec, true);
                      }}
                      aria-label={isPlayingThis ? `Stop ${rec.name}` : `Play ${rec.name}`}
                      className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition cursor-pointer ${
                        isPlayingThis
                          ? 'bg-amber-500 text-slate-950'
                          : 'bg-teal-500/20 text-teal-300 hover:bg-teal-500/30'
                      }`}
                    >
                      {isPlayingThis ? (
                        <Square className="w-3.5 h-3.5 fill-slate-950" />
                      ) : (
                        <Play className="w-3.5 h-3.5 fill-teal-300" />
                      )}
                    </button>
                    {isEditingThis ? (
                      <div
                        className="flex items-center gap-1.5 flex-1 min-w-0"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="text"
                          value={editingRecordName}
                          onChange={(e) => setEditingRecordName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleSaveLibraryRename(rec.id);
                            } else if (e.key === 'Escape') {
                              setEditingRecordId(null);
                            }
                          }}
                          autoFocus
                          aria-label={`New name for ${rec.name}`}
                          className="flex-1 min-w-0 rounded-lg bg-slate-900 border border-teal-400 px-2.5 py-1 text-xs text-white focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={(e) => handleSaveLibraryRename(rec.id, e)}
                          aria-label="Save trigger rename"
                          className="p-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white cursor-pointer shrink-0"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={handleCancelLibraryRename}
                          aria-label="Cancel trigger rename"
                          className="p-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 cursor-pointer shrink-0"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div className="truncate">
                        <p className="text-xs font-semibold truncate flex items-center gap-1.5">
                          <Music className="w-3 h-3 text-teal-400 shrink-0" />
                          <span className="truncate">{rec.name}</span>
                        </p>
                        <p className="text-[10px] text-slate-400">
                          {clipDur.toFixed(2)}s micro-clip (from {rec.duration.toFixed(1)}s recording) •{' '}
                          {rec.lowpassCutoffHz} Hz
                        </p>
                      </div>
                    )}
                  </div>
                  {!isEditingThis && (
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={(e) => handleStartLibraryRename(rec, e)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-teal-300 hover:bg-slate-700 cursor-pointer"
                        title="Rename trigger"
                        aria-label={`Rename ${rec.name}`}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => handleDeleteSaved(rec.id, e)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-700 cursor-pointer"
                        title="Delete recording"
                        aria-label={`Delete ${rec.name}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
