const { createClient } = require('@libsql/client');
const c = createClient({
  url: 'libsql://sholaratlas-zainu786110.aws-ap-south-1.turso.io',
  authToken: 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODcwODIzMjUsImlkIjoiMDFhMDE2NjctMzAwMS03ZGJhLThkMDgtODA1YTZjZGIwYTBkIiwia2lkIjoiMllUeTJsSkZBMFpnSEVTYU1FSV8wY2FLSG5HYmlQcGFLVFNQSFVEWXFXSSIsInJpZCI6ImY5ODAyNTM2LTA3MDktNDZlOC1iM2Y1LTJiODdjZGIyODgxMSJ9.TRtkeLKHWdFLN5I6DaZqAVORE69CqXFGH5cyRFO4zsIQ6F7gUqTXTre6qvK2pf2FgyR2V53rP8bnlD79dXuWBw'
});
(async () => {
  const r = await c.execute("SELECT slug, title, description FROM Scholarship WHERE countryCode IS NULL AND recordType='SCHOLARSHIP' AND status='ACTIVE' ORDER BY title");
  console.log('ACTIVE global scholarships:', r.rows.length);
  for (const x of r.rows) {
    const desc = x.description || '';
    // host lines
    const hostLines = [];
    desc.split('\n').forEach(line => {
      const t = line.trim();
      if (/^host institution/i.test(t) || /hosting institutions?/i.test(t) || /participating (universities|institutions|countries)/i.test(t) || /peace centers? around the world/i.test(t) || /consortium of/i.test(t)) hostLines.push(t);
    });
    console.log('=== ' + x.slug);
    console.log('TITLE: ' + x.title);
    if (hostLines.length) console.log('HOST: ' + hostLines.join(' | '));
    else console.log('HOST: (none in desc)');
  }
})();
