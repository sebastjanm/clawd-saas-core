const Database = require('better-sqlite3');
const path = require('path');
const db = new Database(process.env.PIPELINE_DB || path.join(__dirname, '../../db', 'pipeline.db'));

const project = 'avant2go-subscribe';
const date = '2026-03-05';

// Fetch existing row
const existing = db.prepare('SELECT * FROM daily_intel WHERE project = ? AND date = ?').get(project, date);
if (!existing) {
    console.error('No existing row found for', project, date);
    process.exit(1);
}

// Parse existing JSON fields
const stories = JSON.parse(existing.stories);
const dataPoints = JSON.parse(existing.data_points);
const signalsToWatch = JSON.parse(existing.signals_to_watch);
const articleIdeas = JSON.parse(existing.article_ideas);
const rawMd = existing.raw_md;

// Add new story: Mocean Subscription expands to Germany
const moceanStory = {
    headline: "Mocean Subscription expands to Germany as Hyundai Connected Mobility pushes car subscription growth",
    summary: "Hyundai Connected Mobility's Mocean Subscription service launches in Germany from November, offering flexible, all-inclusive subscriptions to Hyundai vehicles with no down payment and option to swap every six months. Part of broader European rollout, reflecting shift toward usership models.",
    source_url: "https://www.hyundai.news/eu/articles/press-releases/mocean-subscription-expands-to-germany.html",
    relevance: "high"
};

// Add new story: Nissan Sunderland plant threatened by EU 'Made in Europe' rules
const nissanStory = {
    headline: "Nissan Sunderland plant could close if UK excluded from EU 'Made in Europe' rules",
    summary: "Nissan has reportedly warned it could be forced to close its Sunderland plant if the UK is not fully included in the EU's proposed 'Made in Europe' manufacturing rules under the Industrial Accelerator Act. The rules would limit public subsidies for electric vehicles to those made in the EU, potentially locking UK-based manufacturers out of corporate fleet incentives.",
    source_url: "https://www.theguardian.com/business/2026/mar/05/nissan-sunderland-plant-could-close-if-uk-excluded-from-made-in-europe-rules-eu",
    relevance: "high"
};

// Add stories if not already present (simple duplicate detection by URL)
const existingUrls = stories.map(s => s.source_url);
if (!existingUrls.includes(moceanStory.source_url)) {
    stories.push(moceanStory);
}
if (!existingUrls.includes(nissanStory.source_url)) {
    stories.push(nissanStory);
}

// Update data points if needed
if (!dataPoints.mocean_germany_launch) {
    dataPoints.mocean_germany_launch = "November 2026";
}
if (!dataPoints.nissan_sunderland_risk) {
    dataPoints.nissan_sunderland_risk = "potential closure threat";
}

// Update signals to watch
const newSignal1 = "Hyundai Mocean expansion to Germany";
const newSignal2 = "UK car industry exclusion from EU 'Made in Europe' incentives";
if (!signalsToWatch.includes(newSignal1)) signalsToWatch.push(newSignal1);
if (!signalsToWatch.includes(newSignal2)) signalsToWatch.push(newSignal2);

// Update article ideas
const newArticle = {
    title: "Hyundai Mocean expands to Germany: What it means for car subscription competition",
    angle: "Analysis of Hyundai's subscription service expansion into Germany and its implications for local providers like Avant2Go.",
    keyword: "Hyundai Mocean expansion",
    why_timely: "Mocean Subscription announced Germany launch starting November."
};
articleIdeas.push(newArticle);

// Update raw MD - we'll just append a section
const newSection = `
## New Updates (added by Oti)

### Mocean Subscription expands to Germany
**Source:** [Mocean Subscription expands to Germany](${moceanStory.source_url})
**Relevance:** high
**Summary:** ${moceanStory.summary}

### Nissan Sunderland plant threatened by EU 'Made in Europe' rules
**Source:** [Nissan Sunderland plant could close](${nissanStory.source_url})
**Relevance:** high
**Summary:** ${nissanStory.summary}
`;

const updatedRawMd = rawMd + newSection;

// Insert or replace
const stmt = db.prepare(`
    INSERT OR REPLACE INTO daily_intel (project, date, top_signal, stories, data_points, signals_to_watch, article_ideas, raw_md, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
`);
stmt.run(
    project,
    date,
    existing.top_signal, // keep existing top signal
    JSON.stringify(stories),
    JSON.stringify(dataPoints),
    JSON.stringify(signalsToWatch),
    JSON.stringify(articleIdeas),
    updatedRawMd
);

console.log('Updated daily_intel for', project, date);
console.log('Added', stories.length - existing.stories.length, 'new stories');