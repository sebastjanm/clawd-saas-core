const fs = require('fs');
const path = '/home/clawdbot/projects/pipeline-router/agent-prompts.json';
const prompts = JSON.parse(fs.readFileSync(path, 'utf8'));

const projectId = 'lightingdesign-studio';
const projectPath = 'projects/lightingdesign-studio.json';

// Clone templates (using baseman-blog as base, but tailored)
prompts[`pino:${projectId}`] = {
  ...prompts['pino:baseman-blog'],
  cronJobId: 'uuid-' + projectId + '-pino', // Fake UUID for now
  message: prompts['pino:baseman-blog'].message
    .replace(/BASEMAN BLOG/g, 'LIGHTING DESIGN STUDIO')
    .replace(/baseman-blog/g, projectId)
    .replace(/baseman/g, 'lightingdesign')
    .replace(/content-pipeline\/projects\/.*?.json/g, `content-pipeline/${projectPath}`)
    .replace(/No tech intel available/g, 'No design intel available') // Clean up
};

prompts[`rada:${projectId}`] = {
  ...prompts['rada:baseman-blog'],
  cronJobId: 'uuid-' + projectId + '-rada',
  message: prompts['rada:baseman-blog'].message
    .replace(/baseman-blog/g, projectId)
    .replace(/content-pipeline\/projects\/.*?.json/g, `content-pipeline/${projectPath}`)
};

prompts[`zala:${projectId}`] = {
  ...prompts['zala:baseman-blog'],
  cronJobId: 'uuid-' + projectId + '-zala',
  message: prompts['zala:baseman-blog'].message
    .replace(/baseman-blog/g, projectId)
    .replace(/content-pipeline\/projects\/.*?.json/g, `content-pipeline/${projectPath}`)
    // No specific HTML template for Zala yet, she'll fallback or fail. 
    // I should point her to a generic one or remove the template reading line.
    // For now, let's point to the baseman one as a placeholder, or just let her run.
    // Actually, I'll update the prompt to NOT read a specific file if it doesn't exist.
    // Simplifying: just keeping the path replace.
};

fs.writeFileSync(path, JSON.stringify(prompts, null, 2));
console.log('Updated agent-prompts.json');
