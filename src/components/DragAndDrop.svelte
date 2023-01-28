<script lang="ts">
export let onDrop: (file: FileSystemDirectoryHandle) => void;
export let overlay = false;
export let isDragging = false;

function notSupportedMessage() {
	alert("This browser does not support the File System Access API. Please use a chromium browser such as Google Chrome, Microsoft Edge, or Opera.");
}

async function dropHandler(ev: DragEvent) {
  if (ev.dataTransfer?.items) {
		for (const item of ev.dataTransfer.items) {
			if (!("getAsFileSystemHandle" in item)) {
				notSupportedMessage();
				return;
			}

			const file = await item.getAsFileSystemHandle();
			if (!file) continue;
			if (file.kind === "directory") {
				onDrop(file as FileSystemDirectoryHandle);
			}
		}
  }
}

let timeout = 0;
function onDrag() {
	clearInterval(timeout);
	isDragging = true;
	timeout = setTimeout(() => {
		isDragging = false;
		timeout = 0;
	}, 100);
}

async function onClick() {
	if (!("showDirectoryPicker" in window)) {
		notSupportedMessage();
		return;
	}
	
	const folder = await showDirectoryPicker({ mode: "readwrite" });
	onDrop(folder);
}

</script>
<svelte:body on:dragover|preventDefault={onDrag} />

<!-- svelte-ignore a11y-click-events-have-key-events -->
<div
	class:isDragging
	class:isOverlay={overlay}

	on:drop|preventDefault={dropHandler}
	on:click={onClick}
>
	<slot></slot>
</div>

<style>
div {
	display: grid;
	overflow: hidden;
	padding: 1em;
	transition: opacity .1s ease;
}

div::after {
	content: "";
	position: absolute;
	inset: 1em;

	border: .2em dashed currentColor;
	border-radius: .5em;
	transition: border-color .1s ease;
}

.isDragging::after {
	border-color: var(--helion-color-accent);
}

.isOverlay {
	opacity: 0;
	background-color: var(--helion-color-backdrop-background);
	pointer-events: none;
}

.isOverlay.isDragging  {
	opacity: .95;
	pointer-events: all;
}
</style>