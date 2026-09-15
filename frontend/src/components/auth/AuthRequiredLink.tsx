import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  useAuthPrompt,
  type AuthPromptIntent,
} from "../../context/AuthPromptContext";
import { useAuth } from "../../context/AuthContext";

interface AuthRequiredLinkProps {
  to: string;
  intent: AuthPromptIntent;
  children: ReactNode;
  className?: string;
  ariaCurrent?: "page";
  onNavigate?: () => void;
}

export function AuthRequiredLink({
  to,
  intent,
  children,
  className,
  ariaCurrent,
  onNavigate,
}: AuthRequiredLinkProps) {
  const { isAuthenticated } = useAuth();
  const { openAuthPrompt } = useAuthPrompt();

  if (isAuthenticated) {
    return (
      <Link
        to={to}
        onClick={onNavigate}
        aria-current={ariaCurrent}
        className={className}
      >
        {children}
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={(event) => {
        openAuthPrompt(intent, event.currentTarget);
        onNavigate?.();
      }}
      aria-current={ariaCurrent}
      className={className}
    >
      {children}
    </button>
  );
}
