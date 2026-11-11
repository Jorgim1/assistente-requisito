---
inclusion: manual
---

# Diretrizes de Geracao de Historias - GFO + TJ (Tribunal de Justica)

> ATIVACAO: Estas diretrizes valem APENAS quando o usuario escolher o modelo **GFO + TJ**
> (ou indicar explicitamente que a geracao e para o cliente TJ / Tribunal de Justica,
> ou referenciar esta steering via `#diretrizes-gfo-tj`).
>
> PRECEDENCIA: Quando ativas, estas regras SUBSTITUEM o formato de narrativa e de
> criterios de aceite definidos em `formato-historias.md`. As regras de
> granularidade, classificacao HU/HT e numeracao de `regras-extracao.md`
> continuam valendo normalmente.

## Campo de integracoes

No modelo GFO+TJ, o campo de integracoes internas e nomeado **Integracoes GFO**:

```markdown
| **Integracoes GFO** | [Modulos GFO relacionados] |
```

## Publico-alvo da escrita

As historias devem ser compreendidas por um Product Owner SEM conhecimento
tecnico de TI. O objetivo e representar a necessidade de negocio e o resultado
esperado, nao descrever como o sistema sera implementado.

## 1. Perspectiva da historia

Escrever sempre sob a perspectiva da NECESSIDADE DE NEGOCIO, mesmo quando a
implementacao for exclusivamente tecnica.

Nao usar como sujeito principal expressoes como: "o sistema", "o endpoint",
"a API", "o modulo X precisa chamar...", "realizar um GET", "retornar dados via
endpoint".

Quando a necessidade envolver integracao entre modulos, traduzir a necessidade
tecnica para o resultado de negocio que essa integracao precisa garantir.

Evitar:
> Eu, como sistema de replicacao, quero consultar a versao atual das tabelas do
> modulo Institucional via endpoint, para validar se os dados estao atualizados.

Utilizar:
> A fim de garantir que os dados utilizados pelo Planejamento estejam
> atualizados, precisa-se consultar a versao mais recente dos dados do modulo
> Institucional antes de realizar uma replicacao.

## 2. Nao utilizar linguagem tecnica

Nao usar, na descricao da necessidade ou nos criterios de aceite, termos tecnicos
de implementacao, tais como: endpoint, API, GET / POST / PUT / DELETE, backend,
frontend, banco de dados, tabela (quando puder ser substituido por "dados" ou
"informacoes"), payload, request / response, servico, microservico, URL, codigo
HTTP, autenticacao tecnica, autorizacao tecnica, integracao via API, chamada de
servico.

Detalhes tecnicos identificados na fonte devem ser preservados como observacoes
tecnicas ou regras de implementacao (na secao Observacoes), mas nao devem
dominar a historia. Nao inventar necessidade de negocio ausente na fonte.

## 3. Estrutura obrigatoria

Toda historia do modelo GFO+TJ deve seguir EXATAMENTE esta estrutura:

```markdown
**A fim de** [objetivo ou beneficio que se deseja alcancar],

**precisa-se** [necessidade que deve ser atendida].

-------------

**Resultados esperados:**

**CA01:** [primeiro resultado verificavel]

**CA02:** [segundo resultado verificavel]

**CA03:** [terceiro resultado verificavel]

**CA04:** [quarto resultado verificavel, quando aplicavel]

**Observacoes:** [informacoes relevantes, premissas, regras ou contexto que nao
precisam estar nos criterios de aceite.]
```

## 4. Como escrever "A fim de"

Representa o PORQUE da necessidade (objetivo ou beneficio para o processo de
negocio). Exemplos: garantir que os dados estejam atualizados; garantir que
somente informacoes validas sejam utilizadas; evitar que informacoes
inconsistentes sejam replicadas; permitir a identificacao de informacoes que
precisam de regularizacao; garantir que uma etapa do processo seja realizada
corretamente.

Nao usar objetivos tecnicos: "para que o sistema consiga chamar a API"; "para que
o endpoint retorne os dados"; "para permitir a comunicacao entre microservicos".

## 5. Como escrever "precisa-se"

Representa o QUE precisa ser disponibilizado, verificado, controlado ou realizado
para atingir o objetivo. Deve ser compreensivel para uma pessoa de negocio.

Exemplo:
> A fim de garantir que somente informacoes validas sejam utilizadas, precisa-se
> verificar se os codigos estao publicados e validos para o ano ao qual a
> replicacao se refere.

## 6. Criterios de aceite (Resultados esperados)

Descrevem comportamentos e resultados validaveis pelo negocio. Devem responder:
"Como o Product Owner podera verificar que essa necessidade foi atendida?"

Preferir frases como: "Deve ser possivel identificar..."; "Deve ser possivel
consultar..."; "Devem ser disponibilizadas..."; "Somente informacoes que... devem
ser consideradas..."; "Quando ocorrer..., deve ser informado..."; "Informacoes
que... nao devem ser utilizadas...".

Evitar criterios de implementacao: "O endpoint deve utilizar GET"; "A API deve
retornar HTTP 200"; "O endpoint deve possuir autorizacao"; "A resposta JSON deve
conter..."; "O servico deve realizar uma chamada..."; "A consulta deve utilizar
determinada tabela.".

## 7. Preservacao das regras de negocio

Nao simplificar a ponto de perder regras importantes. Manter todos os
comportamentos de negocio da fonte, especialmente: condicoes para utilizacao dos
dados; condicoes que impedem a utilizacao; tratamento de informacoes nao
publicadas; necessidade de validacao de dados; comportamento em caso de
inconsistencia; responsabilidade do usuario pela regularizacao; necessidade de
nao alterar informacoes existentes; regras relacionadas a periodos anteriores;
dependencias entre etapas do processo.

Regra de natureza exclusivamente tecnica deve ficar em Observacoes, nao como
requisito de negocio.

## 8. Nao transformar necessidade tecnica em falsa necessidade de usuario

O fato de a historia ser implementada como API, endpoint ou servico NAO significa
que deva ser escrita como necessidade tecnica. A implementacao tecnica e tratada
separadamente da necessidade funcional.

Fonte tecnica:
> O modulo Planejamento precisa consultar o Institucional via endpoint.

Historia para o PO:
> A fim de garantir que o Planejamento utilize informacoes atualizadas,
> precisa-se disponibilizar as informacoes do Institucional necessarias para a
> replicacao.

A tecnologia utilizada fica no detalhamento tecnico (Observacoes).

## 9. Nao criar informacoes que nao estejam na fonte

Usar exclusivamente as informacoes dos documentos fornecidos. Nao inventar: novos
atores, regras de negocio, fluxos, funcionalidades, criterios, campos ou
comportamentos.

Quando a informacao (tecnica ou de negocio) nao estiver suficientemente detalhada
na fonte, registrar em Observacoes como pendencia de refinamento. Exemplo:
> Observacoes: A forma de identificacao do registro ainda precisa ser detalhada
> durante o refinamento.

## 10. Tratamento de historias tecnicas (HT)

Mesmo que a fonte classifique como HT, aplicar as mesmas regras de redacao acima.
A classificacao HT pode ser mantida nos metadados, mas NAO deve determinar a
linguagem da historia.

O PO deve conseguir entender: (1) qual problema esta sendo tratado; (2) por que e
necessario; (3) o que precisa acontecer; (4) qual resultado sera considerado
correto. Ele nao precisa conhecer a tecnologia usada na implementacao.

## 11. Resultado final esperado

Para cada historia identificada na fonte:
1. Preservar a necessidade original.
2. Identificar o objetivo de negocio.
3. Traduzir a necessidade tecnica para linguagem de negocio.
4. Preservar todas as regras relevantes.
5. Transformar criterios tecnicos em criterios de resultado.
6. Colocar detalhes exclusivamente tecnicos em Observacoes.
7. Nao inventar informacoes ausentes.
8. Usar obrigatoriamente o formato definido nestas diretrizes.

## Verificacao interna obrigatoria

Antes de apresentar cada historia, verificar:

> "Um Product Owner sem conhecimento de TI conseguiria entender esta historia sem
> precisar perguntar o que e uma API, endpoint, GET, backend, tabela ou servico?"

Se a resposta for "nao", reescrever a historia utilizando linguagem de negocio.
