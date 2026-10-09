import fs from "node:fs";
import path from "node:path";

export type Product = {
  sku: string;
  name: string;
  category: string;
  price: number;
  stock: number;
};

export const catalog: Product[] = JSON.parse(
  fs.readFileSync(path.join(__dirname, "..", "..", "app", "products.json"), "utf8"),
);

export function product(sku: string): Product {
  const found = catalog.find((p) => p.sku === sku);
  if (!found) throw new Error(`sku ${sku} nao esta em app/products.json`);
  return found;
}

export const customers = {
  mariana: { name: "Mariana Alves", email: "mariana.alves@example.com", cep: "01310-100" },
  joao: { name: "João Ribeiro", email: "joao.ribeiro@example.com", cep: "22041-080" },
};

export function brl(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }).replace(/\s/g, " ");
}
