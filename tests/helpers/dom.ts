import fs from "node:fs";
import path from "node:path";

export function loadFixture(name: string): string {
  const fixturePath = path.resolve(process.cwd(), "tests/fixtures/extraction", name);
  return fs.readFileSync(fixturePath, "utf8");
}

export function setDocument(html: string) {
  document.open();
  document.write(html);
  document.close();
}

