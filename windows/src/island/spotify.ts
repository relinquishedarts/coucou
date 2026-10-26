// Spotify's reports → the page (src-tauri/src/spotify.rs). The parts of
// SpotifyController.swift that touch the app: the pill wears the track's
// title, music starting shows the compact island without a sound, and the
// card reads the player again whenever it comes on screen (seeks made in
// Spotify's own window are never signalled).

import { Bridge, onEvent } from "../core/bridge";
import { pillDefinition } from "../core/pills";
import { SPOTIFY_ID, MUSIC_ID, Spotify, isAd, type SpotifyState } from "../core/spotify";
import { State } from "../core/state";
import { t } from "../i18n/i18n";

export interface SpotifyHost {
  /** Compact island from hidden, no peek sound. */
  revealSilently(): void;
}

export function registerSpotifyHandlers(island: SpotifyHost) {
  void onEvent<SpotifyState>("spotify", (s) => applySpotify(island, s));
  void onEvent<{ artUrl: string; dataUrl: string }>("spotify-artwork", (art) => {
    Spotify.artwork = art;
    State.notify();
  });
  State.subscribe(() => {
    syncPillName();
    refreshWhenShown();
  });
}

/** A report from Rust (or the answer to a refresh). */
export function applySpotify(island: SpotifyHost, next: SpotifyState) {
  const wasPlaying = State.spotifyPlaying;
  Spotify.state = next;
  syncPillName();
  // Only on not playing → playing (SpotifyController.setPlaying).
  if (!wasPlaying && State.spotifyPlaying && !State.paused && State.mode === "hidden") {
    island.revealSilently();
  }
  State.notify();
}

/** SpotifyController.syncTaskName: the track's title, else the pill's name. */
export function syncPillName() {
  for (const id of [SPOTIFY_ID, MUSIC_ID]) {
    const task = State.tasks.find((x) => x.id === id);
    if (!task) continue;
    const track = Spotify.state.track;
    const title = isAd(track) ? t("Advertisement") : (track?.title ?? "");
    const defName = pillDefinition(id)?.name ?? (id === SPOTIFY_ID ? "Spotify" : "Apple Music");
    const name = title || defName;
    if (task.name !== name) task.name = name;
  }
}

let shown = false;

function refreshWhenShown() {
  const now = State.mode === "expanded" && State.view === "overview" &&
    (State.focusTask?.id === SPOTIFY_ID || State.focusTask?.id === MUSIC_ID);
  if (now && !shown) void Bridge.spotifyRefresh();
  shown = now;
}
