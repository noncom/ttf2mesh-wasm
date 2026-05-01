/*
 * This is a TypeScript Wasm wrapper, based on the `.out.js` that Emscripten generates.
 * Even though https://www.npmjs.com/package/@types/emscripten exists, I still prefer this.
 */

import { DefaultWasmExports } from "./wasm-wrapper-exports.js"
import { createWasmImports, WasmModuleWrapper_Imports,  } from "./wasm-wrapper-imports.js"
import { createWasmModuleWrapper_Instance, WasmModuleWrapper_InstanceInfo, WasmModuleWrapper_InstantiationParams } from "./wasm-wrapper-instance.js"
import { createWasmModuleWrapper_IO, WasmModuleWrapper_IO } from "./wasm-wrapper-io.js"
import { createWasmModuleWrapper_Memory, WasmModuleWrapper_Memory } from "./wasm-wrapper-memory.js"
import { createWasmModuleWrapper_StringUtils, WasmModuleWrapper_StringUtils } from "./wasm-wrapper-string-utils.js"


export type WasmModuleWrapper_Instance = {
    program: WebAssembly.WebAssemblyInstantiatedSource
    /* ! See the description of this method in the function comment */
    getExports: <T>(this: WasmModuleWrapper_Instance) => T
    /* Get an entry from the Wasm table */
    getWasmTableEntry: (this: WasmModuleWrapper_Instance, funcPtr: number) => Function
}

export type WasmModuleWrapper_Callbacks = {
    onRuntimeInitialized?: () => void
    onExit?: () => void
    onAbort?: (message?: string) => void
    preRun?: () => void
    postRun?: ()=> void
    locateFile?: (path: string, scriptDirectory: string) => void
}

export type WasmModuleWrapper = {
    /* -- In the order of initialization -- */

    /* Wrapper preparation */
    io: WasmModuleWrapper_IO
    imports: WasmModuleWrapper_Imports
    callbacks: WasmModuleWrapper_Callbacks
    
    /* Instance preparation + instance */
    instanceInfo: WasmModuleWrapper_InstanceInfo
    instance: WasmModuleWrapper_Instance
 
    /* Memory access */
    memory: WasmModuleWrapper_Memory
    
    /* Utility */
    strings: WasmModuleWrapper_StringUtils
}

/**
 * This is just a convenience method for getting and casting the exports.
 * No check or verification! The type cast is made bassed on trust
 */
function getExports<T>(this: WasmModuleWrapper_Instance): T {
    return this.program.instance.exports as T
}

export function getWasmTableEntry(this: WasmModuleWrapper_Instance, funcPtr: number) {
    const exports = this.getExports<DefaultWasmExports>()
    return exports.__indirect_function_table.get(funcPtr) as Function
}

export async function createWasmModuleWrapper(params: WasmModuleWrapper_InstantiationParams): Promise<WasmModuleWrapper> {
    const wrapper: WasmModuleWrapper = {} as WasmModuleWrapper

    /* Prepare wrappers */

    wrapper.io = createWasmModuleWrapper_IO()
    /* If the user provides the imports, they must take care for them to implement the default part in them.
     * Usually that means calling `createDefaultWasmImports()` first, and then adding to that, because the default imports contain important thingss */
    wrapper.imports = params.imports || createWasmImports(wrapper, params)

    /* Instantiate and remember the Wasm module */

    const instantiatedSource = await createWasmModuleWrapper_Instance(wrapper, params)

    if (!instantiatedSource) {
        throw new Error("[ERROR] Failed instantiating the Wasm module with params=" + JSON.stringify(params))
    }

    wrapper.instance = {
        program: instantiatedSource,
        getExports,
        getWasmTableEntry
    }

    /* Now add the utilities and utility wrappers */

    wrapper.memory = createWasmModuleWrapper_Memory(wrapper)
    wrapper.strings = createWasmModuleWrapper_StringUtils(wrapper)

    return wrapper
}

/**
 * Indicates whether filename is delivered via file protocol (as opposed to http/https)
 */
export function isFileURI (filename: string) {
    return filename.startsWith('file://')
}