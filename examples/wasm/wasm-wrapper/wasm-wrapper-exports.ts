

type SomeFunction = () => void

export type DefaultWasmExports_Emscripten = {
    /* Functions */
    _emscripten_stack_restore: SomeFunction
    _emscripten_stack_alloc: SomeFunction
    emscripten_stack_get_current: SomeFunction
}

export type DefaultWasmExports = {
    /* Values */
    memory: WebAssembly.Memory

    /* Tables */
    __indirect_function_table: WebAssembly.Table
}

/** This is a usable type, but mostly it serves as a reference for what would be the type of all exports together */
export type DefaultWasmExports_FULL =
& DefaultWasmExports
& DefaultWasmExports_Emscripten