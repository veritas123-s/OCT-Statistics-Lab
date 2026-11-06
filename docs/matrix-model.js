(function(root){
  'use strict';
  const mul=(A,B)=>A.map(row=>B[0].map((_,j)=>row.reduce((v,a,k)=>v+a*B[k][j],0)));
  const transpose=A=>A[0].map((_,j)=>A.map(row=>row[j]));
  const apply=(A,v)=>A.map(row=>row.reduce((s,x,i)=>s+x*v[i],0));
  function plan(stats,state){
    const t=state.center,rad=state.angle*Math.PI/180,c=Math.cos(rad),s=Math.sin(rad);
    const R=[[c,-s],[s,c]],D=[[state.sx,0],[0,state.sy]],M=mul(D,R);
    const offset=apply(M,stats.mean).map(x=>-t*x);
    const H=[[...M[0],offset[0]],[...M[1],offset[1]],[0,0,1]];
    const invM=[[c/state.sx,s/state.sy],[-s/state.sx,c/state.sy]];
    const invOffset=apply(invM,offset).map(x=>-x);
    const inverse=[[...invM[0],invOffset[0]],[...invM[1],invOffset[1]],[0,0,1]];
    const covariance=mul(mul(M,stats.S),transpose(M));
    function stages(point){const raw=[point.x,point.y],centered=raw.map((v,i)=>v-t*stats.mean[i]),rotated=apply(R,centered),scaled=apply(D,rotated);return{raw,centered,rotated,scaled,recovered:apply(inverse,[...scaled,1]).slice(0,2)};}
    return{R,D,M,H,inverse,covariance,stages,map:p=>stages(p).scaled,
      T:[[1,0,-t*stats.mean[0]],[0,1,-t*stats.mean[1]],[0,0,1]],
      determinant:state.sx*state.sy};
  }
  // Clip an unbounded affine lattice to the current viewport. Grid density
  // follows perpendicular screen spacing, including anisotropic transforms.
  function viewportGrid(M,origin,scale,width,height){
    const A=[[scale*M[0][0],scale*M[0][1]],[-scale*M[1][0],-scale*M[1][1]]];
    const det=A[0][0]*A[1][1]-A[0][1]*A[1][0];
    if(!Number.isFinite(det)||det===0||width<=0||height<=0)return[];
    const inv=[[A[1][1]/det,-A[0][1]/det],[-A[1][0]/det,A[0][0]/det]];
    const corners=[[0,0],[width,0],[width,height],[0,height]].map(p=>apply(inv,p.map((v,i)=>v-origin[i])));
    const spacing=Math.abs(det)/Math.max(Math.hypot(A[0][0],A[1][0]),Math.hypot(A[0][1],A[1][1]));
    const wanted=42/spacing,unit=10**Math.floor(Math.log10(wanted));
    const step=[1,2,5,10].find(v=>v*unit>=wanted)*unit,lines=[];
    function clip(p,v){
      let low=-Infinity,high=Infinity;
      for(let j=0;j<2;j++){
        const limit=j===0?width:height;
        if(Math.abs(v[j])<1e-12){if(p[j]<0||p[j]>limit)return null;continue;}
        const t0=-p[j]/v[j],t1=(limit-p[j])/v[j];
        low=Math.max(low,Math.min(t0,t1));high=Math.min(high,Math.max(t0,t1));
      }
      if(low>high)return null;
      return[p.map((x,j)=>x+low*v[j]),p.map((x,j)=>x+high*v[j])];
    }
    for(let axis=0;axis<2;axis++){
      const values=corners.map(p=>p[axis]),first=Math.ceil(Math.min(...values)/step),last=Math.floor(Math.max(...values)/step);
      for(let k=first;k<=last;k++){
        const offset=origin.map((v,j)=>v+A[j][axis]*k*step),direction=[A[0][1-axis],A[1][1-axis]],ends=clip(offset,direction);
        if(ends)lines.push({axis,index:k,step,ends});
      }
    }
    return lines;
  }
  const api={mul,transpose,apply,plan,viewportGrid};
  if(typeof module==='object'&&module.exports)module.exports=api;else root.MatrixMath=api;
})(typeof globalThis!=='undefined'?globalThis:this);
