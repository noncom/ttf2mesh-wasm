import { createWasmImportsTable_Emscripten, DefaultWasmImports_Funcs_Emscripten } from "./wasm-wrapper-imports-emscripten.js"
import { WasmModuleWrapper_InstantiationParams } from "./wasm-wrapper-instance.js"
import { WasmModuleWrapper } from "./wasm-wrapper.js"

/**
 * These functions are basic Wasm->JS communication
 */
export type DefaultWasmImports_Funcs = {

    /* For logging into JS from Wasm */
    jsLog: (pointer: number, length: number) => void

    /* For calling an abort on the JS side from Wasm */
    _abort_js: () => void

    /* For calling from the */
    ___abort_from_js: (message: string) => void // TODO: This probably should be taken out into some common area, together with abort_js_impl()
}

/** This is a usable type, but mostly it serves as a reference for what would be the type of all exports together */
export type DefaultWasmImports_FULL =
& DefaultWasmImports_Funcs
& DefaultWasmImports_Funcs_Emscripten

export type DefaultWasmImports_FuncsTable = WebAssembly.Imports & {
    env: DefaultWasmImports_Funcs,
    wasi_snapshot_preview1: DefaultWasmImports_Funcs
}

export type DefaultWasmImports_State = {
    exitStatus: number
    isAbort: boolean
    noExitRuntime: boolean
    runtimeKeepAliveCounter: number
}

export type WasmModuleWrapper_Imports = {
    state: DefaultWasmImports_State
    importsTable: DefaultWasmImports_FuncsTable
}


/* -----------------------------------------------------------------------------------
 *     Functions implementations
 * --------------------------------------------------------------------------------- */

/** 
 * This function is based on `abort()` in the original Emscripten JS glue output had comments about TODOs,
 * maybe check if they are still there, and if the function could be updated
 */
function abort_js_impl(wrapper: WasmModuleWrapper, state: DefaultWasmImports_State, what: string | undefined) {
    const onAbort = wrapper.callbacks.onAbort
    if (onAbort) {
        onAbort(what)
    }

    const errorMessage = 'Aborted(' + what + ')'
    wrapper.io.err(errorMessage)

    state.isAbort = true

    var e = new WebAssembly.RuntimeError(what + '. Build with -sASSERTIONS for more info.')
    throw e
}

/* -----------------------------------------------------------------------------------
 *     Create the imports internal state
 * --------------------------------------------------------------------------------- */

function createImportsState(): DefaultWasmImports_State {
    const state: DefaultWasmImports_State = {
        exitStatus: 0,
        isAbort: false,
        noExitRuntime: false,
        runtimeKeepAliveCounter: 0
    }
    return state
}

/* -----------------------------------------------------------------------------------
 *     Create the imports functions table
 * --------------------------------------------------------------------------------- */

function createWasmImportsTable(wrapper: WasmModuleWrapper, params: WasmModuleWrapper_InstantiationParams, state: DefaultWasmImports_State): DefaultWasmImports_FuncsTable {
    const maybeEmscriptenImports = params.config.isEmscripten ? createWasmImportsTable_Emscripten(wrapper, state) : undefined

    /* // !!! These functions must be closures over `wrapper` because othewise there's no way to share state with them */
    const funcs: DefaultWasmImports_Funcs = {
        /* Emscripten funcs */
        ... maybeEmscriptenImports,

        /* JS glue funcs */
        jsLog: (pointer: number, length: number) => {
            const s = wrapper.strings.UTF8ArrayToString(wrapper.memory.memoryViews.HEAPU8, pointer, length, false)
            console.log(s)
        },
        ___abort_from_js: (message: string) => abort_js_impl(wrapper, state, message), // TODO: This probably should be taken out into some common area, together with abort_js_impl()
        _abort_js: () => abort_js_impl(wrapper, state, 'AbortJS'),
    }

    /* Currently this is what Emscripted does -- just having the same table under two different keys */
    const imports = {
        env: funcs,
        wasi_snapshot_preview1: funcs
    }
    return imports
}


/* -----------------------------------------------------------------------------------
 *     API: Create Wasm imports
 * --------------------------------------------------------------------------------- */

export function createWasmImports(wrapper: WasmModuleWrapper, params: WasmModuleWrapper_InstantiationParams): WasmModuleWrapper_Imports {
    const state = createImportsState()
    const importsTable = createWasmImportsTable(wrapper, params, state)
    return { state, importsTable }
}