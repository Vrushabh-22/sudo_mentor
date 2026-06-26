## Plan

1. **Fix the OAuth redirect construction**
   - Update Google sign-in to use the current app origin explicitly and include the candidate auth route/redirect parameter instead of only `/`.
   - Store the intended post-login route before starting OAuth so the callback can reliably continue to the portal.

2. **Handle OAuth callback on this app**
   - Ensure `/auth` detects a successful OAuth session after Google returns.
   - If the user is authenticated, resolve the candidate profile and navigate to `/`.
   - If tenant selection is needed, show the existing tenant picker instead of bouncing out.

3. **Remove provider mismatch risk**
   - Keep Google as `provider: "google"`.
   - Leave LinkedIn/GitHub buttons untouched unless they are also reported broken.

4. **Validate the outgoing Google URL**
   - Use the preview/published app URL to confirm the generated OAuth request contains `redirect_to=https://sudo-mentor.lovable.app/auth?redirect=/` or the current preview equivalent.
   - Confirm it no longer omits/loses the redirect in a way that can fall back to `alpharecrewt.ai`.

## Technical note

The URL you pasted shows Google is receiving a nested `redirect_to=https://sudo-mentor.lovable.app/`, which means the app is trying to pass the correct destination. Since the final hop still goes to `alpharecrewt.ai`, I’ll make the callback target more explicit and persistent on our side so Supabase has a valid, exact redirect target for this standalone candidate portal.