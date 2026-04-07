import { useState, useCallback, useRef, useEffect } from 'react';
import PuzzleGrid from '@/components/PuzzleGrid';
import SolutionPath from '@/components/SolutionPath';
import LogPanel, { LogEntry } from '@/components/LogPanel';
import GoalEditorModal from '@/components/GoalEditorModal';
import { Board, Algorithm, Heuristic, solvePuzzle, isSolvable, shuffleBoard } from '@/lib/puzzleSolver';

const DEFAULT_GOAL: Board = [1,2,3,4,5,6,7,8,0];

const Index = () => {
  const [board, setBoard] = useState<Board>([1,2,3,4,5,6,7,8,0]);
  const [goal, setGoal] = useState<Board>([...DEFAULT_GOAL]);
  const [algo, setAlgo] = useState<Algorithm>('astar');
  const [heuristic, setHeuristic] = useState<Heuristic>('manhattan');
  const [depthLimit, setDepthLimit] = useState(30);
  const [speed, setSpeed] = useState(200);
  const [solution, setSolution] = useState<Board[]>([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [stats, setStats] = useState({ moves: '—', nodes: '—', depth: '—', time: '—' });
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [solving, setSolving] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [movingTile, setMovingTile] = useState<number | null>(null);
  const [showGoalEditor, setShowGoalEditor] = useState(false);
  const [showBoardEditor, setShowBoardEditor] = useState(false);
  const [statusBanner, setStatusBanner] = useState<{ type: string; msg: string } | null>(null);

  const playRef = useRef(false);
  const speedRef = useRef(speed);
  speedRef.current = speed;

  const addLog = useCallback((msg: string, type: LogEntry['type'] = 'info') => {
    const now = new Date();
    const ts = `${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}:${now.getSeconds().toString().padStart(2,'0')}`;
    setLogs(prev => [...prev, { time: ts, message: msg, type }]);
  }, []);

  const handleShuffle = () => {
    let b: Board;
    do { b = shuffleBoard(); } while (!isSolvable(b, goal));
    setBoard(b);
    setSolution([]);
    setCurrentStep(0);
    setStats({ moves: '—', nodes: '—', depth: '—', time: '—' });
    setStatusBanner(null);
    addLog('Board shuffled (solvable configuration)', 'info');
  };

  const handleReset = () => {
    setBoard([1,2,3,4,5,6,7,8,0]);
    setSolution([]);
    setCurrentStep(0);
    setStats({ moves: '—', nodes: '—', depth: '—', time: '—' });
    setStatusBanner(null);
    addLog('Board reset to initial state', 'info');
  };

  const handleStepBack = () => {
    if (solution.length > 0 && currentStep > 0) {
      const newStep = currentStep - 1;
      setCurrentStep(newStep);
      setBoard(solution[newStep]);
      highlightMove(solution[newStep], solution[newStep + 1]);
    }
  };

  const handleStepForward = () => {
    if (solution.length > 0 && currentStep < solution.length - 1) {
      const newStep = currentStep + 1;
      setCurrentStep(newStep);
      setBoard(solution[newStep]);
      highlightMove(solution[newStep - 1], solution[newStep]);
    }
  };

  const highlightMove = (prev: Board, next: Board) => {
    const movedIdx = next.findIndex((v, i) => v !== prev[i] && v !== 0);
    setMovingTile(movedIdx);
    setTimeout(() => setMovingTile(null), 300);
  };

  const handleSolve = () => {
    if (board.join(',') === goal.join(',')) {
      setStatusBanner({ type: 'ok', msg: '✓ Already in goal state!' });
      addLog('Already in goal state', 'ok');
      return;
    }
    if (!isSolvable(board, goal)) {
      setStatusBanner({ type: 'err', msg: '✗ This configuration is unsolvable' });
      addLog('Configuration is unsolvable', 'err');
      return;
    }

    setSolving(true);
    setStatusBanner({ type: 'running', msg: `⟳ Solving with ${algo.toUpperCase()}...` });
    addLog(`Starting ${algo.toUpperCase()} solver...`, 'info');

    setTimeout(() => {
      const result = solvePuzzle(board, goal, algo, heuristic, depthLimit);
      setSolving(false);

      if (result.found) {
        setSolution(result.path);
        setCurrentStep(0);
        setBoard(result.path[0]);
        setStats({
          moves: String(result.path.length - 1),
          nodes: result.nodesExplored.toLocaleString(),
          depth: String(result.maxDepth),
          time: `${result.timeMs.toFixed(1)}`,
        });
        setStatusBanner({ type: 'ok', msg: `✓ Solution found — ${result.path.length - 1} moves` });
        addLog(`Solution found: ${result.path.length - 1} moves, ${result.nodesExplored.toLocaleString()} nodes explored in ${result.timeMs.toFixed(1)}ms`, 'ok');
      } else {
        setStatusBanner({ type: 'err', msg: '✗ No solution found within limits' });
        addLog(`No solution found (${result.nodesExplored.toLocaleString()} nodes explored)`, 'err');
        setStats({
          moves: '—', nodes: result.nodesExplored.toLocaleString(),
          depth: String(result.maxDepth), time: `${result.timeMs.toFixed(1)}`,
        });
      }
    }, 50);
  };

  const handleStop = () => {
    playRef.current = false;
    setPlaying(false);
    addLog('Playback stopped', 'warn');
  };

  const handlePlay = () => {
    if (solution.length === 0) return;
    if (playing) { handleStop(); return; }
    playRef.current = true;
    setPlaying(true);
    addLog('Playing solution...', 'info');

    const play = (step: number) => {
      if (!playRef.current || step >= solution.length) {
        playRef.current = false;
        setPlaying(false);
        if (step >= solution.length) addLog('Playback complete', 'ok');
        return;
      }
      setCurrentStep(step);
      setBoard(solution[step]);
      if (step > 0) highlightMove(solution[step - 1], solution[step]);
      setTimeout(() => play(step + 1), speedRef.current);
    };
    play(currentStep);
  };

  useEffect(() => {
    return () => { playRef.current = false; };
  }, []);

  const handleGoalApply = (newGoal: Board) => {
    setGoal(newGoal);
    setShowGoalEditor(false);
    setSolution([]);
    setCurrentStep(0);
    setStats({ moves: '—', nodes: '—', depth: '—', time: '—' });
    addLog('Goal state updated', 'info');
  };

  const handleBoardApply = (newBoard: Board) => {
    setBoard(newBoard);
    setShowBoardEditor(false);
    setSolution([]);
    setCurrentStep(0);
    setStats({ moves: '—', nodes: '—', depth: '—', time: '—' });
    addLog('Current state updated via editor', 'info');
  };

  const handleShuffleGoal = () => {
    let g: Board;
    do { g = shuffleBoard(); } while (!isSolvable(board, g));
    setGoal(g);
    setSolution([]);
    setCurrentStep(0);
    setStats({ moves: '—', nodes: '—', depth: '—', time: '—' });
    setStatusBanner(null);
    addLog('Goal state shuffled (solvable configuration)', 'info');
  };

  const handleStepClick = (step: number) => {
    setCurrentStep(step);
    setBoard(solution[step]);
    if (step > 0) highlightMove(solution[step - 1], solution[step]);
  };

  return (
    <div className="relative z-[1] max-w-[1100px] mx-auto px-6 py-8 pb-16">
      {/* Header */}
      <header className="text-center mb-12 animate-fade-down">
        <span className="inline-block font-mono text-[11px] text-primary border border-primary/30 px-3.5 py-1 rounded-full mb-3.5 tracking-widest uppercase">
          AI Solver — BFS · DFS · A*
        </span>
        <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.1] bg-gradient-to-br from-foreground via-foreground to-primary bg-clip-text text-transparent mb-2.5">
          8-Puzzle Solver
        </h1>
        <p className="text-sm text-muted-foreground font-mono">
          watch the algorithm think, step by step
        </p>
      </header>

      {/* Status Banner */}
      {statusBanner && (
        <div className={`mb-4 px-4 py-3 rounded-lg font-mono text-xs border animate-fade-down
          ${statusBanner.type === 'ok' ? 'bg-success/5 border-success/30 text-success' : ''}
          ${statusBanner.type === 'err' ? 'bg-accent/5 border-accent/30 text-accent' : ''}
          ${statusBanner.type === 'running' ? 'bg-primary/5 border-primary/30 text-primary' : ''}
        `}>
          {statusBanner.type === 'running' && <span className="animate-pulse-opacity">{statusBanner.msg}</span>}
          {statusBanner.type !== 'running' && statusBanner.msg}
        </div>
      )}

      {/* Main Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* Current State Card */}
        <div className="bg-card border border-border rounded-lg p-6 animate-fade-up">
          <div className="flex items-center gap-2 font-mono text-[11px] text-muted-foreground tracking-widest uppercase mb-5">
            <span className="w-1.5 h-1.5 rounded-full bg-primary" />
            current state
            <div className="ml-auto flex gap-3">
              <button onClick={handleShuffle} className="text-primary hover:underline text-[11px] font-mono cursor-pointer">
                SHUFFLE
              </button>
              <button onClick={() => setShowBoardEditor(true)} className="text-primary hover:underline text-[11px] font-mono cursor-pointer">
                EDIT
              </button>
            </div>
          </div>
          <div className="flex justify-center mb-4">
            <PuzzleGrid board={board} goal={goal} movingTile={movingTile} />
          </div>
          <div className="flex gap-2 flex-wrap justify-center">
            <button onClick={handleReset} className="px-4 py-2.5 rounded-lg font-mono text-xs font-semibold border border-border-bright bg-surface2 text-muted-foreground hover:border-primary hover:text-foreground transition-all">
              ↺ Reset
            </button>
            <button onClick={handleStepBack} className="px-4 py-2.5 rounded-lg font-mono text-xs font-semibold border border-border-bright bg-surface2 text-muted-foreground hover:border-primary hover:text-foreground transition-all">
              ← Step
            </button>
            <button onClick={handleStepForward} className="px-4 py-2.5 rounded-lg font-mono text-xs font-semibold border border-border-bright bg-surface2 text-muted-foreground hover:border-primary hover:text-foreground transition-all">
              Step →
            </button>
          </div>
        </div>

        {/* Goal State Card */}
        <div className="bg-card border border-border rounded-lg p-6 animate-fade-up">
          <div className="flex items-center gap-2 font-mono text-[11px] text-muted-foreground tracking-widest uppercase mb-5">
            <span className="w-1.5 h-1.5 rounded-full bg-primary" />
            goal state
            <div className="ml-auto flex gap-3">
              <button onClick={handleShuffleGoal} className="text-primary hover:underline text-[11px] font-mono cursor-pointer">
                SHUFFLE
              </button>
              <button onClick={() => setShowGoalEditor(true)} className="text-primary hover:underline text-[11px] font-mono cursor-pointer">
                EDIT
              </button>
            </div>
          </div>
          <div className="flex justify-center mb-4">
            <PuzzleGrid board={goal} />
          </div>
        </div>
      </div>

      {/* Visualization Box - only shown when solution exists */}
      {solution.length > 0 && (
        <div className="bg-card border border-border rounded-lg p-6 animate-fade-up mb-6">
          <div className="flex items-center gap-2 font-mono text-[11px] text-muted-foreground tracking-widest uppercase mb-5">
            <span className="w-1.5 h-1.5 rounded-full bg-primary" />
            visualization
            <span className="text-primary ml-1">{solution.length - 1} steps</span>
          </div>
          <SolutionPath path={solution} currentStep={currentStep} onStepClick={handleStepClick} />
        </div>
      )}

      {/* Controls */}
      <div className="bg-card border border-border rounded-lg p-6 animate-fade-up mb-6">
        <div className="flex items-center gap-2 font-mono text-[11px] text-muted-foreground tracking-widest uppercase mb-5">
          <span className="w-1.5 h-1.5 rounded-full bg-primary" />
          algorithm
        </div>

        {/* Algorithm Selector */}
        <div className="flex gap-2 flex-wrap mb-4">
          {([['bfs','BFS','Breadth-First Search'],['dfs','DFS','Depth-First Search'],['astar','A*','Heuristic Search']] as const).map(([id, name, desc]) => (
            <button
              key={id}
              onClick={() => setAlgo(id as Algorithm)}
              className={`flex-1 min-w-[80px] px-2 py-2.5 rounded-lg border font-mono text-xs font-semibold text-center transition-all
                ${algo === id ? 'bg-primary/15 border-primary text-primary' : 'bg-surface2 border-border-bright text-muted-foreground hover:border-primary hover:text-foreground'}
              `}
            >
              <span className="text-[13px] block mb-0.5">{name}</span>
              <span className="text-[10px] opacity-60 block">{desc}</span>
            </button>
          ))}
        </div>

        {/* Heuristic (A* only) */}
        {algo === 'astar' && (
          <div className="mb-4">
            <div className="flex items-center gap-2 font-mono text-[11px] text-muted-foreground tracking-widest uppercase mb-3">
              <span className="w-1.5 h-1.5 rounded-full bg-primary" />
              heuristic function
            </div>
            <div className="flex gap-2">
              {(['manhattan','misplaced'] as const).map(h => (
                <button
                  key={h}
                  onClick={() => setHeuristic(h)}
                  className={`flex-1 px-2 py-2 rounded-lg border font-mono text-[11px] text-center transition-all
                    ${heuristic === h ? 'bg-warning/15 border-warning text-warning' : 'bg-surface2 border-border-bright text-muted-foreground hover:text-foreground'}
                  `}
                >
                  {h === 'manhattan' ? 'Manhattan Distance' : 'Misplaced Tiles'}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Depth Limit (DFS only) */}
        {algo === 'dfs' && (
          <div className="mb-4">
            <div className="flex items-center gap-2 font-mono text-[11px] text-muted-foreground tracking-widest uppercase mb-3">
              <span className="w-1.5 h-1.5 rounded-full bg-primary" />
              depth limit
            </div>
            <div className="flex items-center gap-3 font-mono text-[11px] text-muted-foreground">
              <span>10</span>
              <input
                type="range" min={10} max={50} value={depthLimit}
                onChange={e => setDepthLimit(Number(e.target.value))}
                className="flex-1 h-[3px] bg-border-bright rounded appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:cursor-pointer"
              />
              <span>50</span>
              <span className="text-foreground font-semibold">{depthLimit}</span>
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-4 gap-2 mb-4">
          {[['moves', stats.moves],['nodes', stats.nodes],['depth', stats.depth],['ms', stats.time]].map(([label, val]) => (
            <div key={label} className="bg-surface2 border border-border rounded-lg px-2 py-2.5 text-center">
              <span className="text-xl font-extrabold font-mono block">{val}</span>
              <span className="text-[10px] text-muted-foreground/50 font-mono uppercase tracking-wider block mt-0.5">{label}</span>
            </div>
          ))}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={handleSolve}
            disabled={solving}
            className="flex-1 px-5 py-2.5 rounded-lg font-mono text-xs font-semibold bg-primary border border-primary text-primary-foreground hover:brightness-110 transition-all disabled:opacity-40 disabled:cursor-not-allowed tracking-wider"
          >
            {solving ? '⟳ Solving...' : '▶ Solve'}
          </button>
          <button onClick={handleStop} className="px-5 py-2.5 rounded-lg font-mono text-xs font-semibold border border-accent/40 text-accent hover:bg-accent/10 hover:border-accent transition-all">
            ■ Stop
          </button>
          <button onClick={handlePlay} className="px-5 py-2.5 rounded-lg font-mono text-xs font-semibold border border-success/40 text-success hover:bg-success/10 hover:border-success transition-all">
            {playing ? '⏸ Pause' : '▷ Play'}
          </button>
        </div>

        {/* Speed Slider */}
        <div className="flex items-center gap-3 mt-3 font-mono text-[11px] text-muted-foreground">
          <span>slow</span>
          <input
            type="range" min={50} max={800} value={800 - speed + 50}
            onChange={e => setSpeed(800 - Number(e.target.value) + 50)}
            className="flex-1 h-[3px] bg-border-bright rounded appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:cursor-pointer"
          />
          <span>fast</span>
          <span className="text-foreground/50">speed</span>
        </div>
      </div>

      {/* Log Panel */}
      <div className="bg-card border border-border rounded-lg p-6 animate-fade-up">
        <div className="flex items-center gap-2 font-mono text-[11px] text-muted-foreground tracking-widest uppercase mb-5">
          <span className="w-1.5 h-1.5 rounded-full bg-primary" />
          execution log
        </div>
        <LogPanel logs={logs} />
      </div>

      {/* Goal Editor Modal */}
      {showGoalEditor && (
        <GoalEditorModal goal={goal} onApply={handleGoalApply} onClose={() => setShowGoalEditor(false)} />
      )}

      {/* Board Editor Modal */}
      {showBoardEditor && (
        <GoalEditorModal goal={board} onApply={handleBoardApply} onClose={() => setShowBoardEditor(false)} title="Edit Current State" />
      )}
    </div>
  );
};

export default Index;
