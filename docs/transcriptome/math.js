(function(root){'use strict';
 function fit(points,lambda){
  if(points.length<3||points.some(p=>!p.every(Number.isFinite)))return null;
  const n=points.length,m=[0,0];points.forEach(p=>{m[0]+=p[0]/n;m[1]+=p[1]/n;});let a=0,b=0,c=0;
  points.forEach(p=>{const x=p[0]-m[0],y=p[1]-m[1];a+=x*x/(n-1);b+=x*y/(n-1);c+=y*y/(n-1);});
  const raw=[a,b,c],mu=(a+c)/2;a=(1-lambda)*a+lambda*mu;b=(1-lambda)*b;c=(1-lambda)*c+lambda*mu;
  const det=a*c-b*b;if(!(mu>0)||!(det>1e-12*mu*mu))return null;
  const precision=[c/det,-b/det,a/det],trace=a+c,gap=Math.hypot(a-c,2*b);
  return{n,mean:m,raw,cov:[a,b,c],precision,eigen:[(trace+gap)/2,(trace-gap)/2],angle:.5*Math.atan2(2*b,a-c),distance(p){const x=p[0]-m[0],y=p[1]-m[1];return Math.sqrt(Math.max(0,x*x*precision[0]+2*x*y*precision[1]+y*y*precision[2]));}};
 }
 root.TranscriptomeMath={fit};if(typeof module!=='undefined')module.exports={fit};
})(typeof window!=='undefined'?window:globalThis);
