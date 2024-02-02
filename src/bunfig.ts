import { EOL } from "node:os";
import { appendFileSync } from "node:fs";
import { info } from "@actions/core";

type BunfigOptions = {
  registryUrls?: string;
  scopes?: string;
};


const parseRegistryScopePairs = (registryUrl: string, scope: string) => {
  const registries: string[] = [];
  for (const line of registryUrl.split(/\r|\n/)) {
    registries.push(line);
  }
  const scopes = [];
  for (const line of scope.split(/\r|\n/)) {
    scopes.push(line)
  }

  if (registries.length !== scopes.length) {
    throw new Error(`Registires and Scopes must match length`)
  }

  return registries.map((registry, index) => [registry, scopes[index]]);
}

export function createBunfig(options: BunfigOptions): string | null {
  const { registryUrls, scopes } = options;

  const registryScopePairs = parseRegistryScopePairs(registryUrls, scopes)

  let bunfigString: string = registryScopePairs.length === 0 ? null : `
  ${registryScopePairs.some(pair => pair[0]) && '[install]'}${EOL}
  ${registryScopePairs.map((pair, index) => pair[0] && !pair[1] ? `unscoped_${index}${EOL}` : '').join('${EOL}')}
  ${registryScopePairs.some(pair => pair[1] && '[install.scopes]')}${EOL}
  ${registryScopePairs.map((pair, index) => pair[0] && pair[1] ? `scoped_${index}${EOL}` : '').join('${EOL}')}
  `;

  for (const [index, [registryUrl, scope]] of registryScopePairs.entries()) {

    let url: URL | undefined;
    if (registryUrl) {
      try {
        url = new URL(registryUrl);
      } catch {
        throw new Error(`Invalid registry-url: ${registryUrl}`);
      }
    }

    let owner: string | undefined;
    if (scope) {
      owner = scope.startsWith("@")
        ? scope.toLocaleLowerCase()
        : `@${scope.toLocaleLowerCase()}`;
    }

    if (url && owner) {
      bunfigString.replace(`scoped_${index}`, `'${owner}' = { token = "$BUN_AUTH_TOKEN", url = "${url}"}`);
    }

    if (url && !owner) {
      bunfigString.replace(`unscoped_${index}`, `registry = "${url}"`);
    }
  }

  return bunfigString;
}

export function writeBunfig(path: string, options: BunfigOptions): void {
  const bunfig = createBunfig(options);
  if (!bunfig) {
    return;
  }

  info(`Writing bunfig.toml to '${path}'.`);
  appendFileSync(path, bunfig, {
    encoding: "utf8",
  });
}
