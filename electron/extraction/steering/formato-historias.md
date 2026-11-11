---
inclusion: auto
---

# Formato de Saida - Historias de Usuario

Ao extrair historias de usuario, SEMPRE use o formato Markdown abaixo. Nao invente formatos alternativos.

O campo de narrativa e o nome do campo de integracoes internas variam conforme o modelo escolhido (Padrao ou GFO+TJ). As demais secoes sao identicas.

## Modelo Padrao

### Estrutura do documento

```markdown
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
```

## Modelo GFO + TJ

Quando o modelo GFO+TJ estiver ativo, as `diretrizes-gfo-tj.md` substituem a narrativa e os criterios de aceite. O campo de integracoes internas passa a se chamar **Integracoes GFO**. Os demais campos da tabela de metadados sao identicos ao modelo Padrao.

## Modelo SIMADE

Quando o modelo SIMADE estiver ativo, as `diretrizes-simade.md` substituem a narrativa e os criterios de aceite. O campo de integracoes internas passa a se chamar **Integracoes SIMADE**. A historia inclui campo de versao e secao de historico de evolucao.

```markdown
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
```

A narrativa e os criterios de aceite seguem exatamente o formato definido em `dev.kiro/steering/diretrizes-simade.md`.

```markdown
| **Integracoes GFO** | [Modulos GFO relacionados] |
```

A narrativa e os criterios de aceite seguem exatamente o formato definido em `dev.kiro/steering/diretrizes-gfo-tj.md`.

## Tabela resumo ao final de cada macro etapa

```markdown
## Resumo - [Nome Macro Etapa]

| Produto | HU | HT | Total |
|---|---|---|---|
| [Produto 1] | [X] | [Y] | [Z] |
| [Produto 2] | [X] | [Y] | [Z] |
| **TOTAL** | **[X]** | **[Y]** | **[Z]** |
```

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
- Manter numeracao sequencial global (HU001...HUxxx e HT001...HTxxx)
- A numeracao NAO reinicia entre macro etapas
- Se uma informacao nao esta disponivel no documento, usar "-" ou "A definir"
- NAO invente funcionalidades que nao estejam no documento fornecido
