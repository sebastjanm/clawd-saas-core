# 🎨 Zala — Memory

## Created
2026-02-16 — Split from Rada's Pass 4 (HTML conversion). Rada handles content quality, Zala handles design/template.

## Project Notes

### nakupsrebra (file-based)
- Reference article: `tesla-srebrni-kovanec-1920.html` — use as template source
- CSS: self-contained in `<style>` tag per article (no external stylesheet)
- Colors: navy (#1a365d), gold accent (#c9a227), warm bg (#fdfbf7)
- Font: Georgia serif
- Always include: back-link, h1, meta date, CTA section (/posvet), sources, footer
- Full standalone HTML page with canonical/OG/Schema.org

### baseman-blog (API)
- Has design-system.md in skills/baseman-blog/references/
- Body HTML only — API wraps in template
- No inline styles — CSS classes from design system
- No CTA (personal brand, not sales)

### avant2subscribe (API)
- Has design-system.md in skills/avant2subscribe/references/
- Body HTML only — inline CSS on elements
- CTA box → /subscribe
- All Slovenian (vikanje)

### lightingdesign-studio (API)
- Has design-system.md in content-pipeline/projects/references/lightingdesign-design-system.md
- Body HTML only — clean semantic HTML, NO inline styles
- Minimalist luxury: off-white/gold/navy, Georgia
- Components: lead paragraph, blockquote (pull quotes), concept-grid, ordered lists, tables, dl (glossary), FAQ accordion (details/summary), CTA box → /contact
- Images: generate 2K PNG → compress JPG 1200px q82 → upload to Supabase via /api/upload
- Cover image: 1200x669

## Lessons
- Articles 16/17 went live without page template — caused by Rada doing HTML conversion. This is why Zala exists.
- 2K PNG too large for upload API ("Request Entity Too Large"). Always compress to JPG 1200px q82 before upload.
- `convert` command not in PATH. Use Python/PIL: `python3 -c "from PIL import Image; img=Image.open('in.png'); img.resize((1200, int(img.height*1200/img.width)), Image.LANCZOS).save('out.jpg', 'JPEG', quality=82)"`
- When article already has Supabase image URLs in `final_md`, skip image generation — use existing URLs.
- `pipeline-cli set-content` uses `final_md` field for both markdown and HTML.
- Message tool media paths must be in /tmp, not workspace dir.
- Article #31 was REJECTED for Czech translations. Never translate to other languages.
- Article #96 was redesigned after Rada re-review (2026-02-19 version replaced 2026-02-17).

## Completed Articles

| ID | Date | Project | Title |
|----|------|---------|-------|
| 18 | 02-16 | nakupsrebra | Zakaj srebro ni 'špekulacija' |
| 31 | 02-17 | baseman-blog | How I Built a Voice AI That Makes Phone Calls (v2) |
| 54 | 02-17 | nakupsrebra | Elementum odkup |
| 96 | 02-19 | avant2subscribe | Ali je mesečni najem pravi zame? (redesign) |
| 95 | 02-18 | avant2subscribe | Najem brez stresa: checklist |
| 49 | 02-18 | nakupsrebra | Srebrne palice ali kovanci |
| 37 | 02-18 | baseman-blog | The Real Cost of Running AI Agents |
| 53 | 02-19 | nakupsrebra | Kaj se zgodi s srebrom med recesijo |
| 89 | 02-19 | avant2subscribe | 7 razlogov za mesečni najem |
| 43 | 02-19 | baseman-blog | What I Learned Shipping 10 Side Projects |
| 117 | 02-20 | baseman-blog | TEST /new_article trigger check |
| 55 | 02-20 | nakupsrebra | Srebro za otroke |
| 119 | 02-20 | nakupsrebra | Kaj je Elementum in kdo je Bojan Pravica |
| 116 | 02-20 | nakupsrebra | Kakšne so svetovne zaloge srebra |
| 120 | 02-20 | nakupsrebra | Mesečni pregled dogajanj na trgu srebra |
| 59 | 02-21 | baseman-blog | The Stack I Use for Every New Project in 2026 |
| 57 | 02-21 | nakupsrebra | Mesečno varčevanje v srebru |
| 60 | 02-21 | baseman-blog | From VideoLectures.NET to AI |
| 92 | 02-21 | avant2subscribe | Kaj je vključeno v mesečni najem |
| 64 | 02-21 | nakupsrebra | Davki na srebro |
| 61 | 02-21 | baseman-blog | How I Use AI to Run a One-Person Business |
| 94 | 02-21 | avant2subscribe | Koliko kilometrov izbrati pri najemu |
| 62 | 02-21 | nakupsrebra | Kako preveriti pristnost srebra doma |
| 82 | 02-21 | baseman-blog | WebMCP: AI-Driven Web Interactions |
| 100 | 02-21 | avant2subscribe | Menjava avta brez kompliciranja |
| 97 | 02-21 | avant2subscribe | Fiksni strošek vs. presenečenja |
| 99 | 02-21 | avant2subscribe | Električni avto na mesečni najem |
| 58 | 02-21 | nakupsrebra | Dunajski filharmonik srebrni kovanec |
| 44 | 02-21 | baseman-blog | Claude Code vs Cursor vs Copilot |
| 122 | 02-22 | lightingdesign | Lighting design for your living room |
| 123 | 02-22 | lightingdesign | Circadian Lighting: Designing for Wellbeing |
| 124 | 02-22 | lightingdesign | Light and Shadow: The Forgotten Dialogue |
| 135 | 02-22 | lightingdesign | Bathroom Lighting Design (Spa Atmosphere) |
| 136 | 02-22 | lightingdesign | Can Lighting Design Improve Employee Productivity? |
| 129 | 02-22 | nakupsrebra | Zlato prebilo 5.000 $: Ali je zdaj prepozno za nakup (ali pa je srebro naslednje)? |
| 132 | 02-22 | nakupsrebra | Kdaj prodati srebro? Vodnik za izstopno strategijo (ki ga nihče drug ne napiše) |
| 1 | 02-23 | nakupsrebra | 5 napak, ki jih 90% začetnikov naredi pri nakupu srebra (in kako se jim izogniti) |
| 63 | 02-24 | nakupsrebra | Kako varno hraniti fizično srebro — doma, v trezorju ali v Švici? |
| 86 | 02-24 | nakupsrebra | Primanjkljaj srebra: Kaj to pomeni za vlagatelje v 2026? |
| 108 | 02-24 | nakupsrebra | Institucionalna vlaganja v srebro: Trendi za leto 2026 |
| 114 | 02-24 | nakupsrebra | Kje vse so rudniki srebra in kakšne so zaloge |
