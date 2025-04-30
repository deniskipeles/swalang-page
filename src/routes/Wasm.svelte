<script>
	import { onMount } from "svelte";
	import { loadSwalangWasm, getWasmSwalangExports } from "$lib/utils/wasm.js";

	let code = "";
	$: output = "";

	let wasm 
	onMount(async () => {
		await loadSwalangWasm();
		wasm = getWasmSwalangExports();

		// Example usage
		// const result = wasm.multiply(6, 7);
		// console.log("Result:", result);
		// output = `multiply(6, 7) = ${result}`;
	});
	function runCode() {
		output = window.runSwalang(code, "main.py");
	}
	// async function runCode(){
    //     let pyodide = await window.loadPyodide();
    //     output = pyodide.runPython(code);
    //   }
</script>
<svelte:head>
	<script src="https://cdn.jsdelivr.net/pyodide/v0.27.5/full/pyodide.js"></script>
</svelte:head>

<textarea bind:value={code} rows="10" cols="50" placeholder="Write your pylike code here..."></textarea>
<button on:click={() => {
	// const wasm = getWasmExports();
	runCode()
	// output = `multiply(2, 5) = ${wasm.runPylearn(code)}`;
}}>Run</button>

<h3>Output:</h3>
<pre>{output}</pre>
