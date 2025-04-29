let wasmExports = null;
let isWasmLoaded = false;

export async function loadWasm() {
	const WASM_URL = "/wasm.wasm";
	const WASM_OPT_URL = "/wasm_opt.wasm";
	const WASM_EXEC_URL = "/wasm_exec.js";

	if (isWasmLoaded) return wasmExports;

	if (!window.Go) {
		await import(WASM_EXEC_URL); // Dynamically injects wasm_exec.js (must define window.Go)
	}

	const go = new window.Go();
	let result;

	try {
		if ("instantiateStreaming" in WebAssembly) {
			const response = await fetch(WASM_OPT_URL);
			result = await WebAssembly.instantiateStreaming(response, go.importObject);
		} else {
			const response = await fetch(WASM_URL);
			const bytes = await response.arrayBuffer();
			result = await WebAssembly.instantiate(bytes, go.importObject);
		}
	} catch (err) {
		console.error("❌ Failed to instantiate WebAssembly:", err);
		throw err;
	}

	try {
		await go.run(result.instance); // run executes the Go module
		wasmExports = result.instance.exports;
		isWasmLoaded = true;
		console.log("✅ WASM loaded and running");
		return wasmExports;
	} catch (err) {
		console.error("❌ Error running Go WASM instance:", err);
		throw err;
	}
}

export function getWasmExports() {
	if (!wasmExports) {
		throw new Error("WASM not loaded. Call loadWasm() first.");
	}
	return wasmExports;
}
