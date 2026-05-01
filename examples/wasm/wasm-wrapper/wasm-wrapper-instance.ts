import { createWasmImports, WasmModuleWrapper_Imports } from "./wasm-wrapper-imports.js"
import { createEnvironmentNode, InstanceConfigNodeJS } from "./wasm-wrapper-instance-node.js"
import { createEnvironmentWebOrWorker, InstanceConfigWebOrWorker } from "./wasm-wrapper-instance-web-and-worker.js"
import { isFileURI, WasmModuleWrapper } from "./wasm-wrapper.js"

/** This is a purely TS-centric workaround to declaring this property */
declare global {
    namespace globalThis {
        var WorkerGlobalScope: boolean
    }
}

/* -----------------------------------------------------------------------------------
 *     Platform context info
 * --------------------------------------------------------------------------------- */

export type WasmModuleWrapper_InstanceInfo = {
    isWeb: boolean
    isWorker: boolean
    isNode: boolean
    isShell: boolean

    instanceConfig: InstanceConfigNodeJS | InstanceConfigWebOrWorker

    scriptDirectory: string | undefined
    scriptName: string | undefined
}

/* -----------------------------------------------------------------------------------
 *     Wasm instantiation params type
 * --------------------------------------------------------------------------------- */

export type CustomWasmInstantiationFunc = (
    imports: WasmModuleWrapper_Imports,
    postFunc: (program: WebAssembly.WebAssemblyInstantiatedSource) => void)
    => WebAssembly.WebAssemblyInstantiatedSource

export type WasmModuleWrapper_InstantiationParams = {
    /** An already instantiated Wasm instance.
     * !!! Make sure that the imports were provided that are compatible with `WasmModuleWrapper_Imports`, and that they are also passed as `imports` !!!
     * !!! The easiest way to ensure that is to create thenm based on the result of `createDefaultWasmImports()`
     * */
    instance?: {
        program: WebAssembly.WebAssemblyInstantiatedSource
    }
    /** Imports */
    imports?: WasmModuleWrapper_Imports

    /** A fully custom initialization function */
    instantiateWasm?: CustomWasmInstantiationFunc
    /** A binary buffer that was already fetched from somewhere */
    binaryBuffer?: Buffer<ArrayBuffer>
    /** Should be fully qualified with the schema */
    uri?: string
    /** Can be just a relative / local filename, without a schema */
    localFile?: {
        relativePath: string
        readLocalFile: (relativePath: string) => Promise<Buffer<ArrayBuffer>>
    }

    /** Configure various Wasm-related params, for example, specify if it was created by Emscripten or something else */
    config: {
        isEmscripten?: boolean
    }
}


/* -----------------------------------------------------------------------------------
 *     Various ways of fetching and instantiating the Wasm module
 * --------------------------------------------------------------------------------- */

async function fetchAndInstantiate(wrapper: WasmModuleWrapper, info: WasmModuleWrapper_InstanceInfo, uri: string) {
    try {
        var response = fetch(uri, { credentials: 'same-origin' })
        var instantiationResult = await WebAssembly.instantiateStreaming(response, wrapper.imports.importsTable)
        /* Fetch was successful */
        return instantiationResult
    } catch (reason) {
        // We expect the most common failure cause to be a bad MIME type for the binary,
        // in which case falling back to ArrayBuffer instantiation should work.
        wrapper.io.err(`Wasm streaming compile failed: ${reason}`)
        wrapper.io.err('Falling back to ArrayBuffer instantiation')
        // fall back of instantiateArrayBuffer below
    }
}

async function readBinaryFile(wrapper: WasmModuleWrapper, info: WasmModuleWrapper_InstanceInfo, uri: string) {
    try {
        const response = await info.instanceConfig.readAsync(uri);
        const resResponse = typeof response === "string" ? Buffer.from(response) : response
        return new Uint8Array(resResponse)
    } catch {
        // Fall back to getBinarySync below;
    }

    if (info.instanceConfig.readBinary) {
        return info.instanceConfig.readBinary(uri);
    }
    // Throwing a plain string here, even though it not normally advisable since
    // this gets turning into an `abort` in instantiateArrayBuffer.
    throw 'both async and sync fetching of the wasm failed'
}

async function instantateFromUri(wrapper: WasmModuleWrapper, info: WasmModuleWrapper_InstanceInfo, uri: string) {
    if (!isFileURI(uri) && !info.isNode) {
        const fetched = fetchAndInstantiate(wrapper, info, uri)
        if (fetched) { return fetched }
    }
    /* Else + fallback */

    try {
        const binary = readBinaryFile(wrapper, info, uri)
        var instance = await WebAssembly.instantiate(binary, wrapper.imports.importsTable);
        const program: WebAssembly.WebAssemblyInstantiatedSource = {
            instance,
            module: undefined as unknown as WebAssembly.Module
        }
        return program
    } catch (reason) {
        wrapper.io.err(`failed to asynchronously prepare wasm: ${reason}`)
        wrapper.imports.importsTable.env.___abort_from_js(reason as string)
        throw new Error("[ERROR] Failed to instantiate Wasm from uri=" + uri)
    }
}


/* -----------------------------------------------------------------------------------
 *     Create Wasm instance
 * --------------------------------------------------------------------------------- */

export async function createWasmModuleWrapper_Instance(wrapper: WasmModuleWrapper, params: WasmModuleWrapper_InstantiationParams) {
    const isWeb = !!global.window
    const isWorker = !!globalThis.WorkerGlobalScope
    const isNode = !!(globalThis.process?.versions?.node && globalThis.process?.type != 'renderer')
    const isShell = !isWeb && !isWorker && !isNode

    const scriptName = getCurrentScriptName(isWorker)
    const scriptDirectory = ''

    const info: WasmModuleWrapper_InstanceInfo = {
        isWeb, isWorker, isNode, isShell,
        instanceConfig: undefined as unknown as WasmModuleWrapper_InstanceInfo["instanceConfig"],
        scriptName, scriptDirectory,
    }

    info.instanceConfig = isNode ? createEnvironmentNode(info) : createEnvironmentWebOrWorker(info)

    wrapper.instanceInfo = info

    if (params.instantiateWasm) {
        /* Instantiate: By a custom instantiation function */
        const instance = params.instantiateWasm(wrapper.imports, (instance) => {
            // TODO ?
        })
        return instance
    } else if (params.uri) {
        /* Intantaite: from a URI */
        const instance = instantateFromUri(wrapper, info, params.uri)
        return instance
    } else if (params.localFile) {
        //const instance = instantiateFromLocalFile(wrapper, info, params.localFile)
        //return instance
        const fileBuffer = await params.localFile.readLocalFile(params.localFile.relativePath)
        const array = new Uint8Array(fileBuffer)
        const instance = await WebAssembly.instantiate(array, wrapper.imports.importsTable)
        return instance
    } else if (params.binaryBuffer) {
        /* Instantiate: from a binary buffer */
        const array = new Uint8Array(params.binaryBuffer)
        const instance = await WebAssembly.instantiate(array, wrapper.imports.importsTable)
        return instance
    } 

    // ...

    throw new Error("[ERROR] Unable to instantiate the Wasm instance with params=" + JSON.stringify(params))
}

/* -----------------------------------------------------------------------------------
 *     Util
 * --------------------------------------------------------------------------------- */

function getCurrentScriptName(isWorker: boolean): string {
    if (typeof __filename != "undefined") {
        /* NodeJS */
        return __filename
    } else if (isWorker) {
        return self.location.href
    } else {
        // In MODULARIZE mode _scriptName needs to be captured already at the very top of the page immediately when the page is parsed, so it is generated there
        // before the page load. In non-MODULARIZE modes generate it here.
        const currentScript = globalThis.document?.currentScript as HTMLScriptElement
        return currentScript?.src
    }
}