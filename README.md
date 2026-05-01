# About this fork

This fork focuses on compiling ttf2mesh into Wasm. Thankfully the original library is already well-prepared for that, and only some setup is needed.

## How to build

1. Make sure `emcc` is available
2. Run
    ```sh
    emcc -O1 ttf2mesh.c wasmify.c -D TTF_NO_FILESYSTEM=1 -s WASM=1 -s STANDALONE_WASM -s EXPORTED_FUNCTIONS=['_malloc','_free'] --js-library library.js
    ```
    - `-01` -- one of the most important parameters, defines how much Emscripten should try to treeshake the surface API. Other settings like `-O2`, `-O3`, `-Oz`, etc, are possible, and they will result in different provision by Emscripten.
    - `ttf2mesh.c wasmify.c` -- the files to include into the compiled Wasm module
    - `TTF_NO_FILESYSTEM=1` -- a neccessary setting that skips everything file-system related in ttf2mesh compilation, making it very suitable for building for Wasm
    - `EXPORTED_FUNCTIONS=['_malloc', '_free']` -- these functions are needed to properly communicatee binary data between JS and Wasm
    - `--js-library library.js` -- contains the mockup of the custom API that's expected to be imported from the JS side. In practice that means that when Emscripten encounters these functions being declared as `extern` in the C code, it will know to keep them, and to bridge them with the JS functions provided in Wasm imports during the Wasm module instantiation.

3. Use the generated Wasm file
4. Optionally use the example TypeScript wrapper to simplify working with the Wasm module.

## How to use from JS

The typical usage from the JS side very much resembles the `simple.c` example:

1. Instantiate the wasm module, providing the necessary imports.
2. Load the font file on the JS side, and provide the loaded file binary buffer to Wasm.
3. Load the font from the provided buffer via `wasm_loadFontFromBuffer()`. Note: only one font can't be loaded at a time, and it must be freed before loading another one.
4. Request glyphs one by one from the font via `wasm_getGlyphMeshData()`. The user is responsible for saving and using this glyph data on the JS side however they want.
5. Remember to `free()` each of the requested glyphs.
6. Remember to `free()` the font.

Refer to the provilded `usage-example-01.ts` and `usage-example-02.ts` for more details.

# The original ttf2mesh readme follows

# ttf2mesh

![image](https://github.com/fetisov/ttf2mesh/blob/assets/logo.png?raw=true)

The ttf2mesh crossplatform library allows to convert a glyphs of truetype font (ttf) to a mesh objects in 2d and 3d space. The library does not require any graphical context and does not use system dependent functions.

The library consists of two files written in the C language of the **c99 standard**: ttf2mesh.c and ttf2mesh.h.
The ttf2mesh.c code implements a **parsing of ttf-files** and a **tessellation algorithm** that provides the formats conversion. The tessellation algorithm uses the [**Delaunay**](https://en.wikipedia.org/wiki/Delaunay_triangulation) test to form an optimal set of triangles. Tessellation (triangulation) process is described in ["this post"](https://habr.com/post/501268) and is shown in the animation below.

![image](https://github.com/fetisov/ttf2mesh/blob/assets/tessellation.gif?raw=true)

The library has a simple doxygen-documented API for loading TTF files and converting glyphs into mesh objects. Examples of using the library are presented in **examples/src** directory. There are three main examples:

|FILE                           |Description                  |
|-------------------------------|-----------------------------|
|examples/src/simple.c          |The simplest code that shows how a user can load a font from the system directory and convert its glyph to a 2d mesh object. The converted glyph is rendering to an opengl window as a filled mesh, wireframe or the glyph contours.|
||![image](https://raw.githubusercontent.com/fetisov/ttf2mesh/assets/2d.png)|
|examples/src/glyph3d.c         |Same as simple.c example, except that the font glyphs are converted to a 3D mesh object, which is displayed in the opengl window with animation.|
||![image](https://raw.githubusercontent.com/fetisov/ttf2mesh/assets/3d.png)|
|examples/src/ttf2obj.c         |Console application for converting TTF font input file to a Wavefront object file (.obj). Each object in the output file includes the plane geometry of the corresponding glyph and its parameters: Unicode ID, advance and bearing.|
||![image](https://raw.githubusercontent.com/fetisov/ttf2mesh/assets/objfile.png)|

To compile examples on Linux system you can use the GNU make utility: `make -C examples/build-linux-make all`. In the Windows operating system, you can use for compilation the Microsoft Visual Studio C++ project files that are located in the `examples/build-win-msvc` directory. Additionally, the `examples\build-any-qmake` directory contains pro files for building examples using the qtcreator IDE.

You can read information on how the library works at [this link](https://habr.com/post/501268).

[PayPal me](https://www.paypal.me/fetisovs) or:
*MasterCard* 5469 3800 5517 1176
*wmz* Z518568605100 *wmr* R885157851601
