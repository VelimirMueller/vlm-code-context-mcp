# Atomic Design

Reference for `set-up-frontend-structure`. Adapted from Brad Frost's atomic-design methodology, with project-specific rulings on edge cases.

## Why atomic design

A flat `components/` folder grows past readability around 30 components. Atomic design imposes a hierarchy that scales with the codebase and matches how designers think: small reusable pieces compose into larger, more situational pieces.

Five layers, each with a strict criterion. The criterion is what makes the methodology useful — without it, atomic design collapses into "just folders."

## Rule: an atom has one concept and zero internal composition
**Why:** Atoms are the building blocks. If they compose other components, you've introduced a coupling that defeats the methodology.
**How to apply:**
- A `Button` (with optional icon prop accepting an Icon atom) is an atom.
- A `Button` that internally renders a `Spinner` molecule is an organism (or a refactor target).

```tsx
// good: atom takes content as children
<Button>Save</Button>

// bad: atom internally composes higher layers
<Button isLoading /> // internally renders <LoadingDots />
```

## Rule: a molecule does one thing and composes 2–4 atoms
**Why:** "One thing" keeps molecules focused. The 2–4 ceiling is heuristic — past 4, you're probably reaching organism territory.
**How to apply:**
- `SearchInput` (Input + Button) — one job: search input.
- `FormField` (Label + Input + ErrorMessage) — one job: a single labeled, error-aware input.

```tsx
// good
<SearchInput onSubmit={search} />

// bad: molecule with 7 atoms — likely an organism
<UserCard avatar="..." name="..." badge="..." actions={...} bio="..." />
```

## Rule: an organism is a recognizable region of UI
**Why:** Pointed-at-and-named is the test. "The header." "The product card." "The login form."
**How to apply:** Don't pre-extract organisms speculatively. Wait until two pages need the same region.

## Rule: a template arranges organisms; it doesn't fetch data
**Why:** Data fetching couples the layout to a specific feature. Templates are layout machines.
**How to apply:** Templates accept slots/children. Pages do the data fetching and pass content into templates.

```tsx
// good
<AuthLayout sidebar={<Login />} />

// bad
function AuthLayout() {
  const user = useQuery(...); // template should not fetch
  return ...;
}
```

## Rule: a page binds to a route and supplies data
**Why:** Pages are the "container" layer. Routing + data are page concerns.
**How to apply:** A page renders a template + organisms with real data. The page file lives at `src/components/pages/<PageName>/`.

## Anti-pattern: classifying by visual size
**Why:** "It looks small, must be an atom" — ignores composition. A small visual element that internally renders a molecule is still an organism.
**How to apply:** Classify by composition + responsibility, not pixels.

## Anti-pattern: deep folder hierarchies inside a layer
**Why:** `atoms/forms/inputs/text/Button` defeats the flat-within-layer principle. Atoms should be findable in one glance.
**How to apply:** Keep each layer flat. If a layer has 30+ items and you want subfolders, that's a sign some items belong in a higher layer.

## Anti-pattern: atoms that import from molecules/organisms
**Why:** Reverse-direction imports break the layer model and create cycles.
**How to apply:** Atoms import only from `_shared/`, `utils/`, third-party libs, or design tokens. Molecules import from atoms. Organisms from molecules + atoms. Templates from organisms + molecules + atoms. Pages from anywhere lower.

## When to deviate

- **Single-feature codebases:** for projects with < 20 components total, atomic design is overkill. A flat `src/components/` may serve. These skills create the structure regardless because the project will likely grow; if you know it won't, skip skill `set-up-frontend-structure`.
- **Design system mismatch:** if the design system uses different layer terminology (e.g., "primitives / patterns / templates"), align with the design-system terms instead of forcing atomic-design vocabulary.

## Layer summary table

| Layer | Composition | Test | Imports from |
|---|---|---|---|
| Atom | None internal | One concept, no composed components | shared, utils, tokens |
| Molecule | 2–4 atoms | One job, < 5 atoms | atoms |
| Organism | molecules + atoms | Recognizable region | molecules, atoms |
| Template | organisms + molecules + atoms | Arranges, doesn't fetch | organisms, molecules, atoms |
| Page | anything below | Route-bound, fetches data | anything below |
