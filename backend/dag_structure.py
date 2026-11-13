from collections import defaultdict, deque
from pydantic import BaseModel, model_validator


class Node(BaseModel):
    id: str
    title: str
    description: str
    objectives: list[str] = []


class Edge(BaseModel):
    parent_id: str
    child_id: str


class DAG(BaseModel):
    nodes: list[Node]
    edges: list[Edge]

    @model_validator(mode="after")
    def check_graph(self):
        ids = [n.id for n in self.nodes]
        if len(ids) != len(set(ids)):
            raise ValueError("duplicate node ids")
        known = set(ids)
        for e in self.edges:
            if e.parent_id not in known or e.child_id not in known:
                raise ValueError(f"edge references unknown node: {e}")
            if e.parent_id == e.child_id:
                raise ValueError(f"self-loop on {e.parent_id}")

        # cycle detection (Kahn's algorithm)
        indegree = {i: 0 for i in ids}
        children = defaultdict(list)
        for e in self.edges:
            indegree[e.child_id] += 1
            children[e.parent_id].append(e.child_id)
        queue = deque(i for i, d in indegree.items() if d == 0)
        seen = 0
        while queue:
            n = queue.popleft()
            seen += 1
            for c in children[n]:
                indegree[c] -= 1
                if indegree[c] == 0:
                    queue.append(c)
        if seen != len(ids):
            raise ValueError("graph contains a cycle")
        return self


def parents_of(dag: DAG) -> dict[str, list[str]]:
    result = {n.id: [] for n in dag.nodes}
    for e in dag.edges:
        result[e.child_id].append(e.parent_id)
    return result


def compute_status(dag: DAG, mastered: set[str]) -> dict[str, str]:
    parents = parents_of(dag)
    status = {}
    for n in dag.nodes:
        if n.id in mastered:
            status[n.id] = "mastered"
        elif all(p in mastered for p in parents[n.id]):
            status[n.id] = "unlocked"
        else:
            status[n.id] = "locked"
    return status