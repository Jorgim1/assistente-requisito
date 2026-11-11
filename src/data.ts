import type { Message, ContentPart } from './types'

export const DEMO_MESSAGES: Message[] = [
  {
    id: '1',
    role: 'user',
    parts: [{ kind: 'text', content: 'como posso melhorar a performance do componente DataTable?' }],
  },
  {
    id: '2',
    role: 'assistant',
    parts: [{ kind: 'text', content: 'Vou analisar o componente para identificar os gargalos.' }],
    tools: [
      { type: 'Read', args: 'src/components/DataTable.tsx', status: 'done' },
      {
        type: 'Grep',
        args: 'useMemo|useCallback|React.memo',
        output: 'Nenhuma memoização encontrada',
        status: 'done',
      },
    ],
  },
  {
    id: '3',
    role: 'assistant',
    parts: [
      {
        kind: 'text',
        content:
          'Encontrei o problema! O filtro de dados é recalculado em **todo render** — sem nenhuma memoização.\n\nA linha problemática:',
      },
      {
        kind: 'code',
        lang: 'tsx',
        content: `// ❌ Recalcula em todo render
const filteredData = data.filter((item) => item.isActive);`,
      },
      {
        kind: 'text',
        content: 'Solução: envolva com `useMemo` e adicione `React.memo` no componente:',
      },
      {
        kind: 'code',
        lang: 'tsx',
        content: `// ✅ Só recalcula quando 'data' mudar
const filteredData = useMemo(
  () => data.filter((item) => item.isActive),
  [data]
);`,
      },
      {
        kind: 'text',
        content: 'Posso aplicar essas mudanças agora?',
      },
    ],
  },
  {
    id: '4',
    role: 'user',
    parts: [{ kind: 'text', content: 'sim, pode aplicar as duas otimizações' }],
  },
  {
    id: '5',
    role: 'assistant',
    parts: [],
    tools: [{ type: 'Edit', args: 'src/components/DataTable.tsx', status: 'running' }],
    streaming: true,
  },
]

export const STREAM_TEXT =
  `Feito! Apliquei as duas otimizações com sucesso.\n\n✓ \`useMemo\` adicionado para memoizar o filtro\n✓ \`React.memo\` envolvendo o componente no export\n✓ Dependências configuradas corretamente\n\nAqui está o diff aplicado:`

export const STREAM_FINAL_PARTS: ContentPart[] = [
  {
    kind: 'text',
    content:
      'Feito! Apliquei as duas otimizações com sucesso.\n\n✓ `useMemo` adicionado para memoizar o filtro\n✓ `React.memo` envolvendo o componente no export\n✓ Dependências configuradas corretamente\n\nAqui está o diff aplicado:',
  },
  {
    kind: 'code',
    lang: 'diff',
    content: `  import React, { useMemo } from 'react'

- export function DataTable({ data }: Props) {
+ export const DataTable = React.memo(function DataTable({ data }: Props) {
-   const filteredData = data.filter((item) => item.isActive);
+   const filteredData = useMemo(
+     () => data.filter((item) => item.isActive),
+     [data]
+   );

    return <Table rows={filteredData} />
- }
+ });`,
  },
  {
    kind: 'text',
    content: 'Execute `npm test` para confirmar que tudo continua funcionando.',
  },
]
