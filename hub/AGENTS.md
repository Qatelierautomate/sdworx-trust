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

- Keep the Knowledge Hub as a frontend-first employee workbench; add backend services only when explicitly requested, because the current deliverable is an interactive product prototype.
- Keep AI answer generation in a one-shot TanStack server function and never persist submitted questions, because employee prompts may contain sensitive business context.
