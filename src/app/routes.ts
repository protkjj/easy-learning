import { createBrowserRouter } from "react-router";
import { Home } from "./pages/home";
import { SubjectSelection } from "./pages/subject-selection";
import { Recording } from "./pages/recording";
import { Notes } from "./pages/notes";
import { Quiz } from "./pages/quiz";
import { WrongAnswers } from "./pages/wrong-answers";
import { Dashboard } from "./pages/dashboard";

export const router = createBrowserRouter(
  [
    { path: "/", Component: Home },
    { path: "/subjects/:category", Component: SubjectSelection },
    { path: "/recording", Component: Recording },
    { path: "/notes", Component: Notes },
    { path: "/quiz", Component: Quiz },
    { path: "/wrong-answers", Component: WrongAnswers },
    { path: "/dashboard", Component: Dashboard },
  ],
  { basename: "/easy-learning" }
);
