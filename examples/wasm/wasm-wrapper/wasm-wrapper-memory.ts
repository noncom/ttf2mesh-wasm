/*
 * This is a TypeScript Wasm wrapper, heavily based on the `.out.js` that Emscripten generates.
 * Even though https://www.npmjs.com/package/@types/emscripten exists, I still prefer this.
 */

import { WasmModuleWrapper } from "./wasm-wrapper.js"

type Heaps = {
    HEAP16: Int16Array
    HEAP32: Int32Array
    HEAP64: BigInt64Array
    HEAP8: Int8Array
    HEAPF32: Float32Array
    HEAPF64: Float64Array
    HEAPU16: Uint16Array
    HEAPU32: Uint32Array
    HEAPU64: BigUint64Array
    HEAPU8: Uint8Array
}

const wasmValueTypes = ['i1', 'i8', 'i16', 'i32', 'i64', 'float', 'double', '*'] as const

export type WasmValueType = typeof wasmValueTypes[number]

export type WasmModuleWrapper_Memory = {
    getWrapper: () => WasmModuleWrapper
    getMemory: (this: WasmModuleWrapper_Memory) => WebAssembly.Memory
    memoryViews: Heaps
    updateMemoryViews: (this: WasmModuleWrapper_Memory) => void
    getValue: (this: WasmModuleWrapper_Memory, ptr: number, type: WasmValueType) => unknown
    setValue: (this: WasmModuleWrapper_Memory, ptr: number, value: unknown, type: WasmValueType) => void
}

function createMemoryViews(b: ArrayBuffer): Heaps {
    return {
        HEAP8: new Int8Array(b),
        HEAP16: new Int16Array(b),
        HEAPU8: new Uint8Array(b),
        HEAPU16: new Uint16Array(b),
        HEAP32: new Int32Array(b),
        HEAPU32: new Uint32Array(b),
        HEAPF32: new Float32Array(b),
        HEAPF64: new Float64Array(b),
        HEAP64: new BigInt64Array(b),
        HEAPU64: new BigUint64Array(b)
    }
}

function getProgramMemoryBuffer(program: WebAssembly.WebAssemblyInstantiatedSource) {
    return (program.instance.exports.memory as WebAssembly.Memory).buffer
}

function refreshMemoryViews(this: WasmModuleWrapper_Memory) {
    this.memoryViews = createMemoryViews(getProgramMemoryBuffer(this.getWrapper().instance.program))
}

function getMemory(this: WasmModuleWrapper_Memory): WebAssembly.Memory {
    return this.getWrapper().instance.program.instance.exports.memory as WebAssembly.Memory
}

function getValue(this: WasmModuleWrapper_Memory, ptr: number, type: WasmValueType) {
    if (type.endsWith('*')) type = '*';
    const heaps = this.memoryViews
    switch (type) {
        case 'i1': return heaps.HEAP8[ptr];
        case 'i8': return heaps.HEAP8[ptr];
        case 'i16': return heaps.HEAP16[((ptr)>>1)];
        case 'i32': return heaps.HEAP32[((ptr)>>2)];
        case 'i64': return heaps.HEAP64[((ptr)>>3)];
        case 'float': return heaps.HEAPF32[((ptr)>>2)];
        case 'double': return heaps.HEAPF64[((ptr)>>3)];
        case '*': return heaps.HEAPU32[((ptr)>>2)];
        default:
            throw new Error(`invalid type for getValue: ${type}`);
    }
}

function setValue(this: WasmModuleWrapper_Memory, ptr: number, value: unknown, type: WasmValueType) {
    if (type.endsWith('*')) type = '*';
    const heaps = this.memoryViews
    switch (type) {
        case 'i1': heaps.HEAP8[ptr] = value as number; break;
        case 'i8': heaps.HEAP8[ptr] = value as number; break;
        case 'i16': heaps.HEAP16[((ptr)>>1)] = value as number; break;
        case 'i32': heaps.HEAP32[((ptr)>>2)] = value as number; break;
        case 'i64': heaps.HEAP64[((ptr)>>3)] = BigInt(value as number); break;
        case 'float': heaps.HEAPF32[((ptr)>>2)] = value as number; break;
        case 'double': heaps.HEAPF64[((ptr)>>3)] = value as number; break;
        case '*': heaps.HEAPU32[((ptr)>>2)] = value as number; break;
        default:
            throw new Error(`invalid type for setValue: ${type}`);
    }
}

export function createWasmModuleWrapper_Memory(wrapper: WasmModuleWrapper): WasmModuleWrapper_Memory {
    if (!(wrapper?.instance?.program)) {
        throw new Error("[ERROR] Wrapper Core is not initialized")
    }
    const memoryWrapper: WasmModuleWrapper_Memory = {
        getWrapper: () => wrapper,
        getMemory,
        memoryViews: createMemoryViews(getProgramMemoryBuffer(wrapper.instance.program)),
        updateMemoryViews: refreshMemoryViews,
        getValue, setValue,
    }
    return memoryWrapper
}