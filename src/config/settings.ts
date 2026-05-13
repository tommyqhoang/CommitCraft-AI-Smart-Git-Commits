export interface AiCommitSettings {
  openRouterModel: string;
  fallbackModel: string;
  maxDiffCharacters: number;
  includeUntrackedFiles: boolean;
}

export interface ConfigReader {
  get<T>(key: string): T | undefined;
}

export const openRouterTokenSecretKey = "commitCraft.openRouterToken";

export function readSettingsFromConfig(config: ConfigReader): AiCommitSettings {
  return {
    openRouterModel: readNonEmptyString(config, "openRouterModel", "openrouter/auto"),
    fallbackModel: readNonEmptyString(config, "fallbackModel", "openrouter/free"),
    maxDiffCharacters: Math.max(1000, config.get<number>("maxDiffCharacters") ?? 60000),
    includeUntrackedFiles: config.get<boolean>("includeUntrackedFiles") ?? true
  };
}

function readNonEmptyString(config: ConfigReader, key: string, fallback: string): string {
  const value = config.get<string>(key);
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : fallback;
}
