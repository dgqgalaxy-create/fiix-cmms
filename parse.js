const fs = require('fs');

const content = fs.readFileSync('C:/Users/Mantenimiento/.gemini/antigravity-ide/brain/882d4616-4a85-40d7-8425-40af8e2ac4f4/.system_generated/steps/1141/content.md', 'utf8');

// Match everything inside div class "M7eMe" (the question) and its following options
const qs = content.match(/<div[^>]*class=\"[^\"]*M7eMe[^\"]*\"[^>]*>.*?<\/div>(?:.*?)(?=<div[^>]*class=\"[^\"]*M7eMe[^\"]*\"|$)/gs) || [];

qs.forEach(block => {
  const qTitle = (block.match(/<span[^>]*class="M7eMe[^>]*>(.*?)<\/span>/) || [])[1] || '';
  const cleanQ = qTitle.replace(/<[^>]+>/g, '').trim();
  
  // Extract all span classes that look like options (usually class "aDTYNe snByac OvPDhc OIC90c")
  const options = block.match(/<span[^>]*class=\"aDTYNe[^\"]*\"[^>]*>(.*?)<\/span>/g) || [];
  const cleanOpts = options.map(o => o.replace(/<[^>]+>/g, '').trim()).filter(x => x);

  console.log(`Q: ${cleanQ}`);
  if(cleanOpts.length) {
     console.log(`  Options: ${cleanOpts.join(', ')}`);
  }
});
