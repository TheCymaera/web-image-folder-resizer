<script lang="ts">
	export let value: string;
	export let label = "";
	export let placeholder = "";
	export let readonly = false;
	export let hint = "";
	export let error = "";
	export let nullValue = 0;

	let classes = "";
	export { classes as class };
</script>

<label class="block {classes}">
	<div class="pl-1">{label}</div>
	<div>
		<input 
			type="text"
			inputmode="numeric"
			class="
				w-full p-2 border-[.08rem] border-divider rounded-md 
				outline-none 
				outline-[3px] outline-offset-[-3px]
				focus:outline-primary-500 focus:border-primary-500
			"
			disabled={readonly} 
			placeholder="{placeholder || nullValue.toString()}"
			bind:value={value} 
		/>
		<div class="absolute right-0 top-0 h-full grid">
			<slot name="trailingIcon" />
		</div>
	</div>
	<output class="pl-1" style:display={(error || hint) ? "" : "none"}>
		<small class="whitespace-pre {error ? "text-red-500" : ""}">{error || hint}</small>
	</output>
</label>