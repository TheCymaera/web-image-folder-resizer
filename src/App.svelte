<script lang="ts">
import * as fsaUtil from "./fsaUtilities.js";
import DragAndDrop from "./components/DragAndDrop.svelte";
import Icon from "./components/Icon.svelte";
import { closeIcon, homeIcon, infoIcon, arrowRightIcon } from "./icons/icons.js";
import Slider from "./components/Slider.svelte";
import AppInfo from "./AppInfo.svelte";

let inputFolder: FileSystemDirectoryHandle|undefined;
let inputIncludePattern = ".*";
let inputExcludePattern = "resized";

let outputPattern = "{path}/{name}-resized-{width}.{ext}";
let extension = "AUTO";
let width = "512";
let height = "auto";
let quality = 1;

let inputs: {path: string[], handle: FileSystemHandle}[] = [];
let outputs = new Map<string, string>();

let isDragging: boolean;
let progressText = "";


// scroll to bottom when changed
let imageListElement: HTMLElement;
$: {
	inputs, outputs;
	requestAnimationFrame(scrollToBottom);
}

function scrollToBottom() {
	if (!imageListElement) return;
	imageListElement.scrollTop = imageListElement.scrollHeight;
}

async function onDrop(folder: FileSystemDirectoryHandle) {
	inputFolder = folder;
	outputs = new Map<string, string>();
	updateInputFiles();
}

async function updateInputFiles() {
	progressText = "Searching for images...";

	inputs = [];

	if (!inputFolder) return;
	for await (const [path, handle] of fsaUtil.entries(inputFolder)) {
		if (handle.kind !== "file") continue;
		
		if (!isImageFile(path)) continue;
		inputs.push({path, handle});
		inputs = inputs;
	}

	progressText = "Found " + inputs.length + " images!";
}

function isImageFile(path: string[]) {
	const name = path[path.length - 1]!;
	const ext = name.split(".").pop()!.toLowerCase();
	return ext === "png" || ext === "jpg" || ext === "webp";
}

function getOutputPath(path: string[], extension: string, width: number, height: number) {
	const name = path[path.length - 1]!;
	const newPathString = outputPattern
		.replace("{path}", path.slice(0, -1).join("/"))
		.replace("{name}", name.split(".").slice(0, -1).join("."))
		.replace("{width}", width.toString())
		.replace("{height}", height.toString())
		.replace("{ext}", extension);

	return newPathString.split("/").filter(i=>i);
}

function toRegex(pattern: string) {
	try {
		return { value: new RegExp(pattern) };
	} catch (e) {
		return { error: e.message };
	}
}

function toDimension(dimension: string): { value?: number, error?: string } {
if (dimension === "auto") return { value: undefined };
const parsed = parseInt(dimension);
if (isNaN(parsed) || parsed <= 0) return { error: `Must be "auto" or number.` };
return { value: parsed };
}

function filter(path: string[], pattern?: RegExp, excludePattern?: RegExp) {
	const pathString = path.join("/");
	if (excludePattern) {
		if (excludePattern.test(pathString)) return false;
	}

	if (pattern) {
		return pattern.test(pathString);
	}
	
	return false;
}


$: inputIncludeRegex = toRegex(inputIncludePattern);
$: inputExcludeRegex = inputExcludePattern ? toRegex(inputExcludePattern) : undefined;
$: heightParsed = toDimension(height);
$: widthParsed = toDimension(width);

export function getDimensions(image: ImageBitmap, width?: number, height?: number): {width: number, height: number} {
	if (width === undefined && height === undefined) {
		width = image.width;
		height = image.height;
	} else {
		if (width === undefined) {
			width = Math.round(image.width * (height! / image.height));
		}
		if (height === undefined) {
			height = Math.round(image.height * (width! / image.width));
		}
	}

	return {width, height};
}

async function processFiles() {
	if (!inputFolder) {
		progressText = "No input folder selected.";
		return;
	}

	progressText = "Resizing...";

	outputs = new Map<string, string>();
	for (const {path, handle} of inputs) {
		if (handle.kind !== "file") continue;
		
		if (!filter(path, inputIncludeRegex.value, inputExcludeRegex?.value)) continue;

		const file = await (handle as FileSystemFileHandle).getFile();
		const image = await createImageBitmap(file);

		let { width, height } = getDimensions(image, widthParsed.value, heightParsed.value);

		const canvas = document.createElement("canvas");
		canvas.width = width;
		canvas.height = height;

		const ctx = canvas.getContext("2d")!;
		ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
		image.close();

		const oldExtension = file.name.split(".").pop()!.toLowerCase();
		const newExtension = extension === "AUTO" ? oldExtension : extension;

		const blob2 = await new Promise<Blob>(resolve => canvas.toBlob(blob=>{
			if (!blob) return;
			resolve(blob);
		}, `image/${newExtension}`, quality));
		if (!blob2) return;

		const newPath = getOutputPath(path, newExtension, width, height);

		const newHandle = await fsaUtil.getFileHandle(inputFolder, newPath, { create: true }, { create: true });
		const writable = await newHandle.createWritable();
		await writable.write(blob2);
		await writable.close();

		outputs.set(path.join("/"), newPath.join("/"));
		outputs = outputs;
	}

	progressText = "Complete!";
}


let dialogOpen = false;
</script>

<helion-standard-view>
	<helion-app-bar slot="header">
		<helion-app-bar-title>Image Folder Resizer</helion-app-bar-title>
		<helion-app-bar-right>
			<button class="helion-app-bar-icon-button" title="Info" on:click={()=>dialogOpen = true}>
				<Icon url="{infoIcon}" />
			</button>
			<a class="helion-app-bar-icon-button" href="/" title="Home">
				<Icon url="{homeIcon}" />
			</a>
		</helion-app-bar-right>
	</helion-app-bar>
	<div slot="body">
		<helion-panel>
			<h3>Input:</h3>
			<label>
				<div>Include <small>(Regex)</small></div>
				<input type="text" class="helion-outlined-text-field" class:helion-has-error={!!inputIncludeRegex.error} bind:value={inputIncludePattern} />

				<small>{inputIncludeRegex.error ?? ""}</small>
			</label>

			<label>
				<div>Exclude <small>(Regex)</small></div>
				<input type="text" class="helion-outlined-text-field" class:helion-has-error={inputExcludeRegex && !!inputExcludeRegex.error} bind:value={inputExcludePattern} placeholder="None" />

				<small>{inputExcludeRegex?.error ?? ""}</small>
			</label>

			<hr>

			<h3>Output:</h3>
			<label>
				<div>File Path</div>
				<input type="text" class="helion-outlined-text-field" bind:value={outputPattern} />
			</label>

			<label>
				<div>Width</div>
				<input type="text" class="helion-outlined-text-field" bind:value={width} class:helion-has-error={!!widthParsed.error} />
				<small>{widthParsed.error ?? ""}</small>
			</label>

			<label>
				<div>Height</div>
				<input type="text" class="helion-outlined-text-field" bind:value={height} class:helion-has-error={!!heightParsed.error} />
				<small>{heightParsed.error ?? ""}</small>
			</label>

			<label>
				<div>Format</div>
				<select class="helion-outlined-text-field" bind:value={extension}>
					<option value="AUTO">Use Original</option>
					<option value="png">PNG</option>
					<option value="jpg">JPG</option>
					<option value="webp">WebP</option>
				</select>
			</label>

			<label style:display={extension === "png" ? "none" : ""}>
				<div>Quality</div>
				<Slider bind:value={quality} min={0} max={1} step={0.01} />
			</label>

			<hr>
			<br>

			<div>
				<button class="helion-filled-button" on:click={processFiles}>Resize</button>
			</div>

			<br>

			<div>{progressText}</div>

			<div style="height: 300px;"></div>
		</helion-panel>


		<helion-stack>
			<DragAndDrop onDrop={onDrop} bind:isDragging>
				<helion-center style="text-align: center; padding: 1em;">
					<div>
						Drag and drop a folder. <br />
						<small>All images are processed locally in your browser. I never receive your files.</small>
					</div>
				</helion-center>
			</DragAndDrop>

			{#if inputs.length}
				<div style="display: grid; padding: 1em;"
					style:opacity={isDragging ? 0 : 1}
					style:transition={isDragging ? "opacity 0.2s" : ""}
					style:pointer-events={isDragging ? "none" : "auto"}
				>
					<helion-card style="padding: 1em; overflow: auto;" bind:this={imageListElement}>
						<h3>Images:</h3>
						{#each inputs as {path}}
							<code class:Excluded={!filter(path, inputIncludeRegex.value, inputExcludeRegex?.value)}>{path.join("/")}</code>
							
							{#if outputs.has(path.join("/"))}
								<Icon url="{arrowRightIcon}" />
								<code>{outputs.get(path.join("/"))}</code>
							{/if}
							<br />
						{/each}

						<div></div>
					</helion-card>
				</div>
			{/if}
		</helion-stack>
	</div>
</helion-standard-view>



<helion-panel 
	style="
		opacity: {dialogOpen ? 1 : 0};
		pointer-events: {dialogOpen ? "all" : "none"};
		transition: opacity .1s;
	">
	<div style="height: 100%; overflow: auto;">
		<div style="
			margin: auto; 
			max-width: 800px; 
			padding: .5em 1em;
		">
			<AppInfo />
		</div>
	</div>
	<button 
		class="helion-circle-button" 
		style="position: absolute; right: 0.5em; top: 0.5em;"
		title="Close"
		on:click={()=>dialogOpen = false}
	>
		<Icon url="{closeIcon}" />
	</button>
</helion-panel>
<style>
	[slot=body] {
		display: grid;
		grid-template-columns: 350px 1fr;
	}

	helion-panel {
		padding: 1em;
		overflow: auto;
	}

	label {
		display: block;
		margin-bottom: 1em;
	}

	code {
		transition: opacity .1s;
	}

	.Excluded {
		opacity: 0.3;
		text-decoration: line-through;
	}


	@media (max-width: 700px) {
		[slot=body] {
			grid-template-columns: 1fr;
			grid-template-rows: 1fr 1fr;
		}

		[slot=body] > *:nth-child(2) {
			order: 1;
		}

		[slot=body] > *:nth-child(1) {
			order: 2;
		}
	}
</style>