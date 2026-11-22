import re

from pydantic import BaseModel

import database
from dag_structure import DAG, parents_of
from ollama_client import chat_json, embed


class DraftNode(BaseModel):
    id: str
    title: str
    description: str
    objectives: list[str]
    prerequisites: list[str]


class Draft(BaseModel):
    nodes: list[DraftNode]


def slug(text: str) -> str:
    return re.sub(r"[^a-z0-9_]+", "_", text.lower()).strip("_")


def build_prompt(topic: str, context: str, error: str | None = None,
                 description: str = "") -> str:
    goal = f"\nWhat the learner wants from it: {description}\nShape the path around this.\n" \
        if description else ""
    prompt = f"""You are designing a learning path for the topic: {topic}
{goal}
Use only the reference material below.

Create 6 to 10 concepts and organize them as a skill tree that branches, not as a single list:
- The FIRST concept is the root: "{topic} basics". It covers what {topic} is and the essential definitions and key terms a beginner needs before anything else. Its objectives are about knowing those terms. It has no prerequisites.
- Every other concept builds on the root, directly or through other concepts.
- A concept's prerequisites are ONLY the concepts that are truly required to understand it. Do not list a concept just because it comes earlier.
- Concepts that do not need each other must not be prerequisites of each other. Give them the same prerequisite instead, so the tree branches.
- Aim for 2 to 4 branches, and keep the longest chain of prerequisites short.
- List every concept after all of its prerequisites.

For each concept give:
- id: a short lowercase id with underscores and no spaces, like "dot_product"
- title: a short name
- description: one or two sentences
- objectives: 1 to 3 things a learner should be able to do
- prerequisites: ids of the concepts that must be learned first (an empty list only for the root). Only use ids of concepts listed EARLIER.

Reference material:
{context}
"""
    if error:
        prompt += f"\nYour previous answer was rejected: {error}\nFix the problem and try again.\n"
    return prompt


def draft_to_dag(draft: Draft) -> DAG:
    nodes, edges, earlier = [], [], set()
    for n in draft.nodes:
        nid = slug(n.id) or slug(n.title)
        if not nid or nid in earlier:
            continue
        for p in dict.fromkeys(slug(x) for x in n.prerequisites):
            if p in earlier:  # only earlier nodes, so cycles can't happen
                edges.append({"parent_id": p, "child_id": nid})
        nodes.append({"id": nid, "title": n.title,
                      "description": n.description, "objectives": n.objectives})
        earlier.add(nid)
    if len(nodes) < 3:
        raise ValueError("Not enough usable concepts.")
    # Mandatory root: the first concept (the basics, definitions and key terms). Anything
    # else the model left without prerequisites hangs off it, so there is exactly one root.
    root = nodes[0]["id"]
    edges = [e for e in edges if e["child_id"] != root]
    has_parent = {e["child_id"] for e in edges}
    edges += [{"parent_id": root, "child_id": n["id"]} for n in nodes[1:]
              if n["id"] not in has_parent]

    # Drop redundant edges (like its making A-C edge when A-B-C alreaady exists, yk?)
    def reaches(start, target, skip):
        stack = [e["child_id"] for e in edges if e["parent_id"] == start and e is not skip]
        seen = set()
        while stack:
            x = stack.pop()
            if x == target:
                return True
            if x not in seen:
                seen.add(x)
                stack += [e["child_id"] for e in edges if e["parent_id"] == x]
        return False
    edges = [e for e in edges if not reaches(e["parent_id"], e["child_id"], e)]
    return DAG.model_validate({"nodes": nodes, "edges": edges})


MAX_PATH_SHARE = 0.75     # a graph whose longest chain holds more than this share of
                          # its concepts is too linear and gets sent back (the demo tree,
                          # a reasonable branching tree, is 5 of 7 = 0.71)
CONTEXT_CHUNKS = 10
MAX_CHUNKS_PER_SOURCE = 2


def shape_problem(dag: DAG) -> tuple[float, str | None]:
    """How linear the graph is: (share of concepts on the longest chain, feedback for
    the model if that's too linear, else None)."""
    parents = parents_of(dag)
    depth: dict[str, int] = {}      # concepts on the longest chain ending here
    best_parent: dict[str, str | None] = {}
    for n in dag.nodes:             # parents always come first (see draft_to_dag)
        ps = parents[n.id]
        top = max(ps, key=lambda p: depth[p]) if ps else None
        depth[n.id] = depth[top] + 1 if top else 1
        best_parent[n.id] = top
    end = max(depth, key=depth.get)
    chain = []
    while end:
        chain.append(end)
        end = best_parent[end]
    chain.reverse()

    # The mandatory root sits at the top of every chain, so leave it out of the measure.
    below_root = len(dag.nodes) - 1
    share = (len(chain) - 1) / below_root if below_root else 1.0
    widest = max(list(depth.values()).count(d) for d in set(depth.values()))
    if widest > 1 and share <= MAX_PATH_SHARE:
        return share, None
    titles = {n.id: n.title for n in dag.nodes}
    return share, (
        f"The graph is too linear: {len(chain) - 1} of the {below_root} concepts after the "
        f"root form one chain "
        f"({' -> '.join(titles[c] for c in chain)}). Many of these do not need the previous "
        "one. Give concepts that are independent of each other the same prerequisite instead "
        "of chaining them, so the tree has 2 to 4 branches."
    )


def diverse_chunks(tree_id: str, query_embedding: list[float]) -> list[dict]:
    """The closest chunks to the topic, but at most MAX_CHUNKS_PER_SOURCE from any one
    source, so the model sees the different parts of the topic, not one source's intro."""
    picked, per_source = [], {}
    for c in database.search_chunks(tree_id, query_embedding, k=CONTEXT_CHUNKS * 6):
        key = c.get("url") or c["source"]
        if per_source.get(key, 0) < MAX_CHUNKS_PER_SOURCE:
            per_source[key] = per_source.get(key, 0) + 1
            picked.append(c)
            if len(picked) == CONTEXT_CHUNKS:
                break
    return picked


def generate_dag(tree_id: str, topic: str, attempts: int = 3, description: str = "") -> DAG:
    query_embedding = embed([f"{topic}. {description}" if description else topic])[0]
    chunks = diverse_chunks(tree_id, query_embedding)
    if not chunks:
        raise ValueError("No reference text for this tree_id.")
    context = "\n\n".join(c["text"] for c in chunks)

    error, best = None, None   # best: (linearity share, dag) of the least linear valid graph
    for _ in range(attempts):
        raw = chat_json(build_prompt(topic, context, error, description),
                        Draft.model_json_schema())
        try:
            dag = draft_to_dag(Draft.model_validate_json(raw))
        except ValueError as e:  # includes pydantic validation errors
            error = str(e)[:300]
            continue
        share, problem = shape_problem(dag)
        if problem is None:
            return dag
        if best is None or share < best[0]:
            best = (share, dag)
        error = problem
    if best is not None:  # every try came out linear: use the most branched one
        return best[1]
    raise ValueError(f"Could not produce a valid graph after {attempts} tries: {error}")

class NodeContent(BaseModel):
    details: str
    examples: list[str]
    citations: list[int]


def build_content_prompt(course: str, title: str, summary: str,
                         passages: str, error: str | None = None) -> str:
    prompt = f"""You are writing a study page for one concept in a course on: {course}

Concept: {title}
Summary: {summary}

Write a brief summary page. The learner gets the key ideas here and follows the linked sources for more depth. Use ONLY the numbered passages below for facts. Write:
- details: a brief summary for a beginner in 2 or 3 short paragraphs: what the concept is, how it works, and the key terms. Plain text only, no markdown symbols, with a blank line between paragraphs.
- examples: 2 or 3 concrete, worked examples that show the concept in use, each two to four sentences. Each example states a specific case and walks through it to the result, for example a calculation shown step by step, a procedure applied to real values, or a specific instance of the idea explained. Write them as statements, never as questions or exercises for the learner, and always include the answer or outcome. Do not repeat the explanation in general terms.
- citations: the numbers of the passages you used for facts, for example [1, 3]

Do not invent facts the passages don't support. Only provide information that the source agrees with.

Passages:
{passages}
"""
    if error:
        prompt += f"\nYour previous answer was rejected: {error}\nFix this and try again.\n"
    return prompt


def generate_node_content(tree_id: str, node_id: str, attempts: int = 2) -> None:
    dag = database.get_dag(tree_id)
    node = next((n for n in dag.nodes if n.id == node_id), None) if dag else None
    if node is None:
        raise ValueError("node not found")

    chunks = database.search_chunks(tree_id, embed([f"{node.title}. {node.description}"])[0], k=6)
    if not chunks:
        raise ValueError("No reference text found for this tree.")
    passages = "\n\n".join(
        f"[{i}] (source: {c.get('title') or c['source']})\n{c['text']}"
        for i, c in enumerate(chunks, 1))
    course = database.get_tree_title(tree_id) or tree_id

    result, error = None, None
    for _ in range(attempts):
        raw = chat_json(
            build_content_prompt(course, node.title, node.description, passages, error),
            NodeContent.model_json_schema(),
        )
        try:
            parsed = NodeContent.model_validate_json(raw)
        except ValueError as e:
            error = str(e)[:300]
            continue
        valid = [n for n in dict.fromkeys(parsed.citations) if 1 <= n <= len(chunks)]
        result = (parsed, valid)
        if valid and parsed.details.strip():
            break
        error = "Write the details and cite at least one passage using the numbers shown."
    if result is None:
        raise ValueError(f"Could not write the page: {error}")

    parsed, valid = result
    database.save_node_content(
        tree_id, node_id, parsed.details.strip(),
        [x.strip() for x in parsed.examples if x.strip()],
        [chunks[n - 1]["id"] for n in valid],
        [c["id"] for c in chunks],
    )

class GapNode(BaseModel):
    title: str
    description: str
    objectives: list[str]
    covers: list[int]  # numbers of the missed questions this concept addresses


class GapDraft(BaseModel):
    nodes: list[GapNode]


def build_gap_prompt(course: str, node_title: str, missed: str, passages: str,
                     required: bool, max_nodes: int, error: str | None = None) -> str:
    if required:
        task = ("Write exactly 1 review concept that covers ALL the missed ideas below, so "
                "the learner can relearn them before moving on.")
    else:
        task = (f"Write 1 to {max_nodes} short follow-up concepts, one per missed idea "
                "(combine missed questions that test the same idea).")
    prompt = f"""A learner in a course on {course} just took a quiz on the concept "{node_title}" and got these questions wrong:

{missed}

{task} For each concept give:
- title: a short name for the idea (not "Review of ..." and not the same as "{node_title}")
- description: one or two sentences on what the learner needs to understand
- objectives: 1 to 3 things the learner should be able to do afterwards
- covers: the numbers of the missed questions it addresses, for example [1, 3]

Use ONLY ideas the reference text below supports.

Reference text:
{passages}
"""
    if error:
        prompt += f"\nYour previous answer was rejected: {error}\nFix this and try again.\n"
    return prompt


def generate_gap_nodes(tree_id: str, node, missed: list[dict], required: bool,
                       max_nodes: int = 3, attempts: int = 2) -> list[dict]:
    """Concepts that cover what the learner missed in a quiz on `node`.

    missed: [{"question", "concept", "chosen", "correct"}]. Returns
    [{"title", "description", "objectives"}] (exactly 1 when required).
    """
    query = "; ".join(m["concept"] or m["question"] for m in missed)
    chunks = database.search_chunks(tree_id, embed([query])[0], k=5)
    if not chunks:
        raise ValueError("No reference text found for this tree.")
    passages = "\n\n".join(c["text"] for c in chunks)
    missed_text = "\n".join(
        f"{i}. {m['question']}\n   Idea tested: {m['concept'] or 'not given'}\n"
        f"   Learner answered: {m['chosen']}\n   Correct answer: {m['correct']}"
        for i, m in enumerate(missed, 1))
    course = database.get_tree_title(tree_id) or tree_id

    error = None
    for _ in range(attempts):
        raw = chat_json(build_gap_prompt(course, node.title, missed_text, passages,
                                         required, max_nodes, error),
                        GapDraft.model_json_schema())
        try:
            draft = GapDraft.model_validate_json(raw)
        except ValueError as e:
            error = str(e)[:300]
            continue
        nodes = [{"title": g.title.strip(), "description": g.description.strip(),
                  "objectives": [o.strip() for o in g.objectives if o.strip()]}
                 for g in draft.nodes if g.title.strip() and g.description.strip()]
        if nodes:
            return nodes[:1] if required else nodes[:max_nodes]
        error = "Give at least one concept with a title and description."
    raise ValueError(f"Could not write follow-up concepts: {error}")
