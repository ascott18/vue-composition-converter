<script lang="ts">
declare global {
  interface Window {
    __converterLastInput?: string;
  }
}
</script>

<script lang="ts" setup>
import { ref, watch, watchEffect } from "vue";
import prettier from "prettier";
import parserTypeScript from "prettier/parser-typescript";
import parserHtml from "prettier/parser-html";
import hljs from "highlight.js/lib/core";
import typescript from "highlight.js/lib/languages/typescript";
import "highlight.js/styles/atom-one-dark.css";
import { convertSrc } from "../lib/converter";
import classApi from "../assets/template/classAPI.txt?raw";
import optionsApi from "../assets/template/optionsAPI.txt?raw";

hljs.registerLanguage("typescript", typescript);

const templateMap = new Map([
  ["optionsAPI", optionsApi],
  ["classAPI", classApi],
]);

const input = ref(window.__converterLastInput || "");
const output = ref("");
const hasError = ref(false);
const templateKeys = Array.from(templateMap.keys());

const selectedTemplate = ref(templateKeys[1]);
watch(
  selectedTemplate,
  async () => {
    hasError.value = false;

    try {
      input.value = templateMap.get(selectedTemplate.value) || "";
      console.log(input.value);
    } catch (err) {
      hasError.value = true;
      console.error(err);
    }
  },
  { immediate: !window.__converterLastInput }
);

watchEffect(() => {
  try {
    // Make hot reload experience better by remember the last input
    window.__converterLastInput = input.value;

    hasError.value = false;
    let outputText = "";
    try {
      outputText = convertSrc(input.value);
    } catch (e) {
      output.value = "";
      throw e;
    }
    const prettifiedHtml = hljs.highlightAuto(
      prettier.format(outputText, {
        parser: "html",
        plugins: [parserTypeScript, parserHtml],
      })
    ).value;
    output.value = prettifiedHtml;
  } catch (err) {
    hasError.value = true;
    console.error(err);
  }
});
</script>

<template>
  <div class="flex flex-row h-full">
    <div class="flex-1 flex flex-col">
      <div class="flex flex-row">
        <h2>Input: (Vue2)</h2>
        <div style="flex-grow: 1"></div>
        Template:
        <select
          v-model="selectedTemplate"
          class="mx-2"
          style="background: #222; color: white"
        >
          <option v-for="templateItem in templateKeys" :key="templateItem">
            {{ templateItem }}
          </option>
        </select>
      </div>
      <textarea
        class="border w-full text-xs leading-3 flex-1 p-2"
        style="background: transparent"
        :class="{ hasError }"
        v-model="input"
      ></textarea>
    </div>
    <div class="flex-1 flex flex-col">
      <h2>Output: (Vue3 / Script Setup)</h2>
      <pre
        class="hljs border w-full text-xs leading-3 flex-1 p-2 whitespace-pre-wrap select-all"
        v-html="output"
      />
    </div>
    <div
      class="absolute right-2 top-2 w-16 h-16 bg-white rounded-full p-2 hover:bg-yellow-400"
    >
      <a
        href="https://github.com/ascott18/vue-composition-converter"
        target="_blank"
        title="repository"
      >
        <img src="../assets/GitHub-Mark-64px.png" />
      </a>
    </div>
  </div>
</template>

<style scoped>
.hasError {
  @apply border-4 border-red-500 outline-none;
}
</style>
