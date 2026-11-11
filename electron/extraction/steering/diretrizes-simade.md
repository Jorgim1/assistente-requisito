---
inclusion: manual
---

# Diretrizes de Geracao de Historias - SIMADE

> ATIVACAO: Estas diretrizes valem APENAS quando o usuario escolher o modelo **SIMADE**
> (ou indicar explicitamente que a geracao e para o sistema SIMADE,
> ou referenciar esta steering via `#diretrizes-simade`).
>
> PRECEDENCIA: Quando ativas, estas regras SUBSTITUEM o formato de narrativa e de
> criterios de aceite definidos em `formato-historias.md`. As regras de
> granularidade, classificacao HU/HT e numeracao de `regras-extracao.md`
> continuam valendo normalmente.

## Campo de integracoes

No modelo SIMADE, o campo de integracoes internas e nomeado **Integracoes SIMADE**:

```markdown
| **Integracoes SIMADE** | [Modulos SIMADE relacionados] |
```

## Publico-alvo da escrita

As historias devem ser compreendidas por desenvolvedores, analistas de QA e Product Owners com conhecimento do dominio educacional. A linguagem pode mencionar elementos de interface (botoes, modais, tooltips, alertas fixos) e codigos de perfil de acesso (SSC).

## 1. Narrativa — multiplos atores com codigo SSC

Toda historia do modelo SIMADE deve listar TODOS os perfis de acesso que podem executar a acao, cada um com seu codigo SSC no formato `(SSC: CODIGO = "PAPEL")`:

```markdown
Como [Persona1 (SSC: CODIGO1 = "PAPEL1")],
[Persona2 (SSC: CODIGO2 = "PAPEL2")],
[...]
eu quero [acao que o usuario/sistema executa],
para [beneficio ou valor esperado].
```

Exemplo:
```markdown
Como Diretor (SSC: M1EE_DIRETOR = "DIRETOR ESCOLAR"),
Secretario Escolar (SSC: M1EE_SECRETARIO_ESCOLAR = "SECRETARIO"),
Administrador (SSC: GES_SRE = "ADMINISTRADOR"),
eu quero acessar as informacoes da Educacao Profissional,
para atualizar as informacoes.
```

Regras:
- Listar todos os perfis que terao acesso a funcionalidade, conforme identificado no documento
- Cada perfil ocupa sua propria linha
- O codigo SSC deve estar entre parenteses no formato exato: `(SSC: CODIGO = "PAPEL")`
- Se nenhum perfil SSC estiver identificado na fonte, usar `(SSC: A definir)` no lugar do codigo
- Para HT (historias tecnicas automaticas), substituir a narrativa por: `Como sistema,` sem codigo SSC

## 2. Criterios de aceite com sub-numeracao decimal

Os criterios de aceite do modelo SIMADE usam numeracao decimal para representar hierarquia de regras:

```markdown
CRITERIOS DE ACEITE
1 – [Regra ou comportamento principal]
1.1 - [Caso especifico ou variacao da regra 1]
1.2 - [Outro caso especifico]
2 – [Segunda regra principal]
2.1 - [Sub-caso]
3 – [Terceira regra]
```

Regras de escrita:
- Itens de nivel 1 (numeros inteiros com traco: `1 –`) descrevem o comportamento ou regra principal
- Sub-itens (decimal com hifen: `1.1 -`) detalham variacoes, condicionais e casos de borda
- Nivel maximo de sub-numeracao: dois niveis (usar `1.1`, nunca `1.1.1`)
- Podem incluir linguagem funcional de interface: botao, modal, tooltip, alerta fixo, mensagem
- Podem incluir termos do dominio educacional: modulo, curso, historico, diploma, situacao final, lacuna, aprovado, reprovado
- Minimo 2 criterios de nivel 1; sem limite maximo, mas evitar repeticao de conteudo

## 3. Secao "Informacoes Complementares"

Quando a historia possuir regras com exemplos ilustrativos que ajudam a entender os criterios, incluir a secao ao final dos CAs:

```markdown
Informacoes Complementares:
[Exemplos concretos, cenarios ilustrativos ou contexto adicional que
complementam os criterios de aceite sem substitui-los]
```

Incluir APENAS quando houver exemplos concretos ou contexto adicional relevante. Nao criar a secao com conteudo vago, generico ou que repita o que os CAs ja dizem.

## 4. Versionamento e historico de evolucao

Toda historia extraida no modelo SIMADE deve incluir campo de versao e secao de historico:

Posicao do campo de versao: imediatamente apos o ID e titulo da historia, antes da narrativa:

```markdown
[N]a Versao
```

Secao de historico ao final da historia (apos Observacoes):

```markdown
HISTORICO DE EVOLUCAO DA HISTORIA:
| Data | Descricao |
|---|---|
| [data ou "-"] | [descricao da mudanca ou "Versao inicial" se nova] |
```

- Para historias novas, usar `1a Versao` e historico com `-` em Data e `Versao inicial` em Descricao
- Se o documento fonte ja indicar versoes anteriores, preservar o historico existente

## 5. Detalhes tecnicos de implementacao

Detalhes exclusivamente tecnicos (ex: endpoint REST, consulta ao banco, estrutura de payload) NAO devem aparecer nos criterios de aceite. Esses detalhes vao na secao `Observacoes` da tabela de metadados.

## Verificacao interna obrigatoria

Antes de apresentar cada historia, verificar:

> "Todos os perfis SSC estao listados conforme identificado na fonte?"
> "Os sub-criterios detalham adequadamente cada variacao de comportamento?"
> "A secao Informacoes Complementares foi incluida somente se houver exemplos concretos?"
