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
- [ ] Update `src/knowledge/context.ts` with Rishi's complete credentials and prompt rules.
- [ ] Implement an Itachi-themed summon interface (Mangekyō / Terminal modal) on the website to launch the AI chatbot.
- [ ] Optimize mobile touch interaction and canvas rendering.

### Phase 3: Review, Polish & Deployment Readiness
- [ ] Sound synthesizer & accessibility adjustments.
- [ ] SEO, meta descriptions, and OpenGraph tags.
- [ ] Production build and deployment validation.

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
3. **Archived Codebase**:
   - `archive_portfolio/`: Safe storage of previous React sections and components.
