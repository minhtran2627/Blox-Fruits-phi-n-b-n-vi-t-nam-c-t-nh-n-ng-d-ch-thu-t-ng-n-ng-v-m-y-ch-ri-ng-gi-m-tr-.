import React, { useEffect, useRef, useState } from "react";
import { GameWorld } from "./game/GameWorld";
import { FRUITS } from "./game/fruits";
import { PlayerData, Quest } from "./types";
import { UserCircle, Sword, Shield, Map, Zap, Target } from "lucide-react";

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<GameWorld | null>(null);

  const [gameState, setGameState] = useState<any>({
    player: null,
    activeQuest: null,
    cooldowns: {},
    showNpcDialog: false,
  });

  const [menuOpen, setMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("Stats");

  useEffect(() => {
    if (!canvasRef.current) return;

    // Canvas size
    const resize = () => {
      if (canvasRef.current) {
        canvasRef.current.width = window.innerWidth;
        canvasRef.current.height = window.innerHeight;
      }
    };
    window.addEventListener("resize", resize);
    resize();

    const world = new GameWorld(canvasRef.current, (state) => {
      setGameState((prev) => ({ ...prev, ...state }));
    });

    gameRef.current = world;

    // Initial sync
    world.syncUI();

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "m" || e.key === "M") {
        setMenuOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKey);

    return () => {
      window.removeEventListener("resize", resize);
      window.removeEventListener("keydown", handleKey);
      world.destroy();
    };
  }, []);

  const p: PlayerData = gameState.player;
  const q: Quest = gameState.activeQuest;

  const handleStatUpgrade = (stat: keyof PlayerData["stats"]) => {
    if (gameRef.current && p.stats.points > 0) {
      gameRef.current.playerData.stats[stat] += 1;
      gameRef.current.playerData.stats.points -= 1;
      // update hp/energy max based on stats if needed
      if (stat === "defense") gameRef.current.playerData.maxHp += 5;
      if (stat === "melee") gameRef.current.playerData.maxEnergy += 2;

      gameRef.current.syncUI();
      gameRef.current.saveGame();
    }
  };

  const equipFruit = (f: string) => {
    if (gameRef.current) {
      gameRef.current.playerData.equippedFruit = f;
      gameRef.current.syncUI();
      gameRef.current.saveGame();
    }
  };

  return (
    <div className="relative w-full h-screen overflow-hidden bg-black font-sans select-none">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 block cursor-crosshair"
        onContextMenu={(e) => e.preventDefault()}
      />

      {/* HUD Layers below */}
      {p && (
        <>
          {/* Top Left: Player Status */}
          <div className="absolute top-4 left-4 z-10 w-64 bg-black/60 backdrop-blur border border-white/10 rounded-lg p-3 text-white shadow-xl">
            <div className="flex justify-between items-end mb-2">
              <span className="font-bold text-lg">Lv. {p.level}</span>
              <span className="text-sm text-yellow-400 font-bold">
                ${p.money.toLocaleString()}
              </span>
            </div>

            {/* HP */}
            <div className="mb-1.5 border border-white/20 rounded p-[1px] bg-red-950">
              <div
                className="h-3 bg-red-500 rounded-sm"
                style={{ width: `${Math.max(0, (p.hp / p.maxHp) * 100)}%` }}
              />
              <div className="text-[10px] font-black text-center mt-[-14px] text-white drop-shadow-md">
                HP: {Math.floor(Math.max(0, p.hp))} / {p.maxHp}
              </div>
            </div>

            {/* Energy */}
            <div className="mb-1.5 border border-white/20 rounded p-[1px] bg-blue-950">
              <div
                className="h-3 bg-blue-500 rounded-sm"
                style={{
                  width: `${Math.max(0, (p.energy / p.maxEnergy) * 100)}%`,
                }}
              />
              <div className="text-[10px] font-black text-center mt-[-14px] text-white drop-shadow-md">
                Energy: {Math.floor(p.energy)} / {p.maxEnergy}
              </div>
            </div>

            {/* EXP */}
            <div className="border border-white/20 rounded p-[1px] bg-green-950">
              <div
                className="h-1.5 bg-green-400 rounded-sm"
                style={{ width: `${(p.exp / p.maxExp) * 100}%` }}
              />
            </div>
          </div>

          {/* Quest Tracker */}
          {q && (
            <div className="absolute top-4 right-4 z-10 w-48 bg-black/60 backdrop-blur border border-yellow-500/50 rounded-lg p-3 text-white shadow-xl">
              <h3 className="text-yellow-400 font-bold text-sm mb-1 uppercase tracking-widest flex items-center gap-1">
                <Target size={14} /> Quest
              </h3>
              <p className="text-xs mb-2 text-gray-300">{q.title}</p>
              <div className="text-right text-xs font-bold text-white">
                {q.currentCount} / {q.targetCount}
              </div>
              <div className="w-full bg-gray-800 h-1 mt-1 rounded-full overflow-hidden">
                <div
                  className="bg-yellow-400 h-full"
                  style={{
                    width: `${(q.currentCount / q.targetCount) * 100}%`,
                  }}
                />
              </div>
            </div>
          )}

          {/* NPC Interaction Hint */}
          {gameState.showNpcDialog && (
            <div className="absolute bottom-32 left-1/2 -translate-x-1/2 z-10 bg-black/80 backdrop-blur border border-green-500 rounded p-4 text-center animate-bounce shadow-[0_0_15px_rgba(34,197,94,0.3)]">
              <p className="text-white font-bold mb-1">Quest Master</p>
              <p className="text-green-400 text-sm">
                Press{" "}
                <kbd className="bg-white/20 px-2 py-0.5 rounded text-white">
                  F
                </kbd>{" "}
                to Interact
              </p>
            </div>
          )}

          {/* Skills Hotbar */}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 flex gap-2">
            {/* Sword */}
            <div className="w-14 h-14 bg-zinc-800 border-2 border-gray-400 rounded flex flex-col items-center justify-center relative">
              <span className="text-xl">🗡️</span>
              <span className="text-[10px] text-white font-bold absolute bottom-1">
                Click
              </span>
            </div>

            <div className="w-14 h-14 bg-zinc-800 border-2 border-gray-400 rounded flex flex-col items-center justify-center relative">
              <span className="text-xl">🏃‍♂️</span>
              <span className="text-[10px] text-white font-bold absolute bottom-1">
                Shift
              </span>
            </div>

            {/* Fruit Skills */}
            {p.equippedFruit &&
              FRUITS[p.equippedFruit] &&
              ["Z", "X", "C"].map((key) => {
                const skill = FRUITS[p.equippedFruit!].skills[key];
                const cd = gameState.cooldowns[`${p.equippedFruit}_${key}`];
                const isOnCd = cd > 0;
                return (
                  <div
                    key={key}
                    className={`w-14 h-14 border-2 rounded flex flex-col items-center justify-center relative overflow-hidden transition-all ${isOnCd ? "bg-zinc-900 border-red-900" : "bg-zinc-800 border-yellow-500 shadow-[0_0_10px_rgba(250,204,21,0.3)]"}`}
                  >
                    <span className="text-[10px] text-white font-bold absolute top-1 left-1 bg-black/50 px-1 rounded">
                      {key}
                    </span>
                    <span
                      className="text-xs text-white text-center leading-tight mt-2 px-1"
                      style={{ color: FRUITS[p.equippedFruit!].color }}
                    >
                      {skill.name}
                    </span>

                    {isOnCd && (
                      <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
                        <span className="text-red-400 font-bold text-lg">
                          {cd.toFixed(1)}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}

            {/* Menu Hint */}
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="ml-4 w-14 h-14 bg-blue-900 hover:bg-blue-800 border-2 border-blue-400 rounded flex flex-col items-center justify-center relative transition-colors shadow-lg"
            >
              <span className="text-white font-bold">MENU</span>
              <span className="text-[10px] text-blue-200 absolute bottom-1">
                Key: M
              </span>
            </button>
          </div>
        </>
      )}

      {/* Main Menu Modal */}
      {menuOpen && p && (
        <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-white/20 w-full max-w-2xl rounded-xl shadow-[0_0_50px_rgba(0,0,0,0.8)] flex overflow-hidden h-[500px]">
            {/* Sidebar */}
            <div className="w-1/3 bg-black/50 border-r border-white/10 p-4 space-y-2">
              <h2 className="text-2xl font-black text-white mb-6 uppercase tracking-widest text-center">
                Pirate OS
              </h2>

              {["Stats", "Inventory", "Map"].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`w-full py-3 px-4 rounded text-left font-bold transition-colors ${activeTab === tab ? "bg-blue-600 text-white" : "hover:bg-white/10 text-gray-400"}`}
                >
                  {tab}
                </button>
              ))}

              <button
                onClick={() => setMenuOpen(false)}
                className="w-full py-3 px-4 rounded text-left font-bold text-red-400 hover:bg-red-950/50 transition-colors mt-auto block absolute bottom-4 w-[calc(33.33%-2rem)]"
              >
                Resume
              </button>
            </div>

            {/* Content */}
            <div className="w-2/3 p-6 overflow-y-auto">
              {activeTab === "Stats" && (
                <div>
                  <h3 className="text-xl font-bold text-white mb-4 flex items-center justify-between">
                    Attributes
                    <span className="text-sm bg-yellow-500/20 text-yellow-400 px-3 py-1 rounded text-right">
                      Points: {p.stats.points}
                    </span>
                  </h3>

                  <div className="space-y-4">
                    {["melee", "defense", "sword", "fruit"].map((stat) => (
                      <div
                        key={stat}
                        className="bg-black/40 p-4 rounded-lg flex items-center justify-between border border-white/5"
                      >
                        <div className="flex items-center gap-3">
                          {stat === "melee" && (
                            <UserCircle className="text-red-400" />
                          )}
                          {stat === "defense" && (
                            <Shield className="text-blue-400" />
                          )}
                          {stat === "sword" && (
                            <Sword className="text-gray-400" />
                          )}
                          {stat === "fruit" && (
                            <Zap className="text-yellow-400" />
                          )}
                          <span className="text-white capitalize font-bold">
                            {stat}
                          </span>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="text-gray-400 font-mono w-8 text-right pr-2">
                            Lv.{p.stats[stat as keyof PlayerData["stats"]]}
                          </span>
                          <button
                            onClick={() =>
                              handleStatUpgrade(
                                stat as keyof PlayerData["stats"],
                              )
                            }
                            disabled={p.stats.points <= 0}
                            className="w-8 h-8 flex items-center justify-center bg-green-600 hover:bg-green-500 disabled:bg-zinc-800 disabled:text-gray-600 rounded text-white font-black transition-colors"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === "Inventory" && (
                <div>
                  <h3 className="text-xl font-bold text-white mb-4">
                    Fruits Inventory
                  </h3>
                  <p className="text-xs text-gray-400 mb-4">
                    Click a fruit to equip it. Only one fruit can be equipped at
                    a time.
                  </p>

                  <div className="grid grid-cols-2 gap-4">
                    {Object.keys(FRUITS).map((f) => (
                      <button
                        key={f}
                        onClick={() => equipFruit(f)}
                        className={`p-4 rounded-lg border text-left transition-all ${p.equippedFruit === f ? "bg-blue-900/40 border-blue-500" : "bg-black/40 border-white/10 hover:border-white/30"}`}
                      >
                        <div
                          className="font-black text-lg mb-1"
                          style={{ color: FRUITS[f].color }}
                        >
                          {f} Fruit
                        </div>
                        <div className="text-xs text-gray-400 line-clamp-2">
                          Powerful elemental abilities.
                        </div>
                        {p.equippedFruit === f && (
                          <div className="mt-2 text-[10px] bg-blue-500 text-white px-2 py-0.5 rounded inline-block uppercase font-bold">
                            Equipped
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === "Map" && (
                <div className="text-center mt-10">
                  <Map size={64} className="mx-auto text-gray-600 mb-4" />
                  <h3 className="text-xl font-bold text-gray-400">
                    Map Unavailable
                  </h3>
                  <p className="text-sm text-gray-500">
                    Explore the world manually to find islands.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
