# 🌊 FrameFlow: O Futuro da Apresentação Dinâmica Web

**Nome do Projeto:** FrameFlow  
**Natureza:** Ecossistema Web de Composição de Vídeo em Tempo Real e Edição de Cards Dinâmicos.  
**Objetivo:** Transcender a limitação das apresentações estáticas (PPTX, PDF, Google Slides), convertendo-as em objetos de cena inteligentes e interativos que coexistem com o apresentador em um ambiente de vídeo imersivo.

---

## 1. Visão Geral e Filosofia do Sistema

O **FrameFlow** não é apenas um passador de slides; é um estúdio de produção virtual baseado em navegador. A filosofia central é que o apresentador deve ser o protagonista, e o conteúdo deve orbitar ao seu redor de forma orgânica.

Diferente do compartilhamento de tela tradicional, onde o apresentador vira uma "miniatura" no canto, o FrameFlow utiliza a técnica de **Composição em Camadas (Layered Compositing)**. O vídeo da câmera é o plano de fundo (ou um objeto recortado), enquanto os slides são transformados em **"Cards"** — entidades programáveis que possuem física, animação e estados próprios.

### 📊 Fluxograma de Arquitetura Detalhado

```mermaid
graph TD
    subgraph Entrada
        A[Usuário/Webcam] -->|Stream Raw| B(Input Manager)
        C[Arquivos: PPTX/PDF/GSlides] -->|Upload/API| D(Parser de Assets)
    end

    subgraph Processamento Local (Browser)
        B --> E{Motor de Composição}
        D -->|Objetos JSON| F(Card Editor & Manager)
        F --> E
        E --> G[Vision Engine: MediaPipe]
        G -->|Máscara de Recorte| H[Compositor WebGL/WebGPU]
        H -->|Pós-processamento| I[Filtros & Color Grading]
    end

    subgraph Saída e Distribuição
        I --> J(Output Manager)
        J -->|Virtual Camera Driver| K(Zoom/Meet/Teams)
        J -->|WebRTC/RTMP| L(YouTube/Twitch/LinkedIn)
        J -->|Local MediaRecorder| M(Arquivo MP4/WebM)
    end
```

---

## 2. Pilares Técnicos e Engenharia Profunda

### 2.1. O Motor de Composição (The Engine)

- **Pipeline Gráfico:** Utilização de **WebGPU** (com fallback para WebGL 2.0). Isso permite que o processamento de shaders de vídeo ocorra sem sobrecarregar a CPU, mantendo a interface fluida mesmo em 60 FPS.
- **Gerenciamento de Profundidade (Z-Index Virtual):** Diferente do CSS, o motor controla a profundidade real dos pixels. Isso possibilita que o apresentador passe "por trás" de um card ou que um card orbite a cabeça do apresentador.
- **Offscreen Canvas & Workers:** Toda a renderização pesada é feita em uma thread separada via `OffscreenCanvas`, garantindo que interações na UI de edição nunca causem "stuttering" (travamentos) no vídeo final.

### 2.2. Vision Suite: IA e Interação Natural

- **Segmentação de Alta Precisão:** Implementação de modelos customizados do **MediaPipe Selfie Segmentation** com refinamento de bordas (_alpha matting_) para evitar o efeito "recorte serrilhado".
- **Auto-Framing Dinâmico:** Algoritmo que analisa o _bounding box_ do apresentador e aplica um zoom/pan digital suave para manter a composição equilibrada conforme ele se move.
- **Navegação por Gestos (Gesture Control):**
  - **Mão aberta e fechada:** Pinçar e arrastar um card no ar.
  - **Swipe lateral:** Trocar para o próximo card da sequência.
  - **Sinal de "V":** Iniciar/Parar gravação.

### 2.3. Ontologia dos Cards (Data Structure)

Um Card no FrameFlow é uma estrutura JSON complexa que suporta interatividade:

```json
{
  "id": "card_unique_id",
  "metadata": {
    "origin": "pptx_slide_05",
    "title": "Gráfico de Vendas"
  },
  "visuals": {
    "background": "transparent",
    "layers": [
      {
        "type": "vector",
        "data": "SVG_PATH",
        "animation": "draw-in"
      },
      {
        "type": "text",
        "content": "R$ 2.5M",
        "style": {
          "font": "Inter",
          "weight": "bold"
        }
      }
    ]
  },
  "physics": {
    "draggable": true,
    "float_effect": "gentle_sinusoidal"
  },
  "transform": {
    "x": 0.75,
    "y": 0.3,
    "z": 1,
    "rotation": -5,
    "scale": 1.2
  }
}
```

---

## 3. Fluxo de Importação e Transformação

O maior diferencial do FrameFlow é a capacidade de "desconstruir" apresentações legadas.

1.  **Ingestão de Arquivos:** Suporte a `.pptx` via `JSZip` e `xml2js` no frontend para ler a estrutura do arquivo sem enviar para o servidor.
2.  **Extração de Elementos:** O sistema identifica o que é imagem de fundo (que geralmente é removida) e o que é conteúdo útil (gráficos, tabelas, títulos).
3.  **Vetorização Automática:** Textos e formas são convertidos para SVG para permitir zooms extremos sem pixelização (essencial para vídeos 4K).
4.  **Limpeza Inteligente (Clean Slate):** O usuário pode, com um clique, remover todas as cores sólidas de fundo dos slides importados, transformando-os em overlays transparentes profissionais.

---

## 4. Checklist Exaustivo de Desenvolvimento (Master List)

Este checklist é a métrica de sucesso para a IA e desenvolvedores.

### ✅ Fase 1: Núcleo, Captura e Ingestão

- [ ] **Configuração de Media:** Implementar `getUserMedia` com restrições avançadas (ajuste de exposição e foco manual via código).
- [ ] **Parser de PPTX Avançado:** Extrair propriedades de animação nativa do PowerPoint e mapear para animações CSS/WebGL.
- [ ] **PDF Engine:** Integrar `pdf.js` para renderizar páginas como texturas de alta resolução.
- [ ] **Persistence Layer:** Implementar `Dexie.js` (IndexedDB) para versionamento de projetos de vídeo.

### ✅ Fase 2: Vision & AI Processing

- [ ] **Background Removal:** Implementar toggle entre "Blur" e "Full Removal".
- [ ] **Edge Smoothing:** Criar shader de "Feathering" para suavizar o recorte do cabelo e ombros.
- [ ] **Low-Light Enhancement:** Implementar filtro de IA para reduzir ruído em webcams de baixa qualidade.
- [ ] **Eye Contact Fix:** (Experimental) Ajuste sutil das pupilas para simular olhar direto para a câmera.

### ✅ Fase 3: Workspace de Edição (UX/UI)

- [ ] **Cenas e Sequenciamento:** Criar uma "Timeline" de cards para definir a ordem da apresentação.
- [ ] **Editor Inline:** Permitir edição de texto diretamente sobre o vídeo (WYSIWYG).
- [ ] **Asset Library:** Pasta para o usuário subir logos, vídeos de fundo e ícones.
- [ ] **Templates de Layout:** Predefinições como "Entrevista", "Tutorial de Código" e "Pitch de Vendas".
- [ ] **Widgets Ativos:** Card de contagem regressiva, integração com chat do YouTube e barra de progresso da fala.

### ✅ Fase 4: Engine de Saída e Performance

- [ ] **WebCodecs Integration:** Utilizar `VideoEncoder` para exportar arquivos MP4 diretamente do navegador.
- [ ] **Virtual Cam Bridge:** Desenvolver/Integrar bridge para que o sistema seja reconhecido como hardware de câmera.
- [ ] **RTMP Header:** Implementar conexão via WebRTC-to-RTMP para lives sem latência.
- [ ] **Monitoring:** Dashboard de uso de VRAM e queda de frames.

### ✅ Fase 5: Ecossistema e Colaboração

- [ ] **Multi-User Sync:** (Opcional) Dois apresentadores na mesma cena via WebRTC.
- [ ] **Cloud Backup:** Integração com Firebase/S3 para salvar assets pesados.
- [ ] **Exportação de Estáticos:** Gerar um PDF da apresentação "com o apresentador" em cada slide para material de apoio.

---

## 5. Cenários de Uso e Exemplos Práticos

- **Educação Online:** O professor "aponta" para uma fórmula matemática que surge no ar. Ao tocar na fórmula, ela se expande em um gráfico 3D.
- **Pitch de Vendas:** O vendedor apresenta métricas. Conforme ele fala de "Crescimento", um gráfico de barras sobe dinamicamente ao lado dele.
- **Tutoriais de Software:** O FrameFlow exibe a câmera do apresentador no centro e, ao redor dele, cards com snippets de código que podem ser copiados pelos espectadores.

---

## 6. Orientações para a IA (Antigravity & Future Models)

1.  **Modularidade Extrema:** Cada novo "tipo de card" deve ser um módulo independente para facilitar a expansão.
2.  **Performance Primeiro:** Se uma funcionalidade de IA consumir mais de 30% da CPU em um MacBook Air M1, ela deve ser otimizada ou oferecida como "Modo Lite".
3.  **Privacidade Local-First:** O vídeo da webcam nunca deve tocar o servidor. Todo processamento de IA deve ser ON-DEVICE.
4.  **Estética Profissional:** As animações padrão devem seguir a regra de "Ease-in-out" para evitar movimentos robóticos.

---

> **Documento Expandido - FrameFlow Technical Foundation**  
> _Versão 1.1 | Janeiro 2026_
