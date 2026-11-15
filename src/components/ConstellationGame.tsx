import React, { useState, useRef, useEffect, useCallback } from 'react';
import { audioEngine, MicroClipPairingStatus } from '../audio/AudioEngine.ts';
import {
  Sparkles,
  RefreshCw,
  Volume2,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Shapes,
  Palette,
  Infinity as InfinityIcon,
  Flower2,
  Wand2,
  Star,
  Play,
  Square,
  Grid3X3,
  LayoutGrid,
  Upload,
  Mic,
  ArrowDownCircle,
  Clock,
  Scissors,
  Sliders,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { PanicButton } from './PanicButton.tsx';
import { ZenSudokuGame } from './puzzles/ZenSudokuGame.tsx';
import { CozyNonogramGame } from './puzzles/CozyNonogramGame.tsx';
import { HarmonicTangramGame } from './puzzles/HarmonicTangramGame.tsx';
import { ChromaFlowGame } from './puzzles/ChromaFlowGame.tsx';
import { ZenRippleLoopsGame } from './puzzles/ZenRippleLoopsGame.tsx';
import { MandalaSymmetryGame } from './puzzles/MandalaSymmetryGame.tsx';
import {
  generateConstellationLevel,
  getMasteryTier,
} from '../utils/puzzles.ts';
import { getThemeById, getStoredThemeId, ThemeId } from '../utils/themes.ts';

export type PuzzleGameMode =
  | 'sudoku'
  | 'nonogram'
  | 'zenloops'
  | 'chroma'
  | 'tangram'
  | 'constellation'
  | 'mandala';

interface PuzzleModeOption {
  id: PuzzleGameMode;
  label: string;
  shortLabel: string;
  tagline: string;
  icon: React.ReactNode;
}

const PUZZLE_MODES: PuzzleModeOption[] = [
  {
    id: 'sudoku',
    label: 'Zen Sudoku',
    shortLabel: 'Sudoku',
    tagline: '6×6 & 9×9 Focus',
    icon: <Grid3X3 className="w-3.5 h-3.5" />,
  },
  {
    id: 'nonogram',
    label: 'Cozy Nonogram',
    shortLabel: 'Nonogram',
    tagline: 'Picture Logic Grid',
    icon: <LayoutGrid className="w-3.5 h-3.5" />,
  },
  {
    id: 'zenloops',
    label: 'Zen Ripple Loops',
    shortLabel: 'Zen Loops',
    tagline: 'Light Circuits',
    icon: <InfinityIcon className="w-3.5 h-3.5" />,
  },
  {
    id: 'chroma',
    label: 'Chroma Flow',
    shortLabel: 'Chroma Flow',
    tagline: 'Color Gradient',
    icon: <Palette className="w-3.5 h-3.5" />,
  },
  {
    id: 'tangram',
    label: 'Harmonic Tangram',
    shortLabel: 'Tangram',
    tagline: 'Crystal Mosaic',
    icon: <Shapes className="w-3.5 h-3.5" />,
  },
  {
    id: 'constellation',
    label: 'Constellation Connect',
    shortLabel: 'Constellation',
    tagline: 'Starlight Weaving',
    icon: <Sparkles className="w-3.5 h-3.5" />,
  },
  {
    id: 'mandala',
    label: 'Mandala Symmetry',
    shortLabel: 'Mandala',
    tagline: 'Radial Petals',
    icon: <Flower2 className="w-3.5 h-3.5" />,
  },
];

interface ConstellationGameProps {
  parentCeilingGain: number;
  activeTriggerName: string;
  hasRecordedClip: boolean;
  themeId?: ThemeId;
  onPanicTriggered: () => void;
  onFinishSession: () => void;
  onOpenStudio: () => void;
  onQuickUploadClip: (file: File) => void;
  onRenameActiveTrigger: (newName: string) => void;
}

export const ConstellationGame: React.FC<ConstellationGameProps> = ({
  parentCeilingGain,
  activeTriggerName,
  hasRecordedClip,
  themeId,
  onPanicTriggered,
  onFinishSession,
  onOpenStudio,
  onQuickUploadClip,
  onRenameActiveTrigger,
}) => {
  const [activeGameMode, setActiveGameMode] = useState<PuzzleGameMode>('sudoku');
  const [levelsByMode, setLevelsByMode] = useState<Record<PuzzleGameMode, number>>({
    sudoku: 1,
    nonogram: 1,
    zenloops: 1,
    chroma: 1,
    tangram: 1,
    constellation: 1,
    mandala: 1,
  });
  const [harmonyStars, setHarmonyStars] = useState<number>(0);

  const [resetSignal, setResetSignal] = useState(0);
  const [subGameHeader, setSubGameHeader] = useState<{ title: string; subtitle: string }>({
    title: 'Level 1: 6×6 Gentle Awakening',
    subtitle: 'Fill each row, column, and 2×3 box with numbers 1–6',
  });

  const constellationLevel = levelsByMode.constellation;
  const currentPattern = generateConstellationLevel(constellationLevel);
  const constellationTier = getMasteryTier(constellationLevel);
  const nextConstellationTier = getMasteryTier(constellationLevel + 1);
  const nextConstellationPattern = generateConstellationLevel(constellationLevel + 1);

  const [userEdges, setUserEdges] = useState<[number, number][]>([]);
  const [selectedNode, setSelectedNode] = useState<number | null>(null);
  const [isCompleted, setIsCompleted] = useState(false);

  // User-controlled Micro-Clip Pairing settings (Volume, Stop, and collapsible Trigger Editor)
  const [childVolumePercent, setChildVolumePercent] = useState<number>(
    Math.round(audioEngine.getChildGain() * 100) || 20
  );
  const [pairingStatus, setPairingStatus] = useState<MicroClipPairingStatus>(() =>
    audioEngine.getPairingStatus()
  );
  const [isTriggerEditorOpen, setIsTriggerEditorOpen] = useState<boolean>(false);
  const [renameDraft, setRenameDraft] = useState<string>(activeTriggerName);

  useEffect(() => {
    setRenameDraft(activeTriggerName);
  }, [activeTriggerName]);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const quickFileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const unsubscribe = audioEngine.onPairingStatusChange((status) => {
      setPairingStatus(status);
      if (typeof status.childVolumePercent === 'number') {
        setChildVolumePercent(status.childVolumePercent);
      }
    });
    return unsubscribe;
  }, []);

  const getSafeNodeY = useCallback((rawY: number) => {
    return 18 + (rawY / 100) * 74;
  }, []);

  const handleAddStars = useCallback((stars: number) => {
    setHarmonyStars((prev) => prev + stars);
  }, []);

  const handleSetLevel = useCallback((mode: PuzzleGameMode, newLevel: number) => {
    const clamped = Math.max(1, Math.floor(newLevel));
    setLevelsByMode((prev) => ({
      ...prev,
      [mode]: clamped,
    }));
    if (mode === 'constellation') {
      setUserEdges([]);
      setSelectedNode(null);
      setIsCompleted(false);
    }
    audioEngine.playHarmonicChime(3);
  }, []);

  const handleChildVolumeChange = useCallback((percent: number) => {
    setChildVolumePercent(percent);
    const gain0to1 = percent / 100;
    audioEngine.setChildTriggerGain(gain0to1);
  }, []);

  const handleTensionLowerVolume = () => {
    const newPercent = audioEngine.lowerVolumeImmediately(0.05);
    setChildVolumePercent(newPercent);
  };

  useEffect(() => {
    const requiredEdges = currentPattern.edges;
    let allFound = true;

    for (const req of requiredEdges) {
      const exists = userEdges.some(
        ([a, b]) =>
          (a === req[0] && b === req[1]) || (a === req[1] && b === req[0])
      );
      if (!exists) {
        allFound = false;
        break;
      }
    }

    if (allFound && userEdges.length >= requiredEdges.length && !isCompleted) {
      setIsCompleted(true);
      audioEngine.playCompletionChord();
      handleAddStars(constellationTier.starsReward);
    }
  }, [userEdges, currentPattern, isCompleted, constellationTier.starsReward, handleAddStars]);

  const resetCurrentPuzzle = () => {
    if (activeGameMode === 'constellation') {
      setUserEdges([]);
      setSelectedNode(null);
      setIsCompleted(false);
    } else {
      setResetSignal((s) => s + 1);
    }
  };

  const handleConstellationHint = () => {
    if (isCompleted) return;
    const missingEdge = currentPattern.edges.find(
      ([reqA, reqB]) =>
        !userEdges.some(
          ([uA, uB]) =>
            (uA === reqA && uB === reqB) || (uA === reqB && uB === reqA)
        )
    );
    if (missingEdge) {
      const u = Math.min(missingEdge[0], missingEdge[1]);
      const v = Math.max(missingEdge[0], missingEdge[1]);
      setUserEdges((prev) => [...prev, [u, v]]);
      setSelectedNode(v);
      audioEngine.playHarmonicChime(5);
    }
  };

  const handleHeaderUpdate = useCallback((title: string, subtitle: string) => {
    setSubGameHeader({ title, subtitle });
  }, []);

  const handleNodeClick = (nodeId: number) => {
    if (isCompleted) return;
    audioEngine.playHarmonicChime(nodeId);

    if (selectedNode === null) {
      setSelectedNode(nodeId);
      return;
    }

    if (selectedNode === nodeId) {
      setSelectedNode(null);
      return;
    }

    const from = Math.min(selectedNode, nodeId);
    const to = Math.max(selectedNode, nodeId);

    const edgeExists = userEdges.some(([a, b]) => a === from && b === to);
    if (edgeExists) {
      setUserEdges((prev) => prev.filter(([a, b]) => !(a === from && b === to)));
    } else {
      setUserEdges((prev) => [...prev, [from, to]]);
    }

    setSelectedNode(nodeId);
  };

  // Canvas dynamic renderer for Constellation mode
  useEffect(() => {
    if (activeGameMode !== 'constellation') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let t = 0;

    const render = () => {
      t += 0.02;
      const w = canvas.width;
      const h = canvas.height;

      ctx.clearRect(0, 0, w, h);

      const activeTheme = getThemeById(themeId || getStoredThemeId());
      const bgGrad = ctx.createRadialGradient(w / 2, h / 2, 50, w / 2, h / 2, w * 0.7);
      bgGrad.addColorStop(0, activeTheme.canvasBg[0]);
      bgGrad.addColorStop(0.6, activeTheme.canvasBg[1]);
      bgGrad.addColorStop(1, activeTheme.canvasBg[2]);
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, w, h);

      for (let i = 0; i < 40; i++) {
        const sx = (i * 137.5) % w;
        const sy = (i * 243.7) % h;
        const alpha = 0.2 + 0.3 * Math.sin(t + i);
        ctx.fillStyle =
          activeTheme.mode === 'light'
            ? `rgba(21, 94, 86, ${alpha * 0.65})`
            : `rgba(224, 242, 254, ${alpha})`;
        ctx.beginPath();
        ctx.arc(sx, sy, i % 3 === 0 ? 1.5 : 1, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.strokeStyle =
        activeTheme.mode === 'light'
          ? 'rgba(21, 94, 86, 0.22)'
          : 'rgba(148, 163, 184, 0.16)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 6]);
      currentPattern.edges.forEach(([from, to]) => {
        const nodeA = currentPattern.nodes.find((n) => n.id === from);
        const nodeB = currentPattern.nodes.find((n) => n.id === to);
        if (nodeA && nodeB) {
          const ay = (getSafeNodeY(nodeA.y) / 100) * h;
          const by = (getSafeNodeY(nodeB.y) / 100) * h;
          ctx.beginPath();
          ctx.moveTo((nodeA.x / 100) * w, ay);
          ctx.lineTo((nodeB.x / 100) * w, by);
          ctx.stroke();
        }
      });
      ctx.setLineDash([]);

      userEdges.forEach(([from, to]) => {
        const nodeA = currentPattern.nodes.find((n) => n.id === from);
        const nodeB = currentPattern.nodes.find((n) => n.id === to);
        if (nodeA && nodeB) {
          const ax = (nodeA.x / 100) * w;
          const ay = (getSafeNodeY(nodeA.y) / 100) * h;
          const bx = (nodeB.x / 100) * w;
          const by = (getSafeNodeY(nodeB.y) / 100) * h;

          ctx.strokeStyle = isCompleted ? '#34D399' : currentPattern.starColor;
          ctx.lineWidth = 3;
          ctx.shadowColor = currentPattern.starColor;
          ctx.shadowBlur = 10;
          ctx.beginPath();
          ctx.moveTo(ax, ay);
          ctx.lineTo(bx, by);
          ctx.stroke();
          ctx.shadowBlur = 0;
        }
      });

      animId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animId);
  }, [activeGameMode, userEdges, currentPattern, isCompleted, getSafeNodeY, themeId]);

  useEffect(() => {
    if (activeGameMode !== 'constellation') return;
    const handleResize = () => {
      const container = containerRef.current;
      const canvas = canvasRef.current;
      if (container && canvas) {
        canvas.width = container.clientWidth;
        canvas.height = container.clientHeight;
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [activeGameMode]);

  const effectiveGain = (childVolumePercent / 100) * parentCeilingGain;

  const displayTitle =
    activeGameMode === 'constellation' ? currentPattern.name : subGameHeader.title;
  const displaySubtitle =
    activeGameMode === 'constellation'
      ? `${currentPattern.theme} • Tap stars to weave harmonic starlight`
      : subGameHeader.subtitle;

  const matchedConstellationEdges = currentPattern.edges.filter(([reqA, reqB]) =>
    userEdges.some(
      ([uA, uB]) => (uA === reqA && uB === reqB) || (uA === reqB && uB === reqA)
    )
  ).length;

  return (
    <div className="relative w-full flex flex-col rounded-2xl sm:rounded-3xl bg-slate-950 border border-slate-800 shadow-2xl overflow-hidden">
      <input
        ref={quickFileInputRef}
        type="file"
        accept="audio/*,video/mp4,video/webm,.m4a,.mp3,.wav,.ogg,.aac"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onQuickUploadClip(f);
          e.target.value = '';
        }}
        className="hidden"
      />

      {/* Multi-Game Focus & Counterconditioning Sanctuary Bar */}
      <div className="relative z-20 bg-slate-950/90 border-b border-slate-800/80 px-3 sm:px-4 py-2.5 sm:py-3">
        <div className="flex items-center justify-between gap-2 mb-2">
          <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-teal-400 truncate">
            DIY Counterconditioning Focus Games • Micro-Clip Pairing
          </span>
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-400/30 text-amber-300 text-[11px] sm:text-xs font-bold shrink-0">
            <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
            {harmonyStars} {harmonyStars === 1 ? 'Star' : 'Stars'}
          </span>
        </div>

        {/* Game Selector Strip */}
        <div
          role="tablist"
          aria-label="Counterconditioning Focus Games"
          className="flex gap-2 overflow-x-auto no-scrollbar pb-0.5 snap-x"
        >
          {PUZZLE_MODES.map((mode) => {
            const isActive = activeGameMode === mode.id;
            const modeLevel = levelsByMode[mode.id];
            return (
              <button
                key={mode.id}
                role="tab"
                aria-selected={isActive}
                onClick={() => {
                  setActiveGameMode(mode.id);
                  audioEngine.playHarmonicChime(2);
                }}
                className={`snap-start shrink-0 min-w-[142px] flex items-center justify-between gap-2 p-2 sm:p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                  isActive
                    ? 'bg-teal-950/70 border-teal-400 text-white shadow-sm ring-1 ring-teal-400/30'
                    : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div
                    className={`p-1.5 rounded-lg shrink-0 ${
                      isActive ? 'bg-teal-500/20 text-teal-300' : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {mode.icon}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold truncate">{mode.shortLabel}</div>
                    <div className="text-[10px] text-slate-400 truncate">{mode.tagline}</div>
                  </div>
                </div>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-slate-800/90 text-teal-300 border border-slate-700 shrink-0">
                  Lvl {modeLevel}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Top HUD Bar */}
      <div className="relative z-20 flex flex-wrap items-center justify-between gap-2 sm:gap-3 px-3.5 py-2.5 sm:p-4 bg-slate-900/90 backdrop-blur-md border-b border-slate-800/80">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-teal-400 shrink-0" />
            <h2 className="text-sm sm:text-base font-bold text-white tracking-wide truncate">
              {displayTitle}
            </h2>
            <span className="hidden md:inline-block text-[10px] px-2 py-0.5 rounded-full bg-teal-500/10 text-teal-300 border border-teal-500/20 font-medium shrink-0">
              Quiet Focus Sanctuary
            </span>
          </div>
          <p className="text-[11px] sm:text-xs text-slate-400 mt-0.5 line-clamp-1">
            {displaySubtitle}
          </p>
        </div>

        {/* Action Controls & Persistent Panic Button */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={resetCurrentPuzzle}
            className="min-h-[38px] min-w-[38px] flex items-center justify-center p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer"
            title="Reset puzzle"
            aria-label="Reset puzzle"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          <button
            onClick={onFinishSession}
            className="min-h-[38px] flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-medium text-slate-200 transition cursor-pointer"
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-teal-400 shrink-0" />
            <span>Finish Session</span>
          </button>

          <div className="hidden sm:block">
            <PanicButton onPanicTriggered={onPanicTriggered} />
          </div>
        </div>
      </div>

      {/* Main Interactive Focus Game Area */}
      {activeGameMode === 'sudoku' && (
        <div className="flex-1 w-full min-h-[430px] sm:min-h-[480px]">
          <ZenSudokuGame
            key={`sudoku-${levelsByMode.sudoku}-${resetSignal}`}
            level={levelsByMode.sudoku}
            onLevelComplete={handleAddStars}
            onLevelChange={(newLvl) => handleSetLevel('sudoku', newLvl)}
            resetSignal={resetSignal}
            onHeaderUpdate={handleHeaderUpdate}
          />
        </div>
      )}

      {activeGameMode === 'nonogram' && (
        <div className="flex-1 w-full min-h-[430px] sm:min-h-[480px]">
          <CozyNonogramGame
            key={`nonogram-${levelsByMode.nonogram}-${resetSignal}`}
            level={levelsByMode.nonogram}
            onLevelComplete={handleAddStars}
            onLevelChange={(newLvl) => handleSetLevel('nonogram', newLvl)}
            resetSignal={resetSignal}
            onHeaderUpdate={handleHeaderUpdate}
          />
        </div>
      )}

      {activeGameMode === 'constellation' && (
        <div
          ref={containerRef}
          className="relative flex-1 w-full h-[380px] sm:h-[460px] overflow-hidden cursor-crosshair select-none"
        >
          <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />

          <div className="absolute top-2.5 left-2.5 right-2.5 sm:top-3 sm:left-3 sm:right-3 z-20 flex flex-wrap items-center justify-between gap-1.5 sm:gap-2 bg-slate-900/85 backdrop-blur-md px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-xl border border-slate-700/70">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <button
                onClick={() =>
                  constellationLevel > 1 &&
                  handleSetLevel('constellation', constellationLevel - 1)
                }
                disabled={constellationLevel <= 1}
                aria-label="Previous Constellation Level"
                className="min-h-[32px] min-w-[32px] flex items-center justify-center p-1 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-35 text-slate-300 transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-[11px] sm:text-xs font-bold text-teal-300 tracking-wide">
                {constellationTier.tierBadge} • Lvl {constellationLevel} ({currentPattern.nodes.length}★)
              </span>
              <button
                onClick={() => handleSetLevel('constellation', constellationLevel + 1)}
                aria-label="Next Constellation Level"
                className="min-h-[32px] min-w-[32px] flex items-center justify-center p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2">
              <span className="text-[11px] sm:text-xs font-semibold text-sky-300 bg-sky-500/10 px-2 py-1 rounded-lg border border-sky-500/20">
                {matchedConstellationEdges}/{currentPattern.edges.length} Paths
              </span>
              <button
                onClick={handleConstellationHint}
                disabled={isCompleted}
                className="min-h-[32px] flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] sm:text-xs font-semibold bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-400/30 transition-all cursor-pointer disabled:opacity-40"
              >
                <Wand2 className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                <span>Harmonic Hint</span>
              </button>
            </div>
          </div>

          {currentPattern.nodes.map((node) => {
            const isSelected = selectedNode === node.id;
            const safeY = getSafeNodeY(node.y);
            return (
              <button
                key={node.id}
                onClick={() => handleNodeClick(node.id)}
                style={{
                  left: `${node.x}%`,
                  top: `${safeY}%`,
                  transform: 'translate(-50%, -50%)',
                }}
                className={`absolute group flex items-center justify-center p-3.5 sm:p-3 focus:outline-none transition-all cursor-pointer ${
                  isSelected ? 'scale-125 z-30' : 'hover:scale-110 z-20'
                }`}
                aria-label={`Star node ${node.id + 1}`}
              >
                <div
                  className={`absolute w-11 h-11 sm:w-10 sm:h-10 rounded-full transition-all ${
                    isSelected
                      ? 'bg-teal-400/30 scale-125 animate-ping duration-1000'
                      : 'bg-sky-400/10 group-hover:bg-sky-400/20'
                  }`}
                />

                <div
                  className={`relative w-4 h-4 rounded-full border-2 transition shadow-lg ${
                    isSelected
                      ? 'bg-white border-teal-300 shadow-teal-400/80 scale-110'
                      : isCompleted
                      ? 'bg-emerald-300 border-white shadow-emerald-400/60'
                      : 'bg-slate-100 border-sky-300 shadow-sky-400/50'
                  }`}
                />
              </button>
            );
          })}

          {isCompleted && (
            <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-slate-950/80 backdrop-blur-xs p-4 animate-in fade-in duration-500">
              <div className="p-5 sm:p-6 rounded-3xl bg-slate-900/95 border border-emerald-400/40 text-center shadow-2xl max-w-sm w-full">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-400/40 text-amber-300 text-xs font-bold mb-2">
                  {Array.from({ length: constellationTier.starsReward }).map((_, i) => (
                    <Star key={i} className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                  ))}
                  +{constellationTier.starsReward} Harmony {constellationTier.starsReward === 1 ? 'Star' : 'Stars'} Earned
                </div>
                <h3 className="text-lg sm:text-xl font-bold text-white">{currentPattern.name} Harmonized!</h3>
                <p className="text-xs text-slate-300 mt-1">
                  Ready for{' '}
                  <span className="text-teal-300 font-semibold">
                    Level {constellationLevel + 1} ({nextConstellationPattern.nodes.length} Stars • {nextConstellationTier.tierName})
                  </span>
                  ?
                </p>
                <div className="mt-4 sm:mt-5 flex gap-2">
                  <button
                    onClick={resetCurrentPuzzle}
                    className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition cursor-pointer"
                  >
                    Replay Level
                  </button>
                  <button
                    onClick={() => handleSetLevel('constellation', constellationLevel + 1)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-400 text-xs font-bold text-slate-950 shadow-md transition cursor-pointer"
                  >
                    <span>Advance to Level {constellationLevel + 1}</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {activeGameMode === 'tangram' && (
        <div className="flex-1 w-full min-h-[410px] sm:min-h-[460px]">
          <HarmonicTangramGame
            key={`tangram-${levelsByMode.tangram}-${resetSignal}`}
            level={levelsByMode.tangram}
            onLevelComplete={handleAddStars}
            onLevelChange={(newLvl) => handleSetLevel('tangram', newLvl)}
            resetSignal={resetSignal}
            onHeaderUpdate={handleHeaderUpdate}
          />
        </div>
      )}

      {activeGameMode === 'chroma' && (
        <div className="flex-1 w-full min-h-[410px] sm:min-h-[460px]">
          <ChromaFlowGame
            key={`chroma-${levelsByMode.chroma}-${resetSignal}`}
            level={levelsByMode.chroma}
            onLevelComplete={handleAddStars}
            onLevelChange={(newLvl) => handleSetLevel('chroma', newLvl)}
            resetSignal={resetSignal}
            onHeaderUpdate={handleHeaderUpdate}
          />
        </div>
      )}

      {activeGameMode === 'zenloops' && (
        <div className="flex-1 w-full min-h-[410px] sm:min-h-[460px]">
          <ZenRippleLoopsGame
            key={`zenloops-${levelsByMode.zenloops}-${resetSignal}`}
            level={levelsByMode.zenloops}
            onLevelComplete={handleAddStars}
            onLevelChange={(newLvl) => handleSetLevel('zenloops', newLvl)}
            resetSignal={resetSignal}
            onHeaderUpdate={handleHeaderUpdate}
          />
        </div>
      )}

      {activeGameMode === 'mandala' && (
        <div className="flex-1 w-full min-h-[410px] sm:min-h-[460px]">
          <MandalaSymmetryGame
            key={`mandala-${levelsByMode.mandala}-${resetSignal}`}
            level={levelsByMode.mandala}
            onLevelComplete={handleAddStars}
            onLevelChange={(newLvl) => handleSetLevel('mandala', newLvl)}
            resetSignal={resetSignal}
            onHeaderUpdate={handleHeaderUpdate}
          />
        </div>
      )}

      {/* Persistent Micro-Clip Pairing Control Bar (Full User Control over Volume, Duration, Interval, Stop) */}
      <div className="relative z-20 p-3.5 sm:p-4 bg-slate-900/95 border-t border-slate-800 space-y-3">
        {!hasRecordedClip ? (
          /* Prompt to Record or Upload Real Trigger Clip */
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-2xl bg-slate-950/90 border border-teal-500/30">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2 text-xs font-bold text-teal-300">
                <Scissors className="w-4 h-4 shrink-0" />
                <span>Micro-Clip Pairing Ready • Load a Real Trigger Recording</span>
              </div>
              <p className="text-[11px] text-slate-400">
                Synthetic triggers are disabled. Record a real clip in the app or upload a Voice Memo to pair a barely audible <strong>0.5s micro-clip every 30–60s</strong> while you play.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => quickFileInputRef.current?.click()}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold shadow-md transition cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Upload Audio Clip</span>
              </button>
              <button
                type="button"
                onClick={onOpenStudio}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-md transition cursor-pointer"
              >
                <Mic className="w-3.5 h-3.5" />
                <span>Record in Clip Studio</span>
              </button>
            </div>
          </div>
        ) : (
          /* Active Micro-Clip Pairing Dashboard */
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex flex-wrap items-center gap-2 min-w-0">
                <Volume2 className="w-4 h-4 text-teal-400 shrink-0" />
                <span className="font-bold text-white truncate">
                  Micro-Clip: {activeTriggerName}
                </span>
                <span className="px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-teal-300 font-mono text-[11px]">
                  {pairingStatus.clipDurationSec.toFixed(2)}s clip
                </span>
                {pairingStatus.isClipPlayingNow ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/25 border border-amber-400 text-amber-200 text-[10px] font-bold animate-pulse">
                    ● Playing {pairingStatus.clipDurationSec}s Micro-Clip Now
                  </span>
                ) : pairingStatus.isPairingActive ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[11px] font-mono">
                    <Clock className="w-3 h-3" />
                    Next clip in {pairingStatus.secondsUntilNextClip}s ({pairingStatus.minIntervalSec}–{pairingStatus.maxIntervalSec}s)
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700 text-[10px] font-semibold">
                    Stopped • Starts on Session
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 text-[11px] font-mono">
                <span className="text-teal-300 font-bold">
                  Vol: {childVolumePercent}%
                </span>
                <span className="text-slate-500">•</span>
                <span className="text-slate-400">
                  Eff: {(effectiveGain * 100).toFixed(1)}%
                </span>
              </div>
            </div>

            {/* Primary Safety & Session Controls (Always Visible) */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-2.5">
              <div className="flex-1 flex items-center gap-2.5 bg-slate-950/70 border border-slate-800 px-3 py-2 rounded-xl">
                <span className="text-[10px] text-slate-400 font-semibold shrink-0">
                  Barely Audible
                </span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="1"
                  value={childVolumePercent}
                  onChange={(e) => handleChildVolumeChange(parseInt(e.target.value))}
                  className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-teal-400 focus:outline-none"
                  aria-label="Child Trigger Volume Slider"
                />
                <span className="text-[10px] text-slate-400 font-semibold shrink-0">
                  Gentle
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 shrink-0">
                {/* "If you feel tension, lower the volume immediately" */}
                <button
                  type="button"
                  onClick={handleTensionLowerVolume}
                  className="flex-1 sm:flex-initial flex items-center justify-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/40 text-amber-200 text-[11px] sm:text-xs font-bold whitespace-nowrap transition active:scale-95 cursor-pointer"
                  title="Immediately cut any playing micro-clip, lower volume by 5%, and reset the 30-60s timer"
                >
                  <ArrowDownCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-300 shrink-0" />
                  <span>Lower Vol (-5%)</span>
                </button>

                <button
                  type="button"
                  onClick={() => audioEngine.toggleTriggerExposure()}
                  aria-label={
                    pairingStatus.isPairingActive
                      ? 'Stop Micro-Clip Pairing'
                      : 'Start Micro-Clip Pairing'
                  }
                  className={`flex items-center justify-center gap-1 sm:gap-1.5 px-3 sm:px-3.5 py-2 rounded-xl border text-[11px] sm:text-xs font-bold whitespace-nowrap transition cursor-pointer ${
                    pairingStatus.isPairingActive
                      ? 'bg-rose-600/25 border-rose-500/50 text-rose-200 hover:bg-rose-600/35'
                      : 'bg-teal-600 hover:bg-teal-500 border-teal-400 text-white'
                  }`}
                >
                  {pairingStatus.isPairingActive ? (
                    <>
                      <Square className="w-3 h-3 fill-rose-200 shrink-0" />
                      <span>Stop</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3 h-3 fill-white shrink-0" />
                      <span>Start</span>
                    </>
                  )}
                </button>

                {/* Collapsible Trigger Editor Option (Hidden by Default) */}
                <button
                  type="button"
                  onClick={() => setIsTriggerEditorOpen((prev) => !prev)}
                  aria-expanded={isTriggerEditorOpen}
                  aria-label="Trigger Editor"
                  className={`flex items-center justify-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-2 rounded-xl border text-[11px] sm:text-xs font-bold whitespace-nowrap transition cursor-pointer ${
                    isTriggerEditorOpen
                      ? 'bg-teal-600 border-teal-400 text-white'
                      : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200'
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

            {/* Collapsible Trigger Editing Options (Hidden by default) */}
            {isTriggerEditorOpen && (
              <div className="pt-2 border-t border-slate-800/80 space-y-2.5 animate-in fade-in">
                <div className="flex flex-wrap items-center gap-2">
                  <label
                    htmlFor="game-trigger-rename-input"
                    className="text-[11px] font-semibold text-slate-400 shrink-0"
                  >
                    Rename Trigger:
                  </label>
                  <input
                    id="game-trigger-rename-input"
                    type="text"
                    value={renameDraft}
                    onChange={(e) => setRenameDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && renameDraft.trim()) {
                        e.preventDefault();
                        onRenameActiveTrigger(renameDraft.trim());
                      }
                    }}
                    placeholder="Trigger name"
                    aria-label="Rename Active Trigger"
                    className="flex-1 min-w-[160px] rounded-xl bg-slate-950/80 border border-slate-700 px-3 py-1.5 text-xs text-white focus:outline-none focus:border-teal-400"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (renameDraft.trim()) {
                        onRenameActiveTrigger(renameDraft.trim());
                      }
                    }}
                    className="px-3 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold transition cursor-pointer shrink-0"
                  >
                    Save Name
                  </button>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2">
                  {/* Duration & Interval Quick Controls */}
                  <div className="flex flex-wrap items-center gap-2 text-[11px]">
                    <div className="flex items-center gap-1 bg-slate-950/80 border border-slate-800 px-2 py-1 rounded-xl">
                      <span className="text-slate-400 font-medium mr-1">Clip:</span>
                      {[0.3, 0.5, 0.8, 1.0].map((dur) => (
                        <button
                          key={dur}
                          type="button"
                          onClick={() => audioEngine.setMicroClipDuration(dur)}
                          className={`px-2 py-0.5 rounded-lg font-bold transition cursor-pointer ${
                            Math.abs(pairingStatus.clipDurationSec - dur) < 0.04
                              ? 'bg-teal-500 text-slate-950'
                              : 'text-slate-300 hover:bg-slate-800'
                          }`}
                        >
                          {dur}s
                        </button>
                      ))}
                    </div>

                    <div className="flex items-center gap-1 bg-slate-950/80 border border-slate-800 px-2 py-1 rounded-xl">
                      <span className="text-slate-400 font-medium mr-1">Every:</span>
                      {[
                        { label: '15–30s', min: 15, max: 30 },
                        { label: '30–60s', min: 30, max: 60 },
                        { label: '60–90s', min: 60, max: 90 },
                      ].map((intv) => (
                        <button
                          key={intv.label}
                          type="button"
                          onClick={() =>
                            audioEngine.setMicroClipIntervalRange(intv.min, intv.max)
                          }
                          className={`px-2 py-0.5 rounded-lg font-bold transition cursor-pointer ${
                            pairingStatus.minIntervalSec === intv.min
                              ? 'bg-indigo-500 text-white'
                              : 'text-slate-300 hover:bg-slate-800'
                          }`}
                        >
                          {intv.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Test Clip & Full Clip Studio Links */}
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => audioEngine.playMicroClipNow()}
                      className="min-h-[32px] flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-teal-300 text-xs font-bold transition cursor-pointer"
                      title="Play the 0.5s micro-clip once right now at the current volume"
                    >
                      <Play className="w-3 h-3 fill-teal-300" />
                      <span>Test {pairingStatus.clipDurationSec}s Clip</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => quickFileInputRef.current?.click()}
                      className="min-h-[32px] flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-600/20 hover:bg-sky-600/30 border border-sky-500/40 text-sky-300 text-xs font-bold transition cursor-pointer"
                    >
                      <Upload className="w-3 h-3" />
                      <span>Swap Audio</span>
                    </button>

                    <button
                      type="button"
                      onClick={onOpenStudio}
                      className="min-h-[32px] flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600/25 hover:bg-indigo-600/35 border border-indigo-400/40 text-indigo-200 text-xs font-bold transition cursor-pointer"
                    >
                      <Scissors className="w-3 h-3" />
                      <span>Open Clip Studio</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
