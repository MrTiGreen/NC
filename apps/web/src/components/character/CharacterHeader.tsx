import { useEffect, useState, type ReactNode } from "react";
import type { CharacterPublicProfileDto } from "@telegram-mini-chat/shared";
import { getCharacterPublicProfile } from "../../lib/api";
import type { CharacterPageData, ProgressMetric } from "./types";
import styles from "./CharacterPage.module.css";

type CharacterHeaderProps = {
  characterName: string;
  data: Pick<CharacterPageData, "level" | "health" | "energy" | "experience" | "currencies" | "statusBadges">;
  profile?: CharacterPublicProfileDto | null;
  token?: string;
  userId?: number;
  portraitControl?: ReactNode;
  identityControl?: ReactNode;
};

function ProgressBar({ metric }: { metric: ProgressMetric }) {
  const value = Math.min(100, (metric.current / metric.maximum) * 100);
  return (
    <div className={styles.progressLine}>
      <span className={`${styles.progressFill} ${styles[metric.tone]}`} style={{ width: `${value}%` }} />
      <span className={styles.progressValue}>{metric.current}/{metric.maximum}</span>
    </div>
  );
}

export function CharacterHeader({ characterName, data, profile, token, userId, portraitControl, identityControl }: CharacterHeaderProps) {
  const [fetchedProfile, setFetchedProfile] = useState<CharacterPublicProfileDto | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (profile !== undefined) {
      return undefined;
    }

    if (!token || !userId) {
      setFetchedProfile(null);
      return undefined;
    }

    let cancelled = false;

    void getCharacterPublicProfile(token, userId)
      .then((profile) => {
        if (!cancelled) setFetchedProfile(profile);
      })
      .catch(() => {
        if (!cancelled) setFetchedProfile(null);
      });

    return () => {
      cancelled = true;
    };
  }, [profile, token, userId]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const publicProfile = profile === undefined ? fetchedProfile : profile;
  const liveHealth = publicProfile
    ? {
        current: getRegeneratedHp(publicProfile, now),
        maximum: publicProfile.health.maximum,
        tone: "health" as const
      }
    : data.health;
  const liveData = publicProfile
    ? {
        ...data,
        level: publicProfile.level,
        health: liveHealth,
        experience: {
          current: Number(BigInt(publicProfile.totalExp) % BigInt(Math.max(1000, publicProfile.level * 5000))),
          maximum: Math.max(1000, publicProfile.level * 5000),
          tone: "experience" as const
        }
      }
    : data;

  return (
    <header className={styles.header}>
      <div className={styles.headerTopline}>
        {portraitControl ? (
          <div className={styles.headerPortraitControl}>{portraitControl}</div>
        ) : (
          <img className={styles.headerPortrait} src="/assets/character-page/portrait.png" alt="" />
        )}
        <div className={styles.identity}>
          {identityControl ?? <strong>{characterName} · ур.{liveData.level}</strong>}
          <div className={styles.resourceRows}>
            <ProgressBar metric={liveData.health} />
            <ProgressBar metric={liveData.energy} />
          </div>
        </div>
        <div className={styles.statusBadges} aria-label="Статусы персонажа">
        {liveData.statusBadges.map((badge) => (
            <span className={styles[badge.tone]} key={badge.id}>{badge.label}</span>
          ))}
        </div>
        <div className={styles.currencies} aria-label="Валюты">
        {liveData.currencies.map((currency) => (
            <span key={currency.id}>{currency.symbol} {currency.value.toLocaleString("ru-RU")}</span>
          ))}
        </div>
      </div>
      <div className={styles.experienceLine}>
        <span className={styles.experienceFill} style={{ width: `${(liveData.experience.current / liveData.experience.maximum) * 100}%` }} />
        <span>EXP {liveData.experience.current.toLocaleString("ru-RU")} / {liveData.experience.maximum.toLocaleString("ru-RU")}</span>
      </div>
    </header>
  );
}

function getRegeneratedHp(profile: CharacterPublicProfileDto, now: number) {
  const elapsedMinutes = Math.max(0, (now - Date.parse(profile.health.regeneratedAt)) / 60_000);
  return Math.min(profile.health.maximum, Math.floor(profile.health.current + elapsedMinutes * profile.health.regenPerMinute));
}
