const assert=require('node:assert/strict'),fs=require('node:fs'),zlib=require('node:zlib');
const {fit}=require('./docs/transcriptome/math.js');const summary=JSON.parse(fs.readFileSync('docs/transcriptome/data/summary.json','utf8'));
assert.equal(summary.totalLibraries,44);assert.equal(summary.datasets.length,4);let total=0;
for(const ds of summary.datasets){const d=JSON.parse(zlib.gunzipSync(fs.readFileSync('docs/transcriptome/'+ds.data)));assert.equal(d.samples.length,ds.n);assert.equal(d.genes.length,ds.genes);assert.equal(d.normalizedGenes.length,ds.normalizedGenes);assert.equal(new Set(d.genes).size,d.genes.length);assert.equal(d.raw.length,d.genes.length);d.raw.forEach(row=>{assert.equal(row.length,ds.n);row.forEach(v=>assert(Number.isInteger(v)&&v>=0));});d.logCPM.forEach(row=>{assert.equal(row.length,ds.n);row.forEach(v=>assert(Number.isFinite(v)));});assert(ds.samples.every(s=>d.samples.includes(s.sample)));total+=ds.n;}
assert.equal(total,44);
const points=[[1,2],[2,1],[3,5],[4,3]],p=[5,4],lambda=.3;
const model=fit(points,lambda);assert(model);const [a,b,c]=model.cov,[mx,my]=model.mean;const dx=p[0]-mx,dy=p[1]-my;const independent=(c*dx*dx-2*b*dx*dy+a*dy*dy)/(a*c-b*b);assert(Math.abs(model.distance(p)**2-independent)<1e-12);
const rotated=fit(points.map(([x,y])=>[-y,x]),lambda);assert(Math.abs(rotated.distance([-p[1],p[0]])-model.distance(p))<1e-12);
assert.equal(fit([[1,1],[1,1],[1,1]],.3),null);assert.equal(fit([[1,2],[2,4],[3,6]],0),null);assert(fit([[1,2],[2,4],[3,6]],.3));assert.equal(fit([[1,2],[2,3]],.3),null);
const gene=summary.audit.genes.find(r=>r.dataset==='LG_mouse'&&r.gene==='Retnla');assert(Math.abs(gene.full_DESeq2_log2FC-2.479724714)<1e-6);assert(gene.full_DESeq2_q_zero<.05&&gene.all_sample_weighted_q_zero<.05);
console.log('PASS: all 44 libraries, full real matrices, all raw integers, finite normalized values, numeric formula, rotation, singular cases, saved gene result');
