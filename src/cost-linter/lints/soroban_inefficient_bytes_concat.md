# `soroban_inefficient_bytes_concat`

**Default Severity:** `warn`

## What it does

Detects Bytes concatenation operations (`push_back` and `append`) that are executed inside loop bodies (`for`, `while`, or `loop`).

## Why is this bad?

::: danger
Every `push_back` and `append` call on `Bytes` crosses the Soroban host boundary. Placing these operations inside a loop results in repeated host function calls, drastically increasing CPU instruction costs and transaction fees.
:::

## Example

```rust
// ❌ Bad: one host call per iteration
let mut bytes = Bytes::new(env);
for i in 0..items.len() {
    bytes.push_back(items[i]); // host call each iteration!
}
```

## Suggested Fix

::: tip
Accumulate bytes in a Rust `Vec&lt;u8&gt; during the loop, then convert to `Bytes` once outside the loop via `Bytes::from_slice`.
:::

```rust
// ✅ Good: build in memory, convert once
let mut v: Vec<u8> = Vec::new();
for i in 0..items.len() {
    v.push(items[i]); // cheap Rust operation
}
let bytes = Bytes::from_slice(&env, &v); // single host call
```

## Scope

- Detects `push_back` and `append` method calls on `soroban_sdk::Bytes`.
- Fires when the call is inside any loop body (`for`, `while`, `loop`).
- Does not fire on `Vec&lt;u8&gt; operations — only Soroban `Bytes`.
- The `#[allow(soroban_inefficient_bytes_concat)]` attribute can suppress the lint.

## Relationship to other lints

Note that this lint (`soroban_inefficient_bytes_concat`) specifically flags the `.push_back()` and `.append()` method calls. A related lint, `inefficient_bytes_concat`, flags the binary `+` operator (`b1 + b2`). They detect genuinely different code shapes, but both enforce the same best practice: accumulate bytes in a `Vec&lt;u8&gt; instead of using host objects in a loop.
