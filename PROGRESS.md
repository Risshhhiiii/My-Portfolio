# Project Progress & Roadmap — Rishi Raj Sharma Portfolio

## Current Status (2026-09-06)
- **Active Theme**: Uchiha Itachi Cinematic Experience (`https://github.com/Meghamittal0920/itachi.git`).
- **Target Profile**: **Rishi Raj Sharma** (AI & Product Development Engineer, BITM Ballari).
- **Core Strategy**: Maintain the cinematic visual effects (scroll scrubber, eye tracking, Amaterasu, storm sound, WebGL ghost cursor) while fully customizing the content to Rishi's resume, projects, skills, and certifications.
- **State Checkpoint**: Phase 1 verified and fully functional; ready for user-specified updates and Phase 2 integrations.

---

## 3-Phase Roadmap

### Phase 1: Core Portfolio Customization (Completed & Refined)
- [x] Full Button Hitbox & Center Clickability: Removed overlapping global `.hint` hit-box overlay; ensured `pointer-events: none` on ambient layers and enabled 100% direct clickability anywhere across the `AWAKEN THE REALITY` button.
- [x] Landing Screen Scroll-Lock (`tsukuyomi-locked`): Scroll down is strictly locked on Page 1 until the user clicks `AWAKEN THE REALITY`; attempting to scroll triggers a subtle glowing button pulse, preventing accidental skipping to About.
- [x] Single-Page Direct Scroll-Back & Forward-Only Transition: Optimized hero section height to 100vh; scrolling back from About immediately renders Frame 0 (closed eyes) without playing any reverse crow animation or rewinding frames; smooth, dark cinematic fade-in of the Tsukuyomi overlay on top; re-locks scroll on reaching y = 0.
- [x] Master Audio, Thunder & SFX Sync: Mapped synthesized lightning thunder and Mangekyo awakening audio directly to the master volume slider and mute/unmute buttons; muting guarantees 100% silence across all Web Audio and audio elements.
- [x] Editorial Japanese-minimalist About section (no photo, no boxed cards, watermark kanji).
- [x] Top-Center Skills Header ("TECHNICAL MASTERY / 能力 · ARSENAL & CAPABILITIES") above Sharingan.
- [x] Interactive skill & project constellation tracked dynamically by Itachi's gaze.
- [x] Dedicated Projects Editorial Showcase (`#projects`): In-depth architectural breakdowns of Rishi's top 3 GitHub projects:
  - **Newsroom AI** (`Comments-Sentiment-Analysis-And-Summarizer---Newsroom-AI`)
  - **Hospital Management Microservices** (`Hospital-Management-System-Using-MicroServices-And-SpringBoot`)
  - **CNN-Based Media Player** (`CNN-Based-Media-Player`)
  - Designed with Japanese numeral watermarks (`壱`, `弐`, `参`), telemetry grids, and direct GitHub links.
- [x] Optimized scroll distances (scrub: 320vh, eyes: 120vh) for snappy, effortless page navigation.
- [x] Contact section merged into interactive Amaterasu reveal canvas with WebGL ghost cursor and background storm plate.
- [x] Interactive scroll message form with instant transmission seal dispatch.
- [x] Update `public/resume.pdf` with the latest `resume sample.pdf`.
- [x] Header navigation updated: `ABOUT`, `SKILLS`, `PROJECTS`, `CONTACT`, `RESUME`, `🔊 35%`.
- [x] Fixed unclosed `.storm` container div in `index.html` restoring full-page scrolling across all sections.
- [x] Verified complete navigation, WebGL canvases, interactive gaze tracking, and dispatch form functionality in 100% muted state.

### Phase 2: AI Chatbot Integration & Visual Optimizations
- [x] Update `src/knowledge/context.ts` with Rishi's complete credentials, projects (Newsroom AI, Hospital Management Microservices, CNN Media Player), certifications (AWS CCP, JP Morgan simulation, Finacle, VISAI '26, NCC), and strict intelligence prompt rules.
- [x] Calibrate AI persona in `src/knowledge/context.ts` with balanced introductory narrative, high-level project overviews for general queries, and exhaustive on-demand technical deep dives.
- [x] Configured zero-cost dual provider orchestration (`gemini-3.6-flash` primary + `groq/qwen3.6-27b` / `compound` fallback) with real-time SSE streaming.
- [x] Built **Offline Tsukuyomi Shadow Cache (`OFFLINE // SHADOW-CACHE`)** providing graceful, in-character pre-defined telemetry when APIs encounter rate limits, token exhaustion, or connection rifts.
- [x] Implemented Quick Chakra Seals (`[ 壱 · BLUEPRINT ]`, `[ 弐 · NEWSROOM AI ]`, `[ 参 · SPRING CLOUD ]`, `[ 四 · AWS ]`, `[ 伍 · PHILOSOPHY ]`) and floating Mangekyō AI summon orb (`#aiSummonOrb`).
- [x] Verified live browser streaming responses, balanced profile overviews, deep telemetry drill-downs, and seamless Itachi dark aesthetic.

### Phase 3: Review, Polish & Deployment Readiness
- [x] **Shinobi Lineage & Honors Redesign**: Replaced boxy card containers with a sleek, non-boxy editorial **Shinobi Lineage & Honors Scroll** featuring a continuous crimson chakra spine, floating rotating seal nodes (`印`, `雲`, `金`, `銀`, `勝`), authentic Japanese calligraphy badge tags, and a minimalist Philosophy HUD bar.
- [x] **Projects Section Interactivity & Shinobi Seals**: Upgraded the Flagship Inventions (`#projects`) section with interactive Shinobi Tech Pills (`術 FastAPI`, `眼 DistilRoBERTa NLP`, `印 Gemini API`, `核 Spring Boot`, `門 Gateway`, `視 OpenCV`, `網 2D CNNs`), live glowing telemetry pulses (`●`), large numeral watermark parallax, and GitHub summon buttons.
- [x] **Default Audio Activation (35% Volume)**: Enabled audio by default (`isMuted = false`, `masterVolume = 0.35`, sound toggle `音 ON`), preloaded the Mangekyo sound effect (`/mangekyo.mp3`), and guaranteed that clicking **AWAKEN THE REALITY** immediately plays the authentic Mangekyo Sharingan sound effect accompanied by synthesized sub-bass and background theme.
- [x] **Reload Landing Page Reset**: Guaranteed that page reload/refresh automatically directs to the top landing screen (`y = 0`) with closed eyes and `tsukuyomi-locked` state (`history.scrollRestoration = 'manual'`, hash strip, and initial lock enforcement).
- [x] **Contact Form Direct Email Dispatch**: Upgraded `#contactForm` to serverless AJAX FormSubmit (`https://formsubmit.co/ajax/rishisharma21950@gmail.com`) with real-time status feedback, loader state, success notification, input reset, and reliable `mailto:` fallback.
- [x] **SEO, OpenGraph, Twitter Cards & JSON-LD Structured Data**: Implemented comprehensive search indexing metadata, high-resolution OpenGraph preview tags, Twitter/X summary cards, canonical links, and Schema.org (`Person`, `WebSite`, `EducationalOrganization`) JSON-LD graph.
- [x] **Mobile & Touch Refinements**: Built a mobile-first responsive architecture:
  - Added a dedicated mobile header with brand badge, quick sound toggle (`#mobileSoundToggle`, displaying `音 35%`), and an animated Tsukuyomi hamburger button (`#mobileMenuBtn`).
  - Created a full-screen Tsukuyomi slide-down drawer with frosted glass, deep crimson borders, large 50px touch targets, Japanese subtitles, and automatic drawer closing on link navigation.
  - Hardened touch devices with `touch-action: manipulation; -webkit-tap-highlight-color: transparent;` to eliminate tap delay.
  - Bound dual touch-listeners (`touchend` + `click`) for the Tsukuyomi awakening button, guaranteeing immediate zero-latency awakening on iPhone and Android.
  - Enabled mobile touch dragging on the Amaterasu flame canvas (`#contact`) and eye-gaze tracking (`#eyes`).
- [x] **Universal Audio HUD & Volume Level Controls**: Upgraded the sound button on both desktop and mobile to open a comprehensive Audio Control HUD featuring:
  - Direct **AUDIO ON / AUDIO OFF** master chakra switch (`解` / `封`).
  - Interactive smooth volume slider (`0%` to `100%`) with real-time level readout.
  - One-tap quick presets (`消音 OFF`, `25%`, `35%`, `70%`, `100%`).
  - Track indicator ("うちはイタチ · SENYA").
- [x] **Technical Mastery & Sharingan Gaze Visibility Restoration**:
  - Expanded `.eyes` scroll height to `220vh`, allowing visitors ample pinned scroll time to observe Itachi's eyes tracking their gaze across skills.
  - Anchored `.eyes__copy` (`其の眼が追う` / *"Wherever you place your focus, his Sharingan follows."*) at the viewport bottom with high z-index and laser drop-shadows.
  - Positioned `.skills-center-head` (`TECHNICAL MASTERY`) at the top above the eyes.
  - Eliminated premature clipping by the Projects section, making the entire constellation, eyes canvas, and quote 100% visible and unblocked.
- [x] Production deployment validation:
  - Verified local production build (`npm run build`) passing in 802ms with zero errors.
  - Verified SPA single-page application routing configuration in `vercel.json`.
  - Authored comprehensive, exhaustive `README.md` covering all architectural engines, lore, features, AI terminal, audio synthesis, and step-by-step Vercel deployment.
  - Configured git remotes pointing to `https://github.com/Risshhhiiii/My-Portfolio.git` for direct Vercel continuous deployment.
  - Removed private documents (`ChatGPT Image...` and `scorereport.pdf`) from git tracking and GitHub, added to `.gitignore`, and securely preserved locally.
  - Successfully deployed to Vercel production: `https://my-portfolio-tau-navy-48.vercel.app/`
- [x] **Mobile Layout Polish — Checkpoint 4 (2026-09-06)**:
  - Removed Sharingan sticky badge (`#stickyBadge`) from HTML entirely (both mobile and desktop).
  - Fixed `^C STOP` button text → replaced with proper `■ STOP` symbol (both desktop and mobile).
  - Fixed black gap below first animation on mobile: switched `.scrub` and `.scrub__sticky` from `100vh` to `100dvh` on mobile (accounts for mobile browser chrome).
  - Eliminated duplicate X button: `chrome__drawer-close` permanently hidden (`display:none!important`) — burger already animates into X when active; no second X needed.
  - COMMUNE orb (`#aiSummonOrb`) hidden on mobile until awakening animation completes. Added `mobile-hidden-until-awake` CSS class that fades in with `.awake` class added via `unlockTsukuyomi()` in JS.
  - Raised DL/AWS skill cards (`gaze-node--ml`) from `top:50%` to `top:32%` so they sit between the header and the Sharingan eye center — eyes are now fully unobstructed.
  - Reduced SUMMON/STOP terminal button size on mobile (from `min-height:44px` to `38px`, compact padding).
  - [x] COMMUNE orb sized down on mobile to `46×46px` with smaller glyph text.
- [x] **Resume Synchronization (2026-09-06)**:
  - Synchronized `public/resume.pdf` with Rishi's newly generated resume (`C:\Users\ASUS\Desktop\My Resume.pdf`), reflecting current skills, AWS certifications, and flagship projects.
  - Verified static asset routing for direct download from header and about sections.
- [x] **Mobile Opening Performance & UI Polish — Checkpoint 5 (2026-09-06)**:
  - **Eliminated Mobile Opening Animation Lag**: Capped canvas DPR to 1.5 on mobile; reduced opening duration to 1500ms on mobile; bypassed redundant `window.scrollTo(0,0)` during opening sequence; eliminated expensive `filter: blur(14px)` on `.tsukuyomi-lockup.dissolved` in mobile view; and guarded `paintAmaterasu` so it is paused when off-screen or during auto-scrubbing.
  - **Default Master Volume to 20%**: Adjusted default volume from 35% to 20% across desktop and mobile headers, popover volume sliders, preset pills, and Web Audio synthesis.
  - **Separated Mobile AI Terminal & Sizing**: Split typing area and summon button into two distinct, vertically stacked components. Enclosed the input inside a dedicated dark, crimson-bordered container (`.term-input-box`) with iOS zoom protection (16px), and upgraded the SUMMON button (`.term-send-btn`) and STOP button (`.term-abort-btn`) into a tactile, full-width 42px action element with crimson chakra styling.
- [x] **Mobile Pull-to-Refresh HUD (Scroll-Up on First Page) — Checkpoint 6 (2026-09-06)**:
  - Added a mobile-only Pull-to-Refresh HUD (`#mobilePullRefresh`) that activates strictly at the top of the first page (`window.scrollY <= 8` on mobile screens `<= 860px`).
  - Styled as an Akatsuki/Sharingan floating frosted pill with live rotating seal indicator, rubber-band resistance curve, haptic feedback vibration on threshold, and visual text cue (`PULL TO RELOAD` → `RELEASE TO RELOAD` → `RELOADING REALITY...`) triggering `window.location.reload()`.
- [x] **Cinematic Crows Animation & Awakening Transition Calibration — Checkpoint 7 (2026-09-06)**:
  - **Full Crow Swarm Visibility & Extended Pacing**: Extended the awakening duration to a luxurious 3800ms across mobile and desktop, and pinned the viewport strictly at `y = 0` until `progress >= 0.76` so the entire eye-opening, Sharingan spin, and full crow eruption (frames 53–71) play with majestic cinematic pacing.
  - **Silky Smooth Transition Curve**: Programmed a Hermite smooth cubic easing scroll that gracefully glides down into `#about` over nearly 1 second as the crows disperse; smoothed feather particle fade-out over 650ms; and extended sub-bass synthesis to 4.1s.
- [x] **Search Engine Optimization (SEO) & Google Indexing Infrastructure — Checkpoint 8 (2026-09-06)**:
  - Fixed canonical URL and OpenGraph/JSON-LD structured data URLs in `index.html` to point to the live Vercel URL (`https://my-portfolio-tau-navy-48.vercel.app/`), eliminating conflicting canonical signals preventing Google indexing.
  - Generated `public/robots.txt` allowing full crawler access and declaring sitemap path.
  - Generated `public/sitemap.xml` listing main website and resume static asset.
- [x] **Mobile Awakening & Transition Performance Overhaul — Checkpoint 9 (2026-09-06)**:
  - **Full Asset Preloading & Memory Bitmap Decoding**: Synchronized all 126 assets (71 Tsukuyomi awakening frames, 51 eye-tracking frames, `/mangekyo.mp3`, `/sharingan.mp3`, `/itachi-theme.mp3`, and Google Fonts) with the initial loader progress bar; all images pre-decoded via `img.decode()` into GPU-ready raster memory so zero decoding takes place mid-animation.
  - **Eliminated Forced Synchronous Layout Thrashing**: Isolated an Act I Fast-Path within `tick()` when `isAutoScrubbing` is active, bypassing all off-screen `getBoundingClientRect()` queries (Amaterasu, Eye tracking, Jutsu section) and guarding `readScroll()` from recalculating `scrollHeight` on every 16ms frame.
  - **Optimized Phase Overlay Compositing**: Eliminated inline `filter: blur(...)` calculations and dynamic CSS custom property `--y` mutations across phase captions in `paintOverlays()`; replaced with direct GPU opacity and `visibility: hidden/visible` toggling.
- [x] **Unified Single-Speed Cinematic Awakening Pacing — Checkpoint 10 (2026-09-06)**:
  - **Single Constant Velocity Pacing**: Replaced the non-linear piecewise easing curve (which caused noticeable accelerations, decelerations, and pauses) with a unified linear single-speed playback rate across all 71 frames on both desktop (`3200ms`, steady 22 fps) and mobile (`3800ms`, steady 18.7 fps).
  - **Balanced Storytelling Distribution**: Every phase receives equal, natural timing:
    - Mobile (3800ms): 0.0s – 1.3s eyes opening (`静寂` → `覚醒`), 1.3s – 2.85s Sharingan tomoe focus and spin (`写輪眼`), 2.85s – 3.8s crow dispersion (`烏`) and smooth glide into `#about`.
    - Desktop (3200ms): 0.0s – 1.1s eyes opening, 1.1s – 2.4s Sharingan tomoe spin, 2.4s – 3.2s crow dispersion and smooth glide into `#about`.
  - **Synchronized Phase Windows**: Calibrated caption windows (`PHASE_WINDOWS`) and feather emergence (`progress > 0.62`) to precisely align with the unified playback rate.

---

## Subsystems & Resource Inventory
1. **Preserved Chatbot & Knowledge Base**:
   - `src/knowledge/context.ts`
   - `src/pages/Chat.tsx`
   - `src/lib/github.ts`
2. **User Assets**:
   - `resume sample.pdf` (Rishi Raj Sharma resume)
   - `public/rishi-photo.png`
   - `Profile.png`
   - `sample.docx`, `scorereport.pdf`
