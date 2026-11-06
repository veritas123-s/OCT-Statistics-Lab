const assert=require('assert/strict');
const {viewportGrid}=require('./docs/matrix-model.js');
let count=0;
for(const angle of[0,17,45,90,-133,180])for(const [sx,sy]of[[1,1],[.001,20],[.05,.16],[20,.001]])for(const origin of[[450,300],[-5700,4200]]){
  const a=angle*Math.PI/180,M=[[sx*Math.cos(a),-sx*Math.sin(a)],[sy*Math.sin(a),sy*Math.cos(a)]];
  const lines=viewportGrid(M,origin,3.7,900,600);
  assert.ok(lines.length>0&&lines.length<120,'bounded visible lattice');
  const A=[[3.7*M[0][0],3.7*M[0][1]],[-3.7*M[1][0],-3.7*M[1][1]]],det=A[0][0]*A[1][1]-A[0][1]*A[1][0];
  for(const {axis,index,step,ends}of lines)for(const [x,y]of ends){
    assert.ok(x>=-1e-6&&x<=900+1e-6&&y>=-1e-6&&y<=600+1e-6);
    assert.ok(Math.min(Math.abs(x),Math.abs(x-900),Math.abs(y),Math.abs(y-600))<1e-6,'line reaches viewport edge');
    const dx=x-origin[0],dy=y-origin[1],v=axis===0?(A[1][1]*dx-A[0][1]*dy)/det:(-A[1][0]*dx+A[0][0]*dy)/det;
    assert.ok(Math.abs(v-index*step)<1e-6*Math.max(1,Math.abs(v)),'same transformed source lattice');
  }
  count++;
}
console.log(`PASS: ${count} viewport lattices; full edge clipping, translated views, arbitrary rotation, extreme anisotropy, bounded line counts.`);
