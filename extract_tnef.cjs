const fs = require('fs');
const path = require('path');

try {
  const tnef = require('node-tnef');
  console.log('node-tnef loaded successfully.');
  
  const fileBuffer = fs.readFileSync('noname');
  tnef.parse(fileBuffer, (err, result) => {
    if (err) {
      console.error('Error parsing TNEF:', err);
      process.exit(1);
    }
    
    console.log('TNEF parsed successfully.');
    console.log('Attributes count:', Object.keys(result.attributes || {}).length);
    console.log('Attachments count:', (result.attachments || []).length);
    
    const attachments = result.attachments || [];
    attachments.forEach((attach, index) => {
      const filename = attach.name || `attachment_${index}`;
      console.log(`Saving attachment: ${filename} (${attach.size || attach.data.length} bytes)`);
      fs.writeFileSync(filename, attach.data);
    });
    console.log('All attachments saved!');
  });
} catch (e) {
  console.error('Failed to run parser:', e);
}
