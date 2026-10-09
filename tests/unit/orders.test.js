const test = require("node:test");
const assert = require("node:assert/strict");
const { buildOrder, validateCustomer, validateContact, MAX_QTY_PER_LINE } = require("../../app/lib/orders");

const catalog = [
  { sku: "trail-32", name: "Mochila Trail 32L", price: 289, stock: 14 },
  { sku: "apex-light", name: "Lanterna Apex 800", price: 119, stock: 31 },
  { sku: "granite-boot", name: "Bota Granite Mid", price: 459, stock: 6 },
];

const mariana = { name: "Mariana Alves", email: "mariana.alves@example.com", cep: "01310-100" };

function order(items, customer = mariana) {
  return buildOrder({ customer, items }, catalog);
}

test.describe("buildOrder", () => {
  test("soma preco vezes quantidade de cada linha", () => {
    const result = order([
      { sku: "trail-32", qty: 1 },
      { sku: "apex-light", qty: 2 },
    ]);
    assert.equal(result.ok, true);
    assert.equal(result.total, 289 + 2 * 119);
    assert.deepEqual(
      result.items.map((l) => [l.sku, l.qty]),
      [
        ["trail-32", 1],
        ["apex-light", 2],
      ],
    );
  });

  test("junta linhas repetidas do mesmo sku", () => {
    const result = order([
      { sku: "apex-light", qty: 1 },
      { sku: "apex-light", qty: 3 },
    ]);
    assert.equal(result.items.length, 1);
    assert.equal(result.items[0].qty, 4);
    assert.equal(result.total, 4 * 119);
  });

  test("sacola vazia ou ausente vira empty_cart", () => {
    assert.equal(order([]).error, "empty_cart");
    assert.equal(buildOrder({ customer: mariana }, catalog).error, "empty_cart");
    assert.equal(buildOrder(null, catalog).error, "empty_cart");
  });

  test("sku fora do catalogo vira unknown_sku com o sku no corpo", () => {
    const result = order([{ sku: "ski-pro", qty: 1 }]);
    assert.equal(result.status, 400);
    assert.equal(result.error, "unknown_sku");
    assert.equal(result.sku, "ski-pro");
  });

  for (const qty of [0, -1, 1.5, "dois", null, MAX_QTY_PER_LINE + 1]) {
    test(`quantidade ${JSON.stringify(qty)} e invalida`, () => {
      const result = order([{ sku: "trail-32", qty }]);
      assert.equal(result.error, "invalid_qty");
      assert.equal(result.max, MAX_QTY_PER_LINE);
    });
  }

  test("quantidade no limite passa", () => {
    assert.equal(order([{ sku: "apex-light", qty: MAX_QTY_PER_LINE }]).ok, true);
  });

  test("acima do estoque devolve 409 com o disponivel", () => {
    const result = order([{ sku: "granite-boot", qty: 7 }]);
    assert.equal(result.status, 409);
    assert.equal(result.error, "out_of_stock");
    assert.equal(result.available, 6);
    assert.equal(result.name, "Bota Granite Mid");
  });

  test("estoque e checado depois de juntar linhas repetidas", () => {
    const result = order([
      { sku: "granite-boot", qty: 4 },
      { sku: "granite-boot", qty: 3 },
    ]);
    assert.equal(result.error, "out_of_stock");
  });

  test("cliente invalido barra antes de olhar os itens", () => {
    const result = order([{ sku: "ski-pro", qty: 1 }], { ...mariana, cep: "123" });
    assert.equal(result.error, "invalid_cep");
  });
});

test.describe("validateCustomer", () => {
  test("normaliza espacos, caixa do e-mail e hifen do CEP", () => {
    const result = validateCustomer({ name: "  Mariana Alves ", email: "Mariana.Alves@Example.com", cep: "01310100" });
    assert.deepEqual(result.customer, { name: "Mariana Alves", email: "mariana.alves@example.com", cep: "01310-100" });
  });

  const cases = [
    [{}, "customer_required"],
    [{ ...mariana, name: "   " }, "customer_required"],
    [{ ...mariana, name: "M" }, "invalid_name"],
    [{ ...mariana, email: "mariana@" }, "invalid_email"],
    [{ ...mariana, email: "mariana alves@example.com" }, "invalid_email"],
    [{ ...mariana, cep: "0131-0100" }, "invalid_cep"],
    [{ ...mariana, cep: "01310-10" }, "invalid_cep"],
    [{ ...mariana, cep: "ABCDE-FGH" }, "invalid_cep"],
  ];
  for (const [customer, error] of cases) {
    test(`${JSON.stringify(customer)} -> ${error}`, () => {
      assert.equal(validateCustomer(customer).error, error);
    });
  }
});

test.describe("validateContact", () => {
  test("aceita nome e mensagem com espacos nas pontas", () => {
    const result = validateContact({ name: " João Ribeiro ", message: " A Granite Mid serve no 42? " });
    assert.equal(result.ok, true);
    assert.equal(result.name, "João Ribeiro");
  });

  test("exige nome e mensagem", () => {
    assert.equal(validateContact({ name: "João" }).error, "name_and_message_required");
    assert.equal(validateContact({ message: "oi" }).error, "name_and_message_required");
    assert.equal(validateContact(undefined).error, "name_and_message_required");
  });

  test("mensagem acima de 1000 caracteres e recusada", () => {
    const result = validateContact({ name: "João", message: "a".repeat(1001) });
    assert.equal(result.error, "message_too_long");
  });
});
