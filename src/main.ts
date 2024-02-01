import { createApp } from "vue";
import App from "./App.vue";
import "./index.css";

createApp(App).mount("#app");

declare global {
  interface Window {
    __converterLastInput?: string;
  }
}
