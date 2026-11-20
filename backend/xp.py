import math

import database

# ---- XP earned
XP_QUIZ = 50
XP_QUESTION = 10
# Bonuses, turned off for now:
# XP_QUIZ_PERFECT = 25 # got every answer correct in quiz
# XP_TREE = 200 # complete a tree all the way through

XP_LEVEL_START = 200
XP_LEVEL_RAMP = 1.15
XP_LEVEL_ROUND = 50


def level_goal(levels_done: int) -> int:
    """XP needed to finish the next level, given how many levels are done already."""
    goal = max(math.ceil(XP_LEVEL_START + math.log(levels_done + 1)
                         * (XP_LEVEL_START * XP_LEVEL_RAMP)), 1)
    return max(math.floor(goal / XP_LEVEL_ROUND + 0.5) * XP_LEVEL_ROUND, XP_LEVEL_ROUND)


def total_xp() -> int:
    with database.connect() as conn:
        quizzes = conn.execute(
            "SELECT COUNT(*) FROM quizzes WHERE user_id = ? AND submitted_at IS NOT NULL",
            (database.USER_ID,),
        ).fetchone()[0]
        correct = conn.execute(
            "SELECT COUNT(*) FROM quiz_attempts WHERE user_id = ? AND correct = 1",
            (database.USER_ID,),
        ).fetchone()[0]
    return (quizzes * XP_QUIZ + correct * XP_QUESTION)
            # + perfect * XP_QUIZ_PERFECT + trees_done * XP_TREE)


def get_xp() -> dict:
    total = total_xp()
    xp, levels_done = total, 0
    goal = level_goal(levels_done)
    while xp >= goal:
        xp -= goal
        levels_done += 1
        goal = level_goal(levels_done)
    return {
        "xp": total,
        "level": levels_done + 1, # starts at level 1
        "xp_current": xp, # XP earned in the current level
        "xp_max": goal, # max XP the current level
    }
