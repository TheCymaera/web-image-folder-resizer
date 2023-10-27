<script lang="ts">
export let onDrop: (file: FileSystemDirectoryHandle[]) => void;
export let overlay = false;
export let isDragging = false;

function notSupportedMessage() {
	alert("This browser does not support the File System Access API. Please use a Chromium browser such as Google Chrome, Microsoft Edge, or Opera.");
}

async function dropHandler(ev: DragEvent) {
  if (ev.dataTransfer?.items) {

		const out: FileSystemDirectoryHandle[] = [];
		for (const item of ev.dataTransfer.items) {
			if (!("getAsFileSystemHandle" in item)) {
				notSupportedMessage();
				return;
			}

			const file = await item.getAsFileSystemHandle();
			if (!file) continue;
			if (file.kind === "directory") {
				out.push(file as FileSystemDirectoryHandle);
			}
		}

		onDrop(out);
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
	onDrop([folder]);
}

</script>
<svelte:body on:dragover|preventDefault={onDrag} />

<!-- svelte-ignore a11y-click-events-have-key-events -->
<div
	class="
		grid overflow-hidden p-4 transition-opacity duration-100 ease-in-out
		{overlay ? "opacity-0 bg-surface text-onSurface pointer-events-none" : ""}
		{overlay && isDragging ? "!opacity-95 !pointer-events-auto" : ""}
	"

	on:drop|preventDefault={dropHandler}
	on:click={onClick}
>
	<div class="
		absolute inset-4 border-2 border-dashed rounded-md grid place-items-center transition-colors duration-100 ease-in-out
		{isDragging ? "border-primary-500" : "border-[currentColor]"}
	" />
	<slot></slot>
</div>