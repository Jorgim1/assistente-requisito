export type Role = 'user' | 'assistant'
export type ToolType = 'Read' | 'Write' | 'Edit' | 'Bash' | 'Grep'
export type ToolStatus = 'running' | 'done' | 'error'

export interface Tool {
  type: ToolType
  args: string
  output?: string
  status: ToolStatus
}

export interface ContentPart {
  kind: 'text' | 'code'
  content: string
  lang?: string
}

export interface Message {
  id: string
  role: Role
  parts: ContentPart[]
  tools?: Tool[]
  streaming?: boolean
  model?: string
  credits?: number
  promptContent?: string  // conteúdo completo enviado ao kiro (inclui arquivos); apenas mensagens user
}

