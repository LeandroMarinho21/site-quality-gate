import fs from "node:fs";
import path from "node:path";
import Ajv from "ajv";
import { expect } from "@playwright/test";

const dir = path.join(__dirname, "..", "..", "contracts");
const ajv = new Ajv({ allErrors: true, strict: true, strictRequired: false });
for (const file of fs.readdirSync(dir).filter((f) => f.endsWith(".schema.json"))) {
  ajv.addSchema(JSON.parse(fs.readFileSync(path.join(dir, file), "utf8")));
}

export function expectSchema(body: unknown, id: string) {
  const validate = ajv.getSchema(id);
  if (!validate) throw new Error(`schema ${id} nao existe em contracts/`);
  const ok = validate(body);
  expect(ok, `${id}: ${ajv.errorsText(validate.errors)}\n${JSON.stringify(body, null, 2)}`).toBe(true);
}
