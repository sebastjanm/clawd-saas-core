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
};

fs.writeFileSync(path, JSON.stringify(prompts, null, 2));
console.log('Updated agent-prompts.json');
