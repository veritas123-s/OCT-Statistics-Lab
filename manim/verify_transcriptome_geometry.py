"""Check Manim affine geometry against complete published expression matrices."""
from pathlib import Path
import gzip
import json
import manim
from manim import Circle, ORIGIN
import numpy as np

DOCS = Path(__file__).resolve().parents[1] / 'docs'
summary = json.loads((DOCS / 'transcriptome/data/summary.json').read_text(encoding='utf-8'))

def m3(matrix):
    result = np.eye(3)
    result[:2, :2] = matrix
    return result

checks = []
for dataset in summary['datasets']:
    with gzip.open(DOCS / 'transcriptome' / dataset['data'], 'rt', encoding='utf-8') as stream:
        data = json.load(stream)
    genes = ('Ch25h', 'Lyz2' if dataset['id'] == 'EON_rat' else 'Retnla')
    x = np.array([data['logCPM'][data['normalizedGenes'].index(g)] for g in genes]).T
    target = next((i for i, s in enumerate(data['samples']) if s.startswith('igg45_112')), 0)
    reference = np.delete(x, target, axis=0)
    mean, covariance = reference.mean(axis=0), np.cov(reference, rowvar=False, ddof=1)
    eigenvalues, basis = np.linalg.eigh(covariance)
    eigenvalues, basis = eigenvalues[::-1], basis[:, ::-1]
    if np.linalg.det(basis) < 0:
        basis[:, 1] *= -1
    rotation, scaling = basis.T, np.diag(1 / np.sqrt(eigenvalues))
    unit = Circle(radius=1)
    ellipse = unit.copy().apply_matrix(m3(basis @ np.diag(np.sqrt(eigenvalues))), about_point=ORIGIN)
    raw = ellipse.copy().shift([*mean, 0])
    aligned = raw.copy().shift([-mean[0], -mean[1], 0]).apply_matrix(m3(rotation), about_point=ORIGIN)
    whitened = aligned.copy().apply_matrix(m3(scaling), about_point=ORIGIN)
    recovered = whitened.copy().apply_matrix(m3(np.linalg.inv(scaling @ rotation)), about_point=ORIGIN).shift([*mean, 0])
    angle = np.deg2rad(37)
    arbitrary = np.array([[np.cos(angle), -np.sin(angle)], [np.sin(angle), np.cos(angle)]])
    rotated = ellipse.copy().apply_matrix(m3(arbitrary), about_point=ORIGIN)
    observed_cov = np.cov((reference - mean) @ arbitrary.T, rowvar=False, ddof=1)
    errors = {
        'white_geometry': float(np.max(np.abs(whitened.points - unit.points))),
        'inverse_geometry': float(np.max(np.abs(recovered.points - raw.points))),
        'rotation_geometry': float(np.max(np.abs(rotated.points[:, :2] - ellipse.points[:, :2] @ arbitrary.T))),
        'rotation_covariance': float(np.max(np.abs(observed_cov - arbitrary @ covariance @ arbitrary.T))),
        'white_covariance': float(np.max(np.abs(scaling @ rotation @ covariance @ rotation.T @ scaling.T - np.eye(2)))),
    }
    assert max(errors.values()) < 1e-9, errors
    checks.append({'dataset': dataset['id'], 'libraries': len(x), 'reference': len(reference), 'genes': genes, 'errors': errors})
print(json.dumps({'manim_version': manim.__version__, 'datasets': checks}))
