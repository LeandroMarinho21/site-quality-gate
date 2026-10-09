# Estratégia de testes

O gate existe para responder uma pergunta: **esta revisão pode receber tráfego de cliente?** Cada teste está na camada mais barata que consegue responder a parte dele dessa pergunta.

## Riscos e onde cada um é pego

| risco | exemplo | pego em |
| --- | --- | --- |
| regra de preço ou estoque errada | total soma errado, vende 7 botas com 6 em estoque | unit |
| API muda o formato e quebra o front | `order.total` vira `order.amount` | contract |
| métrica que o gate lê some ou muda de nome | `http_error_rate` renomeado | contract |
| loja não abre ou compra não fecha | JS quebra o checkout | smoke |
| fluxo secundário regride | filtro, busca, sacola, mensagens de erro | regression |
| página inacessível | contraste, campo sem label | regression (axe) |
| motor ou tela diferente quebra | Safari, celular | nightly |
| revisão nova erra mais que a atual | 5xx no checkout só no canary | analysis canary vs stable |
| revisão nova fica lenta | +300 ms por request | analysis canary vs stable |
| piora só aparece com 100% do tráfego | vazamento, cache frio | soak pós-promote |
| o próprio gate ficou cego | analysis sem a rota que quebra | drills |

## Camadas

| camada | onde | quanto | quando bloqueia |
| --- | --- | --- | --- |
| unit | `tests/unit` (node:test) | ~50 casos, < 1 s | PR |
| contract | `tests/contract` + `contracts/*.schema.json` | 15 casos, < 1 s | PR, e pula o resto se falhar |
| smoke | `tests/smoke` | 5 casos, < 5 s | PR, canary 10%, canary 50%, soak |
| regression | `tests/regression` | ~26 casos | PR |
| nightly | mesmas jornadas em Firefox, WebKit e Pixel 7, 2× | ~190 execuções | não bloqueia; abre trabalho |
| analysis | `scripts/canary-compare.mjs` no AnalysisTemplate | 3 medições por degrau | canary (aborta sozinho) |

Regra para decidir a camada de um teste novo:

- Dá para testar chamando uma função? **Unit.** Casos de borda moram aqui (quantidade 0, 11, CEP com 7 dígitos).
- É o formato de uma resposta que alguém consome? **Contract.**
- Se quebrar, o cliente não compra? **Smoke**, e só se couber em segundos.
- O resto que o usuário vê na tela: **regression**, com um caso feliz e os negativos que mudam a UI.

E2E não repete o que o unit já prova. O checkout no browser checa que a mensagem certa aparece, não todas as combinações de CEP inválido.

## Critério de promote

Uma revisão só vai para 100% quando, nesta ordem:

1. O stable está dentro do error budget (≤ 5% de erro). Se não estiver, o canary nem começa: não dá para comparar contra uma base que já está ruim.
2. Em cada degrau (10% e 50%), três medições seguidas de canary vs stable passam:
   - erro do canary ≤ 5%;
   - canary erra no máximo 2 pontos percentuais a mais que o stable;
   - p95 do canary ≤ p95 do stable × 1,5 + 50 ms;
   - menos de 20 amostras é inconclusivo e conta como reprovado.
3. O smoke passa batendo no canary (`X-Canary: always`) e confirma que `/health` responde a versão que está sendo promovida.
4. Depois de 100%, três rodadas de smoke sem header e o error rate do stable novo ficam verdes. Se não, rollback para a revisão anterior.

Pausa de 10 minutos em cada degrau é teto, não espera: o Actions promove assim que as checagens passam.

## Classes de falha

O resumo do deploy diz em que camada a revisão parou, porque a ação muda:

| classe | significa | o que fazer |
| --- | --- | --- |
| `budget` | stable já estava ruim | investigar produção antes de qualquer deploy |
| `sli` | canary pior que o stable em erro ou latência | bug no código novo; abort foi automático |
| `functional` | SLIs ok, smoke vermelho | bug funcional **ou teste quebrado**; abrir o trace antes de culpar o código |
| `post-promote` | passou no canary, falhou com 100% | rollback feito; procurar o que depende de volume |
| `deploy` | rollout não chegou no estado esperado | controller, imagem, readiness |

## Drills

Um gate que nunca reprova pode estar cego. O deploy aceita um `drill` no workflow_dispatch; em drill nada é promovido e o job fica verde só se o defeito cair na classe esperada.

| drill | defeito | classe esperada |
| --- | --- | --- |
| `inject-errors` | canary devolve 500 em `/checkout` e `/api/orders` | `sli` |
| `inject-latency` | canary demora 400 ms por request; o smoke passa | `sli` |
| `false-positive` | teste que espera "Release 2.0" num site 1.0 | `functional` |

O de latência é o que justifica a análise existir: o smoke em browser passa inteiro numa revisão 300 ms mais lenta.

## Oráculos e dados

- Seletores por `data-testid`. Texto só quando o texto é o requisito (mensagem de erro).
- Preço, nome e estoque vêm de `app/products.json`, não de número escrito no teste.
- Clientes fixos (`tests/support/data.ts`): Mariana Alves, CEP 01310-100; João Ribeiro, CEP 22041-080.
- Smoke não afirma copy de marketing ("Release 1.0"); afirma capacidade: loja abre, compra fecha, versão certa responde.
- Qualquer exceção JavaScript na página reprova o teste (fixture `failOnPageError`).
- Cada teste roda num contexto de browser novo; nada de limpar estado no `beforeEach`.

## Instabilidade e quarentena

- `retries: 0` em todo lugar. Retry esconde o problema e deixa o gate mais lento.
- O nightly roda cada jornada duas vezes; o resumo lista o que passou e falhou no mesmo run.
- Teste instável tem dono no mesmo dia: corrige, ou marca `@quarantine` com link para a issue e prazo de 14 dias. Quarentena sai dos gates e continua no nightly.

## Fora do escopo, de propósito

- Carga e estresse: o cluster é efêmero e pequeno; números de k6 aqui não significariam nada.
- Regressão visual por screenshot: diff entre Windows local e Linux no CI vira ruído.
- Pagamento, login e multiusuário: a loja não tem.
- Prometheus e Datadog: as métricas vêm do próprio app e das sondas do analysis. Em produção, o `canary-compare` vira uma query sobre o tráfego real.
