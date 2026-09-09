# Data Models & Trace Events

> Internal structures, event schemas, and tree representations.

---

## 1. Event Types (`EventType`)

Defines the life-cycle of WASM and host execution steps:

```rust
pub enum EventType {
    /// Entry into a WASM or host function
    Call,
    /// Exit from a WASM or host function
    Return,
    /// Measured block of CPU instructions or memory
    Step,
}
```

---

## 2. Trace Event (`TraceEvent`)

Emitted by the execution tracer and pushed to the aggregator:

```rust
pub struct TraceEvent {
    /// WASM Program Counter (Instruction Pointer offset)
    pub pc: usize,
    /// Type of execution event
    pub event_type: EventType,
    /// CPU instructions metered since the previous event
    pub cpu_cost: u64,
    /// Memory bytes allocated since the previous event
    pub mem_cost: u64,
}
```

---

## 3. Source Frame (`SourceFrame`)

Represents the human-readable code location after resolving DWARF symbols:

```rust
pub struct SourceFrame {
    /// Demangled Rust function or closure name
    pub function_name: String,
    /// Relative or absolute path to the Rust source file
    pub file_path: Option<String>,
    /// 1-based source code line number
    pub line_number: Option<u32>,
}
```

If DWARF debug symbols are unavailable or stripped, `file_path` and `line_number` default to `None`, and `function_name` displays the WASM export name or index.

---

## 4. Call Stack Node (`CallStackNode`)

The recursive tree structure representing the full execution hierarchy:

```rust
pub struct CallStackNode {
    /// Resolved source location for this frame
    pub frame: SourceFrame,
    /// CPU instructions executed directly by this frame
    pub exclusive_cpu: u64,
    /// Total CPU instructions for this frame + all descendants
    pub inclusive_cpu: u64,
    /// Memory bytes allocated directly by this frame
    pub exclusive_mem: u64,
    /// Total memory bytes allocated by this frame + all descendants
    pub inclusive_mem: u64,
    /// Nested child functions invoked by this frame
    pub children: HashMap<String, CallStackNode>,
}
```

---

## Serialization Schema (JSON Output)

When `--format json` is specified, the tree serializes into a standard JSON payload:

```json
{
  "frame": {
    "function_name": "my_contract::process_payment",
    "file_path": "src/lib.rs",
    "line_number": 64
  },
  "exclusive_cpu": 12400,
  "inclusive_cpu": 345000,
  "exclusive_mem": 256,
  "inclusive_mem": 8192,
  "children": {
    "my_contract::verify_sig": {
      "frame": {
        "function_name": "my_contract::verify_sig",
        "file_path": "src/crypto.rs",
        "line_number": 18
      },
      "exclusive_cpu": 320000,
      "inclusive_cpu": 320000,
      "exclusive_mem": 4096,
      "inclusive_mem": 4096,
      "children": {}
    }
  }
}
```

