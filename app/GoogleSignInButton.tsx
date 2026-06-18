import { googleSignInAction } from "./account-actions";

// Official "Sign in with Google" button, per Google's branding guidelines
// (https://developers.google.com/identity/branding-guidelines): the standard multicolor "G" logo on
// an approved light button, with approved text. Google's official zh-TW string for "Sign in with
// Google" is 「使用 Google 帳戶登入」 (it also covers first-time users — Google creates the account on
// first sign-in). Kept as the single source of truth so the compliant logo + style + text can't
// drift into a custom button. `block` → full-width page CTA; default → inline (header).
function GoogleG() {
  return (
    <svg className="gsi-logo" width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path fill="#4285F4" d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z" />
      <path fill="#FBBC05" d="M3.964 10.71c-.18-.54-.282-1.117-.282-1.71s.102-1.17.282-1.71V4.958H.957C.347 6.173 0 7.548 0 9s.348 2.827.957 4.042l3.007-2.332z" />
      <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" />
    </svg>
  );
}

export function GoogleSignInButton({ block = false }: { block?: boolean }) {
  return (
    <form action={googleSignInAction} className={block ? "gsi-form block" : "gsi-form"}>
      <button type="submit" className={block ? "gsi-button block" : "gsi-button"}>
        <GoogleG />
        <span className="gsi-text">使用 Google 帳戶登入</span>
      </button>
    </form>
  );
}
