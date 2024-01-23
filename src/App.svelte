<script lang="ts">
import * as fsaUtil from "./fsaUtilities.js";
import DragAndDrop from "./DragAndDrop.svelte";
import { fa5_solid_arrowRight, fa5_solid_home, fa5_solid_info, fa5_solid_times } from "fontawesome-svgs"
import Slider from "./Slider.svelte";
import IconButton from "./helion/IconButton.svelte";
import FilledButton from "./helion/FilledButton.svelte";
import OutlinedTextField from "./helion/OutlinedTextField.svelte";
import OutlinedSelectField from "./helion/OutlinedSelectField.svelte";
import CircleButton from "./helion/CircleButton.svelte";
import AppInfo from "./AppInfo.svelte";

let inputFolders: FileSystemDirectoryHandle[]|undefined;
let inputIncludePattern = ".*";
let inputExcludePattern = "resized";

let outputPattern = "{folder}/{name}-resized-{width}.{ext}";
let extension = "AUTO";
let width = "512";
let height = "auto";
let quality = 1;

let inputs: {path: string[], handle: FileSystemHandle, root: FileSystemDirectoryHandle}[] = [];
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

async function onDrop(folder: FileSystemDirectoryHandle[]) {
	inputFolders = folder;
	outputs = new Map<string, string>();
	updateInputFiles();
}

async function updateInputFiles() {
	progressText = "Searching for images...";

	inputs = [];

	if (!inputFolders) return;

	for (const root of inputFolders) {
		for await (const [path, handle] of fsaUtil.entries(root)) {
			if (handle.kind !== "file") continue;
			
			if (!isImageFile(path)) continue;
			inputs.push({path, handle, root});
			inputs = inputs;
		}
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
		.replace("{folder}", path.slice(0, -1).join("/"))
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
	if (!inputFolders) {
		progressText = "No input folder selected.";
		return;
	}

	progressText = "Resizing...";

	outputs = new Map<string, string>();
	for (const {path, handle, root} of inputs) {
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

		const newHandle = await fsaUtil.getFileHandle(root, newPath, { create: true }, { create: true });
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

<div class="grid grid-rows-[min-content,1fr] absolute inset-0 z-0">
	<header class="bg-surfaceContainer text-onSurfaceContainer flex items-center shadow z-10 overflow-hidden">
		<h1 class="flex-1 px-3 font-bold">Image Folder Resizer</h1>
		<IconButton href="/" label="Home">
			{@html fa5_solid_home}
		</IconButton>
		<IconButton label="Info" onPress={()=>dialogOpen = true}>
			{@html fa5_solid_info}
		</IconButton>
	</header>
	<main class="grid grid-cols-[400px,1fr] z-0 overflow-hidden">
		<side class="bg-surfaceContainer text-onSurfaceContainer p-3 overflow-auto">
			<h2 class="font-bold text-xl">Input:</h2>

			<OutlinedTextField label="Include" hint="Regex" bind:value={inputIncludePattern} error={inputIncludeRegex?.error} />

			<OutlinedTextField label="Exclude" hint="Regex" bind:value={inputExcludePattern} error={inputExcludeRegex?.error} />

			<br>

			<h2 class="font-bold text-xl">Output:</h2>

			<OutlinedTextField label="File Path" bind:value={outputPattern} /> <br />

			<OutlinedTextField label="Width" bind:value={width} error={widthParsed.error} /> <br />

			<OutlinedTextField label="Height" bind:value={height} error={heightParsed.error} /> <br />

			<OutlinedSelectField 
				label="Format"
				bind:value={extension}
				options={[
					{ value: "AUTO", label: "Use Original" },
					{ value: "png", label: "PNG" },
					{ value: "jpg", label: "JPG" },
					{ value: "webp", label: "WebP" },
				]}
			/>
			<br>

			<label style:display={extension === "png" ? "none" : ""}>
				<div>Quality</div>
				<Slider bind:value={quality} min={0} max={1} step={0.01} />
			</label>

			<br>
			<hr>
			<br>

			<FilledButton onPress={processFiles}>Resize</FilledButton>

			<br>
			<br>

			<div>{progressText}</div>

			<div style="height: 300px;"></div>
		</side>


		<div class="relative [&>*]:!inset-0 [&>*]:!absolute">
			<DragAndDrop onDrop={onDrop} bind:isDragging>
				<div class="text-center grid place-items-center p-4">
					<div>
						Drag and drop a folder. <br />
						<small>All images are processed locally in your browser. I never receive your files.</small>
					</div>
				</div>
			</DragAndDrop>

			{#if inputs.length}
				<div style="display: grid; padding: 1em;"
					style:opacity={isDragging ? 0 : 1}
					style:transition={isDragging ? "opacity 0.2s" : ""}
					style:pointer-events={isDragging ? "none" : "auto"}
				>
					<div class="bg-surfaceContainer text-onSurfaceContainer p-4 overflow-auto" bind:this={imageListElement}>
						<h2 class="font-bold text-xl">Images:</h2>
						{#each inputs as {path}}
							<code class:Excluded={!filter(path, inputIncludeRegex.value, inputExcludeRegex?.value)}>{path.join("/")}</code>
							
							{#if outputs.has(path.join("/"))}
								{@html fa5_solid_arrowRight}
								<code>{outputs.get(path.join("/"))}</code>
							{/if}
							<br />
						{/each}

						<div></div>
					</div>
				</div>
			{/if}
		</div>
	</main>
</div>



<div class="absolute inset-0 z-20 bg-surface text-onSurface"
	style="
		opacity: {dialogOpen ? 1 : 0};
		pointer-events: {dialogOpen ? "all" : "none"};
		transition: opacity .1s;
	">
	<div class="h-full overflow-auto">
		<div 
			class="m-auto max-w-[800px] py-4 px-2">
			<AppInfo />
		</div>
	</div>
	<CircleButton 
		class="absolute right-2 top-2"
		label="Close"
		onPress={()=>dialogOpen = false}
	>
		{@html fa5_solid_times}
	</CircleButton>
</div>