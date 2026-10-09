# Module Patterns

Reference for `create-module`. How to keep logic out of the UI and in well-bounded modules.

## Rule: UI renders, modules decide
**Why:** Logic inside a component can't be reused, can't be unit-tested without rendering, and re-runs on every render. A component should read as a description of its output for a given state.
**How to apply:** Components call a hook/util/lib and render the result. Move any derivation, formatting, IO, or non-trivial effect into a module.

**Anti-example:**
```tsx
// bad: derivation + effect trapped in the component
function Summary() {
  const { data = [] } = useTodos({ status: 'all' });
  const open = data.filter((t) => !t.done);                 // → utils/
  useEffect(() => { document.title = `${open.length}`; });  // → a hook
  return <p>{open.length}</p>;
}
```

## Rule: the layer is decided by nature, not by feeling
**Why:** "I'll just put it here" is how `utils/` becomes a junk drawer and components grow brains.
**How to apply:** pure + deterministic → `utils/`; wraps a third-party or does IO → `libs/`; stateful/lifecycle → hook/composable; shared client state → store; renders → atomic component.

## Rule: a module exposes a typed surface; callers never reach past it
**Why:** A module's internals are private. Import its helper files directly and you can't refactor the inside without breaking callers.
**How to apply:** Export a small named surface with explicit types from the module's main file; callers import that module by its path (`@/utils/openTodos`), never its private internals.

## Rule: utils are pure by default
**Why:** Purity makes them tree-shakeable and testable with zero setup — the whole reason to extract.
**How to apply:** No IO, no module-level mutable state, same input → same output. Need a dependency or a side effect? It's a `lib`, not a `util`.

## Rule: one module, one responsibility; file name = export
**Why:** Predictable navigation; a file that does two things is two files.

## Rule: group by domain first, then by layer
**Why:** Layers answer "what kind of code is this"; domains answer "what changes together". With one domain the layers suffice. With several, a domain spread over `hooks/`, `stores/`, `components/organisms/` and `libs/` is invisible as a unit and easy to couple by accident.
**How to apply:** From the second domain on, `src/features/<domain>/` holds that domain's `api/`, `hooks|composables/`, `components/`, `stores/`, `schemas/`, behind `index.ts`. The layer rules above apply unchanged inside. A feature never imports another feature's internals — only its `index.ts`; two features that need each other's internals are one feature or share a root module.

## When to deviate
- **One-domain app:** keep the root layers; don't create `features/` for a single domain.
- **Trivial inline helpers:** a one-line, single-use transform inside a component isn't worth a module. Extract on the second use, or when it stops being obvious.
- **Prototype or a three-screen app:** the five-row routing table is for code that will be read by others. A hook used by one component can sit beside it until a second caller appears; move it then.
- **Pure-view logic in a design-system component** (focus handling, roving tabindex): keep it inside the component's folder; it is the component's behaviour, not app logic.
