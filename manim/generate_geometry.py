"""Generate reversible scene geometry with Manim; no video or timed playback.

The browser applies the same affine transforms to these Bezier control points.
"""
from pathlib import Path
import csv
import json
import manim
from manim import Circle, Line, ORIGIN
import numpy as np

ROOT=Path(__file__).resolve().parents[1]
DOCS=ROOT/'docs'
with (DOCS/'teaching-data.csv').open(encoding='utf-8-sig',newline='') as f:
    records=list(csv.DictReader(f))
X=np.array([[float(r['pRNFL_um']),float(r['GCIPL_um'])] for r in records])
mean=X.mean(axis=0)
S=np.cov(X,rowvar=False,ddof=1)
eigen,Q=np.linalg.eigh(S)
eigen=eigen[::-1]
theta=.5*np.arctan2(2*S[0,1],S[0,0]-S[1,1])
B=np.array([[np.cos(theta),-np.sin(theta)],[np.sin(theta),np.cos(theta)]])
R=B.T
D=np.diag(1/np.sqrt(eigen))
def m3(M):
    out=np.eye(3)
    out[:2,:2]=M
    return out
circle=Circle(radius=1)
base=circle.points.copy()
ellipse=circle.copy().apply_matrix(m3(B@np.diag(np.sqrt(eigen))),about_point=ORIGIN)
raw=ellipse.copy().shift([mean[0],mean[1],0])
centered=raw.copy().shift([-mean[0],-mean[1],0])
rotated=centered.copy().apply_matrix(m3(R),about_point=ORIGIN)
white=rotated.copy().apply_matrix(m3(D),about_point=ORIGIN)
assert np.allclose(white.points,base,atol=1e-10)
restored=white.copy().apply_matrix(m3(np.linalg.inv(D)),about_point=ORIGIN).apply_matrix(m3(np.linalg.inv(R)),about_point=ORIGIN).shift([mean[0],mean[1],0])
assert np.allclose(restored.points,raw.points,atol=1e-10)
def curves(obj):
    return [np.array(c)[:,:2].tolist() for c in obj.get_cubic_bezier_tuples()]
geometry={'generator':'Manim Community','version':manim.__version__,
          'unit_circle':curves(circle),
          'basis_lines':[[Line(ORIGIN,[1,0,0]).get_start()[:2].tolist(),[1,0]],[[0,0],[0,1]]],
          'calibration':{'mean':mean.tolist(),'S':S.tolist(),'R':R.tolist(),'D':D.tolist(),
                         'centered':curves(centered),'rotated':curves(rotated),'white':curves(white),
                         'inverse_max_error':float(np.max(np.abs(restored.points-raw.points))),
                         'white_max_error':float(np.max(np.abs(white.points-base)))}}
(DOCS/'manim-geometry.js').write_text('window.MANIM_GEOMETRY = '+json.dumps(geometry,separators=(',',':'))+';\n',encoding='utf-8',newline='\n')
print(json.dumps({'manim_version':manim.__version__,'curves':len(geometry['unit_circle']),
                  'white_max_error':geometry['calibration']['white_max_error'],
                  'inverse_max_error':geometry['calibration']['inverse_max_error']}))
