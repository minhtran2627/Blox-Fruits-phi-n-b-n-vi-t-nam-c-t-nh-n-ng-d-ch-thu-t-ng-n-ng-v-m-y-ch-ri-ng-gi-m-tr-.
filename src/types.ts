export type StatName = "melee" | "defense" | "sword" | "fruit";

export interface PlayerStats {
  melee: number;
  defense: number;
  sword: number;
  fruit: number;
  points: number;
}

export interface PlayerData {
  level: number;
  exp: number;
  maxExp: number;
  hp: number;
  maxHp: number;
  energy: number;
  maxEnergy: number;
  money: number;
  stats: PlayerStats;
  equippedFruit: string | null;
  equippedWeapon: string;
}

export interface Quest {
  id: string;
  title: string;
  targetType: string;
  targetCount: number;
  currentCount: number;
  expReward: number;
  moneyReward: number;
  isCompleted: boolean;
}

export interface GameUIState {
  player: PlayerData;
  activeQuest: Quest | null;
  cooldowns: Record<string, number>;
  menuOpen: boolean;
  damageTexts: {
    id: number;
    text: string;
    x: number;
    y: number;
    color: string;
  }[];
  showNpcDialog: boolean;
  npcText: string;
}
