<script>
	import Pdf from 'src/Pdf/Pdf/Pdf.svelte';
</script>

<div class="layout">
	<Pdf />
	<slot />
</div>

<style>
	.layout {
		display: flex;
		align-items: center;
		flex-direction: column;
	}
</style>
