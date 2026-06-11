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

## When to deviate
- **Feature colocation:** for a large, self-contained domain, a `features/<domain>/` folder colocating its hook + components + schema can beat spreading across layers. This set defaults to layers (fewer conventions); reach for a feature folder only when a domain clearly earns it.
- **Trivial inline helpers:** a one-line, single-use transform inside a component isn't worth a module. Extract on the second use, or when it stops being obvious.
