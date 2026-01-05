Para elevar o **Crom-FrameFlow** de um protótipo avançado para um software de nível profissional, aqui está um checklist de 100 tarefas divididas por categorias críticas.

---

### 🚀 Performance e Motor (Engine)

1. [x] Implementar **WebGPU** no `CompositionEngine` para renderização acelerada por hardware.
2. [/] Migrar o processamento de frames pesado do Worker para **Rust/WASM**.
3. [x] Adicionar suporte a **FileSystem Access API** para evitar cópias de arquivos no IndexedDB.
4. [x] Criar um sistema de **LRU Cache** para gerenciar a memória de blobs de vídeo.
5. [x] Implementar **Proxy Editing** (geração automática de versões em baixa resolução).
6. [x] Otimizar o `frameflow.worker.ts` para usar **SharedArrayBuffers**.
7. [x] Adicionar suporte a **Multi-threading** real na exportação de vídeo.
8. [x] Implementar **Frame-accurate seeking** usando WebCodecs.
9. [x] Criar um sistema de **Pre-rendering** de frames adjacentes ao cursor na timeline.
10. [x] Reduzir o _garbage collection_ evitando a criação excessiva de objetos no loop de render.
11. [x] Implementar suporte a **OffscreenCanvas** para liberar a thread principal.
12. [x] Otimizar o parser de MP4 para leitura via stream, não carregando o arquivo inteiro na RAM.
13. [x] Adicionar detecção automática de capacidades da GPU do usuário.
14. [x] Criar um limitador de FPS dinâmico para economizar bateria em laptops.
15. [x] Implementar compressão de dados antes de salvar no IndexedDB.

### 🧠 Arquitetura e Estado (React/Zustand)

16. [x] Fragmentar a store do Zustand em **slices** (Timeline, Assets, UI).
17. [x] Implementar o **Command Pattern** para suporte robusto a Undo/Redo.
18. [x] Adicionar **Persistence Middleware** seletivo (não salvar estado de UI volátil).
19. [x] Criar um sistema de **Event Bus** para comunicação fora da árvore do React.
20. [x] Eliminar re-renders desnecessários no `Viewport.tsx` usando `selectors` otimizados.
21. [x] Padronizar interfaces de tipos em um diretório `@types/` centralizado (src/types).
22. [x] Implementar **Code Splitting** para o módulo de exportação (Components Lazy Loaded).
23. [x] Criar hooks customizados para abstrair lógica de cálculos de frames/tempo.
24. [x] Substituir usos de `any` perigosos por tipos estritos.
25. [x] Implementar uma camada de **Data Migration** para versões futuras do banco de dados.
26. [x] Adicionar validação de esquemas de projeto usando **Zod**.
27. [x] Refatorar o `PresentationParser.ts` para ser uma classe desacoplada da UI.
28. [x] Criar sistema de **Injeção de Dependência** para o `AudioEngine`.
29. [x] Implementar **Throttling** (via otimização de seletores e renderização).
30. [x] Centralizar constantes (cores de marca, limites de tempo) em um arquivo de config.

### 🦀 Tauri e Backend (Rust)

31. [x] Mover a lógica de escrita de arquivos final para o backend em Rust.
32. [x] Implementar **Custom Protocol** (`frameflow://`) para carregar assets locais sem bloqueios de CORS.
33. [x] Adicionar integração com o **Menu Nativo** do sistema (macOS/Windows).
34. [x] Criar um sistema de **Splash Screen** nativo enquanto o React carrega.
35. [x] Implementar **Auto-updater** usando a infraestrutura do Tauri.
36. [x] Adicionar suporte a **Tray Icon** com status de exportação.
37. [x] Otimizar o consumo de memória do WebView via configurações do `tauri.conf.json` (CSP Strict).
38. [x] Implementar bridge de segurança (Allowlist) rigorosa para comandos Rust (CSP).
39. [x] Adicionar suporte a **Drag-and-Drop** de arquivos diretamente do SO para o app.
40. [x] Criar comandos Rust para extrair metadados de vídeo (FFmpeg sidecar, se necessário).
41. [x] Implementar suporte a múltiplas janelas (ex: Preview em tela cheia separada).
42. [x] Adicionar detecção de "Low Memory" no Rust para alertar o frontend.
43. [ ] Implementar compressão nativa de pacotes de projeto (.frameflow).
44. [x] Criar um logger persistente no backend para depuração de erros críticos.
45. [ ] Adicionar suporte a plugins em Rust (Dynamic Library Loading).

### 🎨 UI/UX e Workflow

46. [x] Implementar atalhos de teclado padrão (J, K, L, I, O).
47. [x] Adicionar sistema de **Snapping** magnético na timeline.
48. [x] Criar visualização de **Waveform de Áudio** em tempo real.
49. [x] Implementar **Multi-seleção** de clips na timeline.
50. [x] Adicionar suporte a **Pastas e Tags** na `AssetLibrary`.
51. [x] Criar um sistema de **Tooltips** informativos para ícones complexos.
52. [x] Implementar modo **Dark/Light** baseado nas preferências do sistema.
53. [x] Adicionar barra de progresso visual de "Render Cache" na timeline.
54. [x] Criar painel de **Histórico de Ações** visível.
55. [x] Implementar suporte a **Keyframes** para animação de propriedades.
56. [x] Adicionar controles de **Transformação Visual** diretamente no Viewport (gizmos).
57. [x] Criar biblioteca de **Presets** de efeitos pré-configurados.
58. [x] Implementar busca global de assets e efeitos.
59. [x] Adicionar suporte a legendas (.SRT) com editor dedicado.
60. [x] Criar workflow de "Exportação Rápida" para redes sociais.

### 🛠️ Estabilidade e QA

61. [x] Configurar **Vitest** para testes unitários na Engine.
62. [x] Implementar **Playwright** para testes E2E focados no Tauri.
63. [x] Adicionar **Visual Regression Testing** para o renderizador de frames.
64. [x] Implementar **Error Boundaries** globais e locais.
65. [x] Adicionar integração com **Sentry** para monitoramento de erros em produção.
66. [x] Criar scripts de **Stress Test** para timelines com +500 clips.
67. [x] Implementar validação de arquivos corrompidos no import.
68. [x] Adicionar logs detalhados de performance no console em modo `dev`.
69. [x] Criar um sistema de "Modo de Recuperação" se o app crashar.
70. [x] Configurar CI/CD no GitHub Actions para builds em Windows, Linux e Mac.
71. [x] Testar comportamento do app com "Disco Cheio".
72. [x] Adicionar testes de unidade para o `CameraManager`.
73. [x] Validar acessibilidade (ARIA labels) em toda a interface.
74. [x] Testar latência de áudio em diferentes taxas de amostragem.
75. [x] Criar um banco de dados de "Golden Frames" para validar fidelidade do render.

### 🌟 Novos Recursos e Visão

76. [x] Adicionar suporte a **Green Screen** (Chroma Key).
77. [x] Implementar motor de **Texto 3D**.
78. [x] Adicionar integração com **Modelos AI Locais** (ONNX) para segmentação.
79. [x] Criar sistema de **Transições** customizáveis via Shaders.
80. [x] Implementar suporte a **Gravação de Voz** (Voiceover) direta no app.
81. [x] Adicionar suporte a **LUTS** (.cube) para color grading.
82. [x] Criar exportador para GIFs animados.
83. [x] Implementar **Motion Tracking** básico.
84. [x] Adicionar suporte a plugins de áudio (VST alternativo via JS).
85. [x] Criar sistema de **Templates de Projeto**.
86. [x] Adicionar suporte a vídeos 360/VR.
87. [x] Implementar colaboração via **WebRTC** (visualização remota).
88. [x] Criar ferramenta de "Collect Files" para backup de projeto.
89. [x] Adicionar suporte a múltiplos canais de áudio (Mixer Engine).
90. [x] Implementar **Auto-captioning** usando modelos Whisper locais.

### 📚 DX e Documentação

91. [x] Criar documentação da **API de Plugins**.
92. [x] Adicionar JSDoc em todas as funções públicas da Engine. (Basic coverage)
93. [x] Criar um `CONTRIBUTING.md` detalhado.
94. [ ] Implementar um **Storybook** para os componentes de UI. (Deferred)
95. [x] Adicionar exemplos de projetos na pasta `examples/`.
96. [x] Criar guia de setup rápido para novos desenvolvedores.
97. [x] Documentar o fluxo de dados entre Rust e React.
98. [x] Adicionar badges de status de build e cobertura de testes no README.
99. [x] Criar um canal de feedback/comunidade dentro do app.
100.  [x] Escrever um `ARCHITECTURE.md` explicando o design do motor de composição.
