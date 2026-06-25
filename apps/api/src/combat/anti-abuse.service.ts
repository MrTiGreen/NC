import { CombatBalanceConfig } from "./combat.config.js";

export type SuspicionSignal = {
  reason: "REPEATED_OPPONENT" | "REPEATED_LOSS_PATTERN" | "LOW_DAMAGE" | "SHORT_BATTLE" | "GEAR_MISMATCH" | "SHARED_DEVICE_OR_IP" | "SUSPICIOUS_REWARD_TRANSFER";
  score: number;
};

export type BattleSuspicionInput = {
  pairBattlesToday: number;
  repeatedLosses: number;
  totalDamage: number;
  combinedMaxHp: number;
  rounds: number;
  gearDifference: number;
  hasSharedIpOrDevice: boolean;
  suspiciousRewardTransfer?: boolean;
};

export function evaluateBattleSuspicion(input: BattleSuspicionInput) {
  const signals: SuspicionSignal[] = [];
  if (input.pairBattlesToday >= CombatBalanceConfig.antiAbuse.repeatPairThreshold) {
    signals.push({ reason: "REPEATED_OPPONENT", score: CombatBalanceConfig.antiAbuse.repeatPairScore });
  }
  if (input.repeatedLosses >= CombatBalanceConfig.antiAbuse.repeatedLossThreshold) {
    signals.push({ reason: "REPEATED_LOSS_PATTERN", score: CombatBalanceConfig.antiAbuse.repeatedLossScore });
  }
  if (input.totalDamage / Math.max(1, input.combinedMaxHp) <= CombatBalanceConfig.antiAbuse.lowDamageRatio) {
    signals.push({ reason: "LOW_DAMAGE", score: CombatBalanceConfig.antiAbuse.lowDamageScore });
  }
  if (input.rounds <= CombatBalanceConfig.antiAbuse.shortBattleRounds) {
    signals.push({ reason: "SHORT_BATTLE", score: CombatBalanceConfig.antiAbuse.shortBattleScore });
  }
  if (input.gearDifference >= CombatBalanceConfig.antiAbuse.largeGearDifference) {
    signals.push({ reason: "GEAR_MISMATCH", score: CombatBalanceConfig.antiAbuse.gearMismatchScore });
  }
  if (input.hasSharedIpOrDevice) {
    signals.push({ reason: "SHARED_DEVICE_OR_IP", score: CombatBalanceConfig.antiAbuse.sharedDeviceScore });
  }
  if (input.suspiciousRewardTransfer) {
    signals.push({ reason: "SUSPICIOUS_REWARD_TRANSFER", score: 0.4 });
  }
  return { suspicionScore: Math.min(1, signals.reduce((sum, signal) => sum + signal.score, 0)), signals };
}
