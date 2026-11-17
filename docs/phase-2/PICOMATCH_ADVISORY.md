# Residual dependency advisory — picomatch (tracked)

**Advisory:** [GHSA-fc5q-39xc-vjpf](https://github.com/advisories/GHSA-fc5q-39xc-vjpf) — ReDoS via single-branch repeated extglobs  
**Severity:** high  
**Package:** `picomatch` (transitive; appears via eslint / vite / vitest tooling)  
**Upstream fix:** none published as of November 17, 2026 (all versions through 4.0.7 affected)  
**CI posture:** production tree must pass `npm audit --omit=dev --audit-level=high`; full tree must pass `npm audit --audit-level=critical`. Do **not** claim the full dependency tree is high-clean. Do **not** use `npm audit fix --force` blindly.  
**Action:** Recheck for a patched `picomatch` release on each Slice PR; upgrade when available.
