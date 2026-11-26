<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Keep password sign-in and administrative-role resolution in the browser-safe login helper so access failures can be tested independently of the form.
- Initial staff provisioning requires an authenticated staff caller; never expose privileged account creation as an anonymous server function.
- Routing-rule reads expose only active guidance to authenticated requesters; inactive rules and SLA settings remain staff-only so the assistant works without exposing administrative configuration.
- Share attachment validation and saving across creation and detail views so upload failures never appear successful.
- Use readData for database reads so permission and network failures are not presented as empty results.
- Account mutations authorize both the caller and protected target through ensureStaff; role replacement is atomic to avoid losing access on failure.
