export interface AiCommitSettings {
  openRouterModel: string;
  fallbackModel: string;
  maxDiffCharacters: number;
  includeUntrackedFiles: boolean;
  autoPushAfterCommit: boolean;
}

export interface ConfigReader {
  get<T>(key: string): T | undefined;
}

export const openRouterTokenSecretKey = "aiCommit.openRouterToken";

export function readSettingsFromConfig(config: ConfigReader): AiCommitSettings {
  return {
    openRouterModel: config.get<string>("openRouterModel") ?? "openrouter/auto",
    fallbackModel: config.get<string>("fallbackModel") ?? "openrouter/free",
    maxDiffCharacters: config.get<number>("maxDiffCharacters") ?? 60000,
    includeUntrackedFiles: config.get<boolean>("includeUntrackedFiles") ?? true,
    autoPushAfterCommit: config.get<boolean>("autoPushAfterCommit") ?? false
  };
}
