from dag_structure import DAG

DEMO_DAG = DAG.model_validate({
    "nodes": [
        {"id": "vectors", "title": "Vectors", "description": "Magnitude, direction, and basic operations.", "objectives": ["Add and scale vectors"]},
        {"id": "dot", "title": "Dot Product", "description": "Measuring alignment between vectors.", "objectives": ["Compute a dot product"]},
        {"id": "matrices", "title": "Matrices", "description": "Matrix notation and multiplication.", "objectives": ["Multiply two matrices"]},
        {"id": "linsys", "title": "Linear Systems", "description": "Solving Ax = b.", "objectives": ["Use row reduction"]},
        {"id": "det", "title": "Determinants", "description": "Scaling factor of a transformation.", "objectives": ["Compute a 3x3 determinant"]},
        {"id": "inverse", "title": "Matrix Inverse", "description": "Undoing a transformation.", "objectives": ["Find an inverse"]},
        {"id": "eigen", "title": "Eigenvalues", "description": "Directions a matrix only stretches.", "objectives": ["Find eigenvalues"]},
    ],
    "edges": [
        {"parent_id": "vectors", "child_id": "dot"},
        {"parent_id": "vectors", "child_id": "matrices"},
        {"parent_id": "matrices", "child_id": "linsys"},
        {"parent_id": "matrices", "child_id": "det"},
        {"parent_id": "linsys", "child_id": "inverse"},
        {"parent_id": "det", "child_id": "inverse"},
        {"parent_id": "inverse", "child_id": "eigen"},
        {"parent_id": "dot", "child_id": "eigen"},
    ],
})