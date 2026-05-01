
export type WasmModuleWrapper_IO = {
    out: typeof console.log
    err: typeof console.error
}

export function createWasmModuleWrapper_IO(): WasmModuleWrapper_IO {
    const io: WasmModuleWrapper_IO = {
        out: console.log.bind(console),
        err: console.error.bind(console)
    }
    return io
}