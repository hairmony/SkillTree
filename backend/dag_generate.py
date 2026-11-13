import re

from pydantic import BaseModel

import database
from dag_structure import DAG
from ollama import chat_json, embed


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


def build_prompt(topic: str, context: str, error: str | None = None) -> str:
    prompt = f"""You are designing a learning path for the topic: {topic}

Use only the reference material below.

Create 6 to 10 concepts, ordered from fundamentals to advanced. For each concept give:
- id: a short lowercase id with underscores and no spaces, like "dot_product"
- title: a short name
- description: one or two sentences
- objectives: 1 to 3 things a learner should be able to do
- prerequisites: ids of concepts that must be learned first. Use an empty list for starting concepts. A concept may only list concepts that appear EARLIER in your list.

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
    return DAG.model_validate({"nodes": nodes, "edges": edges})


def generate_dag(tree_id: str, topic: str, attempts: int = 3) -> DAG:
    query_embedding = embed([topic])[0]
    chunks = database.search_chunks(tree_id, query_embedding, k=6)
    if not chunks:
        raise ValueError("No reference text for this tree_id.")
    context = "\n\n".join(c["text"] for c in chunks)

    error = None
    for _ in range(attempts):
        raw = chat_json(build_prompt(topic, context, error), Draft.model_json_schema())
        try:
            return draft_to_dag(Draft.model_validate_json(raw))
        except ValueError as e:  # includes pydantic validation errors
            error = str(e)[:300]
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

The learner should be able to study this concept directly from your page, so cover it completely. Use ONLY the numbered passages below for facts. Write:
- details: a complete explanation for a beginner. Use as many paragraphs as the passages need to cover the concept properly: a simple concept may need only two, a rich one six or more. Cover definitions, how it works, key terms, and common mistakes where the passages mention them. Plain text only, no markdown symbols, with a blank line between paragraphs.
- examples: practice questions or problems, each one to three sentences. Include 2 or 3 only when a learner could actually try a question or problem for this concept, such as a calculation, a procedure, or an exercise. If the concept does not work that way, use an empty list. Do not write extra illustrations or repeat the explanation.
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
        f"[{i}] (source: {c['source']})\n{c['text']}" for i, c in enumerate(chunks, 1))
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