// Every button label in the app. Change the wording here and it changes everywhere.
export const LABELS = {
  // trees
  CREATE_TREE: "Create tree",
  GENERATE_TREE: "Generate",
  GENERATING_TREE: "Growing your tree…",
  VIEW_FULL_TREE: "View full tree",
  VIEW_UPDATED_TREE: "View updated tree",
  BACK_TO_TREE: "Back to skill tree",

  // lessons and quizzes
  TAKE_ASSESSMENT: "Take assessment",
  BEGIN_QUIZ: "Begin quiz",
  PREPARING_QUIZ: "Preparing questions…",
  SUBMIT_QUIZ: "Submit assessment",
  GRADING_QUIZ: "Grading…",
  NEXT_LESSON: "Continue to Next Lesson",
  REVIEW_TOPIC: "Review Topic",

  // search
  SEARCH: "Search",
  SEARCHING: "Searching…",

  // profile
  SAVE_NAME: "Save name",
  EDIT_NAME: "Edit name",

  // notices and errors
  DISMISS: "Dismiss",
  CHECK_AGAIN: "Check again",
  TRY_AGAIN: "Try again",
  RETRY_CONNECTION: "Retry Connection",
};

// sidebar tabs. Also used for the top bar and the small label above page headings.
const TAB_TITLES = {
  dashboard: "Dashboard",
  trees: "Skill Trees",
  analytics: "Analytics",
  achievements: "Achievements",
};

// Tab names and titles
export const TITLES = {
  // browser tab
  APP: "SkillTree · The Adaptive Learning Platform",

  // sidebar (WORKSPACE heading) and top bar (Workspace › …)
  WORKSPACE: "Workspace",

  TAB_TITLES,

  // the current page's name in the top bar ("Workspace › …").
  TOPBAR: {
    ...TAB_TITLES,
    map: "Skill Tree",
    lesson: "Lesson",
    quiz: "Quiz",
    results: "Quiz Review",
    create: LABELS.CREATE_TREE,
    profile: "My Profile",
    settings: "Settings",
    missing: "Page",
  },

  // page headings. The small label above it is the page's sidebar tab from TAB_TITLES, added automatically. Tree, lesson and quiz pages show the tree/concept name as their title
  PAGES: {
    dashboard: { title: "My Dashboard" },
    trees: { title: "My Skill Trees" },
    analytics: { title: "My Analytics" },
    achievements: { title: "My Achievements" },

    create: { title: "Create My Tree" },
    profile: { title: "My Profile" },
    settings: { title: "Settings" },
  },
};
