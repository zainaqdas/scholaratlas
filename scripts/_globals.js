const { createClient } = require('@libsql/client');
const c = createClient({
  url: 'libsql://sholaratlas-zainu786110.aws-ap-south-1.turso.io',
  authToken: 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODcwODIzMjUsImlkIjoiMDFhMDE2NjctMzAwMS03ZGJhLThkMDgtODA1YTZjZGIwYTBkIiwia2lkIjoiMllUeTJsSkZBMFpnSEVTYU1FSV8wY2FLSG5HYmlQcGFLVFNQSFVEWXFXSSIsInJpZCI6ImY5ODAyNTM2LTA3MDktNDZlOC1iM2Y1LTJiODdjZGIyODgxMSJ9.TRtkeLKHWdFLN5I6DaZqAVORE69CqXFGH5cyRFO4zsIQ6F7gUqTXTre6qvK2pf2FgyR2V53rP8bnlD79dXuWBw'
});
(async () => {
  const r = await c.execute("SELECT slug, recordType, status FROM Scholarship WHERE countryCode IS NULL ORDER BY title");
  console.log('TOTAL:', r.rows.length);
  const byType = {};
  for (const x of r.rows) { byType[x.recordType] = (byType[x.recordType]||0)+1; }
  console.log('BY TYPE:', JSON.stringify(byType));
  const s4d = r.rows.filter(x => x.slug.includes('s4d'));
  console.log('S4D:', s4d.length, '| NON-S4D:', r.rows.length - s4d.length);
  for (const x of r.rows.filter(x => !x.slug.includes('s4d'))) console.log(x.recordType, '|', x.status, '|', x.slug);
})();
