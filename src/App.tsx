import UnpauseIntakeForm from "./unpause/UnpauseIntakeForm";
import UnpauseReview from "./unpause/UnpauseReview";

export default function App() {
  const path = window.location.pathname;

  if (path === "/review") return <UnpauseReview />;
  return <UnpauseIntakeForm />;
}
