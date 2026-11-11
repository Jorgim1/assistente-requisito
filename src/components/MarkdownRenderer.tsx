import React, { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism'
import type { Components } from 'react-markdown'

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      className={`code-copy-btn${copied ? ' copied' : ''}`}
      onClick={() => {
        navigator.clipboard.writeText(text).then(() => {
          setCopied(true)
          setTimeout(() => setCopied(false), 2000)
        })
      }}
      title={copied ? 'Copiado!' : 'Copiar código'}
    >
      {copied ? '✓ Copiado' : '⎘ Copiar'}
    </button>
  )
}

const components: Components = {
  // Passthrough — evita <pre> envolvendo nosso div customizado (HTML inválido)
  pre({ children }) {
    return <>{children}</>
  },

  code({ className, children, node: _node, ...props }) {
    const match = /language-(\w+)/.exec(className ?? '')
    const lang  = match?.[1] ?? ''
    const code  = String(children).replace(/\n$/, '')
    // Bloco: tem classe de linguagem OU tem quebras de linha (fenced sem lang)
    const isBlock = !!match || code.includes('\n')

    if (isBlock) {
      return (
        <div className="md-code-block">
          <div className="md-code-header">
            <span className="md-code-lang">{lang || 'código'}</span>
            <CopyButton text={code} />
          </div>
          <SyntaxHighlighter
            style={oneLight}
            language={lang || 'text'}
            PreTag="div"
            customStyle={{
              margin: 0,
              borderRadius: '0 0 6px 6px',
              fontSize: '12.5px',
              lineHeight: '1.55',
              background: '#f8f9fa',
            }}
            codeTagProps={{ style: { fontFamily: "'Cascadia Code', 'Courier New', monospace" } }}
          >
            {code}
          </SyntaxHighlighter>
        </div>
      )
    }

    // Código inline
    return <code className="md-inline-code" {...props}>{children}</code>
  },

  table({ children }) {
    return (
      <div className="md-table-wrap">
        <table className="md-table">{children}</table>
      </div>
    )
  },

  a({ href, children }) {
    return (
      <a
        href={href}
        onClick={(e) => { e.preventDefault(); if (href) window.open(href) }}
        className="md-link"
      >
        {children}
      </a>
    )
  },

  blockquote({ children }) {
    return <blockquote className="md-blockquote">{children}</blockquote>
  },
}

export default function MarkdownRenderer({ content }: { content: string }) {
  return (
    <div className="md-body">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  )
}
