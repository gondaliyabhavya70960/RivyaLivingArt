/**
 * The Studio route group's ground.
 *
 * WHY IT EXISTS. The root layout paints `rv-scheme-deep`, which is right for the public site and
 * wrong here: until this file, the login page rendered dark because nothing between it and the root
 * said otherwise. Every Studio surface uses semantic tokens only, so setting the scheme once, at the
 * group boundary, is the entire change — no component knew which ground it was on, and none has to.
 *
 * IT DOES NOT AUTHORISE, AND MUST NOT. `/studio/login` lives inside this group, so a permission
 * check here would gate the sign-in page behind being signed in — a redirect loop that presents as
 * "my password is wrong". The authenticated shell is one level down, in the `(shell)` route group,
 * which login is deliberately not a member of.
 */
export default function StudioGroupLayout({ children }: { children: React.ReactNode }) {
  return <div className="rv-scheme-bone min-h-screen">{children}</div>
}
