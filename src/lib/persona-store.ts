import { DEFAULT_PERSONA } from "./personas";

export interface PersonaState {
  presetId: string;
  audience: string;
  genre: string;
}

const STORAGE_KEY = "post-generator:persona";

const DEFAULT_STATE: PersonaState = {
  presetId: DEFAULT_PERSONA.id,
  audience: DEFAULT_PERSONA.audience,
  genre: DEFAULT_PERSONA.genre,
};

const listeners = new Set<() => void>();

// useSyncExternalStore は同じ内容なら同じ参照が返ることを要求するため、読み取り結果を保持する。
let snapshot: PersonaState | null = null;

function readFromStorage(): PersonaState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_STATE;
    const parsed = JSON.parse(raw) as Partial<PersonaState>;
    return {
      presetId: parsed.presetId ?? DEFAULT_STATE.presetId,
      audience: parsed.audience ?? DEFAULT_STATE.audience,
      genre: parsed.genre ?? DEFAULT_STATE.genre,
    };
  } catch {
    return DEFAULT_STATE;
  }
}

export function subscribeToPersona(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

export function getPersonaSnapshot(): PersonaState {
  snapshot ??= readFromStorage();
  return snapshot;
}

/** サーバー描画時は保存値を読めないため、常に既定値を返す。 */
export function getPersonaServerSnapshot(): PersonaState {
  return DEFAULT_STATE;
}

export function setPersona(next: PersonaState): void {
  snapshot = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // プライベートモードなど保存できない環境では、その回だけ保存を諦める。
  }
  for (const listener of listeners) listener();
}
