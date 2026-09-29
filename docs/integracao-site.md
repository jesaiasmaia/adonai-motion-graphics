# Estudo — Como colocar o Gênese (logo reveal) no adonaitech.com.br

> Objetivo: documentar a melhor forma de integrar a peça **01 · Gênese** no site oficial ([adonaitech.com.br](https://adonaitech.com.br), Next.js + Cloudflare), com passos executáveis para um agente/dev implementar depois.

---

## 1. Resumo executivo

**Recomendação: intro overlay (preloader) com vídeo MP4 mutado, exibido 1× por sessão.**

| # | Onde usar | Formato recomendado | Prioridade |
|---|-----------|--------------------|------------|
| 1 | **Intro/preloader** na primeira visita da sessão | MP4 mutado em overlay (Opção A abaixo) | ⭐ recomendada |
| 2 | **Fundo animado do hero** (atrás do título) | Peça 04 Aurora Flow em `<video muted loop>` ou CSS | 2ª fase |
| 3 | **Página Sobre / cases** — intro com som ao clique | `exports/01-genesis-reveal.mp4` (com áudio) | opcional |
| 4 | **Social/Open Graph** — teaser da marca | MP4 1080p de `exports/` | opcional |

Por quê MP4 mutado e não animação embutida logo de cara: é o caminho de **menor risco** (nenhum código de animação entra no bundle do site), **acessível** (respeita `prefers-reduced-motion` com um `if`), e **rápido de implementar** (~30 linhas de React). A versão em canvas nativo (Opção B) é a evolução natural depois.

---

## 2. Comparativo de formatos

| Formato | Tamanho (esta peça) | Qualidade/escala | Esforço | Quando usar |
|---|---|---|---|---|
| **MP4 H.264 mutado** | 1,8 MB (`genesis-web.mp4`) | fixo 1080p | mínimo | ✅ intro/preloader, OG video |
| WebM VP9 | ~0,9 MB (estimado) | fixo 1080p | mínimo (+1 encode) | alternativa ao MP4 p/ poupar banda (safari precisa do MP4 como fallback) |
| **Componente React/Canvas** (portar `motion-core.js`) | ~15 KB de JS + fontes | vetorial, nítido em qualquer tela, interativo | médio (portar render p/ component, ~1-2h) | ✅ evolução: intro + fundos vivos sem vídeo |
| Lottie (JSON) | ~100–300 KB | vetorial | alto (recriar no AE/LottieFiles) | só se já houver fluxo AE na empresa |
| Rive | ~50–150 KB | vetorial interativo | alto (editor externo) | interações ricas no app/futuro |
| iframe da demo HTML | 0 (aponta pro repo) | — | trivial | ❌ não usar em produção (acoplamento e fontes externas) |

**Conclusão:** MP4 agora, componente Canvas depois. Lottie/Rive só valem se a marca for contratar motion designer — hoje o pipeline é 100% código.

---

## 3. Arquivos prontos (neste repositório)

Já gerados em `exports/web/`:

| Arquivo | O que é | Uso |
|---|---|---|
| `genesis-web.mp4` (1,8 MB) | Gênese completo 6s **sem áudio** | intro overlay (áudio impediria o autoplay) |
| `genesis-poster.jpg` (77 KB) | frame final (lockup completo) | poster do `<video>` + fallback |
| `genesis-web-short.mp4` (1,2 MB, 3,9 s) | corte: convergência → lockup, sem fade final | **preloader ideal** (6s é longo para intro) |
| `genesis-web-short_poster.jpg` | frame final do corte | poster do corte |

Para regenerar/variantes:

```bash
# sem áudio (a partir do MP4 master com som)
ffmpeg -y -i exports/01-genesis-reveal.mp4 -an -c:v copy exports/web/genesis-web.mp4

# corte curto p/ preloader (0,45s → 4,35s do master)
ffmpeg -y -ss 0.45 -to 4.35 -i exports/01-genesis-reveal.mp4 -an \
  -c:v libx264 -preset medium -crf 19 -pix_fmt yuv420p -movflags +faststart \
  exports/web/genesis-web-short.mp4

# poster
ffmpeg -y -ss 4.4 -i exports/01-genesis-reveal.mp4 -frames:v 1 -q:v 3 exports/web/genesis-poster.jpg

# opcional: WebM VP9 (~40-50% menor; manter MP4 como fallback p/ Safari)
ffmpeg -y -i exports/web/genesis-web.mp4 -c:v libvpx-vp9 -crf 32 -b:v 0 -row-mt 1 \
  exports/web/genesis-web.webm
```

---

## 4. Opção A (recomendada) — Intro overlay em Next.js

### Passo 1 — Publicar os arquivos

Copiar para a pasta `public/` do site (versionar o nome do arquivo facilita cache busting):

```
public/motion/genesis-web-short_v1.mp4
public/motion/genesis-poster_v1.jpg
```

> Nota Cloudflare/Next: arquivos de `public/` não recebem hash automático — por isso o sufixo `_v1`. Ao trocar o vídeo, suba como `_v2`.

### Passo 2 — Componente `GenesisIntro`

```tsx
// components/GenesisIntro.tsx  ("use client")
import { useEffect, useRef, useState } from "react";

const VIDEO = "/motion/genesis-web-short_v1.mp4";
const POSTER = "/motion/genesis-poster_v1.jpg";
const KEY = "adn-intro-seen";

export default function GenesisIntro() {
  const [show, setShow] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const seen = sessionStorage.getItem(KEY);
    if (!seen && !reduced) {
      setShow(true);
      document.documentElement.style.overflow = "hidden"; // trava scroll durante a intro
    }
  }, []);

  const close = () => {
    sessionStorage.setItem(KEY, "1");
    setLeaving(true);                                  // fade 400ms via CSS
    document.documentElement.style.overflow = "";
    setTimeout(() => setShow(false), 450);
  };

  if (!show) return null;
  return (
    <div
      onClick={close}
      style={{ opacity: leaving ? 0 : 1, transition: "opacity 400ms ease" }}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-[#07182D]"
    >
      <video
        ref={videoRef}
        src={VIDEO}
        poster={POSTER}
        autoPlay
        muted            // obrigatório p/ autoplay (iOS incl.)
        playsInline
        preload="auto"
        onEnded={close}
        className="w-full h-full object-cover"
      />
      <button
        onClick={close}
        className="absolute bottom-6 right-6 rounded-full border border-[#31DDD4]/50 px-4 py-2
                   font-mono text-xs tracking-widest text-[#31DDD4]"
      >
        PULAR
      </button>
    </div>
  );
}
```

### Passo 3 — Montar no layout raiz

```tsx
// app/layout.tsx
import GenesisIntro from "@/components/GenesisIntro";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        <GenesisIntro />   {/* antes de tudo; overlay z-100 */}
        {children}
      </body>
    </html>
  );
}
```

### Passo 4 — QA (checklist de aceite)

- [ ] Toca 1× por sessão (`sessionStorage`), 2ª navegação não mostra
- [ ] `prefers-reduced-motion: reduce` → nunca mostra
- [ ] Botão PULAR visível a partir de ~1s
- [ ] iOS Safari: autoplay funciona (`muted` + `playsInline` presentes)
- [ ] Fim do vídeo → fade 400ms → hero por baixo idêntico (mesmo navy `#07182D`, mesmo lockup)
- [ ] LCP não regrediu: o hero renderiza normal por baixo do overlay (a intro é `fixed`, não bloqueia hidratação)
- [ ] Sem CLS (overlay `fixed`, nada pula)
- [ ] Scroll travado durante a intro, liberado no fechamento
- [ ] Lighthouse mobile ≥ score anterior

### Rollback

Remover `<GenesisIntro />` do layout — o resto é código morto sem efeito.

---

## 5. Opção B (evolução) — Componente Canvas nativo, sem vídeo

Portar `motion-core.js` + `01-genesis-reveal.html` para um componente React:

1. Copiar `motion-core.js` para `lib/motion-core.ts` (ou `.js`) e o loop do 01 para um componente com `<canvas ref>` + `requestAnimationFrame`.
2. O render é 100% determinístico (`render(t)`), então o componente só precisa de um rAF clock — **não há vídeo, não há download de 1,8 MB**, escala perfeito em retina (multiplicar canvas por `devicePixelRatio`).
3. Fontes: o site já self-hospeda Manrope e Geist Mono (`/_next/static/media/*.woff2`) — reutilizar via `next/font`, sem baixar nada novo.
4. Bônus: o mesmo componente serve para a peça 04 (Aurora) como fundo do hero em loop e para a peça 05 interativa em uma seção "playground".

Quando escolher: se a marca quiser **vários fundos vivos** no site sem custo de banda de vídeo em cada visita.

---

## 6. Cuidados transversais

- **Autoplay**: sempre `muted` + `playsInline`; áudio só em interação explícita (peça com som = página Sobre, com botão play).
- **`prefers-reduced-motion`**: intro e fundos animados off; mostrar poster estático (`genesis-poster.jpg`).
- **Banda/mobile**: considerar exibir a intro só em telas ≥ 768px ou usar o corte curto (1,2 MB) em mobile.
- **Cache**: `public/` sem hash → versionar sufixo `_vN`; Cloudflare cacheará na borda.
- **SEO**: intro não afeta indexação (é overlay visual; o conteúdo continua no DOM por baixo).
- **Frequência**: 1× por sessão (não por visita) para não irritar usuários recorrentes.

## 7. Handoff para o agente implementador

**Inputs:** este documento + `exports/web/genesis-web-short_v1.mp4` + `genesis-poster_v1.jpg` (copiar de `exports/web/`).
**Tarefa:** Opção A, passos 1–4, respeitando o checklist.
**Definição de pronto:** checklist da seção 4 integralmente verde + deploy em produção verificado em mobile real.
**Não fazer:** iframe da demo HTML, áudio no autoplay, intro a cada navegação, bloqueio de render do hero.
