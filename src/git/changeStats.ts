export interface ChangeStats {
  filesChanged: number;
  linesAdded: number;
  linesRemoved: number;
}

export function calculateChangeStats(diff: string): ChangeStats {
  const changedFiles = new Set<string>();
  let linesAdded = 0;
  let linesRemoved = 0;

  for (const line of diff.split(/\r?\n/)) {
    if (line.startsWith("diff --git ")) {
      const match = /^diff --git a\/(.+) b\/(.+)$/.exec(line);
      changedFiles.add(match?.[2] ?? line);
      continue;
    }

    if (line.startsWith("+++") || line.startsWith("---")) {
      continue;
    }

    if (line.startsWith("+")) {
      linesAdded += 1;
    } else if (line.startsWith("-")) {
      linesRemoved += 1;
    }
  }

  return {
    filesChanged: changedFiles.size,
    linesAdded,
    linesRemoved
  };
}
