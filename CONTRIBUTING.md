🤝 Contributing to WeebDex++ Enhanced

Thank you for your interest in contributing to WeebDex++ Enhanced!
Contributions are welcome, but please read the guidelines below carefully to ensure the project remains stable, respectful of upstream authors, and aligned with its purpose.

📌 Project Purpose

This repository is personal rework inspired patch sort of of the well known mangadex++ and import expoerter attributed and forked on my profile. 

Its goals are to:

Attempt to at least make weebdex.org a bit more friendly with the same local storage and import/export function with dom filteration for Ignore read and item read.

Share improvements publicly in good faith using a fork and your welcome to patch and change if youd like to push upstream please reach out to me Via a PR with proper documantion. 

This project is not an official fork and is not affiliated with MangaDex.

⚠️ Important Contribution Rules
1️⃣ Respect Upstream Authors

This project is derived or inspired by and refactor of :

https://github.com/Theo1996/mangadex-plus-plus-json-history-export-imporr

https://github.com/MangaDexPP/userscript

Any contributions must not:

Remove existing credits or attribution

Claim original ownership of upstream code

Introduce license conflicts

If upstream authors request changes or removal, those requests will be honored.

2️⃣ Scope of Contributions

✅ Accepted:

Bug fixes

Stability improvements

DOM selector hardening

Performance optimizations

UI consistency improvements

Defensive code and error handling

Documentation improvements

❌ Not Accepted:

Features that abuse WeebDex infrastructure

Scraping, automation, or API abuse

DRM circumvention

Monetization or ad injection

Anything that violates WeebDex oe Github Terms of Service

🧪 Development Guidelines
Userscript Constraints

Must work in Tampermonkey and Violentmonkey

No build steps or bundlers

No external dependencies

No API calls unless explicitly approved or Supported via Weebdex API for the intented purpse of the scripit 

Code Style

Vanilla JavaScript (ES6+)

Defensive DOM checks

Graceful failure on unsupported pages

Avoid hardcoded layout assumptions unless already present from main branch

Prefer MutationObserver over polling

🧠 Feature Philosophy

Before proposing a feature, ask:

Does this improve reading or browsing clarity?

Is it non-destructive?

Will it remain stable if weebDex changes layout?

Can it fail safely?

If the answer is “no” to any of the above, the feature may be rejected.

🐛 Reporting Bugs

Please include:

A clear description of the issue

Page URL(s) affected

Browser and userscript manager

Console errors (if any)

Screenshots or screen recordings if possible

Open an issue using the Bug Report template if available.

🚀 Submitting Pull Requests

Fork the repository

Create a feature or fix branch
feature/your-feature-name or fix/bug-description

Make small, focused commits

Ensure the script:

Does not duplicate controls

Does not break title pages

Does not hide content incorrectly

Open a Pull Request with:

Clear description

What changed and why

Screenshots (if UI-related)

Large or breaking changes should be discussed before submitting a PR.

🔒 Data Safety

Do not introduce telemetry

Do not collect personal data

All data must remain local (localStorage)

Export/import must remain optional and transparent

📜 License & Ownership

By contributing:

You agree your contributions may be distributed under the same terms as this repository

You acknowledge this project is a derivative work

You do not claim exclusive ownership of shared code

🙏 Credits & Acknowledgment

Contributors may be acknowledged in:

GitHub Releases

README credits section

Meaningful contributions will always be credited.
