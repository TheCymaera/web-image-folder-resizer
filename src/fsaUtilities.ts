export async function *entries(folder: FileSystemDirectoryHandle): AsyncGenerator<[string[], FileSystemHandle]> {
	for await (const [name, entry] of folder) {
		if (entry.kind === 'directory') {
			for await (const [path, subentry] of entries(entry)) {
				yield [[name, ...path], subentry];
			}
		} else {
			yield [[name], entry];
		}
	}
}

export async function getDirectoryHandle(
	folder: FileSystemDirectoryHandle,
	path: string[], 
	options?: FileSystemGetDirectoryOptions
): Promise<FileSystemDirectoryHandle> {
	if (path.length === 0) {
		return folder;
	}
	const [name, ...rest] = path;
	const subfolder = await folder.getDirectoryHandle(name!, options);
	return getDirectoryHandle(subfolder, rest, options);
}

export async function getFileHandle(
	folder: FileSystemDirectoryHandle,
	path: string[], 
	directoryOptions?: FileSystemGetDirectoryOptions,
	options?: FileSystemGetFileOptions
): Promise<FileSystemFileHandle> {
	if (path.length === 0) {
		throw new Error('Path must not be empty');
	}

	const [name, ...rest] = path;
	if (rest.length === 0) {
		return folder.getFileHandle(name!, options);
	}
	const subfolder = await folder.getDirectoryHandle(name!, directoryOptions);
	return getFileHandle(subfolder, rest, directoryOptions, options);
}