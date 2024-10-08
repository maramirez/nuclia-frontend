<svelte:options
  customElement="nuclia-popup"
  accessors />

<script lang="ts">
  import { onMount } from 'svelte';
  import SearchBar from '../search-widget/SearchBar.svelte';
  import SearchResults from '../search-widget/SearchResults.svelte';
  import { isEmptySearchQuery, pendingResults, showResults } from '../../core';
  import type { KBStates } from '@nuclia/core';

  export let backend = 'https://nuclia.cloud/api';
  export let zone = 'europe-1';
  export let knowledgebox: string;
  export let placeholder = '';
  export let lang = '';
  export let cdn = '';
  export let apikey = '';
  export let account = '';
  export let client = 'widget';
  export let state: KBStates = 'PUBLISHED';
  export let features = '';
  export let standalone = false;
  export let proxy = false;
  export let filters = '';
  export let preselected_filters = '';
  export let cssPath = '';
  export let prompt = '';
  export let system_prompt = '';
  export let generativemodel = '';
  export let no_tracking = false;
  export let rag_strategies = '';
  export let rag_image_strategies = '';
  export let not_enough_data_message = '';
  export let ask_to_resource = '';
  export let max_tokens: number | undefined = undefined;
  export let max_output_tokens: number | undefined = undefined;
  export let max_paragraphs: number | undefined = undefined;
  export let query_prepend = '';
  export let json_schema = '';
  export let vectorset = '';

  let searchBar: any;
  let visible = false;

  export function search(query: string, filters?: string[]) {
    visible = true;
    setTimeout(() => searchBar?.search(query, filters), 0);
  }

  function enablePopupTrigger() {
    const searchButtons = document.querySelectorAll('[data-nuclia="search-widget-button"]');
    if (searchButtons.length > 0) {
      searchButtons.forEach((button) => button.addEventListener('click', toggleSearchVisibility));
      return true;
    } else {
      return false;
    }
  }

  onMount(() => {
    const firstTry = enablePopupTrigger();
    if (!firstTry) {
      setTimeout(() => {
        const secondTry = enablePopupTrigger();
        if (!secondTry) {
          console.info(
            `No button found to open Nuclia’s search widget. Make sure you added 'data-nuclia="search-widget-button"' to a clickable element.`,
          );
        }
      }, 1000);
    }
  });

  function toggleSearchVisibility() {
    visible = !visible;
  }

  function onBackdropKeyup(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      toggleSearchVisibility();
    }
  }

  function onBackdropClick(event: MouseEvent) {
    if ((event.target as HTMLElement).classList.contains('backdrop')) {
      toggleSearchVisibility();
    }
  }
</script>

<div
  class="nuclia-widget"
  data-version="__NUCLIA_DEV_VERSION__">
  {#if visible}
    <div
      class="backdrop"
      on:keyup={onBackdropKeyup}
      on:click={onBackdropClick}>
      <div
        class="search-container"
        class:with-results={$showResults && !$isEmptySearchQuery}
        class:pending-results={$pendingResults}>
        <div class="search-bar-container">
          <SearchBar
            bind:this={searchBar}
            {backend}
            {zone}
            {knowledgebox}
            {placeholder}
            {lang}
            {cdn}
            {apikey}
            {account}
            {client}
            {state}
            {features}
            {standalone}
            {proxy}
            {filters}
            {preselected_filters}
            {cssPath}
            {prompt}
            {system_prompt}
            {generativemodel}
            {no_tracking}
            {rag_strategies}
            {rag_image_strategies}
            {not_enough_data_message}
            {ask_to_resource}
            {max_tokens}
            {max_output_tokens}
            {max_paragraphs}
            {query_prepend}
            {json_schema}
            {vectorset} />
        </div>
        <div class="search-results-container">
          <SearchResults />
        </div>
      </div>
    </div>
  {/if}
</div>

<style
  lang="scss"
  src="./PopupWidget.scss"></style>
