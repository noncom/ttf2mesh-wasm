import { DefaultWasmImports_State } from "./wasm-wrapper-imports.js"
import { WasmModuleWrapper } from "./wasm-wrapper.js"


export type DefaultWasmImports_Funcs_Emscripten = {
    __call_sighandler: (funcPointer: number, sig: unknown) => void
    _emscripten_runtime_keepalive_clear: () => void
    emscripten_resize_heap: (requestedSize: number) => void
    fd_write: (fd: number, iov: number, iovcnt: number, pnum: number) => void
    proc_exit: (code: number) => void
}

/* -----------------------------------------------------------------------------------
 *     Functions implementations
 * --------------------------------------------------------------------------------- */

function call_signhandler_impl(wrapper: WasmModuleWrapper, funcPointer: number, sig: unknown) {
    const func = wrapper.instance.getWasmTableEntry(funcPointer)
    if (func) {
        return func(sig)
    } else {
        throw new Error ("[ERROR] Can't find function by pointer=" + funcPointer + " to pass sig=" + sig)
    }
}

function emscripten_runtime_keepalive_clear_impl(wrapper: WasmModuleWrapper, state: DefaultWasmImports_State) {
    state.noExitRuntime = false
    state.runtimeKeepAliveCounter = 0
}

function emscripten_resize_heap_impl(wrapper: WasmModuleWrapper, state: DefaultWasmImports_State, requestedSize: number) {
    var oldSize = wrapper.memory.memoryViews.HEAPU8.length;
    // With CAN_ADDRESS_2GB or MEMORY64, pointers are already unsigned.
    requestedSize >>>= 0;

    // TODO: Replace this with some real logic
    //wrapper.imports.funcs.
}

function fd_write_impl(wrapper: WasmModuleWrapper, state: DefaultWasmImports_State, fd: number, iov: number, iovcnt: number, pnum: number) {
    const { HEAPU32, HEAPU8 } = wrapper.memory.memoryViews
    const printChar = wrapper.strings.printChar
    // hack to support printf in SYSCALLS_REQUIRE_FILESYSTEM=0
    var num = 0;
    for (var i = 0; i < iovcnt; i++) {
        var ptr = HEAPU32[((iov)>>2)];
        var len = HEAPU32[(((iov)+(4))>>2)];
        iov += 8;
        for (var j = 0; j < len; j++) {
            wrapper.strings.printChar(fd, HEAPU8[ptr+j]);
        }
        num += len;
    }
    HEAPU32[((pnum)>>2)] = num;
    return 0
}

function proc_exit_impl(wrapper: WasmModuleWrapper, state: DefaultWasmImports_State, code: number) {
    state.exitStatus = code
    wrapper.instanceInfo.instanceConfig.quit("" + code, { message: `Program terminated with exit(${status})`, status: code })
}

/* -----------------------------------------------------------------------------------
 *     Create the imports functions table
 * --------------------------------------------------------------------------------- */

export function createWasmImportsTable_Emscripten(wrapper: WasmModuleWrapper, state: DefaultWasmImports_State): DefaultWasmImports_Funcs_Emscripten {
    /* // !!! These functions must be closures over `wrapper` because othewise there's no way to share state with them */
    const funcs: DefaultWasmImports_Funcs_Emscripten = {
        __call_sighandler: (funcPointer: number, sig: unknown) => call_signhandler_impl(wrapper, funcPointer, sig),
        _emscripten_runtime_keepalive_clear: () => emscripten_runtime_keepalive_clear_impl(wrapper, state),
        emscripten_resize_heap: (requestedSize: number) => emscripten_resize_heap_impl(wrapper, state, requestedSize),
        fd_write: (fd: number, iov: number, iovcnt: number, pnum: number) => fd_write_impl(wrapper, state, fd, iov, iovcnt, pnum),
        proc_exit: (code: number) => proc_exit_impl(wrapper, state, code),
    }
    return funcs
}