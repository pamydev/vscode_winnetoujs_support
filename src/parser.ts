import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import { IWinConfig } from "./types";

interface ConstructorData {
  id: string;
  file: string;
  line: number;
  position: number;
}

export async function getLanguages(): Promise<string[]> {
  const folderPath = path.join(
    vscode.workspace.workspaceFolders?.[0].uri.fsPath || "",
    (global as any).winnetoujsPath || "",
    "translations"
  );
  if (!fs.existsSync(folderPath)) {
    console.warn(`Folder not found: ${folderPath}`);
    return [];
  }
  let jsonFiles = await fs.promises.readdir(folderPath);
  let res = jsonFiles
    .filter(file => file.endsWith(".json"))
    .map(json => {
      return path.basename(json, path.extname(json));
    });
  return res;
}

export async function parseStrings(): Promise<{ [key: string]: any }> {
  const results: { [key: string]: any } = new Object();

  const folderPath = path.join(
    vscode.workspace.workspaceFolders?.[0].uri.fsPath || "",
    (global as any).winnetoujsPath || "",
    "translations"
  );
  if (!fs.existsSync(folderPath)) {
    console.warn(`WinnetouJS: Translations: Folder not found: ${folderPath}`);
    return {};
  }

  const jsonFiles = fs
    .readdirSync(folderPath)
    .filter(file => file.endsWith(".json"));

  await Promise.all(
    jsonFiles.map(async json => {
      const filePath = path.join(folderPath, json);
      const fileContent = await fs.promises.readFile(filePath, "utf-8");
      results[path.basename(json, path.extname(json))] =
        JSON.parse(fileContent);
    })
  );
  return results;
}

export async function parseConstructos(): Promise<ConstructorData[]> {
  const results: ConstructorData[] = [];
  const config = await __getUpdatedWinConfig();
  const folder = config !== false ? config.constructosPath : `./constructos`;
  const folderPath = path.isAbsolute(folder)
    ? folder
    : path.join(
        vscode.workspace.workspaceFolders?.[0].uri.fsPath || "",
        (global as any).winnetoujsPath || "",
        folder
      );
  if (!fs.existsSync(folderPath)) {
    console.warn(`Folder not found: ${folderPath}`);
    return [];
  }

  function getAllHtmlFiles(dir: string): string[] {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    const files = entries
      .filter(entry => !entry.isDirectory() && entry.name.endsWith(".html"))
      .map(file => path.join(dir, file.name));
    const folders = entries.filter(entry => entry.isDirectory());
    folders.forEach(folder => {
      files.push(...getAllHtmlFiles(path.join(dir, folder.name)));
    });
    return files;
  }

  const htmlFiles = getAllHtmlFiles(folderPath);

  await Promise.all(
    htmlFiles.map(async filePath => {
      const fileContent = await fs.promises.readFile(filePath, "utf-8");
      const lines = fileContent.split("\n");

      lines.forEach((line, index) => {
        const regex = /id="\[\[([^\]]+)\]\]"/g;
        let match;
        while ((match = regex.exec(line)) !== null) {
          const id = match[1];
          const position = match.index + match[0].indexOf(`[[${id}]]`) + 2;

          results.push({
            id,
            file: filePath,
            line: index + 1,
            position,
          });
        }
      });
    })
  );

  return results;
}

export async function getUpdatedWinConfig(): Promise<IWinConfig | false> {
  return await __getUpdatedWinConfig();
}

export async function getUpdatedPort(): Promise<Number> {
  const config = await __getUpdatedWinConfig();
  return config !== false ? config.serverPort : 0;
}

async function __getUpdatedWinConfig(): Promise<IWinConfig | false> {
  let configPath = path.join(
    vscode.workspace.workspaceFolders?.[0].uri.fsPath || "",
    "win.config.json"
  );

  if (!fs.existsSync(configPath)) {
    // in this case vscode has to prompt the user to input the path to the win.config.json file

    const packagePath = path.join(
      vscode.workspace.workspaceFolders?.[0].uri.fsPath || "",
      "package.json"
    );

    if (!fs.existsSync(packagePath)) {
      console.warn("No package.json file found");
      (global as any).winnetoujsPath = false;
      return false;
    }

    const packageFileContent = fs.readFileSync(packagePath, "utf-8");
    const packageJson = JSON.parse(packageFileContent);

    if (!packageJson.winnetoujs?.path) {
      console.warn("No winnetou.path found in package.json");
      (global as any).winnetoujsPath = false;
      return false;
    }

    const winnetoujsPath = packageJson.winnetoujs.path;

    // Store the winnetoujsPath globally
    (global as any).winnetoujsPath = winnetoujsPath;

    configPath = path.join(
      vscode.workspace.workspaceFolders?.[0].uri.fsPath || "",
      winnetoujsPath,
      "win.config.json"
    );

    if (!fs.existsSync(configPath)) {
      console.warn("No win.config.json file found");
      (global as any).winnetoujsPath = false;
      return false;
    }

    const configFileContent = fs.readFileSync(configPath, "utf-8");
    const config = JSON.parse(configFileContent);
    return config;
  }

  const configFileContent = fs.readFileSync(configPath, "utf-8");
  const config = JSON.parse(configFileContent);
  return config;
}
