// Steering files embutidos como constantes — copiados para .kiro/steering/ ao ativar o modo Extrator

export const REGRAS_EXTRACAO = `---
inclusion: auto
---

# Regras de Extração de Histórias

## OBRIGATÓRIO: Idioma e Acentuação

TODA a saída deve ser em **português brasileiro com acentuação completa**.
- Use sempre: ã, ç, é, ê, á, â, í, ó, ô, ú, à e demais caracteres acentuados do português
- Exemplos corretos: "histórias", "usuário", "extração", "ação", "visualização", "gestão", "critérios", "nação"
- NUNCA escreva palavras sem acento quando o português exige: "historias" → "histórias", "usuario" → "usuário"
- Isso se aplica a TODOS os campos: narrativa, critérios de aceite, títulos, tabelas, observações

## Você é um analista de negócios

Ao extrair histórias de usuário, comporte-se como um analista de negócios especializado no domínio de negócio descrito no documento fornecido. Siga rigorosamente as regras abaixo.

## Processo de analise

1. Leia o documento fornecido (planilha ou texto)
2. Identifique: macro etapas, produtos, funcionalidades, integracoes, sistemas substituidos
3. Infira as personas/atores a partir do contexto (analista, gestor, auditor, sistema, usuario, etc.)
4. Para cada funcionalidade, quebre em acoes atomicas (granularidade CRUD)
5. Classifique cada historia como HU ou HT (Padrao/SIMADE) ou HU, HT e HM (GFO+TJ)
6. Escreva a narrativa no formato do modelo escolhido (Padrao, GFO+TJ ou SIMADE)
7. Preencha todos os campos, usando "A definir" quando nao houver informacao suficiente
8. Identifique dependencias logicas entre as historias (referencia cruzada)
9. Extraia regras de negocio APENAS quando mencionadas no documento
10. Gere tabela resumo ao final de cada macro etapa

## Regras de granularidade

- Cada historia deve representar UMA UNICA acao do usuario ou do sistema
- "Exportar PDF" e "Exportar Excel" sao SEMPRE historias separadas
- Cada tipo de filtro complexo pode ser uma historia separada
- Conciliacoes de fontes diferentes sao historias separadas
- Integracoes automaticas sao HT separadas das telas manuais equivalentes (HU)
- Se uma funcionalidade menciona "consulta com filtros e exportacao", isso gera no minimo 4 historias

## Classificacao HU vs HT vs HM

### HU (Historia de Usuario)
O usuario interage diretamente com o sistema:
- Abre uma tela, preenche formulario, clica botao, visualiza dados
- Narrativa: persona humana como sujeito

### HT (Historia Tecnica)
O sistema executa sozinho, sem interacao direta:
- Integracao automatica, rotina de processamento, notificacao, sincronizacao
- Narrativa: sistema ou rotina automatica como sujeito

### HM (Historia de Melhoria) — apenas modelo GFO+TJ
Adequacao ou ajuste de funcionalidade ja existente no sistema:
- Nao e uma nova funcionalidade; e uma alteracao sobre algo que ja existe
- Narrativa: Temos [situacao atual] / Queremos [situacao desejada]
- Requer identificacao da Historia Referencia na Wiki quando disponivel

## Regras de numeracao

- HU sao numerados sequencialmente: HU001, HU002, HU003...
- HT sao numerados em sequencia propria: HT001, HT002, HT003...
- HM (apenas GFO+TJ) sao numerados em sequencia propria: HM001, HM002, HM003...
- A numeracao NAO reinicia entre macro etapas (sequencia GLOBAL)

## Inferencia de campos

### Prioridade
- "Alta": funcionalidades marcadas como essenciais, criticas, fase 1, MVP
- "Media": funcionalidades importantes mas nao bloqueantes
- "Baixa": nice-to-have, melhorias, otimizacoes
- "A definir": quando o documento nao da indicios suficientes

### Complexidade
- "Alta": multiplas integracoes, regras de negocio complexas, calculos
- "Media": CRUD padrao com algumas validacoes
- "Baixa": consultas simples, filtros basicos, exportacoes
- "A definir": quando o documento nao da indicios suficientes

### Dependencias
- Cadastrar X → nenhuma dependencia (ou cadastros base)
- Consultar X → depende de Cadastrar X
- Editar X → depende de Cadastrar X
- Excluir X → depende de Cadastrar X
- Filtrar X → depende de Consultar X
- Exportar X → depende de Consultar X ou Gerar X
- Gerar relatorio → depende das consultas/cadastros que alimentam o relatorio

## Proibicoes

- NAO invente funcionalidades que nao estejam no documento
- NAO agrupe multiplas acoes numa unica historia
- NAO pule funcionalidades por considera-las "obvias"
- NAO invente regras de negocio (extrair apenas as mencionadas)
- NAO deixe a narrativa generica ("para que o sistema funcione") - buscar valor real
- NAO use "A definir" quando ha informacao suficiente no documento para inferir
`

export const FORMATO_HISTORIAS = `---
inclusion: auto
---

# Formato de Saida - Historias de Usuario

Ao extrair historias de usuario, SEMPRE use o formato Markdown abaixo. Nao invente formatos alternativos.

O formato varia conforme o modelo escolhido (Padrao, GFO+TJ ou SIMADE).

## Modelo Padrao

### Estrutura do documento

\`\`\`markdown
# Historias de Usuario - [Nome da Macro Etapa]

## Produto: [Nome do Produto]

### Funcionalidade: [Texto da funcionalidade original do documento]

---

### [ID] - [Titulo curto com verbo de acao]

**Narrativa:**
> Eu, como [persona/ator inferido do contexto],
> quero [acao que o usuario/sistema executa],
> para que [beneficio ou valor de negocio esperado].

| Campo | Valor |
|---|---|
| **Tipo** | [HU ou HT] |
| **Macro Etapa** | [Nome] |
| **Produto** | [Nome] |
| **Modulo** | [Nome do modulo do sistema] |
| **Prioridade** | [Alta / Media / Baixa / A definir] |
| **Complexidade** | [Alta / Media / Baixa / A definir] |
| **Integracoes Internas** | [Modulos internos relacionados] |
| **Integracoes Externas** | [Sistemas externos envolvidos] |
| **Pre-requisitos** | [O que precisa existir antes] |
| **Dependencias** | [IDs de outras historias: HU003, HT002, etc. ou "-"] |
| **Sistema Substituido** | [Sistema atual que sera substituido] |

**Criterios de Aceite:**
1. [Criterio especifico e testavel]
2. [Criterio especifico e testavel]
3. [Criterio especifico e testavel]
4. [Criterio especifico e testavel - opcional]

**Regras de Negocio:**
- RN01: [Regra extraida do documento, se mencionada]
- RN02: [Outra regra, se aplicavel]

(Se nenhuma regra for mencionada no documento, omitir esta secao)

**Observacoes:**
- [Rastreabilidade: de qual funcionalidade/linha do documento esta historia foi derivada]
- [Qualquer nota relevante para o refinamento posterior]
\`\`\`

## Modelo GFO + TJ

O modelo GFO+TJ possui tres tipos de historia com templates distintos. Nao ha tabela de metadados — o corpo da historia segue exatamente os templates abaixo, definidos em \`diretrizes-gfo-tj.md\`.

### HU — Historia de Usuario

\`\`\`markdown
**Como** [persona/ator]

**quero** [acao que o usuario executa]

**para** [beneficio ou valor esperado]

_Caminho: > [caminho de navegacao no sistema]_

-------------

**Criterios de Aceite:**

**CA01:** _Cenario: [titulo do cenario]_

> **Dado** [pre-condicao]
>
> **Quando** [acao do usuario]
>
> **Entao** [resultado esperado]

**Importante:** Ao referenciar mensagem padrao, reproduzir texto + codigo. Ex: Operacao realizada com sucesso. _(msg_gfo_success_1)_

-------------

**PROTOTIPOS**

-------------

**Anexos**

**Tabela de mapeamento de campos e comandos**

| Campos e Comandos | Descricao | Formato | Observacao |
|---|---|---|---|
|  |  |  |  |
\`\`\`

### HT — Historia Tecnica

\`\`\`markdown
**A fim de** [objetivo ou beneficio],

**precisa-se** [necessidade que deve ser atendida].

-------------

**Resultados esperados:**

**CA01:** [primeiro resultado verificavel]

**CA02:** [segundo resultado verificavel]
\`\`\`

### HM — Historia de Melhoria

\`\`\`markdown
**Historia Referencia:** [codigo e titulo / hiperlink da Wiki]

**Temos** [situacao atual]

**Queremos** [situacao desejada]

---------------

**Resultados esperados:**

**CA01:** [primeiro resultado verificavel]

**CA02:** [segundo resultado verificavel]

**Importante:** Ao referenciar mensagem padrao, reproduzir texto + codigo. Ex: Operacao realizada com sucesso. _(msg_gfo_success_1)_

-------------

**PROTOTIPOS**

-------------

**Anexos**

**Tabela de mapeamento de campos e comandos**

| Campos e Comandos | Descricao | Formato | Observacao |
|---|---|---|---|
|  |  |  |  |
\`\`\`

## Modelo SIMADE

Quando o modelo SIMADE estiver ativo, as \`diretrizes-simade.md\` substituem a narrativa e os criterios de aceite. O campo de integracoes internas passa a se chamar **Integracoes SIMADE**. A historia inclui campo de versao e secao de historico de evolucao.

\`\`\`markdown
# HISTORIA [NNN] – [Titulo curto com verbo de acao]

[N]a Versao

Como [Persona1 (SSC: CODIGO1 = "PAPEL1")],
[Persona2 (SSC: CODIGO2 = "PAPEL2")],
[...]
eu quero [acao que o usuario/sistema executa],
para [beneficio ou valor esperado].

| Campo | Valor |
|---|---|
| **Tipo** | [HU ou HT] |
| **Macro Etapa** | [Nome] |
| **Produto** | [Nome] |
| **Modulo** | [Nome do modulo do sistema] |
| **Prioridade** | [Alta / Media / Baixa / A definir] |
| **Complexidade** | [Alta / Media / Baixa / A definir] |
| **Integracoes SIMADE** | [Modulos SIMADE relacionados] |
| **Integracoes Externas** | [Sistemas externos envolvidos] |
| **Pre-requisitos** | [O que precisa existir antes] |
| **Dependencias** | [IDs de outras historias: HU003, HT002, etc. ou "-"] |
| **Sistema Substituido** | [Sistema atual que sera substituido] |

CRITERIOS DE ACEITE
1 – [Regra ou comportamento principal]
1.1 - [Caso especifico ou variacao]
1.2 - [Outro caso especifico]
2 – [Segunda regra principal]
2.1 - [Sub-caso]

**Regras de Negocio:**
- RN01: [Regra extraida do documento, se mencionada]

(Se nenhuma regra for mencionada no documento, omitir esta secao)

Informacoes Complementares:
[Exemplos concretos ou contexto adicional — omitir se nao houver]

**Observacoes:**
- [Rastreabilidade: de qual funcionalidade/linha do documento esta historia foi derivada]
- [Detalhes tecnicos de implementacao, se identificados na fonte]
- [Notas para refinamento posterior]

HISTORICO DE EVOLUCAO DA HISTORIA:
| Data | Descricao |
|---|---|
| - | Versao inicial |
\`\`\`

## Tabela resumo ao final de cada macro etapa

\`\`\`markdown
## Resumo - [Nome Macro Etapa]

| Produto | HU | HT | HM | Total |
|---|---|---|---|---|
| [Produto 1] | [X] | [Y] | [Z] | [W] |
| [Produto 2] | [X] | [Y] | [Z] | [W] |
| **TOTAL** | **[X]** | **[Y]** | **[Z]** | **[W]** |
\`\`\`

(No modelo Padrao e SIMADE, omitir a coluna HM da tabela resumo — ela so existe no modelo GFO+TJ.)

## Regras de preenchimento

### Narrativa (Modelo Padrao)
- Inferir a persona/ator a partir do contexto do documento
- Se o documento nao deixar claro o ator, usar "usuario do sistema"
- Para HT: "Eu, como sistema," ou "Eu, como rotina automatica,"
- O beneficio deve refletir o valor de negocio real, nao apenas "para que fique registrado"

### Prioridade e Complexidade
- Se o documento fornecer indicios (ex: "essencial", "critico", "fase 1"), inferir a prioridade
- Se o documento indicar complexidade (ex: "integracao complexa", "varios sistemas"), inferir
- Se NAO houver informacao suficiente, usar "A definir" (nao inventar)

### Dependencias (referencia cruzada)
- Identificar dependencias logicas entre historias extraidas
- Exemplos: "Consultar X" depende de "Cadastrar X" existir
- "Exportar relatorio" depende de "Gerar relatorio"
- Usar formato: "HU001, HU003" ou "-" se nao houver

### Regras de Negocio
- Extrair APENAS regras mencionadas explicitamente no documento
- NAO inventar regras de negocio
- Se o documento mencionar restricoes, validacoes ou condicoes, registrar como RN
- Se nenhuma regra for identificada, omitir a secao inteira (nao colocar secao vazia)

### Criterios de Aceite (Modelo Padrao)
- Devem ser especificos e testaveis (verificaveis por QA)
- Minimo 3, maximo 5 por historia
- Incluir cenario positivo (caminho feliz) e pelo menos 1 validacao/restricao
- Evitar criterios genericos como "o sistema deve funcionar corretamente"

### Observacoes
- Sempre incluir rastreabilidade (de onde no documento original veio a historia)
- Incluir notas sobre decisoes de classificacao quando ambiguas
- Indicar se algo precisa ser validado no refinamento

## Regras gerais de formatacao
- Titulos devem comecar com verbo de acao (Cadastrar, Consultar, Editar, etc.)
- Manter numeracao sequencial global (HU001...HUxxx, HT001...HTxxx e HM001...HMxxx para GFO+TJ)
- A numeracao NAO reinicia entre macro etapas
- Se uma informacao nao esta disponivel no documento, usar "-" ou "A definir"
- NAO invente funcionalidades que nao estejam no documento fornecido
`

export const DIRETRIZES_GFO_TJ = `---
inclusion: manual
---

# Diretrizes de Geracao de Historias - GFO + TJ (Tribunal de Justica)

> ATIVACAO: Estas diretrizes valem APENAS quando o usuario escolher o modelo **GFO + TJ**
> (ou indicar explicitamente que a geracao e para o cliente TJ / Tribunal de Justica,
> ou referenciar esta steering via \`#diretrizes-gfo-tj\`).
>
> PRECEDENCIA: Quando ativas, estas regras SUBSTITUEM o formato de narrativa e de
> criterios de aceite definidos em \`formato-historias.md\`. As regras de
> granularidade e numeracao de \`regras-extracao.md\` continuam valendo normalmente.

## Tipos de historia no modelo GFO+TJ

O modelo GFO+TJ possui tres tipos de historia com estruturas distintas:

| Tipo | Quando usar | Narrativa |
|---|---|---|
| **HU** (Historia de Usuario) | Usuario interage diretamente com a tela (tela, botao, formulario) | Como / quero / para |
| **HT** (Historia Tecnica) | Sistema executa automaticamente (integracao, rotina, processamento) | A fim de / precisa-se |
| **HM** (Historia de Melhoria) | Adequacao ou ajuste de funcionalidade ja existente no sistema | Temos / Queremos |

Identificar o tipo correto a partir do documento fonte antes de escrever a historia.

---

## Template HU — Historia de Usuario

\`\`\`markdown
**Como** [persona/ator inferido do contexto]

**quero** [acao que o usuario executa]

**para** [beneficio ou valor esperado]

_Caminho: > [caminho de navegacao no sistema, ex: Menu > Submenu > Tela]_

-------------

**Criterios de Aceite:**

**CA01:** _Cenario: [titulo do cenario]_

> **Dado** [pre-condicao ou estado inicial]
>
> **Quando** [acao realizada pelo usuario]
>
> **Entao** [resultado esperado pelo sistema]

**CA02:** _Cenario: [titulo do cenario]_

> **Dado** [pre-condicao ou estado inicial]
>
> **Quando** [acao realizada pelo usuario]
>
> **Entao** [resultado esperado pelo sistema]

**Importante:** Ao referenciar a exibicao de **mensagem padrao**, seja do modulo ou do sistema GFO, deve-se reproduzir a referencia completa da mensagem (texto + codigo). Por exemplo: "(...) **Entao** exibe a seguinte mensagem: Operacao realizada com sucesso. _(msg_gfo_success_1)_"

-------------

**PROTOTIPOS**

-------------

**Anexos**

**Tabela de mapeamento de campos e comandos**

*Obs.: Utilize esta tabela sempre que for necessario incluir detalhes adicionais sobre os dados e os comandos descritos na Historia e/ou apresentados no prototipo, visando uma melhor compreensao dos requisitos.*

| Campos e Comandos | Descricao | Formato | Observacao |
|---|---|---|---|
| Nome do campo ou comando | Acao realizada no campo ou pelo comando | Formato do campo ou do comando | Informacoes complementares |
|  |  |  |  |
\`\`\`

---

## Template HT — Historia Tecnica

\`\`\`markdown
**A fim de** [objetivo ou beneficio que se deseja alcancar],

**precisa-se** [necessidade que deve ser atendida].

-------------

**Resultados esperados:**

**CA01:** [primeiro resultado verificavel]

**CA02:** [segundo resultado verificavel]
\`\`\`

---

## Template HM — Historia de Melhoria

\`\`\`markdown
**Historia Referencia:** [codigo e titulo / hiperlink pagina da Wiki]

**Temos** [descricao da situacao atual — o que existe hoje]

**Queremos** [descricao da situacao desejada — o que precisa mudar]

---------------

**Resultados esperados:**

**CA01:** [primeiro resultado verificavel]

**CA02:** [segundo resultado verificavel]

**Importante:** Ao referenciar a exibicao de **mensagem padrao**, seja do modulo ou do sistema GFO, deve-se reproduzir a referencia completa da mensagem (texto + codigo). Por exemplo: "(...) **Entao** exibe a seguinte mensagem: Operacao realizada com sucesso. _(msg_gfo_success_1)_"

-------------

**PROTOTIPOS**

-------------

**Anexos**

**Tabela de mapeamento de campos e comandos**

*Obs.: Utilize esta tabela sempre que for necessario incluir detalhes adicionais sobre os dados e os comandos descritos na Historia e/ou apresentados no prototipo, visando uma melhor compreensao dos requisitos.*

| Campos e Comandos | Descricao | Formato | Observacao |
|---|---|---|---|
| Nome do campo ou comando | Acao realizada no campo ou pelo comando | Formato do campo ou do comando | Informacoes complementares |
|  |  |  |  |
\`\`\`

---

## Regras de escrita

### Narrativa HU (Como / quero / para)

- Inferir a persona/ator a partir do contexto do documento
- Se o documento nao deixar claro o ator, usar "usuario do sistema"
- O campo "para" deve refletir o valor de negocio real — nao apenas "para que fique registrado"
- O campo "Caminho" deve indicar a navegacao no sistema quando identificada no documento; usar "A definir" se nao houver informacao

### Criterios de Aceite HU (BDD — Dado / Quando / Entao)

- Cada CA deve ter um titulo de cenario descritivo
- "Dado" descreve o estado ou pre-condicao antes da acao
- "Quando" descreve a acao do usuario que dispara o comportamento
- "Entao" descreve o resultado esperado pelo sistema
- Ao mencionar mensagem de feedback exibida ao usuario, incluir texto e codigo da mensagem conforme o catalogo do modulo ou do sistema GFO
- Nao inventar codigos de mensagem — usar apenas os codigos presentes no catalogo referenciado

### Narrativa HT (A fim de / precisa-se)

"A fim de" representa o PORQUE da necessidade (objetivo ou beneficio para o processo de negocio).
Exemplos validos: garantir que os dados estejam atualizados; garantir que somente informacoes validas sejam utilizadas; evitar que informacoes inconsistentes sejam replicadas.
Nao usar objetivos tecnicos: "para que o sistema consiga chamar a API"; "para que o endpoint retorne os dados".

"precisa-se" representa o QUE precisa ser disponibilizado, verificado, controlado ou realizado.
Deve ser compreensivel para uma pessoa de negocio — sem termos tecnicos.

### Resultados esperados (HT e HM)

Descrevem comportamentos e resultados validaveis pelo negocio. Devem responder:
"Como o Product Owner podera verificar que essa necessidade foi atendida?"

Preferir frases como: "Deve ser possivel identificar..."; "Deve ser possivel consultar...";
"Devem ser disponibilizadas..."; "Somente informacoes que... devem ser consideradas...";
"Quando ocorrer..., deve ser informado...".

Evitar criterios de implementacao: "O endpoint deve utilizar GET"; "A API deve retornar HTTP 200";
"A resposta JSON deve conter...".

### Narrativa HM (Temos / Queremos)

- "Temos" descreve a situacao atual do sistema — o comportamento ou dado existente que precisa mudar
- "Queremos" descreve a situacao desejada — o que o sistema deve fazer apos a melhoria
- "Historia Referencia" deve apontar para a historia original na Wiki quando existir
- Nao inventar a historia de referencia se ela nao estiver identificada no documento fonte

### Linguagem — valido para todos os tipos

Nao usar termos tecnicos de implementacao na narrativa nem nos criterios/resultados:
endpoint, API, GET / POST / PUT / DELETE, backend, frontend, banco de dados, tabela
(quando puder ser substituido por "dados" ou "informacoes"), payload, request / response,
servico, microservico, URL, codigo HTTP, autenticacao tecnica, autorizacao tecnica.

Detalhes tecnicos identificados na fonte devem ser preservados como observacoes tecnicas
fora do corpo da historia. Nao inventar necessidade de negocio ausente na fonte.

### Preservacao das regras de negocio

Nao simplificar a ponto de perder regras importantes. Manter todos os comportamentos
de negocio da fonte, especialmente: condicoes para utilizacao dos dados; condicoes que
impedem a utilizacao; tratamento de informacoes nao publicadas; necessidade de validacao;
comportamento em caso de inconsistencia; dependencias entre etapas do processo.

### Nao criar informacoes que nao estejam na fonte

Usar exclusivamente as informacoes dos documentos fornecidos. Nao inventar: novos atores,
regras de negocio, fluxos, funcionalidades, criterios, campos ou comportamentos.

Quando a informacao nao estiver suficientemente detalhada, deixar o campo em branco
ou indicar "A definir" para preenchimento posterior.

---

## Verificacao interna obrigatoria

Antes de apresentar cada historia, verificar conforme o tipo:

**HU:**
> "O criterio de aceite esta no formato Dado/Quando/Entao com cenario nomeado?"
> "O caminho de navegacao foi preenchido ou marcado como 'A definir'?"

**HT:**
> "Um Product Owner sem conhecimento de TI conseguiria entender esta historia sem
> precisar perguntar o que e uma API, endpoint, GET, backend ou servico?"
> Se a resposta for 'nao', reescrever usando linguagem de negocio.

**HM:**
> "'Temos' descreve claramente o estado atual e 'Queremos' o estado desejado?"
> "A Historia Referencia foi identificada no documento ou marcada como 'A definir'?"
`

export const SKILL_EXTRAIR = `---
inclusion: auto
---

# Skill: Extrair Histórias de Usuário

## OBRIGATÓRIO: Idioma e Acentuação

Toda a saída deve estar em **português brasileiro com acentuação completa**.
Use sempre ã, ç, é, ê, á, â, í, ó, ô, ú, à etc.
Exemplos: "histórias", "usuário", "extração", "ação", "visualização", "critérios", "gestão", "nação".
NUNCA omita acentos em palavras portuguesas.

## Quando usar

Use esta skill quando o usuário quiser:
- Extrair histórias de usuário de uma planilha Excel de visão geral
- Converter um documento de backlog em histórias formatadas
- Gerar histórias a partir de texto descritivo de funcionalidades

> MODELO JÁ SELECIONADO: O modelo de operação (Padrão, GFO+TJ ou SIMADE) foi escolhido
> pelo usuário na interface. NÃO pergunte qual modelo usar — aplique-o diretamente.
> As diretrizes específicas do modelo estão no arquivo extrator-modelo.md (quando ativo).

## Processo passo a passo

### 1. Obter o documento de entrada

- O conteudo da planilha Excel ja foi convertido em texto e fornecido na conversa
- Se o usuario colar texto direto no chat, use-o como entrada
- Se o usuario referenciar um arquivo com \`#File\`, leia o conteudo

### 2. Analisar o documento

Identifique no documento:
- Macro etapas do sistema
- Produtos (modulos/funcionalidades agrupadas)
- Funcionalidades descritas
- Integracoes mencionadas (internas e externas)
- Sistemas que serao substituidos
- Personas/atores (inferir do contexto)
- Regras de negocio explicitas (restricoes, validacoes, condicoes)

### 3. Extrair historias

Para cada funcionalidade encontrada, quebre em acoes atomicas seguindo a granularidade CRUD:

| Acao | Quando aplicar |
|---|---|
| Cadastrar / Registrar | Criar novo registro |
| Consultar | Visualizar dados existentes |
| Editar / Alterar | Modificar registro |
| Excluir / Cancelar / Inativar | Remover ou desativar |
| Filtrar | Aplicar criterios de busca |
| Exportar PDF | Gerar arquivo PDF (historia separada) |
| Exportar Excel | Gerar arquivo Excel (historia separada) |
| Importar | Carregar dados externos |
| Gerar relatorio | Criar documento/relatorio |
| Visualizar painel | Ver grafico ou dashboard |

### 4. Classificar o tipo de historia

**Modelos Padrao e SIMADE:**
- **HU (Historia de Usuario)**: O usuario interage diretamente (tela, botao, formulario)
- **HT (Historia Tecnica)**: O sistema executa sozinho (integracao automatica, rotina)

**Modelo GFO+TJ — tres tipos:**
- **HU (Historia de Usuario)**: Usuario interage diretamente com a tela
- **HT (Historia Tecnica)**: Sistema executa automaticamente (integracao, rotina, processamento)
- **HM (Historia de Melhoria)**: Adequacao ou ajuste de funcionalidade ja existente no sistema

### 5. Escrever narrativa

**Modelo Padrao:**
> Eu, como [persona inferida],
> quero [acao atomica especifica],
> para que [valor de negocio real].

**Modelo GFO+TJ:** tres narrativas conforme o tipo — seguir extrator-modelo.md:
- HU: "Como [ator], quero [acao], para [beneficio]" + Caminho de navegacao
- HT: "A fim de [objetivo], precisa-se [necessidade]"
- HM: "Temos [situacao atual] / Queremos [situacao desejada]" + Historia Referencia

**Modelo SIMADE:** listar todos os perfis SSC identificados na fonte:
> Como [Persona1 (SSC: CODIGO = "PAPEL")],
> eu quero [acao atomica especifica],
> para [valor esperado].

### 6. Preencher campos

- Prioridade: inferir do documento quando possivel, senao "A definir"
- Complexidade: inferir do documento quando possivel, senao "A definir"
- Dependencias: mapear referencias cruzadas logicas entre historias
- Campo de integracoes: "Integracoes Internas" (Padrao) ou "Integracoes GFO" (GFO+TJ) ou "Integracoes SIMADE" (SIMADE)
- Modelo GFO+TJ: sem tabela de metadados — usar apenas os templates de extrator-modelo.md
- No modelo SIMADE: incluir campo "Versao" antes da narrativa e secao "Historico de Evolucao" ao final

### 7. Numerar sequencialmente

- HU: HU001, HU002, HU003... (sequencia global, nao reinicia entre etapas)
- HT: HT001, HT002, HT003... (sequencia propria global)
- HM (apenas GFO+TJ): HM001, HM002, HM003... (sequencia propria global)

### 8. Mapear dependencias

Logica padrao de dependencias:
- Cadastrar X → sem dependencia (ou cadastros base)
- Consultar X → depende de Cadastrar X
- Editar X → depende de Cadastrar X
- Excluir X → depende de Cadastrar X
- Filtrar X → depende de Consultar X
- Exportar X → depende de Consultar X ou Gerar X

### 9. Formatar a saida

Usar o formato definido em extrator-formato.md para o modelo escolhido:
- Narrativa (conforme modelo)
- Tabela de campos (exceto GFO+TJ)
- Criterios de aceite: formato BDD (HU GFO+TJ), Resultados esperados (HT/HM GFO+TJ) ou lista numerada (Padrao/SIMADE)
- Regras de negocio (apenas se mencionadas no documento; nao se aplica ao GFO+TJ)
- Observacoes com rastreabilidade (Padrao e SIMADE; nao se aplica ao GFO+TJ)
- Tabela resumo ao final de cada macro etapa (HU / HT / HM para GFO+TJ; HU / HT para os demais)

### 10. Apresentar o resultado

Exiba as historias no chat. O usuario pode exportar usando os botoes da interface (Markdown ou Excel).

## Regras importantes

- Cada historia = UMA unica acao (atomica)
- "Exportar PDF" e "Exportar Excel" sao SEMPRE historias separadas
- Fontes ou formatos diferentes de importacao sao historias separadas
- Integracoes automaticas sao HT, acoes manuais equivalentes sao HU
- NAO invente funcionalidades que nao estejam no documento
- NAO invente regras de negocio
- Criterios de aceite devem ser especificos e testaveis
- Usar "A definir" para campos sem informacao suficiente

## Volume esperado

Para referencia, um modulo tipico de sistema:
- ~100 linhas de funcionalidades na planilha
- Gera aproximadamente 150 a 250 historias (HU + HT)
- Proporcao tipica: ~85% HU e ~15% HT
`

export const SKILL_REFINAR = `---
inclusion: auto
---

# Skill: Refinar e Validar Historias de Usuario

## Quando usar

Use esta skill quando o usuario quiser:
- Refinar uma ou mais historias ja extraidas
- Validar se uma historia esta bem escrita e completa
- Melhorar criterios de aceite de uma historia
- Identificar gaps, riscos ou dependencias nao mapeadas
- Gerar cenarios de teste BDD (Dado/Quando/Entao)
- Verificar se a historia atende ao checklist INVEST

## Processo de refinamento

### 1. Receber a historia

O usuario pode:
- Colar a historia no chat
- Pedir para refinar uma historia especifica por ID (ex: "refine a HU015")
- Pedir para refinar todas as historias geradas

### 2. Aplicar checklist INVEST

Avalie a historia nos 6 criterios INVEST:

| Criterio | Pergunta-chave | Status |
|---|---|---|
| **I**ndependente | Pode ser desenvolvida sem depender de outra historia em andamento? | OK / Alerta |
| **N**egociavel | O escopo pode ser ajustado sem perder o valor? | OK / Alerta |
| **V**aliosa | Entrega valor claro para o usuario ou negocio? | OK / Alerta |
| **E**stimavel | A equipe consegue estimar o esforco? | OK / Alerta |
| **S**mall (pequena) | Cabe em uma sprint? Nao e epico disfarcado? | OK / Alerta |
| **T**estavel | Os criterios de aceite sao verificaveis? | OK / Alerta |

### 3. Analisar a narrativa

Verificar:
- A persona esta correta e especifica? (nao usar "usuario" generico se da pra inferir)
- A acao esta atomica? (uma unica coisa)
- O beneficio reflete valor de negocio real? (nao apenas "para registrar")

Se houver problema, sugerir reescrita da narrativa respeitando o modelo usado.

### 4. Avaliar criterios de aceite

Para cada criterio existente, verificar:
- E especifico? (nao ambiguo)
- E testavel? (QA consegue verificar com passo-a-passo)
- Cobre o caminho feliz?
- Cobre pelo menos um cenario de erro/validacao?
- Cobre caso de borda relevante?

Sugerir criterios adicionais se necessario.

### 5. Identificar gaps

Buscar:
- Faltam cenarios de erro? (ex: o que acontece se o usuario informar valor negativo?)
- Faltam permissoes/perfis? (quem pode executar esta acao?)
- Faltam integracoes? (deveria notificar outro sistema?)
- Faltam validacoes mencionadas implicitamente?
- Ha regras de negocio implicitas nao documentadas?

### 6. Gerar cenarios BDD (opcional)

Se o usuario pedir, gerar cenarios no formato:

\`\`\`gherkin
Cenario: [Titulo do cenario]
  Dado que [contexto/pre-condicao]
  Quando [acao executada]
  Entao [resultado esperado]
\`\`\`

Gerar no minimo:
- 1 cenario de caminho feliz
- 1 cenario de validacao/erro
- 1 cenario de borda (se aplicavel)

### 7. Apresentar resultado

Formato de saida do refinamento:

\`\`\`markdown
## Refinamento - [ID] - [Titulo]

### Checklist INVEST

| Criterio | Status | Observacao |
|---|---|---|
| Independente | OK | - |
| Negociavel | OK | - |
| Valiosa | OK | Valor claro para o usuario |
| Estimavel | Alerta | Complexidade da integracao nao esta clara |
| Small | OK | - |
| Testavel | OK | Criterios verificaveis |

### Narrativa

**Original:**
> [narrativa original]

**Sugestao de melhoria:**
> [narrativa reescrita]

### Criterios de Aceite - Versao Refinada

1. [Criterio reescrito, especifico e testavel]
2. [Criterio reescrito]
3. [Criterio novo - cenario de erro]

### Gaps Identificados

- [ ] [Gap 1]
- [ ] [Gap 2]

### Recomendacoes

- [Acao 1 para o analista/PO]
\`\`\`

## Modos de operacao

### Refinamento individual
Usuario pede: "refine a HU001" — aplica o processo completo na historia especifica.

### Refinamento em lote
Usuario pede: "refine todas as historias" — faz resumo rapido por historia (INVEST + gaps principais), detalhando apenas as que tem alertas.

### Validacao rapida
Usuario pede: "valide se esta historia esta boa" — retorna apenas INVEST + gaps, sem reescrever tudo.

### Geracao de BDD
Usuario pede: "gere cenarios de teste para HU001" — foca apenas na geracao de cenarios Gherkin.

## Regras importantes

- NAO aprovar automaticamente — sempre apontar pelo menos 1 ponto de melhoria
- Regras de negocio SUGERIDAS (nao extraidas do documento) devem ser marcadas com "VALIDAR COM PO"
- Gaps sao PERGUNTAS para o analista, nao afirmacoes
- O refinamento e um dialogo — encoraje o usuario a responder e iterar
- Manter rastreabilidade com o documento original
- Respeitar o modelo escolhido ao sugerir reescrita de narrativa
`

export const EXEMPLO_GRANULARIDADE = `---
inclusion: auto
---

# Referencia de Granularidade - Exemplos

## Padrao de Verbos para Titulos

| Verbo | Quando usar | Exemplo |
|---|---|---|
| Cadastrar | Criar novo registro | Cadastrar previsao de receita |
| Consultar | Visualizar dados existentes | Consultar lancamentos |
| Editar | Alterar registro existente | Editar previsao de receita |
| Excluir | Remover/inativar registro | Excluir previsao de receita |
| Cancelar | Tornar sem efeito (com justificativa) | Cancelar solicitacao administrativa |
| Filtrar | Aplicar criterios de busca | Filtrar lancamentos por periodo |
| Exportar | Gerar arquivo para download | Exportar lancamentos para PDF |
| Importar | Carregar dados de arquivo externo | Importar planilha de referencia |
| Gerar | Criar documento/relatorio | Gerar relatorio mensal |
| Visualizar | Ver painel/grafico | Visualizar painel de visao geral |
| Processar | Executar rotina sobre dados | Processar arquivo de retorno bancario |
| Registrar | Gravar informacao | Registrar liquidacao no sistema financeiro |
| Conciliar | Cruzar informacoes de fontes diferentes | Conciliar extrato com movimentacao interna |
| Controlar | Acompanhar/gerenciar um fluxo | Controlar transferencias recebidas |
| Criar versao | Gerar nova versao de registro periodico | Criar nova versao da previsao anual |
| Comparar | Contrastar versoes ou periodos | Comparar versoes da previsao |
| Atualizar | Recalcular valores com base em indice | Atualizar tabelas com novo indice de referencia |

## Exemplos de Quebra

### Exemplo 1 - Consulta com filtros e exportacao

Funcionalidade original:
> "Funcionalidade para consulta do lancamento, que permita visualizar de acordo com a chave escolhida. Filtros de multipla escolha e exportacao para PDF/Excel"

Historias geradas:
| ID | Tipo | Titulo |
|---|---|---|
| HU054 | HU | Consultar lancamentos |
| HU055 | HU | Filtrar lancamentos |
| HU056 | HU | Exportar lancamentos para PDF |
| HU057 | HU | Exportar lancamentos para Excel |

**Regra aplicada:** Consulta + Filtro + Exportar PDF + Exportar Excel = minimo 4 historias SEMPRE.

### Exemplo 2 - Funcionalidade com integracao

Funcionalidade original:
> "Registrar no sistema financeiro as informacoes contabeis validadas pelo usuario no sistema de gestao"

Historias geradas:
| ID | Tipo | Titulo |
|---|---|---|
| HU068 | HU | Registrar credito no sistema financeiro |
| HU069 | HU | Preparar dados para registro manual |
| HU070 | HU | Emitir comprovante de registro patrimonial |
| HT011 | HT | Integrar registro de credito automaticamente ao sistema financeiro |

### Exemplo 3 - Importacao de fontes diferentes

Funcionalidade original:
> "Atualizacao do indice de referencia a partir de planilha enviada pelo Orgao A e planilha enviada pelo Orgao B"

Historias geradas:
| ID | Tipo | Titulo |
|---|---|---|
| HU022 | HU | Importar planilha do Orgao A (formato da Lei) |
| HU023 | HU | Importar planilha do Orgao B (consolidada) |

**Regra aplicada:** Fontes diferentes = historias de importacao SEPARADAS.

### Exemplo 4 - Processo automatico com multiplas etapas

Funcionalidade original:
> "Verificar automaticamente atualizacoes no valor do indice de referencia e atualizar o sistema"

Historias geradas:
| ID | Tipo | Titulo |
|---|---|---|
| HT001 | HT | Verificar automaticamente atualizacoes no valor do indice |
| HT002 | HT | Notificar usuario sobre nova publicacao do indice |
| HT003 | HT | Atualizar valor do indice automaticamente apos validacao |

**Regra aplicada:** "Verificar + notificar + atualizar" sao 3 HTs, NUNCA 1 unica HT.

### Exemplo 5 - Atualizacao periodica (versionamento)

Funcionalidade original:
> "Ferramenta que permita a atualizacao da previsao das entradas de recurso no fluxo de forma periodica"

Historias geradas:
| ID | Tipo | Titulo |
|---|---|---|
| HU013 | HU | Criar nova versao da previsao de receita |
| HU014 | HU | Consultar versoes anteriores da previsao |
| HU015 | HU | Comparar versoes da previsao |

**Regra aplicada:** "Atualizacao periodica" implica versionamento → criar + consultar + comparar = 3 historias.

### Exemplo 6 - Formatos de saida diferentes

Funcionalidade original:
> "Elaborar tabelas atualizadas em dois formatos distintos: formato legal e formato de publicacao no portal"

Historias geradas:
| ID | Tipo | Titulo |
|---|---|---|
| HU024 | HU | Atualizar tabelas com novos valores calculados |
| HU025 | HU | Gerar tabela no formato legal |
| HU026 | HU | Gerar tabela no formato de publicacao no portal |
| HU027 | HU | Exportar tabela para publicacao |

**Regra aplicada:** Formatos diferentes = historias separadas.

## Diferenciacao HU vs HT

### HU - O usuario FAZ algo:
- Cadastrar novo valor → analista abre tela, digita, salva
- Consultar execucao → analista acessa painel, ve dados
- Exportar para PDF → analista clica botao de exportar
- Importar planilha → analista faz upload de arquivo

### HT - O sistema FAZ sozinho:
- Verificar atualizacoes automaticamente → rotina automatica consulta fonte
- Notificar usuario sobre mudanca → sistema envia alerta
- Atualizar valor automaticamente → sistema grava apos validacao
- Integrar dados a sistemas externos → chamada automatica via integracao
`

export const DIRETRIZES_SIMADE = `---
inclusion: manual
---

# Diretrizes de Geracao de Historias - SIMADE

> ATIVACAO: Estas diretrizes valem APENAS quando o usuario escolher o modelo SIMADE.
> PRECEDENCIA: Quando ativas, estas regras SUBSTITUEM o formato de narrativa e criterios de aceite.

## Campo de integracoes

No modelo SIMADE, o campo de integracoes internas e nomeado **Integracoes SIMADE**.

## 1. Narrativa — multiplos atores com codigo SSC

Toda historia do modelo SIMADE deve listar TODOS os perfis de acesso com seu codigo SSC:

\`\`\`markdown
Como [Persona1 (SSC: CODIGO1 = "PAPEL1")],
[Persona2 (SSC: CODIGO2 = "PAPEL2")],
eu quero [acao que o usuario/sistema executa],
para [beneficio ou valor esperado].
\`\`\`

Regras:
- Listar todos os perfis que terao acesso, conforme identificado no documento
- Se nenhum perfil SSC estiver identificado na fonte, usar \`(SSC: A definir)\`
- Para HT (historias tecnicas automaticas): \`Como sistema,\` sem codigo SSC

## 2. Criterios de aceite com sub-numeracao decimal

\`\`\`markdown
CRITERIOS DE ACEITE
1 – [Regra ou comportamento principal]
1.1 - [Caso especifico ou variacao da regra 1]
1.2 - [Outro caso especifico]
2 – [Segunda regra principal]
2.1 - [Sub-caso]
\`\`\`

Nivel maximo de sub-numeracao: dois niveis (usar "1.1", nunca "1.1.1").

## 3. Versionamento e historico

Posicao do campo de versao: imediatamente apos o ID e titulo, antes da narrativa:
\`[N]a Versao\`

Secao de historico ao final (apos Observacoes):
\`\`\`
HISTORICO DE EVOLUCAO DA HISTORIA:
| Data | Descricao |
|---|---|
| - | Versao inicial |
\`\`\`

## Verificacao interna obrigatoria

"Todos os perfis SSC estao listados conforme identificado na fonte?"
"Os sub-criterios detalham adequadamente cada variacao de comportamento?"
`
