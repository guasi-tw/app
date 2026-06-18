import { googleSignInAction } from "./account-actions";

// A CTA that starts Google OAuth directly (no /login hop). Auth.js sign-in must be a POST, so this
// is a <form> + submit button; pass the visual `className` that matches the surrounding context.
export function GoogleSignInButton({
  label,
  className,
}: {
  label: string;
  className?: string;
}) {
  return (
    <form action={googleSignInAction}>
      <button type="submit" className={className}>
        {label}
      </button>
    </form>
  );
}
