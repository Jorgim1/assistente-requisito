; Hook NSIS do electron-builder.
; Ao final da instalacao do AcelerAI, garante o kiro-cli como pre-requisito.
; NAO redistribui o binario: baixa e roda o instalador OFICIAL da Kiro.
; Se o kiro-cli ja existir, nao faz nada.

!macro customInstall
  DetailPrint "Verificando pre-requisito: Kiro CLI..."

  ; Verifica se o kiro-cli ja esta no local de instalacao padrao do usuario.
  IfFileExists "$LOCALAPPDATA\Kiro-Cli\kiro-cli.exe" kiro_ok kiro_instalar

  kiro_instalar:
    DetailPrint "Kiro CLI nao encontrado. Executando o instalador oficial..."
    ; Instalador oficial da Kiro (nao redistribuimos o binario).
    nsExec::ExecToLog 'powershell -NoProfile -ExecutionPolicy Bypass -Command "irm https://cli.kiro.dev/install.ps1 | iex"'
    Pop $0
    ${If} $0 == 0
      DetailPrint "Kiro CLI instalado com sucesso."
    ${Else}
      DetailPrint "Aviso: nao foi possivel instalar o Kiro CLI automaticamente (codigo $0)."
      DetailPrint "O aplicativo orientara a instalacao no primeiro uso."
    ${EndIf}
    Goto kiro_fim

  kiro_ok:
    DetailPrint "Kiro CLI ja instalado."

  kiro_fim:
!macroend
